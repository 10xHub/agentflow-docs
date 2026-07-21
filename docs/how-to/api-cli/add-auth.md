---
title: Add Authentication — AgentFlow Python AI Agent Framework
sidebar_label: Add Authentication
description: How to add JWT or custom authentication to the AgentFlow API. Part of the AgentFlow agentflow api guide for production-ready Python AI agents.
keywords:
  - agentflow api
  - agentflow cli
  - agent rest api
  - agentflow
  - python ai agent framework
  - add authentication
---


# Add authentication

By default, the AgentFlow API accepts all requests. This guide shows how to protect your endpoints using authentication and authorization.

## Authentication vs. Authorization

**Authentication** answers the question: "Who are you?"
- Verifies the user's identity (login, token validation, API key check)
- Returns `401 Unauthorized` if credentials are invalid

**Authorization** answers the question: "What are you allowed to do?"
- Restricts which users can call which endpoints (graph invocation, thread access, store operations)
- Returns `403 Forbidden` if the user does not have permission

You can use authentication alone (everyone who logs in can do everything) or combine both for fine-grained control.

## Method 1: JWT Authentication (simplest)

JWT (JSON Web Tokens) is the fastest way to add authentication for stateless APIs. A JWT is a cryptographically signed token that can be verified without a database lookup.

### Setup

1. **Update `agentflow.json`:**

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "env": ".env"
}
```

2. **Set environment variables in `.env`:**

```bash
# Generate a random secret key (at least 32 characters)
JWT_SECRET_KEY=your-super-secret-key-at-least-32-characters-long-like-this

# Signing algorithm
JWT_ALGORITHM=HS256
```

To generate a strong random key on macOS/Linux:

```bash
openssl rand -hex 32
```

3. **Restart the server:**

```bash
Agentflow api
```

### How it works

When a client makes a request, the server checks the `Authorization: Bearer <token>` header:

```bash
# Decode the token using the JWT_SECRET_KEY
# Verify the signature matches
# If valid and not expired, allow the request
# If invalid, return 401 Unauthorized
```

### Test without a token (should fail)

```bash
curl -X POST http://127.0.0.1:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "config": {"thread_id": "test-1"}
  }'
```

Expected response:

```json
{"detail": "Unauthorized"}
```

HTTP 401 status.

### Generate a test token

Create a Python script to generate a valid JWT token:

```python
# gen_token.py
from jose import jwt
from datetime import datetime, timedelta

# Must match JWT_SECRET_KEY and JWT_ALGORITHM from your .env
secret_key = "your-super-secret-key-at-least-32-characters-long-like-this"
algorithm = "HS256"

# Create token payload
payload = {
    "sub": "user-123",  # Subject (user ID)
    "name": "Alice",
    "role": "user",
    "exp": datetime.utcnow() + timedelta(hours=1)  # Expires in 1 hour
}

# Encode the token
token = jwt.encode(payload, secret_key, algorithm=algorithm)

print(f"Token: {token}")
print(f"\nUse this in your requests:")
print(f"Authorization: Bearer {token}")
```

Run it:

```bash
python gen_token.py
```

Output:

```
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Test with the token

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://127.0.0.1:8000/v1/graph/invoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "config": {"thread_id": "test-1"}
  }'
```

Expected: HTTP 200 with a valid response.

### Token expiration

Tokens can include an expiration time (`exp` claim). After expiration, the token is invalid even if the signature is correct:

```python
# Token expires in 1 hour
payload = {
    "sub": "user-123",
    "exp": datetime.utcnow() + timedelta(hours=1)
}
```

When the token expires, clients must generate a new one. This is more secure than fixed credentials because expired tokens cannot be replayed.

## Method 2: Custom Authentication

Use a custom auth backend for:

- Integration with external identity providers (OAuth, SAML, existing auth systems)
- Custom verification logic (API keys, database lookups, third-party services)
- Non-JWT token formats

### Example: API Key authentication

Create `graph/auth.py`:

`authenticate` is **synchronous** and takes `(request, response, credential)`. The server calls
it without `await`, so declaring it `async def` returns an un-awaited coroutine and breaks auth
silently — keep it a plain `def`.

```python
import os
from typing import Any

from fastapi import Request, Response
from fastapi.security import HTTPAuthorizationCredentials

from agentflow_cli import BaseAuth


class ApiKeyAuth(BaseAuth):
    def __init__(self):
        # Load valid API keys from environment
        self.valid_keys = os.environ.get("VALID_API_KEYS", "").split(",")

    def authenticate(
        self,
        request: Request,
        response: Response,
        credential: HTTPAuthorizationCredentials | None,
    ) -> dict[str, Any] | None:
        # API keys ride in a custom header, not the bearer credential.
        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key not in self.valid_keys:
            return None  # missing or invalid -> 401

        # Return user info (at least user_id) for authorization.
        return {
            "user_id": "api-key-user",
            "role": "api-user",
            "api_key_id": api_key,
        }
```

### Example: OAuth (external provider)

The bearer token is parsed for you and delivered as `credential` — no need to slice the header.
Keep the method a plain `def`; use a sync HTTP client for provider verification.

```python
from typing import Any

