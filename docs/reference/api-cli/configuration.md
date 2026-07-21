---
title: agentflow.json Configuration
sidebar_label: agentflow.json Configuration
description: Complete reference for all fields in agentflow.json. Part of the AgentFlow agentflow api reference guide for production-ready Python AI agents.
keywords:
  - agentflow api reference
  - rest api documentation
  - agent cli reference
  - agentflow
  - python ai agent framework
  - agentflowjson configuration
---


# agentflow.json configuration

`agentflow.json` is the configuration file the CLI reads at startup. Place it in your project root (next to your `graph/` folder).

## Minimal example

```json
{
  "agent": "graph.react:app"
}
```

## Full example

```json
{
  "agent": "graph.react:app",
  "checkpointer": "graph.dependencies:my_checkpointer",
  "store": "graph.dependencies:my_store",
  "injectq": "graph.dependencies:container",
  "thread_name_generator": "graph.thread_name_generator:MyNameGenerator",
  "authorization": "graph.auth:my_authorization_backend",
  "redis": "redis://localhost:6379/0",
  "env": ".env",
  "auth": "jwt",
  "rate_limit": {
    "enabled": true,
    "backend": "memory",
    "requests": 100,
    "window": 60,
    "by": "ip",
    "exclude_paths": ["/health", "/docs", "/redoc", "/openapi.json"]
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

---

## Fields

### `agent` (required)

The import path to your compiled `CompiledGraph`, in the format `module.path:variable`.

```json
"agent": "graph.react:app"
```

- `graph.react` — the Python module path (relative to the project root)
- `app` — the variable name that holds the compiled graph

The CLI imports this module at startup and calls the variable as the graph for every request.

---

### `checkpointer`

Import path to a `BaseCheckpointer` instance.

```json
"checkpointer": "graph.dependencies:my_checkpointer"
```

If omitted, the graph uses no checkpointer and each request is stateless.

In `graph/dependencies.py`:

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer

my_checkpointer = InMemoryCheckpointer()
```

---

### `store`

Import path to a `BaseStore` instance.

```json
"store": "graph.dependencies:my_store"
```

Required if you want to use the `/v1/store/*` endpoints.

---

### `injectq`

Import path to an `injectq` dependency injection container.

```json
"injectq": "graph.dependencies:container"
```

Use this when your graph nodes or tools depend on services that need to be resolved at startup.

---

### `thread_name_generator`

Import path to a class that generates display names for threads.

```json
"thread_name_generator": "graph.thread_name_generator:MyNameGenerator"
```

The class must implement a `generate(thread_id: str) -> str` method.

---

### `authorization`

Controls object-level access (thread ownership), per-endpoint scopes, and storage isolation.
Accepted values:

| Value | Behaviour |
| --- | --- |
| `null` (unset) | **Mode-based default**: `"ownership"` in production, `"allow_all"` in development. |
| `"ownership"` | Owner-only: a thread is accessible only to the user who created it. |
| `"allow_all"` (aliases `"default"`, `"none"`) | Any authenticated user may do anything. |
| `"module:attr"` | A custom `AuthorizationBackend`. |
| `{ "backend": "rbac", ... }` | Role-based access control (below). `"role_based"` and `"roles"` select the same backend, and `type` is an accepted alias for `backend`. |

An unrecognised string, or an object whose backend name is not one of the RBAC spellings, raises a
`ValueError` at startup rather than falling back to a permissive default.

Built-in owner-only access (no code):

```json
"authorization": "ownership"
```

Role-based access control — maps roles to scopes on top of owner-only isolation:

```json
"authorization": {
  "backend": "rbac",
  "roles": {
    "admin":  ["*"],
    "member": ["graph:invoke", "graph:stream", "graph:read", "checkpointer:read"]
  },
  "default_scopes": ["graph:read"],
  "isolation": "owner"
}
```

See [Auth](./auth.md) for the scope catalog, the custom-backend interface, and how the isolation
policy reaches the storage layer.

---

### `env`

Path to a `.env` file that is loaded before the graph module is imported.

```json
"env": ".env"
```

Variables in this file are available to all modules as `os.environ` values.

---

### `auth`

Authentication method. Accepted values:

| Value | Description |
| --- | --- |
| `null` | No authentication (default) |
| `"jwt"` | JWT bearer token authentication |
| `{"method": "custom", "path": "module:backend"}` | Custom auth backend |

**JWT auth:**

```json
"auth": "jwt"
```

Requires `JWT_SECRET_KEY` and `JWT_ALGORITHM` environment variables.

**Custom auth:**

```json
"auth": {
  "method": "custom",
  "path": "graph.auth:MyAuthBackend"
}
```

