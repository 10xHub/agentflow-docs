# Production Deployment Checklist

> Security, persistence, scaling, and monitoring checklist before shipping your 10xGraph API to production.

Source: https://10xgraph.com/docs/server/production-checklist
Last updated: 2026-10-08

Deploying 10xGraph to production requires hardening your API server for security, reliability, and scale. This checklist walks through every critical setting, from runtime mode to persistence topology to horizontal scaling, with verification steps to confirm each piece is working before traffic arrives.

## Prerequisites

You have a 10xGraph project with a working `10xgraph.json` and a compiled graph. You are ready to containerize and deploy. This guide covers Linux/Kubernetes production environments; Docker and `docker-compose` will be used in examples.

Before production, make sure you have read the guides for checkpointing, authentication, and rate limiting:

- [Set up checkpointing](/docs/guides/set-up-checkpointing)
- [Authentication](/docs/server/auth)
- [Rate limiting](/docs/server/rate-limiting)

## 1. Runtime mode and debug settings

The first critical step is disabling development features. Set these environment variables:

```bash
MODE=production
IS_DEBUG=false
LOG_LEVEL=INFO
```

`MODE=production` enforces stricter validation at startup: wildcard CORS origins combined with credentials will fail the server boot, JWT secrets shorter than 32 bytes are rejected, and missing `JWT_SECRET_KEY` when JWT auth is configured raises an error. Leave debug mode off; it exposes internal stack traces over HTTP and accepts slower code paths.

Verify the mode is active:

```bash
curl http://127.0.0.1:8000/ping
# Response should have no debug information
```

## 2. Secrets and authentication

### JWT configuration

If you use JWT authentication in `10xgraph.json`:

```json
{
  "auth": "jwt"
}
```

Set a strong secret key and algorithm:

```bash
JWT_SECRET_KEY=$(openssl rand -hex 32)   # 64 hex chars = 32 bytes, production minimum
JWT_ALGORITHM=HS256
```

Export these to your deployment. The server requires them at startup when JWT auth is configured and will fail to boot otherwise.

For token generation, create a JWT with the required claims:

```bash
# Example using PyJWT (install: pip install PyJWT)
python -c "
import jwt
import os
secret = os.environ['JWT_SECRET_KEY']
payload = {'sub': 'user_id', 'iss': 'your-service'}
token = jwt.encode(payload, secret, algorithm='HS256')
print(token)
"
```

### Custom authentication

If you use custom authentication, ensure your `BaseAuth` subclass is properly deployed and all dependencies are available. Verify it loads without errors:

```bash
10xgraph init --dry-run   # Validates the loaded graph and auth
```

### API keys and secrets

Never commit secrets to version control. Secrets must be passed at deployment time via environment variables or a secret manager:

- Development: use a `.env` file (added to `.gitignore`)
- Production: inject via your orchestration platform (Kubernetes secrets, AWS Secrets Manager, GitHub Actions secrets, etc.)

## 3. CORS and security headers

Restrict CORS origins to your front-end domains:

```bash
ORIGINS=https://app.example.com,https://admin.example.com
ALLOWED_HOST=app.example.com
```

The server rejects `ORIGINS="*"` combined with `CORS_ALLOW_CREDENTIALS=true` in production mode. If you need cross-origin requests without authentication, set:

```bash
ORIGINS=*
CORS_ALLOW_CREDENTIALS=false
```

Security headers are enabled by default. Verify they are present:

```bash
curl -i http://127.0.0.1:8000/ping | grep -E "Strict-Transport-Security|X-Frame-Options"
# Should see security headers in response
```

Disable documentation UI paths in production to reduce your attack surface:

```bash
DOCS_PATH=
REDOCS_PATH=
```

## 4. Authentication and authorization

### Access control

If you are using authorization (RBAC or ownership-based access control), configure it in `10xgraph.json`:

```json
{
  "auth": "jwt",
  "authorization": "ownership"
}
```

The `ownership` backend ensures each user can access only their own threads. This is the production default when `MODE=production`. Verify it is enforced by testing access to a thread owned by a different user; the API should return 403 Forbidden.

### Permission scopes

If your authorization uses custom scopes, ensure they are validated on every protected route. The server automatically guards all routes except `/ping`.

## 5. Persistence topology

Thread history, state snapshots, and message logs must survive server restarts and be shared across instances.

### PostgreSQL setup

Use `PgCheckpointer` in production. In your graph module, instantiate the checkpointer:

```python
from tenxgraph.storage.checkpointer import PgCheckpointer

my_checkpointer = PgCheckpointer(
    postgres_dsn="postgresql://user:password@postgres.internal:5432/10xgraph",
    redis_url="redis://redis.internal:6379/0",
)

app = state_graph.compile(checkpointer=my_checkpointer)
```

