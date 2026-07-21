---
title: Environment Variables — CLI reference
sidebar_label: Environment Variables
description: All environment variables recognized by the AgentFlow API server.
keywords:
  - agentflow api reference
  - rest api documentation
  - agent cli reference
  - agentflow
  - python ai agent framework
  - environment variables
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
| `MODE` | `development` | `development` or `production`. Normalized to lowercase. Drives several defaults, including the authorization backend and whether the CORS check is fatal. |
| `LOG_LEVEL` | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `IS_DEBUG` | `true` | Enable debug mode. Set `false` in production; leaving it on logs a startup warning. |
| `SUMMARY` | `Agentflow Backend` | One-line service summary shown in the OpenAPI schema |
| `LOGGER_NAME` | `agentflow-cli` | Name of the root logger the server writes under. Read at import time, so it must be a process environment variable; setting it in `.env` is too late. |
| `GRAPH_PATH` | `agentflow.json` | Path to the config file the ASGI app loads. `agentflow api --config` sets this for you; set it directly when running the app under an external server such as Gunicorn or Uvicorn. |

The settings model allows extra variables, so unknown names in the environment are tolerated
rather than rejected.

---

## Security headers

Applied by the security-headers middleware when `SECURITY_HEADERS_ENABLED` is true.

| Variable | Default | Description |
| --- | --- | --- |
| `SECURITY_HEADERS_ENABLED` | `true` | Add security headers to all responses |
| `HSTS_ENABLED` | `true` | Add `Strict-Transport-Security` |
| `HSTS_MAX_AGE` | `31536000` | HSTS max age in seconds (one year) |
| `HSTS_INCLUDE_SUBDOMAINS` | `true` | Add `includeSubDomains` to the HSTS header |
| `HSTS_PRELOAD` | `false` | Add `preload` to the HSTS header. Only enable if you intend to submit the domain to the preload list; it is hard to undo. |
| `FRAME_OPTIONS` | `DENY` | `X-Frame-Options` value: `DENY`, `SAMEORIGIN`, or `ALLOW-FROM` |
| `CONTENT_TYPE_OPTIONS` | `nosniff` | `X-Content-Type-Options` value |
| `XSS_PROTECTION` | `1; mode=block` | `X-XSS-Protection` value |
| `REFERRER_POLICY` | `strict-origin-when-cross-origin` | `Referrer-Policy` value |
| `PERMISSIONS_POLICY` | `null` | `Permissions-Policy` value. Unset uses the middleware's built-in default. |
| `CSP_POLICY` | `null` | `Content-Security-Policy` value. Unset uses the middleware's built-in default. |

---

## CORS variables

| Variable | Default | Description |
| --- | --- | --- |
| `ORIGINS` | `*` | Comma-separated allowed origins. Set to specific domains in production. |
| `ALLOWED_HOST` | `*` | Allowed `Host` header values |
| `CORS_ALLOW_CREDENTIALS` | `true` | Whether cross-origin requests may carry cookies or auth headers |

:::danger Wildcard origins plus credentials refuses to start in production
`ORIGINS=*` on its own is a legitimate choice for a public, token-less API. The dangerous
combination is wildcard origins **together with** credentials: Starlette reflects the caller's
`Origin` back alongside `Access-Control-Allow-Credentials: true`, which turns every origin into a
trusted, credentialed one.

With `MODE=production`, that combination raises `InsecureCorsConfigError` at startup and the
server does not boot. There are exactly two ways forward:

```bash
# 1. Name the origins explicitly (the usual answer)
ORIGINS=https://yourapp.com,https://api.yourapp.com

# 2. Or serve a public, non-credentialed API from any origin
CORS_ALLOW_CREDENTIALS=false
```

In development the same combination only logs a warning, which tells you the deploy will fail
before it does.
:::

---

## Authentication variables

| Variable | Description | Required for |
| --- | --- | --- |
| `JWT_SECRET_KEY` | Secret key for JWT signing and verification. No default. | `auth: "jwt"` |
| `JWT_ALGORITHM` | JWT algorithm. Default `HS256`. | `auth: "jwt"` |

