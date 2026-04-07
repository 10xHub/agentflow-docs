---
title: Add Authentication
description: How to add JWT or custom authentication to the AgentFlow API.
---

# Add authentication

By default, the API accepts all requests. This guide shows how to protect your endpoints.

## Option 1: JWT authentication

JWT is the fastest way to add authentication. Set `auth` to `"jwt"` in `agentflow.json`:

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "env": ".env"
}
```

Add the required secrets to `.env`:

```bash
JWT_SECRET_KEY=your-long-random-secret-key
JWT_ALGORITHM=HS256
```

Restart the server. Requests without a valid `Authorization: Bearer <token>` header now receive a `401` response.

### Test it

```bash
# Without token — should return 401
curl http://127.0.0.1:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "config": {"thread_id": "t1"}}'

# With a valid token — should return 200
curl http://127.0.0.1:8000/v1/graph/invoke \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "config": {"thread_id": "t1"}}'
```

### Generate a token for testing

```python
from jose import jwt

token = jwt.encode(
    {"sub": "user-123", "role": "user"},
    key="your-long-random-secret-key",
    algorithm="HS256",
)
print(token)
```

## Option 2: Custom authentication

Use a custom backend when you need to verify tokens against an external identity provider.

Create `graph/auth.py`:

```python
from agentflow_cli.src.app.core.auth.auth_backend import BaseAuth

class MyAuthBackend(BaseAuth):
    async def authenticate(self, request) -> dict | None:
        token = request.headers.get("X-Api-Key")
        if not token:
            return None
        # Verify with your identity provider
        user = await verify_api_key(token)
        if not user:
            return None
        return {"id": user.id, "role": user.role, "name": user.name}
```

Configure in `agentflow.json`:

```json
{
  "agent": "graph.react:app",
  "auth": {
    "method": "custom",
    "path": "graph.auth:MyAuthBackend"
  }
}
```

## Add authorization (per-resource permissions)

After adding authentication, you can further restrict which users can access which resources.

Create `graph/auth.py` (or add to existing):

```python
class MyAuthorizationBackend:
    async def authorize(self, user: dict, resource: str, action: str) -> bool:
        role = user.get("role", "guest")
        if resource == "graph":
            return role in ("user", "admin")
        if resource == "store":
            return role == "admin"
        return False
```

Configure in `agentflow.json`:

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "authorization": "graph.auth:MyAuthorizationBackend"
}
```

## Using auth from the TypeScript client

```typescript
const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
});
```

## Security checklist for production

- [ ] Set a strong, random `JWT_SECRET_KEY` (at least 32 characters)
- [ ] Set `MODE=production`
- [ ] Restrict `ORIGINS` to your specific domains
- [ ] Disable API docs (`DOCS_PATH=`, `REDOCS_PATH=`)
- [ ] Use HTTPS at the reverse proxy level
