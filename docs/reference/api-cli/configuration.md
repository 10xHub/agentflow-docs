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
  "env": ".env",
  "auth": "jwt"
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

Import path to a custom authorization backend.

```json
"authorization": "graph.auth:my_authorization_backend"
```

See [Auth](./auth.md) for details on building a custom authorization backend.

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

## Loading order

When the CLI starts:

1. Reads `agentflow.json`
2. Loads `.env` if `env` is set
3. Imports the module specified in `agent` and gets the compiled graph
4. Imports and configures `checkpointer`, `store`, `injectq`, and `authorization` if set
5. Starts the FastAPI server
