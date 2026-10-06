---
title: Backup and restore — Production how-to
sidebar_label: Backup and restore
description: What AgentFlow actually persists, how to back up the Postgres tables that hold threads and state, and how to restore or roll back without corrupting a running deployment.
keywords:
  - agentflow backup
  - agentflow restore
  - postgres backup agent
  - agent thread persistence
  - agentflow disaster recovery
---

# Backup and restore

## What is durable and what is not

Only one of the two storage layers holds anything you cannot lose.

| Layer | Contents | Durable | Back up |
| --- | --- | --- | --- |
| Postgres | Threads, state, messages, tool-execution ledger, schema version | Yes | **Yes** |
| Redis | Hot cache of recent state, default TTL 24h | No | No |
| Vector store (Qdrant, Mem0) | Long-term memories | Yes, in that system | Yes, with that system's own tooling |
| Media store | Uploaded files | Depends on backend | Yes, if local disk |

Redis is a cache in front of Postgres, not a second source of truth. Losing it
costs latency on the next read, nothing else. Never restore Redis from a snapshot
alongside an older Postgres: a cache holding newer versions than the database is
exactly the state the version guard exists to reject.

## Tables

With the default `public` schema, `PgCheckpointer` owns:

| Table | Holds |
| --- | --- |
| `threads` | Thread id, name, owner `user_id`, timestamps, metadata |
| `states` | Serialized graph state, with a `version` column used for optimistic concurrency |
| `messages` | Conversation history |
| `tool_executions` | Idempotency ledger keyed by `(thread_id, origin_message_id:tool_call_id)` |
| `schema_version` | One row per applied schema version |

Current schema version is `3`. If you pass a custom `schema=` to
`PgCheckpointer`, the tables are schema-qualified and your backup must target
that schema.

---

## Back up

### Routine

```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="agentflow-$(date +%Y%m%d-%H%M).dump"
```

Use `--format=custom` rather than plain SQL: it restores in parallel and lets you
restore a single table.

To back up only what AgentFlow owns from a shared database:

```bash
pg_dump "$DATABASE_URL" --format=custom \
  --table=threads --table=states --table=messages \
  --table=tool_executions --table=schema_version \
  --file=agentflow-tables.dump
```

Verify the dump is readable before you trust it. A backup you have never restored
is a hypothesis:

```bash
pg_restore --list agentflow-tables.dump | head
```

### Before an upgrade

Always take a dump before a release that changes the schema, because migrations
apply automatically on first startup of the upgraded server:

```bash
pg_dump "$DATABASE_URL" > agentflow-pre-1.0.sql
```

See [upgrade to 1.0](../../project/upgrade-to-1.0.md).

### Automate it

Whatever your platform offers is usually better than a cron job on one box:
managed Postgres point-in-time recovery, a scheduled snapshot, or a sidecar
CronJob on Kubernetes. What matters is that you know your recovery point
objective and have tested a restore against it.

---

## Restore

Restoring under live traffic corrupts state, because running workers hold state
versions that the restored database has never seen.

```bash
# 1. Stop traffic. Scale to zero rather than restoring under load.
kubectl scale deployment/my-agent --replicas=0

# 2. Flush the cache so it cannot serve newer versions than the database.
redis-cli -u "$REDIS_URL" FLUSHDB

# 3. Restore.
pg_restore --clean --if-exists --no-owner \
  --dbname "$DATABASE_URL" agentflow-tables.dump

# 4. Confirm the schema version matches what the code expects.
psql "$DATABASE_URL" -c "SELECT * FROM schema_version ORDER BY version DESC LIMIT 1;"

# 5. Bring one replica back and smoke-test before scaling up.
kubectl scale deployment/my-agent --replicas=1
```

### Restoring one thread

Full restores are rarely what you want. To recover a single conversation, restore
the dump into a scratch database and copy the rows across:

```bash
createdb agentflow_scratch
pg_restore --no-owner --dbname agentflow_scratch agentflow-tables.dump
```

```sql
-- From the scratch database, export one thread.
\copy (SELECT * FROM threads  WHERE thread_id = 'thr_123') TO 'thread.csv'  CSV
\copy (SELECT * FROM states   WHERE thread_id = 'thr_123') TO 'states.csv'  CSV
\copy (SELECT * FROM messages WHERE thread_id = 'thr_123') TO 'messages.csv' CSV
```

Import into production only when no run is active on that `thread_id`, and keep
the `version` column intact: rewriting it defeats the concurrency guard.

---

## Retention and deletion

Threads carry an owner `user_id`, which is what makes per-user deletion possible.
To honour a deletion request, remove the user's rows from all four tables in
dependency order:

```sql
BEGIN;
DELETE FROM tool_executions WHERE thread_id IN (SELECT thread_id FROM threads WHERE user_id = $1);
DELETE FROM messages        WHERE thread_id IN (SELECT thread_id FROM threads WHERE user_id = $1);
DELETE FROM states          WHERE thread_id IN (SELECT thread_id FROM threads WHERE user_id = $1);
DELETE FROM threads         WHERE user_id = $1;
COMMIT;
```

Then invalidate the cache for those threads, and delete the user's memories from
the vector store and any uploaded files from the media store. Those live outside
Postgres and are not covered by the transaction above.

---

## Test your restore

Once a quarter, or before any release you are nervous about:

1. Restore the latest dump into a scratch database.
2. Point a staging server at it.
3. Open an existing thread and continue the conversation.
4. Confirm the reply includes context from before the restore.

If step 4 fails, your backup covers the tables but not the history, which usually
means messages were excluded from a table-scoped dump.

## Related

- [Checkpointing](checkpointing.md)
- [Deploy on Kubernetes](kubernetes.md)
- [Environment variables](environment-variables.md)
