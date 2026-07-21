---
title: How to set up checkpointing
sidebar_label: Set up checkpointing
description: Guide to enabling state persistence with InMemoryCheckpointer for development, SqliteCheckpointer for client-side agents, and PgCheckpointer (Redis + PostgreSQL) for production.
keywords:
  - agentflow checkpointing
  - state persistence
  - postgres checkpointer
  - redis checkpointer
  - sqlite checkpointer
  - multi-turn conversation
  - agentflow
sidebar_position: 5
---

# How to set up checkpointing

A checkpointer persists the graph state after every node so that:

- Multi-turn conversations work across separate requests.
- Interrupted executions can be resumed.
- The `stopGraph` API can write a stop flag that the running graph reads.

Without a checkpointer, every `invoke()` call starts fresh with an empty state.

---

## InMemoryCheckpointer (development)

`InMemoryCheckpointer` stores state in a Python dict. It is the default when no checkpointer is passed to `compile()`. Use it for local development, unit tests, and single-process servers.

```python
from agentflow.core.graph import StateGraph, Agent
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.core.state import AgentState, Message

graph = StateGraph()
# ... add nodes and edges ...

checkpointer = InMemoryCheckpointer()
app = graph.compile(checkpointer=checkpointer)

# First turn
app.invoke(
    {"messages": [Message.text_message("Hello, my name is Alice.")]},
    config={"thread_id": "user-1"},
)

# Second turn — same thread_id resumes the conversation
result = app.invoke(
    {"messages": [Message.text_message("What is my name?")]},
    config={"thread_id": "user-1"},
)
print(result["messages"][-1].content)  # "Your name is Alice."
```

`InMemoryCheckpointer` state is lost when the process restarts. For persistence across restarts use `PgCheckpointer`.

---

## PgCheckpointer (production)

`PgCheckpointer` is a dual-layer checkpointer: Redis caches the hot state in memory; PostgreSQL provides durable persistence. Both layers are required.

### Install the extra

```bash
pip install "10xscale-agentflow[pg_checkpoint]"
```

### Minimal setup

```python
from agentflow.storage.checkpointer import PgCheckpointer

checkpointer = PgCheckpointer(
    postgres_dsn="postgresql+asyncpg://user:pass@localhost:5432/mydb",
    redis_url="redis://localhost:6379/0",
)
```

### Full constructor reference

```python
PgCheckpointer(
    # PostgreSQL — provide DSN or an existing asyncpg pool
    postgres_dsn: str | None = None,
    pg_pool = None,                         # asyncpg.Pool, if you manage the pool yourself
    pool_config: dict | None = None,        # extra asyncpg.create_pool() kwargs

    # Redis — provide URL, client, or pool
    redis_url: str | None = None,
    redis = None,                           # redis.asyncio.Redis client
    redis_pool = None,                      # redis.asyncio.ConnectionPool
    redis_pool_config: dict | None = None,  # extra pool kwargs

    # Optional
    schema: str = "public",                 # PostgreSQL schema name

    # Tuning options (passed as keyword args)
    cache_ttl: int = 86400,                 # Redis cache TTL in seconds (24h)
    user_id_type: str = "string",           # "string" | "int" | "bigint"
    id_type: str = "string",                # type of thread_id / message_id
    state_history_limit: int = 20,          # per-thread state snapshots to keep
    enforce_user_isolation: bool = True,    # treat user_id as an ownership boundary
    release_resources: bool = False,        # close pools/clients on release()
)
```

### Multi-user isolation (`enforce_user_isolation`)

By default the checkpointer treats `user_id` as an **ownership boundary**. Threads,
state, and messages are scoped to the `user_id` in the config, so an authenticated
caller cannot read, write, or delete another user's thread even if they know (or
guess) its `thread_id`. Attempting to write to a thread owned by someone else
raises a `StorageError`.

This matters because `thread_id` is client-suppliable. If you run multi-tenant,
leave this on.

