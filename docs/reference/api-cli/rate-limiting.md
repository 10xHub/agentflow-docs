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
| `by` | string | `"ip"` | Scope of the limit. `"ip"` for per-client limits; `"global"` for one shared quota. |
| `exclude_paths` | string array | `[]` | Request paths that bypass rate limiting entirely. |
| `trusted_proxy_headers` | boolean | `false` | Use `X-Forwarded-For` as the client IP. Only enable behind a proxy that strips this header from untrusted clients. |
| `redis.url` | string | `null` | Redis connection URL. Required for the `"redis"` backend. Supports `${ENV_VAR}` expansion. |
| `redis.prefix` | string | `"agentflow:rate-limit"` | Key prefix used for all Redis entries. |
| `fail_open` | boolean | `true` | When `true`, requests are allowed if the Redis backend is unreachable. When `false`, they are denied. Only applies to the `"redis"` backend. |

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