The checkpointer creates tables automatically on first connection. Make sure the database user has CREATE permission. Table names are prefixed by default; list them:

```bash
psql "postgresql://user:password@postgres.internal/10xgraph" -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name;
"
```

Expected tables: `agentflow_checkpoints`, `agentflow_messages`, `agentflow_threads`, `agentflow_token_usage_ledger`.

### Redis caching

Redis acts as a hot cache in front of Postgres. It is optional for data durability but improves read latency and supports concurrent request handling.

```bash
REDIS_URL=redis://redis.internal:6379/0
```

Verify Redis connectivity:

```bash
redis-cli -u redis://redis.internal:6379/0 ping
# Should respond PONG
```

### Topology diagram

```
                    Load Balancer
                          |
       ___________ _________|_______  _________
      |           |               |  |
   API 1        API 2           API 3
      |           |               |
       \___________|_______________|
             |                |
         PostgreSQL          Redis
```

All three API instances point to the same PostgreSQL and Redis. On restart, they read the latest state from the shared backend.

## 6. Horizontal scaling and workers

Deploy at least two API instances behind a load balancer to survive instance failures. Each instance must point to the same Postgres and Redis.

### Gunicorn + Uvicorn (ASGI server)

For production, use a multi-worker HTTP server. Gunicorn is the standard choice. Create a startup script:

```bash
#!/bin/bash
set -e

export MODE=production
export IS_DEBUG=false
export DATABASE_URL="postgresql://user:password@postgres.internal:5432/10xgraph"
export REDIS_URL="redis://redis.internal:6379/0"
export JWT_SECRET_KEY=$JWT_SECRET_KEY  # from environment
export ORIGINS="https://app.example.com"

gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile - \
  --log-level info \
  --graceful-timeout 30 \
  --timeout 60 \
  tenxgraph_api.src.app.main:app
```

The `--workers` flag sets the number of worker processes. Start with 2-4 workers per available CPU core. Monitor CPU and memory usage to tune.

### Environment variable for workers

The server reads `WEB_CONCURRENCY` and applies it as the worker count if `--workers` is not specified:

```bash
WEB_CONCURRENCY=4
```

### Instance identity

If using Snowflake IDs for distributed, time-ordered thread identifiers, set unique node and worker IDs per instance:

```bash
SNOWFLAKE_NODE_ID=1      # datacenter id; increment per datacenter
SNOWFLAKE_WORKER_ID=1    # server instance id; increment per server
```

In a second instance:

```bash
SNOWFLAKE_NODE_ID=1
SNOWFLAKE_WORKER_ID=2
```

## 7. Rate limiting

Enable rate limiting to protect against abuse and unintended traffic spikes:

```json
{
  "rate_limit": {
    "enabled": true,
    "requests": 100,
    "window": 60,
    "by": "ip",
    "backend": "redis",
    "redis": {
      "url": "redis://redis.internal:6379/1"
    }
  }
}
```

This allows 100 requests per IP address per 60-second window. Use a separate Redis database (`/1`) to isolate rate limit data from the checkpointer cache.

Exclude health-check endpoints from rate limiting:

```json
{
  "rate_limit": {
    "enabled": true,
    "requests": 100,
    "window": 60,
    "exclude_paths": ["/ping", "/health"]
  }
}
```

Verify rate limiting is active:

```bash
for i in {1..5}; do
  curl -s http://127.0.0.1:8000/v1/graph/invoke \
    -H "Content-Type: application/json" \
    -d '{"messages": [{"role": "user", "content": "test"}]}'
done
# After threshold, requests should return 429 Too Many Requests
```

## 8. Proxy buffering and request handling

When running behind a reverse proxy (nginx, HAProxy, AWS ALB), ensure it forwards headers correctly:

```nginx
# Example nginx configuration
proxy_pass http://10xgraph_backend;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Host $host;

# Allow large request bodies for file uploads
client_max_body_size 50m;

# Buffer size for streaming responses
proxy_buffering off;
```

Set the server to trust the forwarded headers:

```bash
TRUSTED_PROXY_HEADERS=true
```

## 9. Media storage and file uploads

Configure where uploaded files are stored:

```bash
MEDIA_STORAGE_TYPE=local
MEDIA_STORAGE_PATH=/data/uploads
MEDIA_MAX_SIZE_MB=25
MEDIA_ALLOWED_CONTENT_TYPES=image/*,application/pdf
```

For cloud storage:

```bash
MEDIA_STORAGE_TYPE=cloud
MEDIA_CLOUD_PROVIDER=aws
MEDIA_CLOUD_BUCKET=my-bucket
MEDIA_CLOUD_REGION=us-east-1
MEDIA_CLOUD_PREFIX=10xgraph-media
```

