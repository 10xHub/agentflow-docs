---
title: Authentication
description: How to configure JWT auth or a custom auth backend for the AgentFlow API.
---

# Authentication

By default, the AgentFlow API accepts all requests without authentication (suitable for local development). For production, configure either JWT or a custom auth backend.

## No authentication (default)

```json
{
  "agent": "graph.react:app",
  "auth": null
}
```

All endpoints are publicly accessible. Only use this locally or behind a secure gateway.

---

## JWT authentication

Set `auth` to `"jwt"` in `agentflow.json`:

```json
{
  "agent": "graph.react:app",
  "auth": "jwt"
}
```

Set the required environment variables:

```bash
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
```

Requests must include a `Bearer` token in the `Authorization` header:

```bash
curl -X POST http://127.0.0.1:8000/v1/graph/invoke \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1..." \
  -H "Content-Type: application/json" \
  -d '{"messages": [...], "config": {"thread_id": "t1"}}'
```

The server decodes and validates the JWT on every request. The decoded payload is passed to the endpoint as the `user` context.

### Generating tokens

AgentFlow does not issue tokens. Use your identity provider or create tokens with a library such as `python-jose`:

```python
from jose import jwt

token = jwt.encode(
    {"sub": "user-123", "role": "user"},
    key="your-secret-key",
    algorithm="HS256",
)
```

---

## Custom authentication

Provide your own auth backend when you need integration with an internal identity system:

```json
{
  "agent": "graph.react:app",
  "auth": {
    "method": "custom",
    "path": "graph.auth:MyAuthBackend"
  }
}
```

The backend must implement the `BaseAuth` interface:

```python
from agentflow_cli.src.app.core.auth.auth_backend import BaseAuth

class MyAuthBackend(BaseAuth):
    async def authenticate(self, request) -> dict | None:
        """
        Verify the request and return user context.
        Return None to reject (will raise 401).
        Return a dict to accept (passed as 'user' to all endpoints).
        """
        token = request.headers.get("X-My-Auth-Token")
        if not token:
            return None
        user = await my_identity_service.verify(token)
        return {"id": user.id, "role": user.role}
```

---

## Authorization

Authorization controls which authenticated users can access which endpoints. By default, any authenticated user can invoke all endpoints.

For fine-grained access control, configure a custom authorization backend:

```json
{
  "authorization": "graph.auth:my_authorization_backend"
}
```

The backend receives the `user` dict from authentication and the `resource` + `action` for each endpoint:

```python
class MyAuthorizationBackend:
    async def authorize(self, user: dict, resource: str, action: str) -> bool:
        """Return True to allow, False to deny."""
        if resource == "graph" and action == "invoke":
            return user.get("role") in ("user", "admin")
        if resource == "store":
            return user.get("role") == "admin"
        return False
```

### Resource and action pairs

| Resource | Actions |
| --- | --- |
| `graph` | `invoke`, `stream`, `read`, `stop` |
| `checkpointer` | `read`, `write`, `delete` |
| `store` | `read`, `write`, `delete` |
| `files` | `upload`, `read` |

---

## Using auth with the TypeScript client

```typescript
const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

The `headers` object is merged into every request the client makes.
