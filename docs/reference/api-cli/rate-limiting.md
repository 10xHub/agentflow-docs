---
title: Rate Limiting
description: Complete reference for the rate_limit block in agentflow.json.
---

# Rate limiting reference

The `rate_limit` block in `agentflow.json` activates AgentFlow's built-in sliding-window
rate limiter. The limiter is disabled by default — remove the block or set it to `null`
to turn it off.

## Configuration fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Enables the middleware when the `rate_limit` block exists. Set to `false` to temporarily disable without removing the block. |
| `backend` | string | `"memory"` | Counter storage. `"memory"`, `"redis"`, or `"custom"`. |
| `requests` | integer | `100` | Maximum requests allowed within each window. |
| `window` | integer | `60` | Window size in seconds. |
| `by` | string | `"ip"` | Bucket key. `"ip"`, `"user"`, or `"global"`. See [Bucket keys](#bucket-keys). |
| `exclude_paths` | string array | `[]` | Request paths that bypass rate limiting entirely. |
| `trusted_proxy_headers` | boolean | `false` | Use `X-Forwarded-For` to resolve the client IP. Only enable behind a proxy you control. |
| `trusted_proxy_hops` | integer | `1` | How many proxies of your own sit in front of the app. See [Proxy hops](#proxy-hops). Must be `>= 1`. |
| `redis.url` | string | `null` | Redis connection URL. Required for the `"redis"` backend. Supports `${ENV_VAR}` expansion. |
| `redis.prefix` | string | `"agentflow:rate-limit"` | Key prefix used for all Redis entries. |
| `fail_open` | boolean | `true` | When `true`, requests are allowed if the Redis backend is unreachable. When `false`, they are denied. Only applies to the `"redis"` backend. |

Invalid values are rejected at config load: `by` outside `ip`/`user`/`global`, `backend` outside `memory`/`redis`/`custom`, a non-positive `requests` or `window`, or `trusted_proxy_hops` below `1` all raise a `ValueError` and stop the server from starting.

## Bucket keys

`by` decides which bucket a request is counted against.

| `by` | Key | Notes |
| --- | --- | --- |
| `"ip"` | the resolved client address | The default. One bucket per client address. |
| `"user"` | `user:<user_id>` | One bucket per authenticated user. Falls back to `ip:<address>` when there is no authenticated user, so anonymous traffic is still limited per caller rather than sharing one bucket everybody can exhaust. |
| `"global"` | `__global__` | One bucket for the whole service. |

`"user"` is what you want once auth is enabled. Limiting purely by IP gives a single user roaming between addresses an effectively unlimited budget, while a NAT'd office sharing one address gets throttled as though it were one caller.

## Proxy hops

`X-Forwarded-For` is a list that each proxy **appends** to. Whatever the caller sent arrives at the left of the list; only the entries your own proxies appended, on the right, are trustworthy. Reading the leftmost entry would let a caller send a different value on every request, land in a fresh bucket each time, and never be limited at all.

`trusted_proxy_hops` is how many entries, counted from the **right**, your own infrastructure appended. With the default of `1` (one proxy in front of the app) the last entry is the address that proxy actually observed. If the header carries fewer entries than the configured hop count, the header is ignored entirely and the peer address is used, with a warning.

`trusted_proxy_hops` only has an effect when `trusted_proxy_headers` is `true`.

## WebSocket handshakes

Rate limiting is HTTP middleware, and Starlette runs middleware for HTTP scopes only, so WebSocket handshakes would otherwise bypass it. `WS /v1/graph/ws` and `WS /v1/graph/live` therefore re-apply the check at the handshake, using the **same backend and the same bucket** as REST requests. Opening a socket counts exactly like any other request; exceeding the limit refuses the handshake with WebSocket close code `1013` (Try Again Later) before `accept()`.

The separate [`websocket.max_connections`](./configuration.md#websocket) cap is enforced at the same point and uses the same close code.

## Minimal example

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

## Full Redis example

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

```bash
# .env
RATE_LIMIT_REDIS_URL=redis://localhost:6379/0
```

Install the Redis extra before using `"backend": "redis"`:

```bash
pip install "10xscale-agentflow-cli[redis]"
```

## Backend comparison

| Backend | When to use |
| --- | --- |
| `memory` | Local development, tests, demos, single-process services |
| `redis` | Production: Gunicorn/Uvicorn with multiple workers, Docker/Kubernetes |
| `custom` | Custom storage, external quota services, non-standard enforcement |

:::warning The memory backend counts per process
Enabling the `memory` backend logs a startup warning. It keeps counters in process memory, so with N workers the effective limit is `requests x N`, and every counter resets when a worker restarts. Use the `redis` backend for any multi-worker deployment.
:::

## Response headers

Every response includes rate-limit headers:

| Header | Description |
| --- | --- |
| `X-RateLimit-Limit` | Configured request limit |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp for the window reset estimate |
| `X-RateLimit-Reset-After` | Seconds until the window resets |
| `Retry-After` | Present on `429` responses only |

## 429 response body

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
    "request_id": "request-id",
    "status": "error"
  }
}
```

## Custom backend interface

```python
from agentflow_cli.src.app.core.middleware.rate_limit import (
    BaseRateLimitBackend,
    RateLimitDecision,
)


class MyRateLimitBackend(BaseRateLimitBackend):
    async def check(self, key: str, *, limit: int, window: int) -> RateLimitDecision:
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

Set `"backend": "custom"` in `agentflow.json` and bind the instance through InjectQ.

## See also

- [Configure Rate Limiting](../../how-to/api-cli/configure-rate-limiting.md) — step-by-step setup guide
- [agentflow.json configuration](./configuration.md)
- [Environment variables](./environment.md)
