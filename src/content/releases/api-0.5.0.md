---
package: api
version: "0.5.0"
date: 2026-07-21
summary: Adds route protection, ownership and role-based authorization, observability and eval-report endpoints, and fixes a broken wheel that dropped the init templates. Production now refuses wildcard CORS with credentials.
breaking: true
---

### Breaking

- **Production refuses to start with wildcard CORS and credentials enabled.** With `MODE=production`, `ORIGINS='*'` combined with credentials now raises `InsecureCorsConfigError` at startup. Set explicit `ORIGINS`, or set `CORS_ALLOW_CREDENTIALS=false`.
- **The authorization backend now defaults by run mode.** When `authorization` is not set in `10xgraph.json`, production now uses `ownership` (owner-only thread access) and development uses `allow_all`, instead of no backend being loaded.

### Added

- **Route guard.** The server refuses to boot if any non-public route lacks a `RequirePermission` dependency, so a forgotten guard becomes a deploy-time error instead of an open endpoint.
- **Authorization backends.** `OwnershipAuthorizationBackend` for owner-only isolation and `RoleBasedAuthorizationBackend`, which maps user roles to scopes. `RequirePermission` enforces the required `"<resource>:<action>"` scope. The `authorization` key accepts `"ownership"`, `"allow_all"` or a `"module:attribute"` path to a custom backend.
- **File ownership.** Media uploads record the uploader as owner, and other users cannot read the file.
- **Observability.** A declarative `observability` block in `10xgraph.json` (Logfire and LangSmith), telemetry recording for graph runs, and the `/v1/graph/tools` and `/v1/observability/{thread_id}` endpoints for tool listings and run traces.
- **Eval report endpoints** `/v1/evals/runs` and `/v1/evals/runs/{run_id}` for reading local evaluation reports. These are treated as a development surface.
- `GraphInfoSchema` reports `is_realtime` so clients can tell when a graph is a live agent.
- `py.typed` marker, so type information reaches consumers (PEP 561).
- A `--integration` pytest flag gates tests that need real Redis or Postgres.
- mypy configuration and CI step, CodeQL scanning, Dependabot, and community health files (`CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue forms and a pull request template).

### Changed

- **Every runtime dependency now has a lower bound**, and risky ones have an upper cap, including `10xgraph>=0.9.0,<2.0`, `fastapi>=0.116,<1.0` and `pydantic>=2.13,<3`. Environments that resolved older versions alongside this package may resolve differently.
- The optional extras `snowflakekit`, `redis` and `jwt` gained version bounds.
- CI runs on pushes to `main` and covers Python 3.12 and 3.13. The release workflow now depends on a passing test job.
- The `Documentation` project URL points at the published docs site.
- `a2a.py` and `a2ui.py` were removed from the wheel. Both were fully commented out and never mounted.

### Fixed

- **Scaffolding templates were missing from the wheel.** The `package-data` globs dropped `templates/dev/.env.example`, `templates/prod/.env.example`, `templates/prod/.python-version` and `templates/prod/pyproject.toml`, so `agentflow init` failed for installs from PyPI. Packaging now ships the package tree wholesale.
- `agentflow version` reported `unknown` when installed from a wheel. It now reads installed distribution metadata and also reports the core `10xgraph` version.
- The `prod` template shipped `.pre-commot-config.yaml` (typo), so `pre-commit` found no config in scaffolded projects. It is now `.pre-commit-config.yaml`.

### Security

- **Rate-limit bypass through `X-Forwarded-For`.** The client IP was taken from the leftmost entry, which the caller controls, so a new value per request landed in a fresh bucket. The IP is now counted from the right using `trusted_proxy_hops` (default `1`).
- Cross-user access to threads and media is covered by the ownership checks above.
