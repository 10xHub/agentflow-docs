---
title: Checkpointing and Threads
sidebar_label: Checkpointing and Threads
description: How checkpointers save and restore conversation state across calls using thread IDs. Part of the AgentFlow agentflow concepts guide for production-ready Python.
keywords:
  - agentflow concepts
  - agent architecture
  - multi-agent orchestration
  - agentflow
  - python ai agent framework
  - checkpointing and threads
sidebar_position: 7
---


# Checkpointing and threads

By default every `app.invoke` call is stateless — each call starts with an empty `AgentState`. A **checkpointer** adds persistence: state is saved after each node run and restored at the start of the next call for the same thread.

## The config dict

Every checkpointer method accepts a `config` dict. At minimum it must contain a `thread_id`:

```python
config = {
    "thread_id": "conv-abc123",   # required — identifies the conversation
    "user_id": "user-42",         # optional — used by PgCheckpointer for row scoping
}
```

`thread_id` is the primary key for all state, message, and thread-info operations. `user_id` scopes data within a multi-tenant deployment and is used by `PgCheckpointer` when you query threads for a specific user.

## Thread lifecycle

```mermaid
flowchart LR
  NewCall[invoke with thread_id] --> Check{Thread exists?}
  Check -->|no| CreateState[Create fresh AgentState]
  Check -->|yes| LoadState[Load saved AgentState]
  CreateState --> RunGraph[Run graph nodes]
  LoadState --> RunGraph
  RunGraph --> SaveState[Save updated AgentState]
  SaveState --> Return[Return result to caller]
```

A thread is created on the first call and persists until you explicitly delete it. For `InMemoryCheckpointer` data is lost on process restart; `PgCheckpointer` survives restarts.

## Attaching a checkpointer

Pass the checkpointer to `graph.compile()`:

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.core.state import AgentState, Message

checkpointer = InMemoryCheckpointer()
app = graph.compile(checkpointer=checkpointer)
```

Provide `thread_id` in every call. The first argument is always a dict with a `"messages"` key — not an `AgentState` object:

```python
config = {"thread_id": "session-1", "recursion_limit": 10}

# Turn 1
res = app.invoke(
    {"messages": [Message.text_message("What is 2 + 2?")]},
    config=config,
)

# Turn 2 — same thread_id, resumes from saved state
res = app.invoke(
    {"messages": [Message.text_message("Now multiply that by 3.")]},
    config=config,
)
```

---

## InMemoryCheckpointer

`InMemoryCheckpointer` stores everything in Python dicts guarded by `asyncio.Lock` objects. It is **async-first** — all operations are non-blocking coroutines. Sync wrappers (`put_state`, `get_state`, …) run the coroutines via `run_coroutine()`.

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer

checkpointer = InMemoryCheckpointer()
```

**Internal storage:**

| Attribute | Type | Purpose |
|---|---|---|
| `_states` | `dict[str, StateT]` | Current agent state per thread key |
| `_state_cache` | `dict[str, StateT]` | Lightweight read cache for state |
| `_generic_cache` | `dict[str, (Any, float)]` | Optional key-value cache with optional TTL |
| `_messages` | `defaultdict[str, list[Message]]` | Message history per thread key |
| `_threads` | `dict[str, dict]` | Thread metadata per thread key |

**Thread key** is simply `str(thread_id)` — there is no user scoping in the in-memory implementation.

**Use for:** development, unit tests, and short-lived single-process deployments.  
**Do not use for:** anything that requires state to survive a restart or be shared across multiple workers.

---

## PgCheckpointer

`PgCheckpointer` uses **PostgreSQL** for durable storage and **Redis** for a low-latency read cache. It is designed for production multi-worker deployments.

### Constructor signature

```python
from agentflow.storage.checkpointer import PgCheckpointer

checkpointer = PgCheckpointer(
    # --- PostgreSQL connection (pick one) ---
    postgres_dsn="postgresql://user:pass@localhost/mydb",  # DSN string
    # OR
    pg_pool=existing_asyncpg_pool,                         # pass an existing pool
    # OR
    pool_config={"min_size": 2, "max_size": 10},           # kwargs forwarded to asyncpg.create_pool

    # --- Redis connection (pick one, optional) ---
    redis_url="redis://localhost:6379/0",
    # OR
    redis=existing_redis_instance,
    # OR
    redis_pool=existing_connection_pool,
    # OR
    redis_pool_config={"max_connections": 20},

    # --- Optional tuning ---
    schema="public",          # PostgreSQL schema (default: "public")
    cache_ttl=86400,          # Redis TTL in seconds (default: 24 h)
    user_id_type="string",    # Column type for user_id: "string" | "int" | "bigint"
    release_resources=True,   # Close pools on cleanup
)
```

### Schema migration

On the first call to `await checkpointer.asetup()` (or `checkpointer.setup()`) the checkpointer:

1. Checks if the tables already exist.
2. Runs any pending migration steps to bring the schema to the current version.
3. Creates tables if they do not exist.

You must call `setup()` once before using the checkpointer:

