---
title: agentflow.json in production
description: "The agentflow.json fields that matter in production: values to set for auth, persistence, and rate limiting, and defaults that are unsafe under real traffic."
section: How-to guides
group: Production
order: 750
label: agentflow.json in production
updated: "2026-09-29"
---

Every field, its type, and its default are in the
[configuration reference](/docs/reference/api-cli/configuration). This page
covers only what changes when you move from a laptop to a deployment.

## The production shape

```json
{
  "agent": "graph.agent:app",
  "env": ".env",
  "auth": "jwt",
  "authorization": "ownership",
  "store": "graph.dependencies:store",
  "redis": "redis://redis:6379/0",
  "rate_limit": {
    "enabled": true,
    "backend": "redis",
    "requests": 100,
    "window": 60,
    "by": "user",
    "redis": {"url": "${REDIS_URL}", "prefix": "agentflow:rate-limit"},
    "trusted_proxy_headers": true,
    "trusted_proxy_hops": 1,
    "fail_open": true
  }
}
```

Five of those decisions separate a demo from a deployment.

### `auth` must not stay `null`

With `auth` unset, every request is accepted without credentials. Set `"jwt"`
and a `JWT_SECRET_KEY` of at least 32 characters, or point at a custom
`BaseAuth` subclass. See [auth and authorization](/docs/how-to/production/auth-and-authorization).

### `authorization` decides whether a thread id is a secret

Unset, it is mode-based: `"ownership"` in production, `"allow_all"` in
development. Set it explicitly rather than relying on `MODE` being correct in
every environment. Under `"allow_all"`, anyone who knows a `thread_id` can read
that conversation.

### The checkpointer must be shared, not in-memory

`InMemoryCheckpointer` loses every thread on restart and is invisible to other
replicas, so the same user hits a different history depending on which pod
answers. Production means `PgCheckpointer` with a Postgres and Redis that all
replicas share. Pass it to `compile()` in the module `agent` points at; the
server uses the compiled graph's checkpointer and does not apply a `checkpointer`
key in this file yet. See [checkpointing](/docs/how-to/production/checkpointing).

### `rate_limit.backend` must be `redis` with more than one replica

The memory backend counts per process, so three replicas allow three times the
limit you configured.

`trusted_proxy_hops` matters just as much. `X-Forwarded-For` is caller-supplied,
and hops are counted from the right, so the value must match how many proxies
actually sit in front of the server. Set it too high and a client can forge its
own bucket key and bypass the limit entirely.

`fail_open: true` allows requests when the limiter's backend is down. That is
the right default for availability and the wrong one if the limit is protecting
something expensive; decide deliberately. See
[configure rate limiting](/docs/how-to/api-cli/configure-rate-limiting).

### `observability` is how you find out what happened

Set at least a level, and wire an exporter. A production agent that cannot be
traced is a production agent you cannot debug. See
[logging and metrics](/docs/how-to/production/logging-and-metrics).

---

## Secrets

Environment expansion applies only to `rate_limit.redis`. Both `$VAR` and
`${VAR}` forms work. The top-level `redis` value is used as-is; leave it unset to
fall back to the `REDIS_URL` environment variable. Everything else in this
file is read literally, so no other secret belongs in it: keep credentials in
the environment, point `env` at a `.env` for local runs, and inject real secrets
through your platform in production.

A missing variable fails startup rather than falling back:

```text
ValueError: Unresolved environment variable in value: ${REDIS_URL}
```

That is deliberate. A server that silently starts with no rate limiter is worse
than one that refuses to start.

---

## Verify before you ship

```bash
# 1. Config resolves, graph imports, server boots with no reloader
10xgraph api --no-reload

# 2. Auth is really on: an unauthenticated call must be rejected, not served
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST http://127.0.0.1:8000/v1/graph/invoke -d '{}'   # expect 403, never 200

# 3. Rate limiting is really on
for i in $(seq 1 120); do
  curl -s -o /dev/null -w "%{http_code} " http://127.0.0.1:8000/ping
done   # expect 429s once the window fills
```

Then confirm persistence survives a restart: run a thread, restart the server,
and read the thread back.

## Related

- [Configuration reference](/docs/reference/api-cli/configuration), every field and default
- [Environment variables](/docs/how-to/production/environment-variables)
- [Deployment](/docs/how-to/production/deployment) and [Deploy on Kubernetes](/docs/how-to/production/kubernetes)
- [Backup and restore](/docs/how-to/production/backup-and-restore)
