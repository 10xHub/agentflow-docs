---
title: Authentication — CLI reference
sidebar_label: Authentication
description: How to configure JWT auth or a custom auth backend for the AgentFlow API.
keywords:
  - agentflow api reference
  - rest api documentation
  - agent cli reference
  - agentflow
  - python ai agent framework
  - authentication
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

JWT support needs an extra:

```bash
pip install "10xscale-agentflow-cli[jwt]"
```

Set the required environment variables:

```bash
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
```

Both are validated when the config loads: `"auth": "jwt"` with either missing raises a `ValueError` and the server does not start.

Requests must include a `Bearer` token in the `Authorization` header:

```bash
curl -X POST http://127.0.0.1:8000/v1/graph/invoke \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1..." \
  -H "Content-Type: application/json" \
  -d '{"messages": [...], "config": {"thread_id": "t1"}}'
```

The server decodes and validates the JWT on every request. The decoded payload becomes the `user` context, and flows into `config["user"]` for every downstream call.

### Required claims

The built-in backend rejects a token that does not carry both of these:

| Claim | Why |
| --- | --- |
| `exp` | Decoding uses `options={"require": ["exp"]}`. A token with no expiry is refused outright, not treated as non-expiring. |
| `user_id` | The identity key the whole authorization layer is built on. `sub` is **not** accepted as a substitute. |

Everything else in the payload is passed through untouched, so `roles`, `scopes`, `email`, and any custom claims reach your tools and authorization backend as-is.

### Rejection codes

Failures raise `UserAccountError`, which the error handler returns as HTTP **403** with the code in the body.

| `error_code` | Cause |
| --- | --- |
| `REVOKED_TOKEN` | No credential was presented at all: no `Authorization` header, no `agentflow-bearer` subprotocol, no `?token=` on a WebSocket |
| `EXPIRED_TOKEN` | `exp` is in the past |
| `INVALID_TOKEN` | Signature or structure is invalid, or `user_id` is missing from an otherwise valid token |
| `JWT_SETTINGS_NOT_CONFIGURED` | `JWT_SECRET_KEY` or `JWT_ALGORITHM` is unset at request time |

On a WebSocket route these become a clean close with code `1008` instead of an HTTP response.

### Generating tokens

AgentFlow does not issue tokens. Use your identity provider, or mint one for testing. The payload must carry `user_id` and `exp`:

```python
import datetime

import jwt  # PyJWT, installed by the [jwt] extra

token = jwt.encode(
    {
        "user_id": "user-123",
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1),
        "roles": ["member"],
    },
    key="your-secret-key",
    algorithm="HS256",
)
```

A token keyed on `sub` instead of `user_id` is rejected with `INVALID_TOKEN`, and a token with no `exp` is rejected even if it is otherwise valid.

---

## Sending the token over WebSocket

WebSocket routes use the same bearer credential as HTTP, but browsers cannot set an `Authorization` header on a `WebSocket` handshake. The server therefore looks in three places, in this order:

1. **`Authorization: Bearer <token>`** — non-browser clients.
2. **`Sec-WebSocket-Protocol: agentflow-bearer, <token>`** — the preferred browser mechanism. The token rides in a request header, so it never lands in a URL, an access log, or browser history. The server echoes the `agentflow-bearer` sentinel back on `accept()`, which browsers require in order to complete the handshake.
3. **`?token=<jwt>`** — a last-resort fallback, accepted on WebSocket connections only. The token ends up in URLs and access logs.

```javascript
const ws = new WebSocket(
  "ws://localhost:8000/v1/graph/ws",
  ["agentflow-bearer", token],  // sentinel first, then the raw JWT
);
```

The offer must be exactly two entries with the sentinel first. Anything else falls through to the query parameter.

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

The backend must subclass `BaseAuth` and implement `authenticate`. The method is
**synchronous** and receives three arguments: the connection, the response, and the bearer
`credential` (or `None`).

