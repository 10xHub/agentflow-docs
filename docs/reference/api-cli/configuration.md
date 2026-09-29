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
  "store": "graph.dependencies:my_store",
  "injectq": "graph.dependencies:container",
  "thread_name_generator": "graph.thread_name_generator:MyNameGenerator",
  "authorization": "graph.auth:my_authorization_backend",
  "redis": "redis://localhost:6379/0",
  "env": ".env",
  "auth": "jwt",
  "remote_tools": [
    {
      "node": "tools",
      "name": "read_clipboard",
      "description": "Read clipboard text from the client.",
      "parameters": {"type": "object", "properties": {}, "required": []}
    }
  ],
  "rate_limit": {
    "enabled": true,
    "backend": "memory",
    "requests": 100,
    "window": 60,
    "by": "ip",
    "exclude_paths": ["/ping", "/docs", "/redoc", "/openapi.json"],
    "fail_open": true
  },
  "websocket": {
    "max_connections": 100,
    "max_connections_per_user": 10,
    "realtime_models": ["gemini-2.5-flash-live"]
  },
  "ag_ui": {
    "enabled": false
  },
  "observability": {
    "level": "standard",
    "logfire": {"enabled": true, "service_name": "my-agent"},
    "langsmith": {"enabled": false, "project": "my-agent"}
  },
  "test": {
    "path": "tests",
    "coverage": true,
    "coverage_threshold": 80
  },
  "evaluation": {
    "directory": "evals",
    "output_dir": "eval_reports",
    "threshold": 0.75
  }
}
```

`checkpointer` is also a recognised key, but the API server does not apply it yet; see
[`checkpointer`](#checkpointer).

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

The key is recognised, but the API server does **not** apply it yet: the loader never imports
it, so setting it has no effect on the running graph. `agentflow config` shows a warning for it.
Pass the checkpointer to `compile()` in your graph module instead, and the server uses whatever
the compiled graph carries:

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer

checkpointer = InMemoryCheckpointer()
app = graph.compile(checkpointer=checkpointer)
```

If you pass none, `compile()` falls back to an `InMemoryCheckpointer`: threads work, but they
live only in that process and are lost on restart.

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

### `remote_tools`

Trusted schemas for tools whose handlers run in the TypeScript client. Schemas are validated and
attached once at startup; clients cannot mutate them.

```json
"remote_tools": [
  {
    "node": "tools",
    "name": "read_clipboard",
    "description": "Read clipboard text from the client.",
    "parameters": {"type": "object", "properties": {}, "required": []}
  }
]
```

