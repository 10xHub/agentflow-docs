---
title: Releases and changelog — AgentFlow project
sidebar_label: Changelog
description: Release notes for the AgentFlow core library, CLI, and TypeScript client, plus the versioning and deprecation policy each package follows.
keywords:
  - agentflow changelog
  - agentflow release notes
  - agentflow versioning
  - semantic versioning
  - agentflow 1.0
---

# Releases and changelog

AgentFlow ships as three independently versioned packages. A release of one does
not imply a release of the others, so check the version of the package you
actually installed.

| Package | Installed with | Canonical changelog |
| --- | --- | --- |
| `10xscale-agentflow` (core) | `pip install 10xscale-agentflow` | [CHANGELOG.md](https://github.com/10xHub/Agentflow/blob/main/CHANGELOG.md) |
| `10xscale-agentflow-cli` (API server + CLI) | `pip install 10xscale-agentflow-cli` | [CHANGELOG.md](https://github.com/10xHub/agentflow-cli/blob/main/CHANGELOG.md) |
| `@10xscale/agentflow-client` (TypeScript) | `npm install @10xscale/agentflow-client` | [Releases](https://github.com/10xHub/agentflow-client/releases) |

Check what you are running:

```bash
agentflow version          # CLI version and the core version it resolves
pip show 10xscale-agentflow
npm list @10xscale/agentflow-client
```

---

## Versioning policy

All three packages follow [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

From `1.0.0` on, the core public API is stable:

- **A public API is never removed without a deprecation cycle.** It is marked
  deprecated in one release, emits a `DeprecationWarning` naming its replacement,
  keeps working for at least one subsequent minor release, and is only then
  removed in a major release.
- **Moved modules keep a back-compat shim** at the old import path for at least
  one minor release. Import paths do not break silently.
- **Breaking changes appear under a `### Breaking` heading** in the release notes,
  with the migration step spelled out.

What counts as public API:

| Package | Public surface |
| --- | --- |
| Core | Anything importable from `agentflow.*` that is not prefixed with `_` |
| CLI | Names exported from `agentflow_cli`, CLI commands and flags, HTTP routes, and `agentflow.json` keys |
| TypeScript client | Everything exported from `src/index.ts`, plus the package entry points (`main`, `module`, `types`, `exports`) |

Scaffolding emitted by `agentflow init` (anything under
`agentflow_cli/cli/templates/`) is generated content, not API. It can change in
any release.

---

## Core: 1.0.0

**First stable release.** The public API is now covered by the deprecation policy
above and the package is classified `Development Status :: 5 - Production/Stable`.
This is the production-hardening round on top of `0.8.0`: durable state gains
optimistic concurrency and an idempotent tool ledger, execution is bounded by
real timeouts and cancellation, and per-user isolation is enforced across the
storage layer.

Upgrading from 0.8 or 0.9? Read the [1.0 upgrade guide](upgrade-to-1.0.md) first.

### Breaking

- **`injectq` is pinned to `>=0.4.0,<0.5`.** It is pre-1.0, so an unbounded
  dependency could pick up a breaking `0.5` and break fresh installs.
- **The default `user_id` is now `"anonymous"`** (was `"test-user-id"`). With
  per-user isolation enabled, the old placeholder silently pooled every
  unauthenticated run into one identity that looked like a real account.
- **A conditional edge whose condition raises now fails the run** with a
  `GraphError` (`GRAPH_ROUTING_001`). Previously the exception was swallowed and
  the graph fell through to the first static edge or `END`, silently taking a
  path nobody chose.
- **Production refuses to start with wildcard CORS and credentials enabled.** Set
  explicit `ORIGINS`, or `CORS_ALLOW_CREDENTIALS=false`.

### Added

- **Optimistic concurrency control on durable state.** `states` carries a
  `version` column with `UNIQUE (thread_id, version)`; writes take a per-thread
  row lock and compare-and-swap. A write based on a stale version raises
  `StaleStateError` (HTTP 409 at the API) instead of silently discarding another
  run's update.
- **Durable tool-execution ledger** (`tool_executions`, schema v3). A node
  replayed after a crash no longer re-fires tool calls that already completed.
  Keyed by `(thread_id, origin_message_id:tool_call_id)`, because a
  `tool_call_id` alone is not unique across turns.
- **Per-step durable checkpointing** (`durable_checkpoint_every_step`, on by
  default), so a crash replays one node rather than the whole run.
- **Node and tool timeouts** (`node_timeout`, `tool_timeout`) that actually
  cancel the work, plus stop-cancels-a-running-node. Stop was previously only
  polled between nodes, so a hang inside one was unreachable.
- **Real schema migrations** with a stepwise, idempotent runner and a
  `pg_advisory_xact_lock`, so concurrent workers cannot race the DDL.
- **Per-user isolation in the checkpointer** (`enforce_user_isolation`, on by
  default) across state, messages, and threads.
- **File ownership.** Uploads record an owner; reads by another user return 404.
- **Backpressure on background tasks** (`max_pending_tasks`, default 1000). A
  slow or dead publisher sink previously grew an unbounded task set until OOM.
- **OpenTelemetry metrics** via `agentflow.utils.metrics.setup_otel_metrics()`: counters and
  histograms on node and tool execution, with outcome dimensions.
- **Structured, correlated logging** via `agentflow.utils.logging.setup_structured_logging()`.
  Every record carries `run_id`, `thread_id`, and `node`, so one run can be
  grepped out of a busy server.
- **`agentflow build --k8s`** generates a Kubernetes manifest whose termination
  grace period is long enough that a rolling deploy does not kill in-flight runs.
  See [deploy on Kubernetes](../how-to/production/kubernetes.md).

### Fixed

- Lost updates on concurrent writes to one thread. Reads were also
  non-deterministic: `ORDER BY created_at DESC` with no tiebreak.
- The realtime cache could be moved backwards, wedging a thread until its TTL
  expired. Cache writes are now an atomic version-guarded compare-and-set, and a
  lost version check invalidates the cache so the thread self-heals.
- Parallel tools clobbering each other's state. Each tool now runs on its own
  branch copy, merged back field-by-field against a baseline, using a field's
  reducer where it has one.
- One failing tool orphaned its siblings (`gather` without `return_exceptions`),
  and malformed tool arguments raised `JSONDecodeError` through the whole node.
- Retries on non-retryable errors. Status classification matched `"500"` as a
  substring, so `max_tokens must be <= 500` was treated as a server error.
- Cross-tenant reads and deletes of state, messages, threads, and files.
- Rate limit bypass. The bucket key came from the leftmost `X-Forwarded-For`
  entry, which the caller controls, so a new value per request meant a new bucket
  and no limit at all. Proxy hops are now counted from the right.
- Blocking `urllib.urlopen` inside `async def` in the cloud media store stalled
  the event loop for every concurrent run in the process.
- Connection-pool and Qdrant-collection cold-start races (double creation).
- Schema-version failures were swallowed instead of raised.

---

## CLI and API server

Recent work on `10xscale-agentflow-cli`:

### Added

- `py.typed` marker, so type information reaches consumers (PEP 561).
- `--integration` pytest flag gating tests that need real Redis and Postgres, so
  a default `pytest` run requires no external services.
- mypy configuration and a mypy step in CI, plus a CodeQL static-analysis
  workflow and Dependabot for pip and GitHub Actions.

### Changed

- **Every runtime dependency now has a lower bound**, and pre-1.0 or
  major-version-risky dependencies have an upper cap (`pydantic>=2.13,<3`,
  `fastapi>=0.116,<1.0`, `10xscale-agentflow>=0.9.0,<2.0`). Previously all runtime
  dependencies were unpinned, so a major release of any of them could break
  installs without warning.
- The release workflow depends on a passing test job; it no longer builds and
  publishes untested code.
- CI covers both advertised Python versions (3.12 and 3.13) rather than 3.13
  alone.

### Fixed

- **Scaffolding templates were missing from the wheel**, so `agentflow init`
  failed for anyone installing from PyPI. The packaging globs dropped
  `templates/dev/.env.example`, `templates/prod/.env.example`,
  `templates/prod/.python-version`, and `templates/prod/pyproject.toml`.
- `agentflow version` reported `unknown` when installed from a wheel. It now
  resolves from installed distribution metadata and also reports the core
  version.
- The `prod` template shipped `.pre-commot-config.yaml` (typo), so `pre-commit`
  found no config in scaffolded projects.

### Removed

- The commented-out `a2a.py` and `a2ui.py` routers, which were never mounted but
  shipped in the wheel as dead code. Agent-to-Agent serving is not currently
  implemented; see the [roadmap](roadmap.md).

---

## TypeScript client: 0.3.0

### Fixed

- **`uploadFile()` threw on Node 18.** `File` only became a global in Node 20 and
  the upload path did an unguarded `file instanceof File`, so every call failed
  with `ReferenceError: File is not defined`, including calls passing a plain
  `Blob`. The package declares `engines.node >= 18`, so this broke file upload on
  supported runtimes.
- **`npm publish` would have failed.** Scoped packages default to `restricted`;
  `publishConfig.access: "public"` and `provenance: true` are now set.
- **The build was not cross-platform.** It ended in `cp -r dist-types/* dist/`,
  which does not exist on Windows. `tsc` now emits declarations straight into
  `dist/`.

---

## Getting notified

- Watch [releases on GitHub](https://github.com/10xHub/Agentflow/releases) for
  release announcements.
- Security releases are announced through
  [GitHub Security Advisories](https://github.com/10xHub/Agentflow/security/advisories).
  See the [security policy](security.md).
