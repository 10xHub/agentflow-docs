---
title: agentflow.json Configuration — Production how-to
sidebar_label: agentflow.json Config
description: Complete reference for the agentflow.json configuration file. Covers agent, auth, checkpointer, store, rate limiting, injectq, thread name generator, authorization, and environment loading.
keywords:
  - agentflow.json
  - agentflow config
  - agentflow configuration
  - python ai agent framework
---

# agentflow.json configuration

`agentflow.json` is the single configuration file that controls every behavior of the AgentFlow server. The `agentflow api` command reads it at startup. This page documents every supported field.

## Minimal example

```json
{
  "agent": "graph.agent:app",
  "env": ".env",
  "auth": null,
  "thread_name_generator": null
}
```

## Full example

```json
{
  "agent": "graph.agent:app",
  "env": ".env",
  "auth": "jwt",
  "authorization": "graph.agent:MyAuthorizationBackend",
  "checkpointer": null,
  "injectq": "graph.agent:container",
  "store": null,
  "redis": null,
  "thread_name_generator": "graph.thread_name_generator:MyNameGenerator",
  "rate_limit": {
    "enabled": true,
    "backend": "redis",
    "requests": 100,
    "window": 60,
    "by": "user",
    "trusted_proxy_headers": true,
    "trusted_proxy_hops": 1,
    "exclude_paths": ["/health", "/docs", "/redoc", "/openapi.json"],
    "redis": {
      "url": "redis://localhost:6379/0",
      "prefix": "agentflow:rate-limit"
    },
    "fail_open": true
  },
  "websocket": {
    "max_connections": 100
  },
  "observability": {
    "level": "standard",
    "logfire": {"enabled": true, "service_name": "my-agent"},
    "langsmith": {"enabled": false, "project": "my-agent"}
  }
}
```

:::note `auth` as an object needs both keys
`"auth": "jwt"` is a bare string. The object form is only for custom backends and requires **both** `method` and `path`: `{"method": "custom", "path": "auth.agent_auth:AgentAuth"}`. An object missing either key raises a `ValueError` at startup.
:::

---

## Field reference

### `agent` (required)

**Type:** `string`

Import path to your compiled graph, in `module:attribute` format.

```json
"agent": "graph.agent:app"
```

The server imports the module and retrieves the attribute. The attribute must be a `CompiledGraph` instance, a callable that returns one, or an async callable that returns one.

- `"graph.agent:app"` — retrieves the `app` variable from `graph/agent.py`
- `"mypackage.graph:build_graph"` — calls `build_graph()` synchronously
- `"mypackage.graph:async_build"` — calls `await async_build()` asynchronously

The module must be importable from the working directory where `agentflow api` is started. The loader inserts the project root into `sys.path` automatically.

---

### `env`

**Type:** `string | null` — Default: `null`

Path to a `.env` file. Loaded with `python-dotenv` before the graph module is imported, so environment variables are available during graph initialization.

```json
"env": ".env"
```

Environment variable references in the value are expanded. If the file does not exist, it is silently skipped. Setting `null` or omitting the field disables `.env` loading.

---

### `auth`

**Type:** `null | "jwt" | object` — Default: `null`

Controls authentication. When `null`, all requests are accepted without credentials (skip the entire auth layer).

#### No authentication

```json
"auth": null
```

All endpoints pass through without credential checks. Safe for internal networks or local development. Not recommended for public deployments.

#### JWT authentication

```json
"auth": "jwt"
```

or equivalently:

```json
"auth": {"method": "jwt"}
```

Validates `Authorization: Bearer <token>` using PyJWT. Requires two environment variables to be set before the server starts:

| Variable | Description |
| --- | --- |
| `JWT_SECRET_KEY` | Signing secret (32+ characters recommended in production) |
| `JWT_ALGORITHM` | Algorithm used to sign tokens (default `HS256`) |

If either variable is missing the server will refuse to start.