```python
from typing import Any

from fastapi import Request, Response
from fastapi.security import HTTPAuthorizationCredentials

from agentflow_cli import BaseAuth


class MyAuthBackend(BaseAuth):
    def authenticate(
        self,
        request: Request,          # may be a Request or a WebSocket (HTTPConnection)
        response: Response,
        credential: HTTPAuthorizationCredentials | None,  # bearer token, or None
    ) -> dict[str, Any] | None:
        """Verify the request and return the user context.

        - Return a dict (with at least ``user_id``) to accept. The keys flow into
          ``config["user"]`` for every downstream call.
        - Return ``{}`` / ``None`` for an anonymous request.
        - Raise ``UserAccountError`` (always 403) or ``HTTPException`` (your chosen
          status) to reject. On a WebSocket route either becomes a clean 1008 close.
        """
        if credential is None:
            return None
        claims = my_identity_service.verify(credential.credentials)
        return {
            "user_id": claims["sub"],
            "email": claims.get("email"),
            "roles": claims.get("roles", []),   # consumed by RBAC / custom authorization
            "scopes": claims.get("scopes", []), # consumed by per-endpoint scope checks
        }
```

:::warning `authenticate` is synchronous
The server calls `authenticate(...)` without `await`. Declaring it `async def` returns an
un-awaited coroutine and breaks auth silently. Keep it a plain `def`. For non-bearer schemes
(API keys, cookies), ignore `credential` and read `request.headers` directly.
:::

---

## Authorization

Authorization decides *what* an authenticated user may do and *whose data* they can touch. It is
configured separately from `auth`, via the `authorization` key.

### Built-in backends and mode-based defaults

You do not have to write code to get per-user isolation. Two backends ship built in:

| `authorization` value | Behaviour |
|---|---|
| `"ownership"` | Owner-only: a thread can be read, run, streamed, stopped, fixed, or deleted **only by the user who created it**. A foreign `invoke`/`stream` is rejected up front (403). |
| `"allow_all"` (aliases `"default"`, `"none"`) | Any authenticated user may do anything. |
| `"module:attr"` | Your own `AuthorizationBackend`. |
| `{ ... }` (object) | RBAC config block — see below. |
| not set (`null`) | **Mode-based**: `ownership` in production, `allow_all` in development. |

A production build (`MODE=production`) enforces owner-only access even if you never set
`authorization`. Development stays permissive. The developer's explicit choice always wins.

```json
{ "agent": "graph.react:app", "auth": "jwt", "authorization": "ownership" }
```

An unrecognised built-in name raises a `ValueError` at startup listing the valid ones, so a typo
fails loudly rather than silently falling back to something permissive.

The classes behind these names are importable, so you can subclass or compose them:

```python
from agentflow_cli.src.app.core.auth.authorization import (
    AuthorizationBackend,             # the abstract base
    DefaultAuthorizationBackend,      # "allow_all" / "default" / "none"
    OwnershipAuthorizationBackend,    # "ownership"
    RoleBasedAuthorizationBackend,    # the RBAC config block
)
```

### How ownership is resolved

`OwnershipAuthorizationBackend` only ownership-checks the thread-scoped resources `graph` and
`checkpointer`. `store`, `files`, and `config` pass through, because they enforce their own
per-user scoping.

Its decision table:

| Situation | Result |
| --- | --- |
| No `user_id` on the request | Deny |
| No `resource_id` (list or create endpoints, for example `GET /v1/threads`) | Allow. Those paths are already user-scoped by the service layer. |
| The thread does not exist yet | Allow. This is a new session; `invoke`/`stream` will create it owned by the caller. |
| The thread exists and the caller owns it | Allow |
| The thread exists and someone else owns it | **Deny, for every action**, including `invoke` and `stream` |
| The checkpointer cannot resolve ownership (`aget_thread_owner` raises `NotImplementedError`) | Allow, with a warning. There is nothing to enforce against. |
| The ownership lookup errors | **Deny.** A resolution failure must never silently grant access. |

:::note Ownership needs a checkpointer that records owners
Ownership comes from `BaseCheckpointer.aget_thread_owner`. `PgCheckpointer`, SQLite, and the
in-memory checkpointer implement it; the base class raises `NotImplementedError`. With no
checkpointer configured at all there are no persisted threads to protect, so requests pass
through with a warning. The in-memory checkpointer only records a thread when one is explicitly
written, which is why ownership is the production default (backed by Postgres) while development
defaults to `DefaultAuthorizationBackend`.
:::

#### `ThreadOwnershipResolver`

Ownership is immutable: it is set when a thread is created and never changes, only disappearing
on delete. That makes it safe to cache aggressively, and `ThreadOwnershipResolver` does, so an
authorization check is not a database round-trip per request.

