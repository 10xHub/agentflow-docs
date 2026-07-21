---
title: Conventions and permissions — REST API reference
sidebar_label: Conventions and permissions
description: The response envelope, authentication for HTTP and WebSocket routes, the full endpoint permission table, and the HTTP status codes the AgentFlow API server returns.
keywords:
  - agentflow rest api
  - api response envelope
  - agent api authentication
  - api permissions
  - http status codes
sidebar_position: 0
---


# REST API conventions

Everything on this page applies to every endpoint in this section.

## Base URL

All API routes (except `/ping`) are prefixed with `/v1/`.

## Response envelope

Every successful endpoint wraps its payload in a uniform envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message",
  "timestamp": "2026-05-23T10:00:00Z"
}
```

Errors (4xx / 5xx) return FastAPI's standard detail format:

```json
{
  "detail": "Not authorized to invoke graph"
}
```

## Authentication

When auth is configured in `agentflow.json`, all endpoints except `/ping` require a Bearer token:

```
Authorization: Bearer <token>
```

WebSocket connections that cannot set an `Authorization` header have two options, in order of preference:

```javascript
// Preferred for browsers: the token rides in a request header, not the URL
new WebSocket("ws://host/v1/graph/ws", ["agentflow-bearer", token]);
```

```
# Last-resort fallback: the token lands in URLs and access logs
/v1/graph/ws?token=<token>
```

The server echoes the `agentflow-bearer` sentinel back on `accept()`, which browsers require to complete the handshake.

If auth is not configured (`"auth": null`), credentials are not required and the auth layer is skipped entirely.

Authentication failures return HTTP `403` with an `error.code` such as `REVOKED_TOKEN` or `EXPIRED_TOKEN`, not `401`. On WebSocket routes the same failures become close code `1008`.

## Permission model

Each endpoint requires a specific `(resource, action)` pair. The table below lists them. When an `AuthorizationBackend` is configured, the `authorize(user, resource, action)` method is called. The built-in `DefaultAuthorizationBackend` allows all requests as long as `user_id` is present.

---

## Permission reference

The table below lists every `(resource, action)` pair enforced by the server. When an `AuthorizationBackend` is configured, each request calls `authorize(user, resource, action)`.

| Endpoint | Resource | Action |
| --- | --- | --- |
| `POST /v1/graph/invoke` | `graph` | `invoke` |
| `POST /v1/graph/stream` | `graph` | `stream` |
| `WebSocket /v1/graph/ws` | `graph` | `stream` |
| `WebSocket /v1/graph/live` | `graph` | `stream` |
| `GET /v1/graph` | `graph` | `read` |
| `GET /v1/graph/tools` | `graph` | `read` |
| `GET /v1/observability/{thread_id}` | `graph` | `read` |
| `GET /v1/graph:StateSchema` | `graph` | `read` |
| `POST /v1/graph/stop` | `graph` | `stop` |
| `POST /v1/graph/setup` | `graph` | `setup` |
| `POST /v1/graph/fix` | `graph` | `fix` |
| `GET /v1/threads/{id}/state` | `checkpointer` | `read` |
| `PUT /v1/threads/{id}/state` | `checkpointer` | `write` |
| `DELETE /v1/threads/{id}/state` | `checkpointer` | `delete` |
| `GET /v1/threads/{id}/messages` | `checkpointer` | `read` |
| `GET /v1/threads/{id}/messages/{msg}` | `checkpointer` | `read` |
| `POST /v1/threads/{id}/messages` | `checkpointer` | `write` |
| `DELETE /v1/threads/{id}/messages/{msg}` | `checkpointer` | `delete` |
| `GET /v1/threads` | `checkpointer` | `read` |
| `GET /v1/threads/{id}` | `checkpointer` | `read` |
| `DELETE /v1/threads/{id}` | `checkpointer` | `delete` |
| `POST /v1/store/memories` | `store` | `write` |
| `POST /v1/store/search` | `store` | `read` |
| `POST /v1/store/memories/{id}` | `store` | `read` |
| `POST /v1/store/memories/list` | `store` | `read` |
| `PUT /v1/store/memories/{id}` | `store` | `write` |
| `DELETE /v1/store/memories/{id}` | `store` | `delete` |
| `POST /v1/store/memories/forget` | `store` | `delete` |
| `POST /v1/files/upload` | `files` | `upload` |
| `GET /v1/files/{id}` | `files` | `read` |
| `GET /v1/files/{id}/info` | `files` | `read` |
| `GET /v1/files/{id}/url` | `files` | `read` |
| `GET /v1/config/multimodal` | `config` | `read` |
| `GET /ping` | (none) | (none) |
| `GET /v1/evals/runs` | (none) | (none) |
| `GET /v1/evals/runs/{run_id}` | (none) | (none) |

The last three rows are the complete public allowlist. Every other route must carry a `RequirePermission` guard, and the server refuses to start if one does not.

:::warning The eval endpoints are unauthenticated
`/v1/evals/runs*` serves the contents of `eval_reports/` to anyone who can reach the port, regardless of your `auth` setting. Keep `eval_reports/` out of the deployed working directory, or block `/v1/evals/*` at your ingress. See [eval endpoints](evals.md).
:::

---

## HTTP status codes

| Code | When |
| --- | --- |
| `200` | Success |
| `400` | Empty file upload or missing required field |
| `401` | Token missing or invalid (when auth is configured) |
| `403` | Authorization check failed |
| `404` | Resource not found (file, thread, message) |
| `413` | Uploaded file exceeds `MEDIA_MAX_SIZE_MB` |
| `422` | Request validation error (malformed body or invalid param) |
| `500` | Unexpected server error |