The JWT payload must contain a `user_id` field. The decoded payload is merged into the graph's run config and available to nodes as `config["user_id"]`.

**Error responses:**

| Condition | Error code | Message |
| --- | --- | --- |
| No token | `REVOKED_TOKEN` | "Invalid token, please login again" |
| Token expired | `EXPIRED_TOKEN` | "Token has expired, please login again" |
| Invalid signature | `INVALID_TOKEN` | "Invalid token, please login again" |
| `user_id` missing | `INVALID_TOKEN` | "Invalid token, user_id missing" |

**Install PyJWT:**

```bash
pip install "10xscale-agentflow-cli[jwt]"
```

#### Custom authentication

```json
"auth": {
  "method": "custom",
  "path": "auth.agent_auth:AgentAuth"
}
```

Loads and instantiates the class at the given import path. The class must subclass `BaseAuth` and implement the `authenticate` method:

```python
from agentflow_cli import BaseAuth
from fastapi import Request, Response
from fastapi.security import HTTPAuthorizationCredentials

class AgentAuth(BaseAuth):
    def authenticate(
        self,
        request: Request,
        response: Response,
        credential: HTTPAuthorizationCredentials,
    ) -> dict | None:
        # Validate credential.credentials
        # Return dict with at least "user_id" on success
        # Raise an exception on failure
        return {"user_id": "user-123", "role": "admin"}
```

The return value is merged into the graph's run config. The server checks that `user_id` is present; if not, a warning is logged but the request proceeds.

---

### `authorization`

**Type:** `string | null` — Default: `null`

Import path to a custom `AuthorizationBackend` class or instance, in `module:attribute` format.

```json
"authorization": "graph.agent:MyAuthorizationBackend"
```

When `null`, the built-in `DefaultAuthorizationBackend` is used, which allows all requests as long as a valid `user_id` is present.

To implement custom RBAC:

```python
from agentflow_cli.src.app.core.auth.authorization import AuthorizationBackend

class MyAuthorizationBackend(AuthorizationBackend):
    async def authorize(
        self,
        user: dict,
        resource: str,
        action: str,
        resource_id: str | None = None,
        **context,
    ) -> bool:
        if user.get("role") == "admin":
            return True
        if resource == "graph" and action == "invoke":
            return True
        return False
```

