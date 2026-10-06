---
title: Checkpointers
seoTitle: "Checkpointers API reference (Python)"
description: BaseCheckpointer, InMemoryCheckpointer, PgCheckpointer, SqliteCheckpointer — state persistence for conversation threads.
section: Reference
group: Python library
order: 1490
label: Checkpointers
updated: "2026-07-21"
---

## When to use this

A checkpointer persists graph state between requests so conversations survive server restarts, threads can be paused and resumed, and multiple turns stay coherent. Without a checkpointer the graph uses an in-memory default that is reset every call.

## Import paths

```python
from tenxgraph.storage.checkpointer import BaseCheckpointer, InMemoryCheckpointer
# Optional — requires asyncpg
from tenxgraph.storage.checkpointer import PgCheckpointer
# Optional — requires aiosqlite
from tenxgraph.storage.checkpointer import SqliteCheckpointer
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
| `aput_messages` | `async (config, messages, metadata=None) -> Any` | Append messages for the thread. |
| `aget_message` | `async (config, message_id) -> Message` | Fetch a single message by ID. |
| `alist_messages` | `async (config, search=None, offset=None, limit=None) -> list[Message]` | List messages. |
| `adelete_message` | `async (config, message_id) -> Any \| None` | Delete a single message. |
| `aput_thread` | `async (config, thread_info) -> Any \| None` | Store thread metadata. |
| `aget_thread` | `async (config) -> ThreadInfo \| None` | Get thread metadata. |
| `alist_threads` | `async (config, search=None, offset=None, limit=None) -> list[ThreadInfo]` | List threads. |
| `aclean_thread` | `async (config) -> Any \| None` | Delete a thread and its state and messages. |
| `arelease` | `async () -> Any \| None` | Release resources (close pools and connections). |

### Sync wrappers

For every `async axxx()` method there is a sync `xxx()` wrapper that calls `asyncio.run()`. Use these only from non-async contexts (e.g. a management script):

```python
checkpointer.put_state(config, state)
checkpointer.get_state(config)
```

### Wiring into a graph

```python
from tenxgraph.storage.checkpointer import InMemoryCheckpointer

app = graph.compile(checkpointer=InMemoryCheckpointer())
```

---

## `InMemoryCheckpointer`

In-process dictionary-based storage. Zero dependencies.

```python
from tenxgraph.storage.checkpointer import InMemoryCheckpointer

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

<aside class="callout callout-note" role="note"><p class="callout-title">Optional dependency</p>

Requires `asyncpg`. Install with:
```
pip install asyncpg
```
Redis caching is optional but recommended for high-traffic deployments:
```
pip install redis
```

</aside>

```python
from tenxgraph.storage.checkpointer import PgCheckpointer

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

## `SqliteCheckpointer`

Single-file SQLite checkpointer. Stores **everything** — durable state, the hot "realtime" state cache, generic TTL cache, messages, and threads — in one local `.db` file. No Postgres, no Redis. Fully async via `aiosqlite`.

<aside class="callout callout-note" role="note"><p class="callout-title">Optional dependency</p>

Requires `aiosqlite`. Install with:
```
pip install 10xgraph[sqlite_checkpoint]
```

</aside>

```python
from tenxgraph.storage.checkpointer import SqliteCheckpointer

# Defaults to ~/.10xgraph/checkpointer.db; pass a path to override.
checkpointer = SqliteCheckpointer("agent_state.db")

await checkpointer.asetup()   # creates tables (also runs lazily on first use)
app = graph.compile(checkpointer=checkpointer)
```

### Constructor parameters

| Parameter | Type | Description |
|---|---|---|
| `db_path` | `str \| Path \| None` | Path to the SQLite database file. Defaults to `~/.10xgraph/checkpointer.db`. Parent directories are created on setup. Pass `":memory:"` for an ephemeral in-process database (useful for tests). |

**When to use:**
- **Client-side / embedded agents.** A desktop app that ships a Python sidecar (Tauri, Electron, PyInstaller) or a local CLI agent — the checkpointer runs entirely on the user's machine, right next to the app.
- **Dedicated-room deployments.** Each user (or tenant, or session) has their own process and their own `.db` file, so there is exactly one writer per database.

**When NOT to use:**
- **Multi-user servers where many users share one backend.** SQLite serializes writers and does not scale horizontally. Reach for [`PgCheckpointer`](#pgcheckpointer) (Postgres + optional Redis) instead.

### Design notes

- **One file, no external services.** The realtime state cache lives in a separate SQLite table (`af_state_cache`) rather than Redis; durable state lives in `af_states`. Reads check the cache table first, then fall back to durable state — the same two-layer read path as `PgCheckpointer`, collapsed into one file.
- **Custom state is preserved.** State is serialized with an embedded `__class_path__` and reconstructed into its exact `AgentState` subclass on read, matching `PgCheckpointer`.
- **Concurrency.** A single persistent connection is opened lazily with `PRAGMA journal_mode=WAL`; writes are serialized behind an `asyncio.Lock`. Call `await checkpointer.arelease()` (or `checkpointer.release()`) at shutdown to close it.
- **Isolation.** Data is keyed purely by `thread_id`; `user_id` is not required. `alist_threads` returns every thread in the file, which matches the one-database-per-user model.

---

## Writing a custom checkpointer

```python
from typing import Any
from tenxgraph.storage.checkpointer import BaseCheckpointer
from tenxgraph.core.state import AgentState, Message
from tenxgraph.utils.thread_info import ThreadInfo

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

    async def aput_messages(
        self, config: dict, messages: list[Message], metadata: dict | None = None
    ) -> Any:
        ...

    async def aget_message(self, config: dict, message_id: str | int) -> Message:
        ...

    async def alist_messages(
        self,
        config: dict,
        search: str | None = None,
        offset: int | None = None,
        limit: int | None = None,
    ) -> list[Message]:
        ...

    async def adelete_message(self, config: dict, message_id: str | int) -> Any | None:
        ...

    async def aput_thread(self, config: dict, thread_info: ThreadInfo) -> Any | None:
        ...

    async def aget_thread(self, config: dict) -> ThreadInfo | None:
        ...

    async def alist_threads(
        self,
        config: dict,
        search: str | None = None,
        offset: int | None = None,
        limit: int | None = None,
    ) -> list[ThreadInfo]:
        ...

    async def aclean_thread(self, config: dict) -> Any | None:
        ...

    async def arelease(self) -> Any | None:
        ...  # close connections
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
| `ImportError: aiosqlite` | `SqliteCheckpointer` used without `aiosqlite` installed. | Run `pip install 10xgraph[sqlite_checkpoint]`. |
| State lost between requests | Using `InMemoryCheckpointer` with multiple workers. | Switch to `PgCheckpointer` or ensure a single-process deployment. |