```python
await checkpointer.asetup()
app = graph.compile(checkpointer=checkpointer)
```

### Installing the extra

```bash
pip install "10xscale-agentflow[pg_checkpoint]"
```

This installs `asyncpg` and `redis[asyncio]`.

---

## Checkpointer API reference

All methods exist in both **async** (preferred) and **sync** (convenience wrapper) flavours. The sync wrappers call `run_coroutine()` internally.

### State methods

| Async method | Sync method | Description |
|---|---|---|
| `aput_state(config, state)` | `put_state(config, state)` | Persist the current `AgentState` for the thread |
| `aget_state(config)` | `get_state(config)` | Load the saved `AgentState`; returns `None` if not found |
| `aclear_state(config)` | `clear_state(config)` | Delete the persisted state for a thread |
| `aput_state_cache(config, state)` | `put_state_cache(config, state)` | Write to the fast read cache |
| `aget_state_cache(config)` | `get_state_cache(config)` | Read from the fast cache (Redis for `PgCheckpointer`) |

The **state cache** is a thin Redis-backed read layer in `PgCheckpointer` (TTL-controlled). It avoids a Postgres round-trip on repeated reads for the same thread. For `InMemoryCheckpointer` both `_states` and `_state_cache` live in memory.

### Message methods

Checkpointers also store the full message history for a thread independently of the compressed state:

| Async method | Sync method | Description |
|---|---|---|
| `aput_messages(config, messages, metadata)` | `put_messages(...)` | Append one or more `Message` objects |
| `aget_message(config, message_id)` | `get_message(...)` | Retrieve a single message by ID |
| `alist_messages(config, search, offset, limit)` | `list_messages(...)` | Paginated and optionally full-text searched message list |
| `adelete_message(config, message_id)` | `delete_message(...)` | Remove a single message |

### Thread methods

Thread metadata (`ThreadInfo`) is stored separately from state:

| Async method | Sync method | Description |
|---|---|---|
| `aput_thread(config, thread_info)` | `put_thread(...)` | Create or update thread metadata |
| `aget_thread(config)` | `get_thread(...)` | Get `ThreadInfo` for a thread |
| `alist_threads(config, search, offset, limit)` | `list_threads(...)` | Paginated thread listing scoped to `user_id` |
| `aclean_thread(config)` | `clean_thread(...)` | Delete all state, messages, and metadata for a thread |

### Generic cache methods

An optional key-value cache layer for arbitrary JSON values (e.g., pre-computed embeddings or rendered prompts):

```python
# Store a value with a 10-minute TTL
await checkpointer.aput_cache_value("llm-cache", "prompt-hash-abc", {"response": "..."}, ttl_seconds=600)

# Retrieve it
value = await checkpointer.aget_cache_value("llm-cache", "prompt-hash-abc")

# Delete it
await checkpointer.aclear_cache_value("llm-cache", "prompt-hash-abc")

# List all keys in a namespace
keys = await checkpointer.alist_cache_keys("llm-cache", prefix="prompt-")
```

`InMemoryCheckpointer` supports TTL on the generic cache via expiry timestamps. `PgCheckpointer` uses Redis `SETEX` / `GET` / `DEL` / `SCAN` for these operations.

---

## Direct checkpointer usage (outside the graph)

You can interact with a checkpointer directly — useful for admin scripts, migrations, or custom REST endpoints:

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.core.state import AgentState, Message

cp = InMemoryCheckpointer()
config = {"thread_id": "t1", "user_id": "u1"}

# Save state manually
state = AgentState(context=[Message.text_message("Hello", role="user")])
await cp.aput_state(config, state)

# Load it back
loaded = await cp.aget_state(config)

# List all messages
messages = await cp.alist_messages(config, limit=50)

# Clean the thread
await cp.aclean_thread(config)
```

---

## Reading thread state via REST

When running behind the API server the same data is exposed over HTTP:

```bash
# Read current state
GET /v1/threads/{thread_id}/state

# Overwrite state
PUT /v1/threads/{thread_id}/state

# Read message history  
GET /v1/threads/{thread_id}/messages

# List threads for a user
GET /v1/threads
```

See [REST API: Threads](../reference/rest-api/threads.md) for request/response schemas.

## Configuring via agentflow.json

In the API layer the checkpointer is declared in `agentflow.json` — the graph module stays storage-agnostic:

```json
{
  "agent": "graph.react:app",
  "checkpointer": "graph.dependencies:my_checkpointer"
}
```

See [Configure agentflow.json](../how-to/api-cli/configure-agentflow-json.md).

---

## Choosing a checkpointer

| Criterion | InMemoryCheckpointer | PgCheckpointer |
|---|---|---|
| State survives restart | No | Yes |
| Shared across workers | No | Yes |
| Multi-tenant user scoping | No | Yes |
| External dependencies | None | PostgreSQL + Redis |
| Setup required | No | `await cp.asetup()` |
| Best for | Dev, tests | Production |

---

## Related concepts

- [Memory and store](./memory-and-store.md)
- [State and messages](./state-and-messages.md)
- [REST API: Threads](../reference/rest-api/threads.md)