The `resource` and `action` values match the [permission reference](./api-reference.md#permission-reference) in the API docs.

---

### `checkpointer`

**Type:** `string | null` — Default: `null`

Import path to a `BaseCheckpointer` instance, in `module:attribute` format.

```json
"checkpointer": "graph.agent:my_checkpointer"
```

When `null`, threads are stateless. Thread endpoints (`/v1/threads/...`) require a checkpointer to be configured.

The server loads the object at the path and binds it as a `BaseCheckpointer` in the dependency injection container. Both `InMemoryCheckpointer` (dev) and `PgCheckpointer` (production) implement this interface.

See [Checkpointing](./checkpointing.md) for setup instructions.

---

### `injectq`

**Type:** `string | null` — Default: `null`

Import path to an `InjectQ` container instance, in `module:attribute` format.

```json
"injectq": "graph.agent:container"
```

When set, the server uses your container as the global DI container, inheriting all your bindings (database connections, API clients, custom services, etc.). The container must be an `InjectQ` instance.

When `null`, the server creates a default `InjectQ` container automatically.

```python
# graph/agent.py
from injectq import InjectQ
from my_services import DatabaseService, ApiClient

container = InjectQ()
container.bind(DatabaseService)
container.bind_instance(ApiClient, ApiClient(api_key=os.environ["MY_API_KEY"]))
```

---

### `store`

**Type:** `string | null` — Default: `null`

Import path to a `BaseStore` instance, in `module:attribute` format.

```json
"store": "graph.agent:my_store"
```

When set, enables the `/v1/store/...` endpoints for semantic memory storage and retrieval. The object must implement `BaseStore`.

When `null`, store endpoints are mounted but return errors because no backend is bound.

---

### `redis`

**Type:** `string | null` — Default: `null`

Redis connection URL. Used as a fallback Redis URL for features that need Redis (e.g. checkpointer, publisher).

```json
"redis": "redis://localhost:6379/0"
```

Note: the `rate_limit` block has its own `redis` sub-key that takes precedence for rate limiting. This top-level `redis` key is for other components.

---

### `thread_name_generator`

**Type:** `string | null` — Default: `null`

Import path to a `ThreadNameGenerator` class or instance, in `module:attribute` format.

```json
"thread_name_generator": "graph.thread_name_generator:MyNameGenerator"
```

When set, the server calls the generator when a new thread is created to produce a human-readable name (e.g. `"thoughtful-dialogue"`).

The class must subclass `ThreadNameGenerator`:

```python
from agentflow_cli.src.app.utils.thread_name_generator import ThreadNameGenerator

class MyNameGenerator(ThreadNameGenerator):
    def generate(self) -> str:
        # Return any string
        return "session-" + str(int(time.time()))
```

When `null`, threads get IDs but no human-readable names.

---

### `rate_limit`

**Type:** `object | null` — Default: `null`

When present and `enabled: true`, applies rate limiting to all incoming requests.

```json
"rate_limit": {
  "enabled": true,
  "backend": "memory",
  "requests": 100,
  "window": 60,
  "by": "ip",
  "trusted_proxy_headers": false,
  "exclude_paths": ["/health", "/docs", "/redoc", "/openapi.json"],
  "fail_open": true
}
```

#### `rate_limit` fields

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `enabled` | `bool` | No | `true` | Set to `false` to disable rate limiting while keeping the config in place. |
| `backend` | `string` | No | `"memory"` | Storage backend: `"memory"`, `"redis"`, or `"custom"`. |
| `requests` | `int` | No | `100` | Maximum requests allowed in the time window. Must be > 0. |
| `window` | `int` | No | `60` | Time window in seconds. Must be > 0. |
| `by` | `string` | No | `"ip"` | Bucket key: `"ip"` (per client address), `"user"` (per authenticated `user_id`, falling back to `ip:<address>` for anonymous callers), or `"global"` (one counter for everyone). |
| `trusted_proxy_headers` | `bool` | No | `false` | When `true`, resolves the client IP from `X-Forwarded-For`. Enable only when the server is behind a proxy you control. |
| `trusted_proxy_hops` | `int` | No | `1` | How many proxies of your own sit in front of the app. Entries are counted from the **right** of `X-Forwarded-For`, since only those were appended by your infrastructure. Must be >= 1. |
| `exclude_paths` | `string[]` | No | `[]` | Request paths that bypass rate limiting entirely. |
| `fail_open` | `bool` | No | `true` | When the backend is unavailable: `true` = allow the request, `false` = deny it (429). |

Two behaviours that are not obvious from the field list:

- **WebSocket handshakes count against the same bucket.** Rate-limit middleware is HTTP-only, so `/v1/graph/ws` and `/v1/graph/live` re-apply the check at the handshake using the same backend and key. Exceeding the limit closes the handshake with code `1013`, not with an HTTP 429.
- **`"backend": "memory"` counts per process** and logs a warning at startup. With N workers the effective limit is `requests x N`, and it resets on every worker restart. Use Redis for anything multi-worker.

#### Memory backend (default)

```json
"rate_limit": {
  "enabled": true,
  "backend": "memory",
  "requests": 100,
  "window": 60,
  "by": "ip"
}
```

Uses an in-process sliding window counter. Counters are lost on server restart. Not shared across multiple server instances. Suitable for single-process development and testing.

#### Redis backend (production)

```json
"rate_limit": {
  "enabled": true,
  "backend": "redis",
  "requests": 200,
  "window": 60,
  "by": "ip",
  "trusted_proxy_headers": true,
  "exclude_paths": ["/health", "/docs", "/redoc", "/openapi.json"],
  "redis": {
    "url": "redis://localhost:6379/0",
    "prefix": "agentflow:rate-limit"
  },
  "fail_open": true
}
```

The `redis` sub-key accepts:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | `string` | — | Redis connection URL. Supports environment variable expansion: `"$REDIS_URL"`. |
| `prefix` | `string` | `"agentflow:rate-limit"` | Key prefix for all rate-limit keys in Redis. |

The `url` field also accepts a bare string as shorthand: `"redis": "redis://localhost:6379/0"`.

Redis rate limits survive server restarts and are shared across all server instances behind a load balancer.

#### Custom backend

```json
"rate_limit": {
  "enabled": true,
  "backend": "custom",
  "requests": 100,
  "window": 60,
  "by": "ip"
}
```

When `backend` is `"custom"`, bind a `BaseRateLimitBackend` instance in your InjectQ container before the server starts.

---

### `websocket`

**Type:** `object | null`

Per-process limits for the WebSocket endpoints.

```json
"websocket": {
  "max_connections": 100
}
```

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `max_connections` | `int \| null` | No | `null` | Maximum concurrent WebSocket connections this server **process** accepts, counted across `/v1/graph/ws` and `/v1/graph/live` together. `null` or `0` means unlimited. A negative value raises a `ValueError` at startup. |

Exceeding the cap refuses the handshake before `accept()` with close code `1013` (Try Again Later), so the client gets a clean rejection rather than a socket that opens and immediately dies. The slot is released when the handler returns or the client disconnects.

The counter is per process, like the in-memory rate-limit backend. With four workers, `max_connections: 100` allows up to 400 concurrent sockets across the deployment. Size it per worker.

---

### `observability`

**Type:** `object | null`

Declarative Logfire and LangSmith tracing setup, passed through to the core framework's observability configuration.

```json
"observability": {
  "level": "standard",
  "logfire":   {"enabled": true, "service_name": "my-agent"},
  "langsmith": {"enabled": true, "project": "my-agent", "endpoint": null}
}
```

Secrets stay in the environment: `LOGFIRE_TOKEN` and `LANGSMITH_API_KEY` are read from there and are never read from this file.

---

## Environment variable expansion

String values in `agentflow.json` support environment variable expansion. Use standard shell syntax:

```json
"redis": {
  "url": "$REDIS_URL"
}
```

or with braces:

```json
"redis": {
  "url": "${REDIS_URL}"
}
```

The server raises a `ValueError` at startup if a referenced variable is not set in the environment.

---

## Config discovery

The `agentflow api` command looks for the config file in this order:

1. The path passed via `--config` (default `agentflow.json`)
2. `agentflow.json` in the current directory
3. `.agentflow.json` in the current directory
4. `agentflow.config.json` in the current directory

The first file found is used.

---

## Complete field summary

| Field | Type | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| `agent` | `string` | **Yes** | — | Graph import path (`module:attribute`) |
| `env` | `string \| null` | No | `null` | `.env` file to load |
| `auth` | `null \| "jwt" \| object` | No | `null` | Authentication backend |
| `authorization` | `string \| null` | No | `null` | RBAC authorization backend |
| `checkpointer` | `string \| null` | No | `null` | Thread state persistence backend |
| `injectq` | `string \| null` | No | `null` | Dependency injection container |
| `store` | `string \| null` | No | `null` | Semantic memory store backend |
| `redis` | `string \| null` | No | `null` | Redis URL for shared components |
| `thread_name_generator` | `string \| null` | No | `null` | Human-readable thread name generator |
| `rate_limit` | `object \| null` | No | `null` | Rate limiting configuration |
| `websocket` | `object \| null` | No | `null` | WebSocket connection limits (`max_connections`) |
| `observability` | `object \| null` | No | `null` | Logfire / LangSmith tracing setup |