See [Auth reference](./auth.md) for the custom backend interface.

---

### `rate_limit`

Sliding-window rate limiter configuration.

```json
"rate_limit": {
  "enabled": true,
  "backend": "memory",
  "requests": 100,
  "window": 60,
  "by": "ip",
  "exclude_paths": ["/health", "/docs", "/redoc", "/openapi.json"]
}
```

Omit this field (or set it to `null`) to disable rate limiting entirely.

Rate limiting also gates WebSocket handshakes on `/v1/graph/ws` and `/v1/graph/live`, sharing the
same backend and bucket as REST requests.

For the full field reference (including `by: "user"` and `trusted_proxy_hops`), backend options,
response headers, and the custom backend interface see [Rate Limiting](./rate-limiting.md).

---

### `websocket`

Per-process limits for the WebSocket endpoints.

```json
"websocket": {
  "max_connections": 100
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `max_connections` | integer or `null` | `null` (unlimited) | Maximum concurrent WebSocket connections this server **process** accepts, counted across `/v1/graph/ws` and `/v1/graph/live` together. `null` or `0` means unlimited. Negative values raise a `ValueError` at startup. |

Omit the block entirely to leave connections unlimited.

Exceeding the cap refuses the handshake before `accept()` with WebSocket close code `1013`
(Try Again Later), so the client gets a clean rejection instead of a half-open socket. The slot is
released when the handler returns or the client disconnects.

The counter is per process, like the in-memory rate-limit backend. With N workers the effective
cluster-wide limit is `max_connections x N`, so size it per worker.

---

### `redis`

A Redis connection URL used by the server itself, as a string.

```json
"redis": "redis://localhost:6379/0"
```

It currently backs the L2 tier of the thread-ownership cache used by the `ownership` and `rbac`
authorization backends. When it is unset the server falls back to the `REDIS_URL` environment
variable; when neither is set, or the `redis` package is not installed, the cache runs in-process
only and logs a warning at startup.

This is separate from `rate_limit.redis`, which configures the rate limiter's own connection. Set
both if you want both features backed by Redis.

---

### `observability`

Declarative tracing setup for Logfire and LangSmith.

```json
"observability": {
  "level": "standard",
  "logfire": {"enabled": true, "service_name": "my-agent"},
  "langsmith": {"enabled": true, "project": "my-agent", "endpoint": null}
}
```

The block is passed through to the core framework's observability setup. Secrets stay in the
environment: `LOGFIRE_TOKEN` and `LANGSMITH_API_KEY` are read from there and are never read from
this file.

---

### `test`

Default settings for `agentflow test`. All fields are optional. CLI flags always take precedence.

```json
"test": {
  "path": "tests",
  "coverage": true,
  "coverage_threshold": 70
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | string | — | Default path passed to pytest when no `PATH` argument is given on the CLI. Omit to let pytest auto-discover tests. |
| `coverage` | boolean | `false` | Enable coverage collection by default (equivalent to `--coverage` flag) |
| `coverage_threshold` | integer | — | Minimum coverage percentage required for a passing run. Adds `--cov-fail-under=N` to the pytest command. Omit to skip threshold enforcement. |

**Example — enforce 80 % coverage on every run:**

```json
{
  "agent": "graph.react:app",
  "test": {
    "path": "tests",
    "coverage": true,
    "coverage_threshold": 80
  }
}
```

---

### `evaluation`

Default settings for `agentflow eval`. All fields are optional. CLI flags always take precedence.

```json
"evaluation": {
  "directory": "evals",
  "output_dir": "eval_reports",
  "threshold": 0.75,
  "timestamp_files": true
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `directory` | string | `"evals"` | Directory scanned for eval files when no `TARGET` argument is given |
| `output_dir` | string | `"eval_reports"` | Directory where HTML and JSON report files are written |
| `threshold` | float | — | Minimum pass rate (0.0–1.0) required for a passing run. Omit to skip threshold enforcement. |
| `timestamp_files` | boolean | `true` | Append a timestamp to report filenames so runs do not overwrite each other |

**Example — enforce 75 % pass rate and write reports to `ci/reports/`:**

```json
{
  "agent": "graph.react:app",
  "evaluation": {
    "directory": "evals",
    "output_dir": "ci/reports",
    "threshold": 0.75
  }
}
```

---

## Loading order

When the CLI starts:

1. Reads `agentflow.json`
2. Loads `.env` if `env` is set
3. Imports the module specified in `agent` and gets the compiled graph
4. Imports and configures `checkpointer`, `store`, `injectq`, and `authorization` if set
5. Starts the FastAPI server
