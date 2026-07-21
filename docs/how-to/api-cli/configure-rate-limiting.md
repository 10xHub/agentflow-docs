---
title: Configure Rate Limiting
description: How to enable and configure the built-in sliding-window rate limiter in the AgentFlow API.
keywords:
  - rate limiting agentflow
  - sliding window rate limiter
  - agentflow.json rate_limit
  - redis rate limiting
  - 429 too many requests
---

# Configure rate limiting

By default, the AgentFlow API accepts unlimited requests. This guide shows how to enable
the built-in sliding-window rate limiter to protect your API from overuse or abuse.

## How it works

The rate limiter is middleware that runs before every request. It counts requests per
client (or globally) inside a rolling time window and returns `429 Too Many Requests`
when the limit is exceeded. The limit is never active until you add a `rate_limit` block
to `agentflow.json`.

## Method 1: In-memory backend (development / single process)

The simplest setup stores counters in the process memory. It works with a single Uvicorn
worker and requires no extra dependencies.

**Update `agentflow.json`:**

```json
{
  "agent": "graph.react:app",
  "rate_limit": {
    "enabled": true,
    "backend": "memory",
    "requests": 100,
    "window": 60,
    "by": "ip",
    "exclude_paths": ["/health", "/docs", "/redoc", "/openapi.json"]
  }
}
```

Each client IP can make up to `100` requests every `60` seconds. Health-check and
documentation paths are excluded so monitoring and browser access are not affected.

:::warning The memory backend logs a warning, and it means it
Selecting `"backend": "memory"` logs this at startup:

> Rate limiting uses the in-memory backend. It counts per process, so with N workers the real
> limit is requests x N and it resets on every worker restart.

Counters live in process memory. Run four workers and the real limit is `400` per window, not
`100`, and a rolling restart resets everything. Use Redis for anything with more than one worker.
:::

## Method 2: Redis backend (production / multi-process)

When you run multiple Uvicorn workers, containers, or servers, each process would have
its own in-memory counter. Use Redis to store counters centrally so the limit is enforced
across the whole deployment.

### Install the Redis extra

```bash
pip install "10xscale-agentflow-cli[redis]"
```

### Update `agentflow.json`

```json
{
  "agent": "graph.react:app",
  "rate_limit": {
    "enabled": true,
    "backend": "redis",
    "requests": 1000,
    "window": 60,
    "by": "ip",
    "trusted_proxy_headers": true,
    "exclude_paths": ["/health", "/metrics", "/docs", "/redoc", "/openapi.json"],
    "redis": {
      "url": "${RATE_LIMIT_REDIS_URL}",
      "prefix": "agentflow:rate-limit"
    },
    "fail_open": true
  }
}
```

### Set the environment variable

```bash
# .env
RATE_LIMIT_REDIS_URL=redis://localhost:6379/0
```

The `${RATE_LIMIT_REDIS_URL}` placeholder is expanded from the environment at startup —
never commit Redis credentials into `agentflow.json`.

:::tip Atomic enforcement
The Redis backend uses a Lua script with sorted sets. The check and the recording happen
as one atomic Redis operation, which prevents concurrent requests from slipping past the
configured limit.
:::

## Method 3: Custom backend

Implement `BaseRateLimitBackend` when you want to store counters somewhere else (a SQL
database, a distributed cache, or an external rate-limit service).

```python
# graph/rate_limit.py
from agentflow_cli.src.app.core.middleware.rate_limit import (
    BaseRateLimitBackend,
    RateLimitDecision,
)


class MyRateLimitBackend(BaseRateLimitBackend):
    async def check(self, key: str, *, limit: int, window: int) -> RateLimitDecision:
        # Replace with your real logic
        allowed = True
        remaining = limit - 1
        reset_after = window
        return RateLimitDecision(
            allowed=allowed,
            remaining=remaining,
            reset_after=reset_after,
        )

    async def close(self) -> None:
        return None
```

Register it in your InjectQ container and point `backend` to `"custom"`:

```json
{
  "rate_limit": {
    "enabled": true,
    "backend": "custom",
    "requests": 200,
    "window": 60,
    "by": "ip"
  }
}
```

## Identity modes

### Per-IP (recommended for most public APIs)

```json
{
  "rate_limit": { "requests": 100, "window": 60, "by": "ip" }
}
```

### Per-user (recommended once auth is enabled)

