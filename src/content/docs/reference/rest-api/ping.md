---
title: Health check endpoint
description: "GET /ping is the unauthenticated health check of the 10xGraph API server, used for Kubernetes probes, Docker HEALTHCHECK and load balancers."
section: Reference
group: "REST API"
order: 400
label: Ping
updated: "2026-07-21"
---

`GET /ping` is the health check of the 10xGraph API server. It needs no authentication, reads no state, and returns a constant `pong` inside the standard response envelope. Use it to confirm that the process is up and accepting HTTP requests.

---

## GET /ping

**Request:** no body, no headers required.

```bash
curl -i http://127.0.0.1:8000/ping
```

**Response (200):**

```json
{
  "data": "pong",
  "metadata": {
    "request_id": "<uuid>",
    "timestamp": "<server timestamp>",
    "message": "OK"
  }
}
```

The envelope comes from the server's `success_response` helper. `data` holds the payload, and `metadata` carries the per-request `request_id` and `timestamp` set by the request middleware, plus a `message` that defaults to `OK`. See [Conventions](/docs/reference/rest-api/conventions) for the envelope shared by all endpoints.

| Status | Meaning |
| --- | --- |
| `200` | The server process is running and routing requests. |
| Connection refused, timeout or `5xx` | The server is not started yet, is shutting down, or has crashed. |

---

## Authentication and middleware

`/ping` is one of the paths the route guard treats as public, so it has no `RequirePermission` dependency and no scope is checked. Every other route must be guarded, or the server refuses to start.

Three pieces of middleware also skip `/ping` on purpose, because orchestrator probes would otherwise restart healthy containers:

- **Trusted host check.** Probes call `localhost` or the pod IP, which are not in `ALLOWED_HOST`. The host check is skipped for `/ping` only.
- **Rate limiting.** `/ping` is always excluded, so a rate-limit backend outage (for example Redis) does not fail the probe. The production template also lists it in `rate_limit.exclude_paths`.
- **Authentication.** No token is needed.

---

## Liveness and readiness probes

`10xgraph build --k8s` generates a Deployment whose probes both call `/ping`. Readiness decides whether the pod receives traffic. Liveness is deliberately slack, so a worker busy with a long agent run is not mistaken for a hung one:

```yaml
readinessProbe:
  httpGet:
    path: /ping
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /ping
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 30
  failureThreshold: 5
```

The port is the one you pass to `build`. For the rest of the manifest (grace period, `preStop` sleep) see [Kubernetes](/docs/server/kubernetes).

## Docker HEALTHCHECK

The generated Dockerfile includes this check, which needs `curl` in the image:

```dockerfile
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ping || exit 1
```

In Docker Compose the equivalent is:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/ping"]
  interval: 30s
  timeout: 5s
  retries: 3
```

---

## What it does not check

`/ping` proves the HTTP server is alive. It does not call the database, Redis, the checkpointer or the model provider, so a green `/ping` does not mean a graph run will succeed. For that, run a smoke test that invokes the graph after each deploy.

## Related

- [Kubernetes deployment](/docs/server/kubernetes)
- [Deployment](/docs/server/deploy)
- [REST API conventions](/docs/reference/rest-api/conventions)