Both must be set when `agentflow.json` has `"auth": "jwt"`; the config load raises a `ValueError`
otherwise and the server does not start. JWT support also needs the extra:
`pip install "10xscale-agentflow-cli[jwt]"`.

---

## Redis variables

| Variable | Default | Description |
| --- | --- | --- |
| `REDIS_URL` | `null` | Redis connection URL, for example `redis://localhost:6379/0` |

`REDIS_URL` is **optional everywhere**. Two things use it:

- **The ownership authorization cache (L2).** The `ownership` and `rbac` backends resolve their
  Redis URL from the `redis` key in `agentflow.json` first, falling back to `REDIS_URL`. With
  neither set, or with the `redis` package not installed, the cache runs in-process only (L1) and
  the server logs a warning at startup. Nothing breaks; each worker just pays its own first lookup
  per thread.
- **`PgCheckpointer`.** It can use Redis as a hot cache layer in front of Postgres. This is a
  performance choice, not a requirement: `PgCheckpointer` runs without it.

The rate limiter does **not** read `REDIS_URL`. Configure its connection under
`rate_limit.redis.url` in `agentflow.json`.

---

## Snowflake ID variables

Read only by `SnowFlakeIdGenerator`, and only when it is constructed with no arguments.

| Variable | Default | Description |
| --- | --- | --- |
| `SNOWFLAKE_EPOCH` | `1723323246031` | Custom epoch in milliseconds |
| `SNOWFLAKE_TOTAL_BITS` | `64` | Total bits in the generated id |
| `SNOWFLAKE_TIME_BITS` | `39` | Bits reserved for the timestamp |
| `SNOWFLAKE_NODE_BITS` | `7` | Bits reserved for the node id |
| `SNOWFLAKE_NODE_ID` | `0` | This node's id |
| `SNOWFLAKE_WORKER_BITS` | `5` | Bits reserved for the worker id |
| `SNOWFLAKE_WORKER_ID` | `0` | This worker's id |

:::caution Two different sets of SNOWFLAKE_* defaults exist
The settings model also declares `SNOWFLAKE_*` fields, with **different** defaults
(`SNOWFLAKE_EPOCH=1609459200000`, `SNOWFLAKE_NODE_ID=1`, `SNOWFLAKE_WORKER_ID=2`,
`SNOWFLAKE_NODE_BITS=5`, `SNOWFLAKE_WORKER_BITS=8`, and no `SNOWFLAKE_TOTAL_BITS` at all). The
generator never reads that model; it reads `os.environ` directly. The table above is what actually
takes effect.

The practical consequence: reading a default off `get_settings()` will not tell you what ids the
generator produces. Set every variable explicitly in any deployment that runs more than one node
or worker, and never rely on either set of defaults.
:::

See [ID Generator](./id-generator.md) for the constructor contract.

---

## Observability

| Variable | Default | Description |
| --- | --- | --- |
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry tracing |
| `OTEL_SERVICE_NAME` | `agentflow-api` | Service name reported in spans |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `null` | OTLP collector endpoint |
| `OTEL_LEVEL` | `standard` | Trace detail: `spans`, `standard`, or `full` |

OpenTelemetry needs the extra: `pip install "10xscale-agentflow-cli[otel]"`, which also brings the
FastAPI instrumentation and the OTLP exporter.

Logfire and LangSmith are configured through the `observability` block in `agentflow.json`; their
secrets (`LOGFIRE_TOKEN`, `LANGSMITH_API_KEY`) come from the environment.

---

## Media and multimodal

