---
title: agentflow.json Configuration
sidebar_label: agentflow.json Configuration
description: Complete reference for all fields in agentflow.json.
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
  "routers": {
    "evals": false,
    "media": false
  },
  "websocket": {
    "enabled": true,
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

The class must subclass `ThreadNameGenerator` and implement
`async def generate_name(self, messages: list[str]) -> str`. An already-created
instance is also accepted. See [thread name generator](thread-name-generator.md)
for the full interface.

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

### `routers`

Which optional routers the server mounts. Every router is mounted by default, so an absent
block keeps the full API; list a router as `false` to drop it.

```json
"routers": {
  "evals": false,
  "media": false
}
```

| Name | Paths | Disabling it means |
| --- | --- | --- |
| `checkpointer` | `/v1/threads/*` | No thread list, history, state read/write, or message deletion. The playground's thread sidebar and the TypeScript client's `threads()` calls stop working. |
| `store` | `/v1/store/*` | No long-term memory API: create, search, list, or forget memories. |
| `evals` | `/v1/evals/*` | Eval runs cannot be listed or fetched over HTTP. `agentflow eval` on the machine itself is unaffected. |
| `media` | `/v1/files/*`, `/v1/config/multimodal` | No file upload, download, or access URLs, and clients cannot read the multimodal config. Breaks multimodal agents that receive files through the API. |
| `websocket` | `/v1/graph/ws` | No turn-based streaming socket. `POST /v1/graph/stream` (SSE) is the alternative. The realtime bridge `/v1/graph/live` is separate and stays mounted. |

`graph` (`/v1/graph/*`) and `ping` (`/ping`) are always mounted and cannot be listed here.

#### Two spellings for the WebSocket switch

`/v1/graph/ws` can be switched off from either place, so neither is the wrong one to write:

```json
"routers": { "websocket": false }
```

```json
"websocket": { "enabled": false }
```

Setting both is fine. The endpoint is mounted only when neither says `false`, so a config that
says "off" anywhere never ends up serving. If the two are both written and disagree, the
endpoint stays unmounted and the server logs a warning naming both keys; writing only one logs
nothing. The `websocket` block is also where `max_connections` lives, which applies whichever
spelling you use.

A disabled router is never registered, so its paths return `404` with no handler, dependency,
or auth code behind them. Each one logs a line at startup naming the setting that removed it.

#### Bad entries warn, they do not fail the boot

The block is parsed leniently. Each of these logs a `WARNING` at startup and leaves the
router mounted:

- an unknown name, including a typo such as `"eval": false`
- `"graph"` or `"ping"`, which cannot be disabled
- a value that is not a boolean (the strings `"true"`/`"false"` are accepted, as elsewhere in
  this file)
- a `routers` value that is not an object

The consequence is worth stating plainly: `"eval": false` keeps `/v1/evals` serving, and the
startup log is the only place that says so. Check the log after changing this block.

---

### `websocket`

Switch for the streaming WebSocket endpoint, plus per-process connection limits.

```json
"websocket": {
  "enabled": true,
  "max_connections": 100
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Whether `/v1/graph/ws` is mounted. Set to `false` on a deployment that only uses REST and SSE to drop the endpoint entirely. Equivalent to [`routers.websocket`](#routers); if both are written and disagree, the endpoint stays unmounted and startup logs a warning. Values that are not booleans (the strings `"true"`/`"false"` included) raise a `ValueError` at startup. |
| `max_connections` | integer or `null` | `null` (unlimited) | Maximum concurrent WebSocket connections this server **process** accepts, counted across `/v1/graph/ws` and `/v1/graph/live` together. `null` or `0` means unlimited. Negative values raise a `ValueError` at startup. |

Omit the block entirely to keep the endpoint mounted with unlimited connections.

#### Turning the WebSocket endpoint off

```json
"websocket": {
  "enabled": false
}
```

Or, equivalently, `"routers": {"websocket": false}` -- see
[two spellings](#two-spellings-for-the-websocket-switch).

With the endpoint off the route is never registered, so there is no handler, dependency, or
auth code behind that path at all: the server refuses the handshake with HTTP `403` and logs
one line at startup naming the setting. `enabled` does not affect:

- `/v1/graph/stream`, the SSE streaming endpoint, which is the REST alternative to the socket.
- `/v1/graph/live`, the realtime audio bridge, which already rejects non-live graphs with close
  code `1008`.

Clients get no capability hint before connecting -- a browser or the TypeScript client simply
sees the handshake fail -- so switch it off only when nothing you ship uses `/v1/graph/ws`.

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

## File discovery

The CLI resolves the config file in this order and uses the first one it finds:

1. The path passed to `--config`
2. `agentflow.json`
3. `.agentflow.json`
4. `agentflow.config.json`

If none exists, startup fails with a message listing those names.

---

## Environment variable expansion

Expansion is **not** applied to every string in the file. It applies to the
Redis URL in two places: the top-level `redis` value and `rate_limit.redis`.

```json
{
  "redis": {"url": "${REDIS_URL}"},
  "rate_limit": {"redis": {"url": "$RATE_LIMIT_REDIS_URL"}}
}
```

Both `$VAR` and `${VAR}` forms work, and the value may be given either as a bare
string or as an object with a `url` key. If the variable is not set in the
environment, startup fails with:

```text
ValueError: Unresolved environment variable in value: ${REDIS_URL}
```

Every other secret belongs in the environment rather than in this file. Use the
`env` key to point at a `.env`, and read the value from the environment in your
own code.

---

## Loading order

When the CLI starts:

1. Reads the config file resolved above
2. Loads `.env` if `env` is set
3. Imports the module specified in `agent` and gets the compiled graph
4. Imports and configures `checkpointer`, `store`, `injectq`, and `authorization` if set
5. Starts the FastAPI server