Ensure the storage directory (or cloud bucket) is writable and has sufficient capacity. Monitor disk or cloud storage usage.

## 10. Eval endpoints and testing

The eval runner endpoint (`/v1/evals`) allows remote evaluation execution. Disable it in production:

```json
{
  "test": {
    "enabled": false
  },
  "evaluation": {
    "enabled": false
  }
}
```

These endpoints should only be enabled in development or behind an internal network.

## 11. Database backups

PostgreSQL holds all thread history, messages, and state snapshots. Back it up regularly:

```bash
# Daily backup
0 2 * * * pg_dump -h postgres.internal -U user 10xgraph | gzip > /backups/10xgraph-$(date +%Y%m%d).sql.gz
```

Test restore procedures before relying on them:

```bash
gunzip -c /backups/10xgraph-20261008.sql.gz | psql -h postgres.internal -U user 10xgraph
```

Retain backups for at least 7 days. For critical applications, use point-in-time recovery with PostgreSQL's WAL archiving.

## 12. Observability and monitoring

### Logging

Set `LOG_LEVEL=INFO` in production. Logs should include request trace IDs for debugging:

```bash
curl -v http://127.0.0.1:8000/v1/graph/invoke \
  -H "X-Request-ID: trace-123" \
  ...
# Check logs for trace-123
```

### Sentry error tracking

If using Sentry for error monitoring:

```bash
SENTRY_DSN=https://key@sentry.example.com/project
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Sampling 10% of traces is typical for production.

### OpenTelemetry tracing

For distributed tracing across your infrastructure:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=10xgraph-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

## Verification checklist

Before opening the API to production traffic, run these tests:

### 1. Authentication works

```bash
curl -X POST http://127.0.0.1:8000/v1/graph/invoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}]}'
# Should succeed with a valid token, fail with 401 if token is missing
```

### 2. Thread persistence survives restart

```bash
# First invoke
curl -X POST http://127.0.0.1:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Remember: my name is Alice"}], "config": {"thread_id": "test-123"}}'

# Verify it's stored
curl http://127.0.0.1:8000/v1/threads/test-123/messages

# Stop the API server and restart it

# Verify state persists
curl http://127.0.0.1:8000/v1/threads/test-123/messages
# Should still contain the previous message
```

### 3. Rate limiting is active

Run 150 requests in quick succession and verify 429 responses after 100.

### 4. Security headers are present

```bash
curl -i http://127.0.0.1:8000/ping | grep -E "Strict-Transport-Security|X-Frame-Options|X-Content-Type"
```

### 5. Docs paths are disabled

```bash
curl -s http://127.0.0.1:8000/docs | wc -l
# Should return 404 or empty
```

### 6. Load balancer health checks work

```bash
curl http://127.0.0.1:8000/ping
# Should return 200 OK with no auth required
```

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| "JWT_SECRET_KEY is required" at startup | Using JWT auth without setting the secret | Set `JWT_SECRET_KEY` environment variable |
| Requests fail with 403 Forbidden | User does not own the thread | Check authorization backend and thread ownership |
| Thread state disappears after restart | Using `InMemoryCheckpointer` | Switch to `PgCheckpointer` with Postgres DSN |
| One worker sees state, another does not | Workers are not sharing the same backend | Point all instances at the same Postgres and Redis |
| CORS requests are blocked | `ORIGINS` does not include the client domain | Add the domain to `ORIGINS` or set `ORIGINS=*` with `CORS_ALLOW_CREDENTIALS=false` |
| Rate limiting not working | Backend is not configured or Redis is down | Verify `rate_limit.redis.url` and Redis connectivity |

## Related pages

- [Configure the 10xgraph.json file](/docs/server/configure)
- [Authentication and authorization](/docs/server/auth)
- [Rate limiting](/docs/server/rate-limiting)
- [Checkpointing and threads](/docs/concepts/checkpointing-and-threads)
- [Set up checkpointing](/docs/guides/set-up-checkpointing)
- [Observability](/docs/server/observability)
- [Deploy](/docs/server/deploy)

## Frequently asked questions

### What is the minimum checklist for production?

Set MODE=production, IS_DEBUG=false, use explicit ORIGINS, configure Postgres+Redis for persistence, enable rate limiting, run at least two API instances, and disable eval endpoints.

### Can I use in-memory checkpointing in production?

No. InMemoryCheckpointer loses all state on restart and cannot be shared across instances. Use PgCheckpointer for all production deployments.

### Do I have to use Redis?

Redis is optional. PgCheckpointer works with Postgres alone (slower cache behavior). It is required only for rate limiting if you choose the Redis backend, or for authorization caching in RBAC mode.