| Variable | Default | Description |
| --- | --- | --- |
| `MEDIA_STORAGE_TYPE` | `local` | `memory`, `local`, `cloud`, or `pg` |
| `MEDIA_STORAGE_PATH` | `./uploads` | Directory used by the `local` store |
| `MEDIA_MAX_SIZE_MB` | `25.0` | Maximum upload size in megabytes |
| `DOCUMENT_HANDLING` | `extract_text` | `extract_text`, `pass_raw`, or `skip` |
| `MEDIA_ALLOWED_CONTENT_TYPES` | `""` | Comma-separated MIME allowlist for uploads. **Empty means allow every type.** Entries may be exact (`image/png`) or wildcard subtype (`image/*`). |
| `MEDIA_CLOUD_PROVIDER` | `aws` | `aws` or `gcp`. Cloud storage only. |
| `MEDIA_CLOUD_BUCKET` | `""` | Bucket name |
| `MEDIA_CLOUD_REGION` | `us-east-1` | Bucket region |
| `MEDIA_CLOUD_PREFIX` | `agentflow-media` | Key prefix inside the bucket |
| `MEDIA_CLOUD_ACCESS_KEY_ID` | `null` | AWS access key |
| `MEDIA_CLOUD_SECRET_ACCESS_KEY` | `null` | AWS secret key |
| `MEDIA_CLOUD_SESSION_TOKEN` | `null` | AWS session token |
| `MEDIA_CLOUD_PROJECT_ID` | `null` | GCP project id |
| `MEDIA_CLOUD_CREDENTIALS_JSON` | `null` | GCP service-account credentials JSON |
| `MEDIA_SIGNED_URL_TTL_SECONDS` | `3600` | Lifetime of a signed direct URL |
| `MEDIA_SIGNED_URL_REFRESH_BUFFER_SECONDS` | `60` | Re-sign this many seconds before expiry |

Document text extraction needs the extra: `pip install "10xscale-agentflow-cli[media]"`.

See [Multimodal and vision](../../how-to/production/multimodal-and-vision.md) for how these fit
together.

---

## Request limits

| Variable | Default | Description |
| --- | --- | --- |
| `MAX_REQUEST_SIZE` | `10485760` (10MB) | Maximum request body size in bytes |

`MAX_REQUEST_SIZE` is enforced by HTTP middleware and applies to requests that declare a
`Content-Length`. It does not cover WebSocket frames (bounded separately at 1 MiB per frame on
`/v1/graph/live`) or chunked uploads (bounded by `MEDIA_MAX_SIZE_MB` as the body is read).

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

---

## LLM provider variables

Set these based on the `provider` you use on your `Agent`. They are read at client creation time.

### LLM timeout

| Variable | Default | Description |
| --- | --- | --- |
| `AGENTFLOW_LLM_TIMEOUT` | `600.0` | Default request timeout in seconds applied to every LLM client. Must be a positive number. See [Configure Agent](../../how-to/python/configure-agent.md#llm-call-timeout) for the programmatic API. |

### OpenAI (`provider="openai"`)

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | API key from https://platform.openai.com |

### Google Gemini (`provider="google"`)

The Google provider supports two backends: the Gemini API (default) and Vertex AI. See [Using Vertex AI](../../providers/google.md#using-vertex-ai).

**Gemini API (Google AI Studio):**

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | API key from https://aistudio.google.com (preferred) |
| `GOOGLE_API_KEY` | Fallback name for the Gemini API key |

**Vertex AI** (enable with `use_vertex_ai=True` on the agent or `GOOGLE_GENAI_USE_VERTEXAI=true`):

| Variable | Default | Description |
| --- | --- | --- |
| `GOOGLE_GENAI_USE_VERTEXAI` | — | Set to `true` to route the Google provider through Vertex AI process-wide |
| `GOOGLE_CLOUD_PROJECT` | — | **Required.** GCP project ID with the Vertex AI API enabled |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | GCP region for Vertex AI calls |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to a service-account JSON key (Application Default Credentials) |

:::note Vertex AI authentication
Vertex AI authenticates via [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials), not an API key. In local development point `GOOGLE_APPLICATION_CREDENTIALS` at a service-account key file. On GCP runtimes (Cloud Run, GKE, Compute Engine) the attached service account is picked up automatically.
:::