| Tier | What it is | Notes |
| --- | --- | --- |
| L1 | A bounded in-process LRU, `max_size=10_000` entries | Per worker. No expiry. |
| L2 | An optional shared async Redis client | Key prefix `af:authz:owner`. **No expiry** is set, since ownership never changes. Redis errors degrade to the database lookup and never fail a request. |

**Negative results are never cached.** A `None` result means the thread does not exist yet, and
it could become owned by the very next request. Caching that would let a later caller be treated
as the creator of a thread someone else just made.

The L2 tier is wired automatically from `redis` in `agentflow.json`, falling back to
`REDIS_URL`. When neither is set, or when the `redis` package is not installed, the resolver runs
L1-only and logs a warning at startup.

#### The eviction contract

Two methods are part of the backend contract, and a custom backend that caches ownership should
honour both:

| Method | When the server calls it | What it must do |
| --- | --- | --- |
| `evict(thread_id)` | On thread deletion, from `CheckpointerService.delete_thread` | Invalidate any cached owner for that thread, in every tier. Returns the resolver's `evict` coroutine so the caller can `await` it, or `None` when there is nothing to evict. |
| `aclose()` | Once during lifespan shutdown | Close any client the backend opened, such as the L2 Redis connection. |

Skipping `evict` leaves a deleted thread's owner cached, so the id cannot be reused by a
different user until the process restarts.

### Custom authorization backend

Subclass `AuthorizationBackend`. `authorize` is required; `isolation_scope` and `scopes_for`
are optional overrides.

```python
from typing import Any

from agentflow_cli.src.app.core.auth.authorization import AuthorizationBackend


class MyAuthorizationBackend(AuthorizationBackend):
    async def authorize(
        self,
        user: dict[str, Any],
        resource: str,          # "graph" | "checkpointer" | "store" | "files" | "config"
        action: str,            # "invoke" | "stream" | "read" | "write" | "delete" | ...
        resource_id: str | None = None,   # thread_id / memory_id when the path carries one
        **context: Any,
    ) -> bool:
        """Return True to allow, False to deny (403)."""
        if not user.get("user_id"):
            return False
        if resource == "store":
            return user.get("role") == "admin"
        return True

    def isolation_scope(self) -> str:
        """How storage partitions rows for this backend:
        "owner" -> scope every checkpointer/store query to the caller; "none" -> no scoping.
        Stamped server-side into config["user"]["authz"]; the client cannot forge it.
        """
        return "owner"

    def scopes_for(self, user: dict[str, Any]) -> list[str] | None:
        """Scopes this identity carries, or None for unrestricted (the permissive default)."""
        return user.get("scopes")
```

Point `agentflow.json` at it (no `method` wrapper — just the path):

```json
{ "authorization": "graph.auth:MyAuthorizationBackend" }
```

### Resource and action pairs

The server passes these `(resource, action)` pairs to `authorize`. The required **scope** for an
endpoint is `"<resource>:<action>"`.

| Resource | Actions |
| --- | --- |
| `graph` | `invoke`, `stream`, `stop`, `fix`, `setup`, `read` |
| `checkpointer` | `read`, `write`, `delete` |
| `store` | `read`, `write`, `delete` |
| `files` | `upload`, `read` |
| `config` | `read` |

### Role-based access control (no code)

For roles to scopes, use the RBAC config block instead of writing a backend. It loads
`RoleBasedAuthorizationBackend`, which maps roles to scopes on top of the owner-only isolation it
inherits from `OwnershipAuthorizationBackend`:

```json
{
  "authorization": {
    "backend": "rbac",
    "roles": {
      "admin":  ["*"],
      "member": ["graph:invoke", "graph:stream", "graph:read", "checkpointer:read"]
    },
    "default_scopes": ["graph:read"],
    "isolation": "owner"
  }
}
```