import httpx
from fastapi import Request, Response
from fastapi.security import HTTPAuthorizationCredentials

from agentflow_cli import BaseAuth


class OAuthAuth(BaseAuth):
    def authenticate(
        self,
        request: Request,
        response: Response,
        credential: HTTPAuthorizationCredentials | None,
    ) -> dict[str, Any] | None:
        if credential is None:
            return None  # no bearer token -> 401
        token = credential.credentials

        # Verify token with your OAuth provider.
        resp = httpx.post(
            "https://your-oauth-provider.com/verify",
            json={"token": token},
        )
        if resp.status_code != 200:
            return None  # invalid token -> 401

        user_data = resp.json()
        return {
            "user_id": user_data["user_id"],
            "role": user_data["role"],
            "email": user_data["email"],
        }
```

### Configure it

```json
{
  "agent": "graph.react:app",
  "auth": {
    "method": "custom",
    "path": "graph.auth:ApiKeyAuth"
  }
}
```

### Test custom auth

```bash
# Without API key — should return 401
curl http://127.0.0.1:8000/v1/graph/invoke

# With valid API key — should return 200
curl -H "X-API-Key: secret-key-123" \
  http://127.0.0.1:8000/v1/graph/invoke
```

## Method 3: Authorization (fine-grained permissions)

After authenticating, restrict which users can access which resources using an authorization backend.

### Built-in backends and the secure-by-default policy

You do not have to write any code to get per-user isolation. The framework ships two
built-in backends, selected with the `authorization` key in `agentflow.json`:

| `authorization` value | Backend | Behaviour |
|---|---|---|
| `"ownership"` | `OwnershipAuthorizationBackend` | A thread can be read, written, deleted, stopped or fixed **only by the user who owns it**. Running a new thread (`invoke`/`stream`) is allowed; hijacking someone else's thread is denied. |
| `"allow_all"` (aliases: `"default"`, `"none"`) | `DefaultAuthorizationBackend` | Any authenticated user may perform any action. |
| `"module:attribute"` | your class | A custom `AuthorizationBackend` (see below). |
| not set (`null`) | **depends on mode** | `ownership` in production, `allow_all` in development. |

The default is chosen by run mode, so a production build is safe out of the box:

- **`MODE=production`** → defaults to `ownership`. Object-level isolation is enforced even
  if you never configure `authorization`.
- **`MODE=development`** → defaults to `allow_all`, so local iteration is frictionless.

**The developer decision always wins.** To relax security in production, set
`"authorization": "allow_all"`. To enforce owner-only access in development, set
`"authorization": "ownership"`. To do something entirely custom, point it at your own class.

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "authorization": "ownership"
}
```

The `ownership` check runs on **every** thread-touching request — `invoke`, `stream`,
`stop`, `fix`, and all thread state/message read/write/delete — *before* the handler runs.
Running or reading another user's thread is rejected up front (403), so a foreign `invoke`
never reaches the model.

**It is scalable.** Thread ownership is immutable (set when the thread is created, changed
only by deletion), so it is cached: an in-process LRU per worker, plus an optional shared
Redis tier when `redis` (or `REDIS_URL`) is configured. After the first lookup, an
authorization check is an in-memory hit — not a database round-trip per request. The cache
is invalidated automatically when a thread is deleted.

:::note Ownership needs a persistent checkpointer
`ownership` resolves who owns a thread from the checkpointer's thread registry, which is
populated by `PgCheckpointer` (the production checkpointer). With no checkpointer
configured, or a checkpointer that cannot resolve ownership, there are no persisted threads
to protect, so requests pass through (a warning is logged). The in-memory checkpointer does
not keep a thread registry, which is why `ownership` is a production default and development
stays on `allow_all`.
:::

:::tip Every endpoint is guarded by construction
The server refuses to start if any non-public route is missing its authorization guard, so a
newly added endpoint can never silently ship unprotected. `/ping` is the only public route.
:::

### Create an authorization backend

Create `graph/auth.py` (or add to existing):

```python
from typing import Any

from agentflow_cli.src.app.core.auth.authorization import AuthorizationBackend

class RoleBasedAuthorization(AuthorizationBackend):
    async def authorize(
        self,
        user: dict,
        resource: str,
        action: str,
        resource_id: str | None = None,
        **context: Any,
    ) -> bool:
        # `resource_id` is the specific object being accessed (e.g. the thread_id),
        # extracted from the URL path or, for invoke/stream/stop/fix, the request body.
        # Use it to make object-level (per-thread) decisions.
        role = user.get("role", "guest")
        
        # Define permissions by role
        permissions = {
            "admin": {
                "graph": ["invoke", "stream", "stop", "setup"],
                "checkpointer": ["read", "write", "delete"],
                "store": ["read", "write"],
            },
            "user": {
                "graph": ["invoke", "stream"],
                "checkpointer": ["read"],
                "store": ["read"],
            },
            "guest": {
                "graph": ["invoke"],
                "checkpointer": [],
                "store": [],
            },
        }
        
        # Check if role has permission
        role_perms = permissions.get(role, {})
        resource_actions = role_perms.get(resource, [])
        
        return action in resource_actions
```

