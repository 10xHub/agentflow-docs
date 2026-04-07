---
title: Environment Variables
description: All environment variables recognized by the AgentFlow API server.
---

# Environment variables

The API server reads configuration from environment variables. Set them in a `.env` file referenced by `agentflow.json` or as process environment variables.

## Setting variables

### Via .env file

In `agentflow.json`:

```json
{
  "agent": "graph.react:app",
  "env": ".env"
}
```

In `.env`:

```bash
GOOGLE_API_KEY=your-key
JWT_SECRET_KEY=your-secret
MODE=production
```

### At the process level

```bash
MODE=production agentflow api --no-reload
```

---

## Application variables

| Variable | Default | Description |
| --- | --- | --- |
| `APP_NAME` | `MyApp` | Application name shown in logs |
| `APP_VERSION` | `0.1.0` | Application version |
| `MODE` | `development` | `development` or `production` |
| `LOG_LEVEL` | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `IS_DEBUG` | `true` | Enable debug mode (disable in production) |

---

## Security variables

| Variable | Default | Description |
| --- | --- | --- |
| `SECURITY_HEADERS_ENABLED` | `true` | Add security headers to all responses |
| `HSTS_ENABLED` | `true` | Add `Strict-Transport-Security` header |
| `HSTS_MAX_AGE` | `31536000` | HSTS max age in seconds |
| `FRAME_OPTIONS` | `DENY` | `X-Frame-Options` value |
| `REFERRER_POLICY` | `strict-origin-when-cross-origin` | `Referrer-Policy` value |

---

## CORS variables

| Variable | Default | Description |
| --- | --- | --- |
| `ORIGINS` | `*` | Comma-separated allowed origins. Set to specific domains in production |
| `ALLOWED_HOST` | `*` | Allowed `Host` header values |

:::warning Production CORS
Setting `ORIGINS=*` in production allows any website to make requests to your API. Always restrict to specific domains in production:

```bash
ORIGINS=https://yourapp.com,https://api.yourapp.com
```
:::

---

## Authentication variables

| Variable | Description | Required for |
| --- | --- | --- |
| `JWT_SECRET_KEY` | Secret key for JWT signing and verification | `auth: "jwt"` |
| `JWT_ALGORITHM` | JWT algorithm (default: `HS256`) | `auth: "jwt"` |

---

## Redis variables

| Variable | Description | Required for |
| --- | --- | --- |
| `REDIS_URL` | Redis connection URL | `PgCheckpointer` |

Example: `redis://localhost:6379/0`

---

## Request limits

| Variable | Default | Description |
| --- | --- | --- |
| `MAX_REQUEST_SIZE` | `10485760` (10MB) | Maximum request body size in bytes |

---

## API path variables

| Variable | Default | Description |
| --- | --- | --- |
| `ROOT_PATH` | `/` | Root path prefix (useful for reverse proxy sub-paths) |
| `DOCS_PATH` | `/docs` | Swagger UI path (set to empty to disable) |
| `REDOCS_PATH` | `/redocs` | ReDoc path (set to empty to disable) |

:::tip Disable docs in production
Consider disabling API docs in production by clearing `DOCS_PATH` and `REDOCS_PATH`:

```bash
DOCS_PATH=
REDOCS_PATH=
```
:::

---

## Error tracking

| Variable | Description |
| --- | --- |
| `SENTRY_DSN` | Sentry DSN for error tracking (optional) |
