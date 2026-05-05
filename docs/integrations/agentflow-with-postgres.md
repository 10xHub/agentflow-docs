---
title: "AgentFlow with Postgres: Durable Agent Threads"
description: How to wire AgentFlow's PgCheckpointer to a Postgres + Redis backend for durable agent threads. Setup, schema, sizing, and operational patterns.
keywords:
  - agentflow postgres
  - pgcheckpointer
  - python agent postgres
  - durable agent threads
  - agent persistence postgres
sidebar_position: 4
---

# AgentFlow with Postgres

For production agents, every conversation needs durable, resumable state. AgentFlow's `PgCheckpointer` writes graph state to Postgres after every node, with Redis on the hot path for fast reads.

This guide covers setup, schema, and the operational patterns we see in practice.

## Why Postgres + Redis

- **Postgres** is durable, transactional, queryable. The source of truth for thread history.
- **Redis** caches recent thread state for fast reads. Cheap to scale; safe to invalidate.

Together they give you sub-50ms checkpoint reads and durability across restarts.

## Install dependencies

`PgCheckpointer` ships with AgentFlow but needs the Postgres driver + Redis client:

```bash
pip install "agentflow[postgres,redis]"
# Equivalent to:
# pip install agentflow asyncpg redis
```

## Run Postgres + Redis locally

Quickest path. Docker Compose:

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: agentflow
      POSTGRES_PASSWORD: agentflow
      POSTGRES_DB: agentflow
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  pgdata:
```

`docker compose up -d`.

## Wire the checkpointer

```python
from agentflow.core.graph import Agent, StateGraph
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import PgCheckpointer
from agentflow.utils import END

checkpointer = PgCheckpointer(
    db_url="postgresql+asyncpg://agentflow:agentflow@localhost:5432/agentflow",
    redis_url="redis://localhost:6379/0",
)

# ... build graph ...
app = graph.compile(checkpointer=checkpointer)
```

The first call to `app.invoke(...)` creates the schema if it does not exist. For controlled migrations, see the schema section below.

## Use it

```python
# Turn 1
app.invoke(
    {"messages": [Message.text_message("My name is Alex.")]},
    config={"thread_id": "user-42"},
)

# Turn 2 — same thread_id reuses prior state from Postgres
app.invoke(
    {"messages": [Message.text_message("What's my name?")]},
    config={"thread_id": "user-42"},
)
```

Process restarts, replica swaps, blue-green deploys. None of them lose the thread.

## Schema

`PgCheckpointer` creates a small set of tables. The shapes (subject to AgentFlow version):

- `agentflow_threads`. One row per thread (thread_id, created_at, updated_at, metadata)
- `agentflow_checkpoints`. Graph state snapshots, one row per node boundary
- `agentflow_messages`. Message history per thread

For exact DDL and migration guidance, see [the production checkpointing guide](/docs/how-to/production/checkpointing).

## Sizing Postgres

Rough budget for a moderate production load:

| Metric | Estimate |
|---|---|
| Rows per thread (10-turn chat) | ~30 (3 per turn) |
| Bytes per row | 2–10 KB depending on message size |
| Active threads | depends on your DAU |
| Storage per 1M threads | ~20 GB (with vacuum + indexes) |

A `db.t4g.medium` RDS instance handles tens of thousands of concurrent threads comfortably. Scale up when your p95 write latency exceeds 50ms.

## Sizing Redis

Redis holds:

- Recent thread state (LRU eviction)
- Per-thread locks (to avoid concurrent writes to the same thread)

Memory budget: ~5 KB per actively-cached thread. `cache.t4g.small` (1.5 GB) holds ~300k cached threads with headroom.

## Connection pooling

The `PgCheckpointer` shares a connection pool. Right-size it:

```python
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "postgresql+asyncpg://...",
    pool_size=20,           # concurrent connections
    max_overflow=10,        # burst capacity
    pool_pre_ping=True,     # detect dead conns
    pool_recycle=600,       # rotate every 10 min
)

checkpointer = PgCheckpointer.from_engine(engine, redis_url="...")
```

Pool sizing rule of thumb: `n_replicas × n_concurrent_streams_per_replica × 2`. Too small → queueing; too large → waste of DB resources.

## Multi-tenant patterns

For multi-tenant SaaS, scope threads by tenant:

```python
config = {"thread_id": f"tenant-{tenant_id}:user-{user_id}:session-{session_id}"}
```

Or partition Postgres by tenant if you have huge tenants. For most apps, prefixed thread IDs are enough.

## Backups and disaster recovery

- **Postgres**. Daily automated backups via your managed service. Point-in-time recovery for the last 7 days minimum.
- **Redis**. Ephemeral by design. If Redis goes down, the next reads fall through to Postgres. No backup needed.

If you lose Postgres, you lose threads. That is what makes it the durable layer.

## Cleanup and TTL

Threads accumulate. Two patterns:

```sql
-- Soft-delete threads not touched in 90 days
DELETE FROM agentflow_threads WHERE updated_at < NOW() - INTERVAL '90 days';
```

Or run a periodic vacuum job. For tenant offboarding, delete by `thread_id LIKE 'tenant-X:%'`.

## Common gotchas

1. **Forgot Redis.** `PgCheckpointer` requires it. Without Redis, you'll see lock contention and slow reads.
2. **Connection pool too small.** Shows up as queue latency under load.
3. **No `thread_id`** in invoke config. Then surprised when it does not remember. Always pass `thread_id`.
4. **Long messages bloat rows.** Trim before storing. See [state and messages](/docs/concepts/state-and-messages).
5. **Treating Redis as the source of truth.** Redis can lose data. Postgres is canonical.

## Further reading

- [Checkpointing concept](/docs/concepts/checkpointing-and-threads)
- [Production checkpointing guide](/docs/how-to/production/checkpointing)
- [AI agent memory and checkpointing](/blog/ai-agent-memory-checkpointing-python)
- [Deploy AI agent (Docker + AWS)](/blog/deploy-ai-agent-docker-aws)
- [Get started](/docs/get-started)
