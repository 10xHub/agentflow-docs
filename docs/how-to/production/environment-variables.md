---
title: Environment Variables — AgentFlow Python AI Agent Framework
sidebar_label: Environment Variables
description: Complete reference for all environment variables read by the AgentFlow server. Covers auth, CORS, logging, security headers, Snowflake IDs, OpenTelemetry, and media storage.
keywords:
  - agentflow environment variables
  - agentflow configuration
  - agentflow production
  - python ai agent framework
---

# Environment variables

This is the complete reference for every environment variable read by the AgentFlow server. Variables are read via `pydantic-settings` at startup. All are optional unless marked required.

Environment variables take precedence over defaults. The `.env` file pointed to by `agentflow.json`'s `env` field is loaded before the graph module is imported, so variables are available during graph initialization.

---

## Application

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `APP_NAME` | `string` | `"MyApp"` | Application name shown in Swagger UI and logs. |
| `APP_VERSION` | `string` | `"0.1.0"` | Application version shown in Swagger UI. |
| `MODE` | `string` | `"development"` | Runtime mode. Set to `"production"` to enable security warnings and disable debug features. Normalized to lowercase. |
| `LOG_LEVEL` | `string` | `"INFO"` | Python logging level: `"DEBUG"`, `"INFO"`, `"WARNING"`, `"ERROR"`, `"CRITICAL"`. |
| `IS_DEBUG` | `bool` | `true` | Enables FastAPI debug mode. Set to `false` in production. |
| `SUMMARY` | `string` | `"Agentflow Backend"` | One-line summary shown in Swagger UI. |

**Production checklist:**

```bash
MODE=production
IS_DEBUG=false
LOG_LEVEL=INFO
```

---

## CORS

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `ORIGINS` | `string` | `"*"` | Allowed CORS origins, comma-separated. The server logs a warning if this is `"*"` when `MODE=production`. |
| `ALLOWED_HOST` | `string` | `"*"` | Allowed host header values. The server logs a warning if this is `"*"` when `MODE=production`. |

**Production values:**

```bash
ORIGINS=https://app.example.com,https://admin.example.com
ALLOWED_HOST=app.example.com
```

---

## API paths

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `ROOT_PATH` | `string` | `"/"` | ASGI root path. Set when the server is mounted at a sub-path behind a reverse proxy (e.g. `"/api/v1"`). |
| `DOCS_PATH` | `string` | `"/docs"` | Path for Swagger UI. Set to empty string `""` to disable. |
| `REDOCS_PATH` | `string` | `"/redocs"` | Path for ReDoc UI. Set to empty string `""` to disable. |

**Disabling docs in production:**

```bash
DOCS_PATH=
REDOCS_PATH=
```

---

## Request limits

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `MAX_REQUEST_SIZE` | `int` | `10485760` | Maximum request body size in bytes (default 10 MB). Requests exceeding this size are rejected with 413. |

---

## Security headers

These variables control the `SecurityHeadersMiddleware` that is applied to every response.

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `SECURITY_HEADERS_ENABLED` | `bool` | `true` | Toggle all security headers on or off. |
| `HSTS_ENABLED` | `bool` | `true` | Add `Strict-Transport-Security` header. |
| `HSTS_MAX_AGE` | `int` | `31536000` | HSTS max-age in seconds (default 1 year). |
| `HSTS_INCLUDE_SUBDOMAINS` | `bool` | `true` | Add `includeSubDomains` to HSTS header. |
| `HSTS_PRELOAD` | `bool` | `false` | Add `preload` directive to HSTS header. Enable only after submitting to the HSTS preload list. |
| `FRAME_OPTIONS` | `string` | `"DENY"` | `X-Frame-Options` value: `"DENY"`, `"SAMEORIGIN"`, or `"ALLOW-FROM <uri>"`. |
| `CONTENT_TYPE_OPTIONS` | `string` | `"nosniff"` | `X-Content-Type-Options` value. |
| `XSS_PROTECTION` | `string` | `"1; mode=block"` | `X-XSS-Protection` value. |
| `REFERRER_POLICY` | `string` | `"strict-origin-when-cross-origin"` | `Referrer-Policy` value. |
| `PERMISSIONS_POLICY` | `string \| null` | `null` | `Permissions-Policy` header value. Uses a secure default when `null`. |
| `CSP_POLICY` | `string \| null` | `null` | `Content-Security-Policy` header value. Uses a secure default when `null`. |

---

## Redis

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `REDIS_URL` | `string \| null` | `null` | Redis connection URL. Used by components that need Redis if not set elsewhere. Example: `redis://localhost:6379/0`. |

---

## Authentication (JWT)

Required when `"auth": "jwt"` is set in `agentflow.json`.

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `JWT_SECRET_KEY` | `string \| null` | `null` | **Required for JWT auth.** Secret used to verify token signatures. Use a random 32+ character string in production. |
| `JWT_ALGORITHM` | `string` | `"HS256"` | JWT signing algorithm. Supports any algorithm accepted by PyJWT (`"HS256"`, `"HS384"`, `"HS512"`, `"RS256"`, etc.). |

The server raises `ValueError` at startup if `JWT_SECRET_KEY` or `JWT_ALGORITHM` is missing when JWT auth is configured.

---

## Snowflake ID generation