### Configure it

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "authorization": "graph.auth:RoleBasedAuthorization"
}
```

### Role-based access without code (RBAC config block)

You usually do not need a custom class for role → permission mapping. Set `authorization` to an
RBAC object and the framework maps roles to **scopes** on top of owner-only isolation:

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "authorization": {
    "backend": "rbac",
    "roles": {
      "admin":  ["*"],
      "member": ["graph:invoke", "graph:stream", "graph:read", "checkpointer:read"],
      "guest":  ["graph:invoke"]
    },
    "default_scopes": ["graph:read"],
    "isolation": "owner"
  }
}
```

- `roles` maps each role (from the JWT `roles`/`role` claim) to the scopes it grants; `"*"` grants all.
- `default_scopes` is granted to everyone, even a user with no role.
- `isolation` is `"owner"` (owner-only storage, default) or `"none"` (any authenticated user sees all rows).

An endpoint requires the scope `"<resource>:<action>"`. The full scope catalog:

| Resource | Scopes |
|---|---|
| graph | `graph:invoke`, `graph:stream`, `graph:stop`, `graph:fix`, `graph:setup`, `graph:read` |
| checkpointer | `checkpointer:read`, `checkpointer:write`, `checkpointer:delete` |
| store | `store:read`, `store:write`, `store:delete` |
| files | `files:read`, `files:upload` |
| config | `config:read` |

Scopes are enforced only once an identity carries them (an RBAC role, a custom `scopes_for`, or a
JWT `scopes` claim). Without any scopes the server stays permissive, so existing setups keep
working until you issue scopes.

### Data isolation flows to the storage layer

The checks above decide *access* at the API layer. The **data layer** (checkpointer, store)
enforces *isolation* from a trusted policy: after a successful check the server stamps
`user["authz"] = {user_id, scope, scopes}`, where `scope` is the backend's `isolation_scope()`.
Every service copies that trusted `user` into `config["user"]`, so with `owner` isolation the
checkpointer and store scope every query to the caller — and because it is set server-side, the
client cannot forge it.

### Test authorization

A guest user with a valid JWT can call `POST /v1/graph/invoke`, but accessing threads returns 403:

```bash
# Valid token with role=guest
TOKEN="eyJhbGc..."

# This succeeds (guest has graph:invoke permission)
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/v1/graph/invoke

# This returns 403 Forbidden (guest does not have checkpointer:read permission)
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/v1/threads
```

## Using authentication from the TypeScript client

### JWT

```typescript
import { AgentFlowClient } from "@10xscale/agentflow-client";

const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
  headers: {
    Authorization: `Bearer ${userToken}`,
  },
});

await client.invokeGraph({
  messages: [{role: "user", content: "Hello"}],
  config: {thread_id: "test-1"}
});
```

### Custom API key

```typescript
const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
  headers: {
    "X-API-Key": "your-api-key",
  },
});
```

## Production security checklist

Before deploying to production, verify:

- [ ] **JWT Secret Key** — Set a cryptographically strong secret:
  ```bash
  openssl rand -hex 32
  ```
  Never use a weak or predictable secret.

- [ ] **Secret Storage** — Store `JWT_SECRET_KEY` in a secrets management system (AWS Secrets Manager, HashiCorp Vault, Docker Secrets), NOT in `.env` files or code.

- [ ] **HTTPS/TLS** — Always use HTTPS for API calls. Configure TLS at the reverse proxy level (nginx, API Gateway).

- [ ] **Disable public AI docs** — Disable the `/docs` and `/redoc` endpoints in production:
  ```bash
  export DOCS_PATH=""
  export REDOC_PATH=""
  ```

- [ ] **Token rotation** — Implement token expiration and refresh mechanisms.

- [ ] **Rate limiting** — Apply rate limits to authentication endpoints to prevent brute-force attacks.

- [ ] **CORS** — Set `CORS_ORIGINS` to specific, trusted domains only:
  ```bash
  export CORS_ORIGINS="https://app.example.com,https://dashboard.example.com"
  ```

- [ ] **Audit logging** — Log all authentication events (successful logins, failed attempts, permission denials).

## Debugging authentication issues

**401 Unauthorized on all requests**
- Verify the `auth` field is set in `agentflow.json`
- Verify `JWT_SECRET_KEY` and `JWT_ALGORITHM` are set in the environment
- Verify the token is included in the `Authorization: Bearer <token>` header
- Verify the token has not expired

**403 Forbidden despite valid credentials**
- This means authentication passed but authorization failed
- Check your authorization backend logic
- Verify the user's role has the required permission

**Token validation errors**
- Ensure the secret key used to sign the token matches `JWT_SECRET_KEY` on the server
- Ensure the algorithm matches `JWT_ALGORITHM` on the server
- Check that the token has not been manually edited

**Custom auth not being called**
- Verify the module path in `agentflow.json` is correct
- Verify the module can be imported: `python -c "from graph.auth import ApiKeyAuth"`
- Add logging to your auth backend to see if it is being called