```python
checkpointer = PgCheckpointer(
    postgres_dsn="postgresql+asyncpg://user:pass@localhost:5432/mydb",
    redis_url="redis://localhost:6379/0",
    enforce_user_isolation=True,   # default
)
```

**When to turn it off.** Agentflow is a framework, not a product, so this is your
call. Set `enforce_user_isolation=False` when:

- You run **single-tenant** (one user, or an internal service).
- You have **no real user identity** — no auth configured, so every request lands
  under the same placeholder `user_id`, or you pass a dummy/`None` `user_id`.

With it off, `user_id` is ignored for ownership entirely: every query keys on
`thread_id` alone, and the ownership join is skipped (slightly cheaper).

```python
checkpointer = PgCheckpointer(
    postgres_dsn="...",
    redis_url="...",
    enforce_user_isolation=False,   # single-tenant / no user identity
)
```

Only disable it if you are **not** relying on a `thread_id` being secret.

:::note Relationship to auth and authorization
Isolation is only meaningful if a real `user_id` actually reaches the
checkpointer. The API server sets `user_id` from the authenticated user and falls
back to `"anonymous"` when no `auth` is configured — in which case every caller
shares one bucket and isolation is a no-op regardless of this setting.

So: enable [`auth`](#) (e.g. `"auth": "jwt"` in `agentflow.json`) if you want
per-user isolation to mean anything. `authorization` (the `AuthorizationBackend`)
is a separate, coarser layer — it decides *whether* a caller may perform an action
at all; `enforce_user_isolation` decides *whose rows* they can touch in storage.
The two are complementary, and the checkpointer will not second-guess an
allow-all authorization backend: if you disable isolation, it stays disabled.
:::

### State history retention (`state_history_limit`)

Every durable checkpoint appends a **new** versioned row to the `states` table
(`version` 1, 2, 3, …) rather than overwriting the current one. That versioned,
append-only history is what powers the optimistic concurrency check (two
concurrent writers on the same thread cannot collide on a version) and lets you
inspect or recover an earlier snapshot.

At runtime the engine only ever reads the **latest** version, so old snapshots
are not needed for correctness — they exist purely for debugging, audit, and
manual recovery. To keep the table bounded, rows older than
`state_history_limit` are pruned on every write.

You control the trade-off:

```python
from agentflow.storage.checkpointer import PgCheckpointer

checkpointer = PgCheckpointer(
    postgres_dsn="postgresql+asyncpg://user:pass@localhost:5432/mydb",
    redis_url="redis://localhost:6379/0",
    state_history_limit=20,   # default: keep the current state + 19 prior snapshots
)
```

| Value | Behaviour |
|-------|-----------|
| `1` | Keep only the current state per thread (minimal storage; closest to overwrite). |
| `20` (default) | Keep a small bounded audit/rollback window. |
| Higher | Keep a longer history — more storage per active thread. |
| `0` or `None` | Disable pruning entirely (history grows unbounded — not recommended). |

Concurrency safety and correctness are identical at every setting; this knob
only changes how much historical audit trail you retain.

### Using the checkpointer with setup()

For production deployments, call `setup()` before your first request to create the required PostgreSQL tables and Redis indices.

```python
import asyncio
from agentflow.storage.checkpointer import PgCheckpointer

checkpointer = PgCheckpointer(
    postgres_dsn="postgresql+asyncpg://user:pass@localhost:5432/mydb",
    redis_url="redis://localhost:6379/0",
)

asyncio.run(checkpointer.setup())
```

In a FastAPI lifespan handler:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app_: FastAPI):
    await checkpointer.setup()
    yield

app_api = FastAPI(lifespan=lifespan)
```

### Full example with PgCheckpointer

```python
import asyncio
from agentflow.core.graph import StateGraph, Agent
from agentflow.storage.checkpointer import PgCheckpointer
from agentflow.core.state import AgentState, Message

