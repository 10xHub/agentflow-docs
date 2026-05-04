---
title: Add Authentication — AgentFlow Python AI Agent Framework
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

```python
from agentflow_cli.src.app.core.auth.base_auth import BaseAuth
import os

class ApiKeyAuth(BaseAuth):
    def __init__(self):
        # Load valid API keys from environment
        self.valid_keys = os.environ.get("VALID_API_KEYS", "").split(",")
    
    async def authenticate(self, request) -> dict | None:
        # Check for API key in header
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return None  # No credentials provided
        
        # Validate the key
        if api_key not in self.valid_keys:
            return None  # Invalid key
        
        # Return user info for authorization
        return {
            "user_id": f"api-key-user",
            "role": "api-user",
            "api_key_id": api_key
        }
```

### Example: OAuth (external provider)

```python
from agentflow_cli.src.app.core.auth.base_auth import BaseAuth
import httpx

class OAuthAuth(BaseAuth):
    async def authenticate(self, request) -> dict | None:
        # Extract bearer token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header[7:]  # Remove "Bearer " prefix
        
        # Verify token with your OAuth provider
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://your-oauth-provider.com/verify",
                json={"token": token}
            )
        
        if response.status_code != 200:
            return None  # Invalid token
        
        user_data = response.json()
        return {
            "user_id": user_data["user_id"],
            "role": user_data["role"],
            "email": user_data["email"]
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

### Create an authorization backend

Create `graph/auth.py` (or add to existing):

```python
from agentflow_cli.src.app.core.auth.authorization import AuthorizationBackend

class RoleBasedAuthorization(AuthorizationBackend):
    async def authorize(self, user: dict, resource: str, action: str) -> bool:
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
