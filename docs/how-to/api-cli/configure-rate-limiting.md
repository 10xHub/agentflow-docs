---
title: Configure Rate Limiting
description: How to enable and configure the built-in sliding-window rate limiter in the AgentFlow API.
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

### Global (one shared quota for all clients)

```json
{
  "rate_limit": { "requests": 5000, "window": 60, "by": "global" }
}
```

## Behind a reverse proxy

If your API runs behind nginx, a load balancer, or a cloud gateway, the real client IP
is forwarded in the `X-Forwarded-For` header. Set `trusted_proxy_headers: true` to use
that header instead of the direct connection IP.

:::warning Only enable this behind a trusted proxy
A client can spoof `X-Forwarded-For` to bypass per-IP limits unless your proxy strips the
header from untrusted sources before forwarding.
:::

```json
{
  "rate_limit": {
    "backend": "redis",
    "requests": 1000,
    "window": 60,
    "by": "ip",
    "trusted_proxy_headers": true
  }
}
```

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