`node_name` is an accepted alias for `node`. Unknown fields and duplicate names fail startup.
AG-UI clients do not need entries here: the [`ag_ui`](#ag_ui) endpoint offers each client's own
tools to the model for that run.
Run `agentflow audit` in the project directory to check these schemas before starting the API;
it exits with status `1` when validation fails.

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
  "exclude_paths": ["/ping", "/docs", "/redoc", "/openapi.json"]
}
```

Omit this field (or set it to `null`) to disable rate limiting entirely. A block with
`"enabled": false` keeps the settings without enforcing them.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Whether the limiter runs. The strings `"true"`/`"false"` (and `"1"`/`"0"`, `"yes"`/`"no"`, `"on"`/`"off"`) are accepted. |
| `requests` | integer | `100` | Requests allowed per window. Must be positive. |
| `window` | integer | `60` | Window length in seconds. Must be positive. |
| `by` | string | `"ip"` | Bucket key: `"ip"`, `"user"`, or `"global"`. |
| `backend` | string | `"memory"` | `"memory"`, `"redis"`, or `"custom"`. `custom` needs a `BaseRateLimitBackend` bound in InjectQ. |
| `exclude_paths` | string array | `[]` | Paths that bypass the limiter. |
| `trusted_proxy_headers` | boolean | `false` | Key by `X-Forwarded-For` instead of the peer address. Enable only behind a proxy you control. |
| `trusted_proxy_hops` | integer | `1` | How many of your own proxies append to `X-Forwarded-For`; the entry that many places from the right is used. Must be `>= 1`. |
| `trusted_proxies` | string array | `[]` | IPs or CIDR ranges your proxies connect from. When set, `X-Forwarded-For` is honoured only for requests whose peer is in one of them. An invalid network raises a `ValueError`. |
| `redis` | object or string | none | Redis connection for the `redis` backend: `{"url": "...", "prefix": "..."}`, or the URL as a bare string. `url` supports `$VAR`/`${VAR}`. Not needed when a Redis client is bound in InjectQ. |
| `redis.prefix` | string | `"agentflow:rate-limit"` | Key prefix for all Redis entries. |
| `fail_open` | boolean | `true` | What the Redis backend does when Redis errors: `true` allows the request, `false` denies it. |

The block is parsed when the app is built, so an invalid value stops the server from starting.

Rate limiting also gates WebSocket handshakes on `/v1/graph/ws` and `/v1/graph/live`, sharing the
same backend and bucket as REST requests.

For bucket keys, proxy hops, backend options, response headers, and the custom backend interface
see [Rate Limiting](./rate-limiting.md).

---

### `websocket`

Per-process limits for the WebSocket endpoints, plus the realtime models a client may pick.

```json
"websocket": {
  "max_connections": 1000,
  "max_connections_per_user": 10,
  "realtime_models": ["gemini-2.5-flash-live"]
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `max_connections` | integer or `null` | `1000` | Maximum concurrent WebSocket connections this server **process** accepts, counted across `/v1/graph/ws` and `/v1/graph/live` together. `null` or `0` means unlimited. Negative values raise a `ValueError`. |
| `max_connections_per_user` | integer or `null` | `10` | How many of those connections one verified user may hold, so a single account cannot take every slot. Applies only when the caller's credential verifies. `null` or `0` means unlimited. |
| `realtime_models` | list of strings | `[]` | Models a `/v1/graph/live` client may request with `model` in its init frame. Any other requested model is ignored and the live agent's own model is used. Empty means clients cannot choose the model. |

Omit the block entirely to use the default limits. A missing field gets its default; only an
explicit `0` or `null` removes a cap. Both WebSocket endpoints are always mounted; there is no
setting that turns them off.

The block is read when a WebSocket connection is opened, not at startup, so an invalid value
(a negative limit, or `realtime_models` that is not a list of strings) surfaces on the first
handshake. Run `agentflow config` to check the block before deploying.

Exceeding either cap refuses the handshake before `accept()` with WebSocket close code `1013`
(Try Again Later), so the client gets a clean rejection instead of a half-open socket. The slot is
released when the handler returns or the client disconnects.

The counter is per process, like the in-memory rate-limit backend. With N workers the effective
cluster-wide limit is `max_connections x N`, so size it per worker.

---

### `ag_ui`

Switch for the [AG-UI](https://docs.ag-ui.com) protocol endpoint, which lets AG-UI clients such
as CopilotKit use your graph. Off by default.

```json
"ag_ui": {
  "enabled": true
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | Whether `POST /v1/ag-ui` is mounted. The strings `"true"`/`"false"` (and `"1"`/`"0"`, `"yes"`/`"no"`, `"on"`/`"off"`) are accepted; any other non-boolean raises a `ValueError` at startup. |

The endpoint needs the `ag-ui` extra:

```bash
pip install "10xscale-agentflow-cli[ag-ui]"
```

If `enabled` is `true` and the package is missing, the server refuses to start and prints that
install command. With the key absent or `enabled: false`, the route is never registered and the
package is never imported.

`POST /v1/ag-ui` uses the same permission as `/v1/graph/stream` (`graph:stream`), and checks that
the caller owns the `threadId` when auth is configured. See
[AgentFlow with CopilotKit](/docs/integrations/agentflow-with-copilotkit) for the full flow.

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

The value is used as-is: `$VAR` and `${VAR}` are **not** expanded here, unlike
`rate_limit.redis`. To take the URL from the environment, leave this key unset and set
`REDIS_URL`.

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

`level` is `"spans"`, `"standard"` (default), or `"full"`; an unknown value logs a warning and
falls back to `"standard"`. Nothing is set up unless `logfire.enabled` or `langsmith.enabled` is
`true`.

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
| `path` | string | none | Default path passed to pytest when no `PATH` argument is given on the CLI. Omit to let pytest auto-discover tests. |
| `coverage` | boolean | `false` | Enable coverage collection by default (equivalent to `--coverage` flag) |
| `coverage_threshold` | integer | none | Minimum coverage percentage (0 to 100) required for a passing run. Adds `--cov-fail-under=N` to the pytest command, so it only applies when coverage is on. Omit to skip threshold enforcement. |

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
  "parallel": true,
  "max_concurrency": 4
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `directory` | string | `"evals"` | Directory scanned for eval files when no `TARGET` argument is given |
| `output_dir` | string | `"eval_reports"` | Directory where HTML and JSON report files are written |
| `threshold` | float | none | Minimum pass rate (0.0 to 1.0) required for a passing run. Omit to skip threshold enforcement. |
| `parallel` | boolean | `false` | Run eval cases concurrently by default (equivalent to `--parallel`) |
| `max_concurrency` | integer | `4` | How many cases run at once when `parallel` is on (equivalent to `--max-concurrency`). Must be `>= 1`. |

Report filenames always carry a timestamp, so runs do not overwrite each other; there is no
setting for it.

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

`agentflow api`, `agentflow play`, and `agentflow dev` read the file named by `--config`
(default `agentflow.json`). A relative path is looked up in the current directory and then in
each parent directory. If it is not found, startup fails with a message listing every location
searched. The resolved path is passed to the server as the `GRAPH_PATH` environment variable;
a server started directly (for example with `gunicorn` from the generated Dockerfile) reads
`GRAPH_PATH`, or `agentflow.json` in the working directory when it is unset.

`agentflow test` and `agentflow eval`, which only read the `test` and `evaluation` blocks, look
for the first of these names in the current directory and its parents:

1. `agentflow.json`
2. `.agentflow.json`
3. `agentflow.config.json`

If none exists they run with their built-in defaults.

---

## Environment variable expansion

Expansion is **not** applied to every string in the file. It applies only to the
rate limiter's Redis URL, `rate_limit.redis`. The top-level `redis` value is used
as-is.

```json
{
  "rate_limit": {"redis": {"url": "${RATE_LIMIT_REDIS_URL}"}}
}
```

Both `$VAR` and `${VAR}` forms work, and the value may be given either as a bare
string or as an object with a `url` key. If the variable is not set in the
environment, startup fails with:

```text
ValueError: Unresolved environment variable in value: ${RATE_LIMIT_REDIS_URL}
```

Every other secret belongs in the environment rather than in this file. Use the
`env` key to point at a `.env`, and read the value from the environment in your
own code.

---

## Loading order

When the server starts:

1. Reads the config file resolved above and loads `.env` if `env` is set
2. Loads the `injectq` container, if set
3. Builds the app: sets up `observability`, parses `rate_limit`, then mounts the routers
   (the AG-UI endpoint only when `ag_ui.enabled` is `true`)
4. On startup, imports the module specified in `agent`, attaches `remote_tools`, and binds
   `store`, `auth`, `thread_name_generator`, and `authorization` (with `redis`) if set
5. Starts serving requests

`websocket` is read per connection, and `checkpointer` is not read at all.
