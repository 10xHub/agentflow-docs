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
)
```

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
