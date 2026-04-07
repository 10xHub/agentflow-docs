---
title: REST API — Ping
description: Health check endpoint for the AgentFlow API server.
---

# REST API: Ping

The ping endpoint is a simple health check with no authentication required. Use it to verify the server is running.

---

## GET /ping

Check that the server is up and accepting requests.

**Request:** No body, no auth required.

```bash
curl http://127.0.0.1:8000/ping
```

**Response:**

```json
{
  "success": true,
  "data": "pong"
}
```

**Status codes:**

| Status | Meaning |
| --- | --- |
| `200` | Server is healthy |
| `5xx` | Server is starting or has encountered an error |

---

## Use cases

- Load balancer health checks
- Container readiness probes
- Smoke tests after deployment

**Kubernetes readiness probe example:**

```yaml
readinessProbe:
  httpGet:
    path: /ping
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
```

**Docker Compose healthcheck example:**

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/ping"]
  interval: 30s
  timeout: 5s
  retries: 3
```
