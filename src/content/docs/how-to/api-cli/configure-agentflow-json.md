---
title: Configure 10xgraph.json
description: Task guide for setting the common 10xgraph.json keys, wiring a checkpointer, store and auth, and keeping separate configs per environment.
section: How-to guides
group: CLI
order: 890
label: Configure 10xgraph.json
updated: "2026-10-06"
---

`10xgraph.json` tells the API server which graph to serve and how to secure it. This guide covers how to set the keys you reach for most often. For every key, type and default, see the [10xgraph.json reference](/docs/reference/api-cli/configuration).

## Start with the agent key

Only `agent` is required. It is a `module:attribute` path to your compiled graph:

```json
{
  "agent": "graph.react:app",
  "env": ".env"
}
```

The module is imported when the server starts, and `app` must be a compiled graph (`state_graph.compile()`). If the import fails, the server does not start. Test it by hand:

```bash
python -c "from graph.react import app; print(type(app))"
```

`env` names a dotenv file loaded before your graph module is imported. Use it for local secrets, never commit it, and in production pass variables through the container or process environment instead.

## Persist conversations with a checkpointer

Pass the checkpointer to `compile()` in your graph module. The server uses whatever the compiled graph carries. The `checkpointer` key in `10xgraph.json` is recognised but not applied by the API server, so setting it has no effect.

```python
# graph/dependencies.py
from tenxgraph.storage.checkpointer import PgCheckpointer

my_checkpointer = PgCheckpointer(
    postgres_dsn="postgresql://user:password@localhost/agentflow",
    redis_url="redis://localhost:6379/0",
)
```

```python
# graph/react.py
from graph.dependencies import my_checkpointer

app = state_graph.compile(checkpointer=my_checkpointer)
```

`PgCheckpointer` needs `pip install "10xgraph[pg_checkpoint]"`. Without a checkpointer, `compile()` falls back to `InMemoryCheckpointer`: threads work while the process runs, but are lost on restart and are not shared across workers. See [Set up checkpointing](/docs/how-to/python/set-up-checkpointing).

## Enable the memory store endpoints

The `store` key points at a `BaseStore` instance (not a class). Without it, the `/v1/store/*` endpoints report that no store is configured.

```python
# graph/dependencies.py
from tenxgraph.storage.store import QdrantStore
from tenxgraph.storage.store.embedding import OpenAIEmbedding

my_store = QdrantStore(embedding=OpenAIEmbedding(), path="./qdrant_data")
```

```json
{
  "agent": "graph.react:app",
  "store": "graph.dependencies:my_store"
}
```

Loading fails at startup with a clear error if the attribute is not a `BaseStore`. For tests, `tenxgraph.qa.testing.InMemoryStore` satisfies the same key.

## Inject your own services

The `injectq` key points at an `InjectQ` container. Use it when nodes or tools need services resolved at startup, such as a database session factory or an HTTP client:

```python
# graph/dependencies.py
from injectq import InjectQ

container = InjectQ()
container.bind_instance(MyDatabase, MyDatabase(dsn=os.environ["DATABASE_URL"]))
```

```json
{
  "agent": "graph.react:app",
  "injectq": "graph.dependencies:container"
}
```

The container becomes the global instance on load, so the server's own bindings land in the same container as yours. Bind a `BaseRateLimitBackend` here when you use `"backend": "custom"` for rate limiting.

## Name threads

Set `thread_name_generator` to a `module:Class` path to give new threads readable names instead of raw UUIDs:

```python
# graph/thread_name_generator.py
from agentflow_cli.src.app.utils.thread_name_generator import ThreadNameGenerator

class MyThreadNameGenerator(ThreadNameGenerator):
    async def generate_name(self, messages: list[str]) -> str:
        return "thoughtful-conversation"
```

```json
{
  "agent": "graph.react:app",
  "thread_name_generator": "graph.thread_name_generator:MyThreadNameGenerator"
}
```

## Turn on auth, authorization and rate limits

These keys have their own guides:

| Key | Guide |
|---|---|
| `auth` | [Add JWT authentication](/docs/how-to/api-cli/add-auth) |
| `authorization` | [Auth and authorization](/docs/how-to/production/auth-and-authorization) |
| `rate_limit` | [Configure rate limiting](/docs/how-to/api-cli/configure-rate-limiting) |

A minimal secured config looks like this:

```json
{
  "agent": "graph.react:app",
  "auth": "jwt",
  "authorization": "ownership",
  "rate_limit": { "backend": "redis", "redis": { "url": "redis://localhost:6379/1" }, "requests": 100, "window": 60 }
}
```

`"auth": "jwt"` needs `JWT_SECRET_KEY` in the environment. `ownership` makes threads owner-only. The server checks `resource:action` scopes on every endpoint through the authorization backend, and the `rbac` backend maps roles to those scopes.

## Share a Redis URL

The `redis` key is a plain URL string used by the shared tier of the thread-ownership cache. When unset, the server falls back to the `REDIS_URL` environment variable. With neither, the cache is per process and the server logs a warning. It is separate from `rate_limit.redis`, so configure both if you want both backed by Redis.

## Set defaults for test and eval

The optional `test` and `evaluation` blocks supply defaults for `10xgraph test` and `10xgraph eval`. CLI flags win over the file:

```json
{
  "agent": "graph.react:app",
  "test": { "path": "tests", "coverage": true, "coverage_threshold": 80 },
  "evaluation": { "directory": "evals", "output_dir": "eval_reports", "threshold": 0.9 }
}
```

```bash
10xgraph test tests/unit/            # overrides test.path
10xgraph test --coverage             # overrides test.coverage
10xgraph eval --output ci_reports/   # overrides evaluation.output_dir (short form: -o)
10xgraph eval --threshold 0.95
10xgraph eval --parallel --max-concurrency 16
```

Evaluation criteria do not come from `10xgraph.json`. They come from `confeval.py` in your evals directory. See [Run evals](/docs/how-to/api-cli/run-evals).

## Keep one config per environment

Use separate files and pick one with `--config`:

```
config/
  dev.json
  staging.json
  prod.json
```

```bash
10xgraph api --config config/dev.json
MODE=production 10xgraph api --config config/prod.json --no-reload
```

## Validate before you deploy

Run `10xgraph audit` to check the interpreter, packages, project config and port. Then start the server and call the health endpoint:

```bash
10xgraph audit
10xgraph api &
curl http://127.0.0.1:8000/ping
```

## Common config issues

| Symptom | Check |
|---|---|
| Module not found | The module path is spelled correctly and the module exists in your project. |
| Attribute not found | `graph.react:app` needs an `app` variable in `graph/react.py`. |
| Checkpointer database connection failed | The DSN is correct and the database is reachable (`psql <dsn>`). |
| `JWT_SECRET_KEY` not found | Export it, or set `"env": ".env"` and add it there. |