checkpointer = PgCheckpointer(
    postgres_dsn="postgresql+asyncpg://user:pass@localhost:5432/mydb",
    redis_url="redis://localhost:6379/0",
)

graph = StateGraph()
# ... add nodes and edges ...
app = graph.compile(checkpointer=checkpointer)

async def main():
    await checkpointer.setup()

    await app.ainvoke(
        {"messages": [Message.text_message("Remember: the project deadline is Friday.")]},
        config={"thread_id": "project-thread"},
    )

    result = await app.ainvoke(
        {"messages": [Message.text_message("When is the deadline?")]},
        config={"thread_id": "project-thread"},
    )
    print(result["messages"][-1].content)

asyncio.run(main())
```

---

## SqliteCheckpointer (client-side / single-user)

`SqliteCheckpointer` keeps **everything** — durable state, the realtime state cache, messages, and threads — in a single local SQLite `.db` file. No Postgres, no Redis. It is the right choice when the agent runs next to a single user rather than behind a shared server.

**Use it when:**

- You are building a **client-side / desktop agent** — for example a Tauri, Electron, or PyInstaller app that ships a Python sidecar, or a local CLI agent. The state file lives on the user's machine.
- Each user has a **dedicated room / process** with their own database file, so there is exactly one writer per database.

**Do not use it when** many users share one backend. SQLite serializes writers and does not scale horizontally — use `PgCheckpointer` there.

### Install the extra

```bash
pip install "10xscale-agentflow[sqlite_checkpoint]"
```

### Full example with SqliteCheckpointer

```python
import asyncio
from agentflow.core.graph import StateGraph, Agent
from agentflow.storage.checkpointer import SqliteCheckpointer
from agentflow.core.state import AgentState, Message

# Defaults to ~/.agentflow/checkpointer.db when no path is given.
checkpointer = SqliteCheckpointer("agent_state.db")

graph = StateGraph()
# ... add nodes and edges ...
app = graph.compile(checkpointer=checkpointer)

async def main():
    await checkpointer.setup()  # optional; tables are also created lazily

    await app.ainvoke(
        {"messages": [Message.text_message("Remember: the project deadline is Friday.")]},
        config={"thread_id": "project-thread"},
    )

    result = await app.ainvoke(
        {"messages": [Message.text_message("When is the deadline?")]},
        config={"thread_id": "project-thread"},
    )
    print(result["messages"][-1].content)

    await checkpointer.arelease()  # close the SQLite connection at shutdown

asyncio.run(main())
```

The `.db` file persists between processes, so restarting the app resumes every thread from disk. Pass `":memory:"` as the path for an ephemeral database (handy in tests).

---

## Environment variable configuration

When you construct `PgCheckpointer` in Python, read the values from `os.environ` and pass them into the constructor.

```python
import os

from agentflow.storage.checkpointer import PgCheckpointer

checkpointer = PgCheckpointer(
    postgres_dsn=os.environ["DATABASE_URL"],
    redis_url=os.environ["REDIS_URL"],
)
```

Set the environment variables before starting your app:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/mydb
REDIS_URL=redis://localhost:6379/0
```

When using `agentflow api` (the CLI server), configure the checkpointer in `agentflow.json` rather than in code. The server handles `setup()` automatically on startup.

```json
{
    "agent": "graph:app",
    "checkpointer": {
        "type": "pg_checkpoint",
        "postgres_dsn": "${DATABASE_URL}",
        "redis_url": "${REDIS_URL}"
    }
}
```

---

## Thread isolation

Each unique `thread_id` in `config` is a separate conversation thread with its own isolated state. There is no cross-thread state sharing.

```python
# Two independent conversations, each with their own history
result_a = app.invoke(input_a, config={"thread_id": "user-alice"})
result_b = app.invoke(input_b, config={"thread_id": "user-bob"})
```

---

