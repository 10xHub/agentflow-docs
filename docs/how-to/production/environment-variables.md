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
| `LOGGER_NAME` | `string` | `"agentflow-cli"` | Name of the root logger the server writes under. Read at module import time, so it must be a process environment variable; setting it in `.env` is too late to take effect. |
| `GRAPH_PATH` | `string` | `"agentflow.json"` | Path to the config file the ASGI app loads at import. `agentflow api --config` sets this for you. Set it explicitly when running the app under an external server such as Gunicorn. |

The settings model allows extra fields, so unrecognised variables in the environment are tolerated rather than rejected at startup.

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
| `CORS_ALLOW_CREDENTIALS` | `bool` | `true` | Whether cross-origin requests may carry cookies or auth headers. |

**Production values:**

```bash
ORIGINS=https://app.example.com,https://admin.example.com
ALLOWED_HOST=app.example.com
```

:::danger Wildcard origins plus credentials is a hard startup failure
`ORIGINS="*"` on its own is fine for a public, token-less API. The dangerous case is wildcard origins **combined with** credentials: Starlette reflects the caller's `Origin` back alongside `Access-Control-Allow-Credentials: true`, which turns every origin into a trusted, credentialed one.

With `MODE=production` that combination raises `InsecureCorsConfigError` and the server does not start. Two ways forward:

```bash
# 1. Name the origins explicitly
ORIGINS=https://app.example.com,https://admin.example.com
```

```bash
# 2. Or serve a public, non-credentialed API from any origin
CORS_ALLOW_CREDENTIALS=false
```

In development the same combination only logs a warning, so this failure typically appears the first time a working local config is promoted to production.
:::

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
| `REDIS_URL` | `string \| null` | `null` | Redis connection URL. Example: `redis://localhost:6379/0`. |

`REDIS_URL` is optional everywhere; nothing requires it. Two things use it:

- **The ownership authorization cache (L2).** The `ownership` and `rbac` backends read the `redis` key in `agentflow.json` first and fall back to this variable. With neither set, or with the `redis` package not installed, the cache runs in-process only and logs a warning at startup.
- **`PgCheckpointer`.** It can use Redis as a hot cache in front of Postgres. That is a performance choice, not a requirement.

The rate limiter does **not** read `REDIS_URL`. Configure its connection under `rate_limit.redis.url` in `agentflow.json`.

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

Snowflake IDs give distributed, time-ordered thread and message identifiers. They apply when your graph uses `SnowFlakeIdGenerator`, which needs the `snowflakekit` extra.

These are the values the generator actually reads, straight from `os.environ`, and only when it is constructed with no arguments:

| Variable | Type | Default | Description |
| --- | --- | --- | --- |
| `SNOWFLAKE_EPOCH` | `int` | `1723323246031` | Custom epoch in milliseconds. |
| `SNOWFLAKE_TOTAL_BITS` | `int` | `64` | Total bits in the generated id. |
| `SNOWFLAKE_TIME_BITS` | `int` | `39` | Bits reserved for the timestamp. |
| `SNOWFLAKE_NODE_BITS` | `int` | `7` | Bits reserved for the node id. |
| `SNOWFLAKE_NODE_ID` | `int` | `0` | Node (datacenter) identifier. Change per datacenter in multi-datacenter deployments. |
| `SNOWFLAKE_WORKER_BITS` | `int` | `5` | Bits reserved for the worker id. |
| `SNOWFLAKE_WORKER_ID` | `int` | `0` | Worker identifier. Change per server instance to avoid id collisions. |

In a multi-instance deployment behind a load balancer, set unique `SNOWFLAKE_NODE_ID` and `SNOWFLAKE_WORKER_ID` values per instance to prevent id collisions.

:::caution Two conflicting sets of SNOWFLAKE_* defaults exist
The server's `Settings` model also declares `SNOWFLAKE_*` fields, with different defaults: `SNOWFLAKE_EPOCH=1609459200000`, `SNOWFLAKE_NODE_ID=1`, `SNOWFLAKE_WORKER_ID=2`, `SNOWFLAKE_NODE_BITS=5`, `SNOWFLAKE_WORKER_BITS=8`, and no `SNOWFLAKE_TOTAL_BITS` at all. The generator never reads that model.

The table above is what takes effect. Set every variable explicitly rather than relying on either set of defaults, and do not infer the generator's behaviour from `get_settings()`.
:::

The generator's constructor is also all-or-nothing: pass no arguments (environment-driven) or all seven. A partial call silently discards your values. See [ID Generator](/docs/reference/api-cli/id-generator).

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
| `MEDIA_ALLOWED_CONTENT_TYPES` | `string` | `""` | Comma-separated MIME allowlist for uploads. **Empty, the default, allows every type.** Entries may be exact (`image/png`) or wildcard subtype (`image/*`). A rejected upload returns 415. |

Restrict the allowlist before exposing uploads to untrusted callers:

```bash
MEDIA_ALLOWED_CONTENT_TYPES=image/*,application/pdf
```

Document text extraction needs the extra: `pip install "10xscale-agentflow-cli[media]"`. See [Multimodal and vision](./multimodal-and-vision.md).

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
ORIGINS=https://yourapp.com               # never "*" together with credentials
CORS_ALLOW_CREDENTIALS=true
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
MEDIA_ALLOWED_CONTENT_TYPES=image/*,application/pdf   # empty allows everything

# Redis (if using Redis rate limiting or Redis-backed checkpointer)
REDIS_URL=redis://redis:6379/0
```
