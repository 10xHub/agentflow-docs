---
package: core
version: "0.9.0"
date: 2026-07-21
summary: Production-hardening release covering optimistic concurrency, an idempotent tool ledger, real timeouts and cancellation, per-user isolation and new observability hooks. Includes three breaking changes.
breaking: true
---

### Breaking

- **`injectq` is pinned to `>=0.4.0,<0.5`.** It is pre-1.0, so a `0.5` release could break the API. Without an upper bound it would have been picked up automatically and broken fresh installs.
- **The default `user_id` is now `"anonymous"`** (it was `"test-user-id"`). With per-user isolation enabled, a run with no `user_id` previously filed itself under a placeholder that looked like a real account, which pooled every unauthenticated run into one identity.
- **A conditional edge whose condition raises now fails the run** (`GraphError`, `GRAPH_ROUTING_001`). Previously the exception was swallowed and the graph fell through to the first static edge or `END`.

### Added

- **Optimistic concurrency control on durable state.** `states` carries a `version` column with `UNIQUE (thread_id, version)`, and writes take a per-thread row lock and compare-and-swap. A write based on a stale version raises the new `StaleStateError` (HTTP 409 at the API) instead of silently discarding another run's update.
- **Durable tool-execution ledger** (`tool_executions`, schema v3). A node replayed after a crash no longer re-fires tool calls that already completed. Entries are keyed by `(thread_id, origin_message_id:tool_call_id)`, because a `tool_call_id` alone is not unique across turns.
- **Per-step durable checkpointing** (`durable_checkpoint_every_step`, default on), so a crash replays one node rather than the whole run.
- **Node and tool timeouts** (`node_timeout`, `tool_timeout`) that cancel the work, and stop requests now cancel a running node. Previously stop was only polled between nodes.
- **Real schema migrations**, with a stepwise, idempotent runner guarded by `pg_advisory_xact_lock` so concurrent workers cannot race the DDL.
- **Per-user isolation in the checkpointer** (`enforce_user_isolation`, default on) across state, messages and threads, plus global thread-ownership resolution. Owner-only isolation also covers the in-memory and SQLite checkpointers.
- **`tenxgraph.core.authz`**, a module for authorization contracts and scopes, and user ID scoping in `BaseStore` and `QdrantStore` so stores honor authorization policies.
- **File ownership.** Uploads record an owner, and reads by another user return 404.
- **Backpressure on background tasks** (`max_pending_tasks`, default 1000). A slow or dead publisher sink previously grew an unbounded task set until memory ran out.
- **OpenTelemetry metrics** via `metrics.setup_otel_metrics()`, with counters and histograms on node and tool execution and outcome dimensions.
- **Structured, correlated logging** via `logging.setup_structured_logging()`. Every record carries `run_id`, `thread_id` and `node`.
- `agentflow build --k8s` generates a Kubernetes manifest whose termination grace period is long enough that a rolling deploy does not kill in-flight runs.

### Changed

- **Durable storage migrates to schema v3 in place** on first connect.

### Fixed

- **Lost updates on concurrent writes to one thread** (see the compare-and-swap above). Reads were also non-deterministic, because `ORDER BY created_at DESC` had no tiebreak.
- **The realtime cache could be moved backwards**, wedging a thread until its TTL expired. Cache writes are now an atomic, version-guarded compare-and-set, and a lost version check invalidates the cache so the thread self-heals.
- **Parallel tools clobbering each other's state.** Each tool now runs on its own branch copy, merged back field by field against a baseline, using a field's reducer when it has one.
- **One failing tool orphaned its siblings**, and malformed tool arguments raised `JSONDecodeError` through the whole node.
- **Retries on non-retryable errors.** Status classification matched `"500"` as a substring, so `max_tokens must be <= 500` was treated as a server error.
- **Cross-tenant reads and deletes** of state, messages, threads and files.
- Blocking `urllib.urlopen` inside `async def` in the cloud media store stalled the event loop for every concurrent run in the process.
- Connection-pool and Qdrant-collection cold-start races (double creation).
- Schema-version failures were swallowed instead of raised.

### Security

- **Rate limit bypass.** The bucket key came from the leftmost `X-Forwarded-For` entry, which the caller controls, so a new value per request meant a new bucket and no limit at all. Proxy hops are now counted from the right.
- Cross-tenant reads and deletes of state, messages, threads and files are closed off (see Fixed).