## Durability guarantees (PgCheckpointer)

### Per-step durable checkpoints

By default the runtime writes a durable checkpoint after every completed step, not only at terminal points. A process killed mid-run therefore replays at most one node instead of resuming from the last completion (or from the beginning once the Redis cache had expired). Only messages not yet persisted are written, so a long run does not re-upsert its whole history on each step.

Turn it off per run when you would rather trade crash granularity for fewer database writes:

```python
result = app.invoke(
    input_data,
    config={"thread_id": "t-1", "durable_checkpoint_every_step": False},
)
```

| Key | Default | Effect |
|---|---|---|
| `durable_checkpoint_every_step` | `True` | Persist state and new messages after each completed step. When `False`, only the realtime sync runs per step and durable writes happen at terminal points. |

### Optimistic concurrency and `StaleStateError`

State rows are versioned. When a run reads state, the checkpointer stamps the version into `config["_checkpoint_version"]`. The next write is a compare-and-swap under a per-thread row lock: if another execution advanced the thread in the meantime, the write is rejected instead of silently overwriting it.

```python
from agentflow.core.exceptions import StaleStateError

try:
    result = await app.ainvoke(input_data, config=config)
except StaleStateError as exc:
    # error_code == "STORAGE_CONFLICT_001"
    # exc.context carries thread_id, expected_version, current_version
    ...
```

On conflict the cached state for that thread is invalidated, so the next read comes from Postgres rather than re-seeding the same doomed version. The usual recovery is to re-read the thread and retry the turn.

This is what makes it safe to run several server instances against one thread: concurrent turns fail loudly instead of clobbering each other.

### Tool idempotency ledger

Completed tool calls are recorded in a `tool_executions` table keyed by `(thread_id, tool_call_id)`. The result is written as soon as the tool returns.

Before a tool runs, the ledger is consulted. A hit means that exact tool call already completed in an earlier attempt at this node, so the tool is not called again and the recorded result is returned. This is what stops a node replayed after a crash from re-firing side effects such as a payment or an email.

Failure behaviour is deliberately asymmetric:

| Operation | On failure |
|---|---|
| Ledger read | Falls back to "no record". The tool runs again (at-least-once), and the run continues. |
| Ledger write | Raises. Failing to record a completed side effect is what causes a double execution on the next replay, so the caller must know. |

The ledger table is created by `checkpointer.setup()` as part of schema version 3.

---

## Choosing a checkpointer

| Scenario | Checkpointer |
|---|---|
| Local development, tests | `InMemoryCheckpointer` |
| Single-server stateless API (no resume needed) | `InMemoryCheckpointer` |
| Client-side / desktop agent (Tauri, Electron, CLI) | `SqliteCheckpointer` |
| Dedicated room/process per user, one DB file each | `SqliteCheckpointer` |
| Production multi-turn chat | `PgCheckpointer` |
| Interrupt-and-resume workflows | `PgCheckpointer` |
| Horizontal scaling (multiple server instances) | `PgCheckpointer` |

---

## What you learned

- Pass `checkpointer=...` to `graph.compile()` to enable state persistence.
- `InMemoryCheckpointer` is the default; state is lost on process restart.
- `SqliteCheckpointer` requires `pip install 10xscale-agentflow[sqlite_checkpoint]` and stores everything in one local `.db` file — ideal for client-side / single-user agents, not for shared multi-user servers.
- `PgCheckpointer` requires `pip install 10xscale-agentflow[pg_checkpoint]` and both a PostgreSQL DSN and a Redis URL.
- Call `checkpointer.setup()` before the first request to create the database schema.
- Thread isolation is automatic: each `thread_id` is a fully independent conversation.
- `PgCheckpointer` checkpoints durably after every step (`durable_checkpoint_every_step`, default `True`), guards concurrent writes with optimistic versioning (`StaleStateError`), and de-duplicates completed tool calls through the `tool_executions` ledger.