```json
{
  "rate_limit": { "requests": 100, "window": 60, "by": "user" }
}
```

One bucket per authenticated `user_id`. This is the right choice as soon as you have auth:
limiting purely by IP gives a single user roaming between addresses an effectively unlimited
budget, while a NAT'd office sharing one address gets throttled as though it were one caller.

Requests with no authenticated user fall back to an `ip:<address>` bucket, so anonymous traffic is
still limited per caller rather than sharing one bucket any single client could exhaust for
everyone.

### Global (one shared quota for all clients)

```json
{
  "rate_limit": { "requests": 5000, "window": 60, "by": "global" }
}
```

## WebSocket handshakes count too

Rate limiting is HTTP middleware, and Starlette runs middleware for HTTP scopes only, so a
WebSocket handshake would otherwise bypass it entirely. `WS /v1/graph/ws` and `WS /v1/graph/live`
therefore re-apply the check at the handshake, against the **same backend and the same bucket** as
REST requests.

Opening a socket costs one request from the client's quota. When the quota is exhausted the
handshake is refused before `accept()` with WebSocket close code `1013` (Try Again Later), not
with an HTTP `429`.

Budget for this when sizing limits for a streaming client: a browser that reconnects on every
network blip spends a request each time.

Concurrent socket count is capped separately by `websocket.max_connections`, which uses the same
close code. See [agentflow.json configuration](../../reference/api-cli/configuration.md#websocket).

## Behind a reverse proxy

If your API runs behind nginx, a load balancer, or a cloud gateway, the real client IP
is forwarded in the `X-Forwarded-For` header. Set `trusted_proxy_headers: true` to use
that header instead of the direct connection IP.

```json
{
  "rate_limit": {
    "backend": "redis",
    "requests": 1000,
    "window": 60,
    "by": "ip",
    "trusted_proxy_headers": true,
    "trusted_proxy_hops": 1
  }
}
```

### Set `trusted_proxy_hops` to match your topology

`X-Forwarded-For` is a list that each proxy **appends** to. Whatever the caller sent arrives at the
left; only the entries your own proxies appended, on the right, are trustworthy.

`trusted_proxy_hops` is how many entries, counted from the right, your own infrastructure
appended. It defaults to `1`, which is correct for a single proxy in front of the app.

| Topology | `trusted_proxy_hops` |
| --- | --- |
| One nginx or one load balancer | `1` |
| CDN in front of a load balancer, both yours | `2` |
| No proxy at all | leave `trusted_proxy_headers` off |

:::warning Getting the hop count wrong defeats the limiter
Reading the leftmost entry, or counting from the wrong end, takes a value the caller fully
controls. An attacker sends a different `X-Forwarded-For` on every request, lands in a fresh
bucket each time, and is never limited at all.

If the header carries fewer entries than the configured hop count, the header is not shaped the
way the server expects, so it is ignored entirely and the peer address is used instead. Watch the
logs for the warning about mismatched hop counts after any change to your proxy layer.
:::

## Excluding paths

Add monitoring, health-check, and documentation paths to `exclude_paths` so they never
count against the rate limit:

```json
{
  "rate_limit": {
    "exclude_paths": ["/health", "/metrics", "/docs", "/redoc", "/openapi.json"]
  }
}
```

## Disabling rate limiting

Remove the `rate_limit` block (or set it to `null`) to disable the middleware entirely:

```json
{
  "agent": "graph.react:app",
  "rate_limit": null
}
```

## What clients see when limited

When the limit is exceeded, the API returns `429 Too Many Requests`:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Limit: 100 per 60s. Retry after 12s.",
    "limit": 100,
    "window_seconds": 60,
    "retry_after_seconds": 12
  },
  "metadata": {
    "request_id": "abc123",
    "status": "error"
  }
}
```

Every response also includes these headers so clients can track their quota:

| Header | Description |
| --- | --- |
| `X-RateLimit-Limit` | Configured request limit |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp for the window reset |
| `X-RateLimit-Reset-After` | Seconds until the window resets |
| `Retry-After` | Seconds to wait before retrying (only on `429`) |

## See also

- [Rate Limiting reference](../../reference/api-cli/rate-limiting.md) — full field reference, response headers, and backend comparison table
- [agentflow.json configuration](../../reference/api-cli/configuration.md)
- [Environment variables](../../reference/api-cli/environment.md)
