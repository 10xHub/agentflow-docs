---
title: Checkpointers — AgentFlow Python AI Agent Framework
sidebar_label: Checkpointers
description: BaseCheckpointer, InMemoryCheckpointer, PgCheckpointer — state persistence for conversation threads.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - checkpointers
sidebar_position: 7
---


# Checkpointers

## When to use this

A checkpointer persists graph state between requests so conversations survive server restarts, threads can be paused and resumed, and multiple turns stay coherent. Without a checkpointer the graph uses an in-memory default that is reset every call.

## Import paths

```python
from agentflow.storage.checkpointer import BaseCheckpointer, InMemoryCheckpointer
# Optional — requires asyncpg
from agentflow.storage.checkpointer import PgCheckpointer
```

---

## `BaseCheckpointer[StateT]`

Abstract base class for all checkpointer implementations. Provides both async and sync method pairs.

### Abstract async methods

Each abstract method must be implemented by a subclass:

| Method | Signature | Description |
|---|---|---|
| `asetup` | `async () -> Any` | Initialise the storage backend (create tables, connect pools…). |
| `aput_state` | `async (config, state) -> StateT` | Persist a state snapshot for the thread in `config["thread_id"]`. |
| `aget_state` | `async (config) -> StateT \| None` | Load the latest state snapshot for the thread. |
| `aclear_state` | `async (config) -> Any` | Delete all state for the thread. |
| `aput_state_cache` | `async (config, state) -> Any` | Write to the fast cache (Redis or in-memory). |
| `aget_state_cache` | `async (config) -> StateT \| None` | Read from the fast cache. |
| `aput_messages` | `async (config, messages) -> Any` | Append messages for the thread. |
| `aget_messages` | `async (config, search, offset, limit) -> list[Message]` | List messages. |
| `aget_message` | `async (config, message_id) -> Message \| None` | Fetch a single message by ID. |
| `adelete_message` | `async (config, message_id) -> Any` | Delete a single message. |
| `aget_threads` | `async (config, search, offset, limit) -> list[ThreadInfo]` | List threads. |
| `aget_thread` | `async (config) -> ThreadInfo \| None` | Get thread metadata. |
| `adelete_thread` | `async (config) -> Any` | Delete a thread and all its state and messages. |

### Sync wrappers

For every `async axxx()` method there is a sync `xxx()` wrapper that calls `asyncio.run()`. Use these only from non-async contexts (e.g. a management script):

```python
checkpointer.put_state(config, state)
checkpointer.get_state(config)
```

### Wiring into a graph

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer

app = graph.compile(checkpointer=InMemoryCheckpointer())
```

---

## `InMemoryCheckpointer`

In-process dictionary-based storage. Zero dependencies.

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer

checkpointer = InMemoryCheckpointer()
app = graph.compile(checkpointer=checkpointer)
```

**When to use:**
- Unit tests and CI.
- Local development when you don't need state to survive a restart.
- Ephemeral single-process jobs.

**When NOT to use:**
- Any multi-process or multi-worker deployment.
- Production applications where conversation history must survive crashes.

### Storage behaviour

| Storage | Key | Data |
|---|---|---|
| `_states` | `thread_id` | Latest serialised state snapshot. |
| `_state_cache` | `thread_id` | Hot cache for the running execution. |
| `_messages` | `thread_id` | Ordered message list. |
| `_threads` | `thread_id` | Thread metadata (`name`, `created_at`, etc.). |

All access is guarded by per-bucket `asyncio.Lock` instances for safe concurrent use within a single process.

---

## `PgCheckpointer`

PostgreSQL-backed checkpointer with optional Redis caching. Production-grade.

:::note Optional dependency
Requires `asyncpg`. Install with:
```
pip install asyncpg
```
Redis caching is optional but recommended for high-traffic deployments:
```
pip install redis
```
:::

```python
from agentflow.storage.checkpointer import PgCheckpointer

checkpointer = PgCheckpointer(
    postgres_dsn="postgresql://user:pass@localhost:5432/mydb",
    redis_url="redis://localhost:6379/0",   # optional
)

await checkpointer.asetup()   # creates tables if they don't exist
app = graph.compile(checkpointer=checkpointer)
```

### Constructor parameters

| Parameter | Type | Description |
|---|---|---|
| `postgres_dsn` | `str \| None` | PostgreSQL DSN. Required unless `pg_pool` is provided. |
| `pg_pool` | `asyncpg.Pool \| None` | Pre-created asyncpg connection pool. |
| `pool_config` | `dict \| None` | Config passed to `asyncpg.create_pool()` (`min_size`, `max_size`, etc.). |
| `redis_url` | `str \| None` | Redis URL for caching. |
| `redis` | `Redis \| None` | Pre-created Redis instance. |
| `redis_pool` | `ConnectionPool \| None` | Pre-created Redis connection pool. |
| `cache_ttl` | `int` | Redis cache TTL in seconds. Default: `86400` (24 hours). |

### ID types

`PgCheckpointer` adapts its schema based on the `id_type` registered by the compiled graph's `id_generator`:

| `id_type` | SQL column type |
|---|---|
| `string` | `VARCHAR(255)` |
| `int` | `SERIAL` |
| `bigint` | `BIGSERIAL` |

This is set automatically. You do not set it directly.

### Schema migration

`asetup()` creates the required tables if they do not exist. It is idempotent — safe to call on every startup.

---

## Writing a custom checkpointer

```python
from typing import Any
from agentflow.storage.checkpointer import BaseCheckpointer
from agentflow.core.state import AgentState, Message

class DynamoDBCheckpointer(BaseCheckpointer):

    async def asetup(self) -> Any:
        # Create DynamoDB tables
        ...

    async def aput_state(self, config: dict, state: AgentState) -> AgentState:
        thread_id = config["thread_id"]
        # Serialise and PUT to DynamoDB
        ...
        return state

    async def aget_state(self, config: dict) -> AgentState | None:
        thread_id = config["thread_id"]
        # GET from DynamoDB and deserialise
        ...

    async def aclear_state(self, config: dict) -> Any:
        ...

    async def aput_state_cache(self, config: dict, state: AgentState) -> Any:
        ...  # in-memory dict, no external call

    async def aget_state_cache(self, config: dict) -> AgentState | None:
        ...

    async def aput_messages(self, config: dict, messages: list[Message]) -> Any:
        ...

    async def aget_messages(self, config: dict, search: str | None, offset: int, limit: int) -> list[Message]:
        ...

    async def aget_message(self, config: dict, message_id: str) -> Message | None:
        ...

    async def adelete_message(self, config: dict, message_id: str) -> Any:
        ...

    async def aget_threads(self, config: dict, search: str | None, offset: int, limit: int):
        ...

    async def aget_thread(self, config: dict):
        ...

    async def adelete_thread(self, config: dict) -> Any:
        ...
```

---

## Config dictionary

All checkpointer methods accept a `config` dict. The required key is:

```python
config = {"thread_id": "session-abc123"}
```

Additional keys used internally:
- `user_id` — scopes message searches by user.
- `run_id` — tracks a specific invocation.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `StorageError` | Unrecoverable PostgreSQL error. | Check Postgres logs and DSN config. |
| `TransientStorageError` | Temporary Postgres failure. | Automatically retried by the framework. |
| `ImportError: asyncpg` | `PgCheckpointer` used without `asyncpg` installed. | Run `pip install asyncpg`. |
| State lost between requests | Using `InMemoryCheckpointer` with multiple workers. | Switch to `PgCheckpointer` or ensure a single-process deployment. |