| Key | Alias | Meaning |
| --- | --- | --- |
| `backend` | `type` | `"rbac"`, `"role_based"`, or `"roles"`. All three select the same backend. |
| `roles` | `role_scopes` | Role (from the user's `roles` or `role` claim) to the scopes it grants. `"*"` grants every scope. |
| `default_scopes` | — | Granted to everyone, even a user with no role. Defaults to empty. |
| `isolation` | — | `"owner"` (owner-only storage, the default) or `"none"` (see all rows). Any other value falls back to `"owner"`. |

An `authorization` object whose `backend`/`type` is not one of the three RBAC names raises a
`ValueError` at startup.

The same behaviour is available in code when you want to compute the role table at runtime:

```python
from agentflow_cli.src.app.core.auth.authorization import RoleBasedAuthorizationBackend

backend = RoleBasedAuthorizationBackend(
    role_scopes={
        "admin": ["*"],
        "member": ["graph:invoke", "graph:stream", "checkpointer:read"],
    },
    default_scopes=["graph:read"],
    isolation="owner",
)
```

Point `agentflow.json` at it with `"authorization": "module:backend"`. Subclass it when you need
to derive roles from something other than a claim: override `scopes_for` and everything else,
including owner-only thread isolation, still applies.

### Scope precedence

A request is allowed only if the identity's scopes include the endpoint's
`"<resource>:<action>"`. The server resolves that list in a fixed order:

1. `authz.scopes_for(user)` on the configured authorization backend, when it defines one.
2. `user["scopes"]` from the authenticated identity, but **only** when step 1 returned `None`.

A backend that returns a list wins outright; the identity's own `scopes` claim cannot widen it.

The resolved value has three distinct meanings:

| Resolved scopes | Effect |
| --- | --- |
| `None` | **Unrestricted.** The scope check is skipped entirely. This is the permissive default, so nothing breaks until you actually issue scopes. |
| A non-empty list | Only the listed `"<resource>:<action>"` pairs are allowed. Anything else is `403 Missing required scope: <resource>:<action>`. |
| An empty list (`[]`) | **Denies everything.** An empty list is not the same as `None`: no required scope can be a member of it, so every endpoint returns `403`. |

The base `AuthorizationBackend.scopes_for` passes through `user["scopes"]` when it is a list,
tuple, or set, and returns `None` otherwise, which is why an identity with no scopes claim stays
unrestricted.

After a successful check the resolved list is stamped into `user["authz"]["scopes"]` server-side,
so downstream code reads the trusted value rather than anything the client sent.

### Data isolation (the `config["authz"]` contract)

Object-level `authorize` and scope checks run at the API layer. The **data layer** (checkpointer,
store) enforces isolation separately, driven by a trusted policy: after a successful check the
server stamps `user["authz"] = {user_id, scope, scopes}` where `scope` comes from the backend's
`isolation_scope()`. Every service copies that trusted `user` into `config["user"]`, so the
policy reaches the core library and cannot be forged by the client. With `scope: "owner"` the
checkpointer and store scope every row to the caller; with `scope: "none"` they do not.

---

## The boot-time route guard

Authorization is applied per handler with `Depends(RequirePermission(resource, action))`. That is
precise, but it is also easy to forget on a new endpoint, and a forgotten guard ships an open
endpoint. `assert_all_routes_protected` turns that into a startup failure instead: it runs after
the routers are mounted and walks every `APIRoute` and `APIWebSocketRoute`, checking the whole
dependency subtree for a `RequirePermission` instance.

If any non-public route lacks one, the server raises and refuses to start:

```
RuntimeError: Refusing to start: the following routes are not protected by RequirePermission.
Add the dependency, or add the path to the public allowlist if it is intentionally open:
  - POST /v1/my-new-endpoint
```

The check costs nothing per request. Starlette infrastructure routes (`/docs`, `/redoc`,
`/openapi.json`) are not `APIRoute`s and are skipped automatically.

### Public paths

`DEFAULT_PUBLIC_PATHS` is exactly three entries:

| Path | Why it is public |
| --- | --- |
| `/ping` | Health check. Load balancers and orchestrators need it without credentials. |
| `/v1/evals/runs` | Eval report viewer |
| `/v1/evals/runs/{run_id}` | Eval report viewer |

:::warning The eval endpoints are unauthenticated
The eval routes read `eval_reports/*.json` from the server's working directory and serve them to
anyone who can reach the port, regardless of your `auth` setting. They exist as a local report
viewer. On a deployment reachable from a network you do not control, keep `eval_reports/` out of
the working directory or block `/v1/evals/*` at your ingress. See
[REST API: Evals](../rest-api/evals.md).
:::

Adding to the allowlist requires editing the frozenset in the source, which is deliberate: it
makes opening a route a reviewable change rather than a config edit.

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