Snowflake IDs are used by the server to generate distributed, time-ordered thread and message identifiers.

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `SNOWFLAKE_EPOCH` | `int` | `1609459200000` | Custom epoch in milliseconds (default: 2021-01-01 00:00:00 UTC). |
| `SNOWFLAKE_NODE_ID` | `int` | `1` | Node (datacenter) identifier. Change per datacenter in multi-datacenter deployments. |
| `SNOWFLAKE_WORKER_ID` | `int` | `2` | Worker identifier. Change per server instance to avoid ID collisions in multi-instance deployments. |
| `SNOWFLAKE_TIME_BITS` | `int` | `39` | Number of bits used for timestamp. |
| `SNOWFLAKE_NODE_BITS` | `int` | `5` | Number of bits used for node ID. |
| `SNOWFLAKE_WORKER_BITS` | `int` | `8` | Number of bits used for worker ID. |

In a multi-instance deployment behind a load balancer, set unique `SNOWFLAKE_NODE_ID` and `SNOWFLAKE_WORKER_ID` values per instance to prevent ID collisions.

---

## OpenTelemetry

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `OTEL_ENABLED` | `bool` | `false` | Enable OpenTelemetry tracing. |
| `OTEL_SERVICE_NAME` | `string` | `"agentflow-api"` | Service name reported in traces. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `string \| null` | `null` | OTLP gRPC or HTTP endpoint for trace export (e.g. `http://otel-collector:4318`). |
| `OTEL_LEVEL` | `string` | `"standard"` | Tracing granularity: `"spans"` (coarse), `"standard"` (recommended), `"full"` (verbose). |

---

## Media / file storage

These variables configure the media storage backend for file uploads (`/v1/files/...`).

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `MEDIA_STORAGE_TYPE` | `string` | `"local"` | Where files are stored: `"memory"` (no persistence), `"local"` (disk), `"cloud"` (S3/GCS), `"pg"` (PostgreSQL). |
| `MEDIA_STORAGE_PATH` | `string` | `"./uploads"` | Local directory path when `MEDIA_STORAGE_TYPE=local`. |
| `MEDIA_MAX_SIZE_MB` | `float` | `25.0` | Maximum upload size in MB. Uploads exceeding this return 413. |
| `DOCUMENT_HANDLING` | `string` | `"extract_text"` | How uploaded documents are processed: `"extract_text"` (extract for graph context), `"pass_raw"` (store raw), `"skip"` (store but do not process). |

### Cloud storage (S3 / GCS)

Used when `MEDIA_STORAGE_TYPE=cloud`.

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `MEDIA_CLOUD_PROVIDER` | `string` | `"aws"` | Cloud provider: `"aws"` (S3) or `"gcp"` (GCS). |
| `MEDIA_CLOUD_BUCKET` | `string` | `""` | Bucket name. Required when using cloud storage. |
| `MEDIA_CLOUD_REGION` | `string` | `"us-east-1"` | AWS region or GCP region. |
| `MEDIA_CLOUD_PREFIX` | `string` | `"agentflow-media"` | Object key prefix within the bucket. |
| `MEDIA_CLOUD_ACCESS_KEY_ID` | `string \| null` | `null` | AWS access key ID. Omit to use instance role / environment credentials. |
| `MEDIA_CLOUD_SECRET_ACCESS_KEY` | `string \| null` | `null` | AWS secret access key. |
| `MEDIA_CLOUD_SESSION_TOKEN` | `string \| null` | `null` | AWS STS session token for temporary credentials. |
| `MEDIA_CLOUD_PROJECT_ID` | `string \| null` | `null` | GCP project ID. |
| `MEDIA_CLOUD_CREDENTIALS_JSON` | `string \| null` | `null` | GCP service account credentials JSON (as a string). |
| `MEDIA_SIGNED_URL_TTL_SECONDS` | `int` | `3600` | Pre-signed URL lifetime in seconds for cloud storage. |
| `MEDIA_SIGNED_URL_REFRESH_BUFFER_SECONDS` | `int` | `60` | Seconds before expiry at which URLs are refreshed. |

---

## Error monitoring

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `SENTRY_DSN` | `string \| null` | `null` | Sentry DSN for error tracking. When set, Sentry captures unhandled exceptions. |

---

## LLM provider

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | `string` | — | API key for the OpenAI provider. |
| `GEMINI_API_KEY` | `string` | — | API key for the Google Gemini API (preferred over `GOOGLE_API_KEY`). |
| `GOOGLE_API_KEY` | `string` | — | Fallback name for the Gemini API key. |
| `AGENTFLOW_LLM_TIMEOUT` | `float` | `600.0` | Default request timeout in seconds applied to every LLM client. Override with `set_default_llm_timeout()` at runtime. Must be a positive number. |

---

## Production checklist

Minimum variables to set before a public deployment:

```bash
# Runtime
MODE=production
IS_DEBUG=false

# Security
JWT_SECRET_KEY=<random-32+-char-string>   # only if using JWT auth
ORIGINS=https://yourapp.com
ALLOWED_HOST=yourapp.com

# Disable docs (optional but recommended)
DOCS_PATH=
REDOCS_PATH=

# Distributed IDs — set unique values per instance
SNOWFLAKE_NODE_ID=1
SNOWFLAKE_WORKER_ID=1

# Media storage (for file uploads)
MEDIA_STORAGE_TYPE=local          # or cloud
MEDIA_STORAGE_PATH=/data/uploads  # writable directory in your container

# Redis (if using Redis rate limiting or Redis-backed checkpointer)
REDIS_URL=redis://redis:6379/0
```
