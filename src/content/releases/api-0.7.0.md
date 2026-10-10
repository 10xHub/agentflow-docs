---
package: api
version: "0.7.0"
date: 2026-10-10
summary: First release as 10xgraph-api. The command is 10xgraph, the config file is 10xgraph.json and the import is tenxgraph_api; the old names keep working until 2.0. Requires 10xgraph 0.10.0 or newer.
breaking: false
---

Agentflow is now 10xGraph. This package replaces `10xscale-agentflow-cli`. The server, the CLI and the HTTP API are unchanged apart from the names below, and every old name keeps working until 2.0.

### Changed

- **PyPI package is `10xgraph-api`.** Uninstall the old packages first, since the old core and the new one both ship an `agentflow` module:

  ```bash
  pip uninstall 10xscale-agentflow-cli 10xscale-agentflow
  pip install 10xgraph-api
  ```

- **The command is `10xgraph`.** `agentflow` still runs the same CLI and prints a one-line deprecation notice.
- **The config file is `10xgraph.json`.** `agentflow.json` is still read when no `10xgraph.json` sits in the same directory; when both exist, `10xgraph.json` wins. `10xgraph init` writes `10xgraph.json`, and `10xgraph config` creates it from `agentflow.json` on first save without touching the old file.
- **The import package is `tenxgraph_api`** (`from tenxgraph_api import BaseAuth`). `agentflow_cli` stays as a deprecated alias.
- **Core dependency is `10xgraph>=0.10.0,<2.0`** (import `tenxgraph`), replacing `10xscale-agentflow`.
- **CLI env vars use the `TENXGRAPH_` prefix** (`TENXGRAPH_NO_FULLSCREEN`, `TENXGRAPH_NO_SPINNER`, `TENXGRAPH_ASCII`). The `AGENTFLOW_` names are read when the new one is unset.
- **Uploaded media is referenced as `graph://media/<key>`.** `agentflow://media/<key>` still resolves, and both go through the same ownership check.
- **Default `MEDIA_CLOUD_PREFIX` is `10xgraph-media`.** With the default, objects under `agentflow-media` are still read.
- **The WebSocket bearer subprotocol is `10xgraph-bearer`.** `agentflow-bearer` is still accepted.
- **The bundled skill installs as `10xgraph`**, and the Copilot instructions file as `10xgraph.instructions.md`. Delete old `agentflow` skill folders after installing the new one.
- **Logger names are `tenxgraph_api.*`.** Update logging config that targets the old names.
- The default Redis rate-limit key prefix is `10xgraph:rate-limit`. Counters restart once on upgrade; a configured `prefix` is kept.
- The config editor's session header is `X-10xGraph-Token`.
- **`10xgraph build` Dockerfiles ship only what the server runs.** The image drops the CLI-only templates and config editor, and the generated `.dockerignore` leaves out `tests/`, `evals/`, `.claude/`, `.agents/` and `.github/`. Regenerate with `10xgraph build --force`.
- **Terminal look follows the brand.** A shorter intro (0.9 s) in the logo's colors shows the running versions and can be skipped with any key. Ctrl+C quits immediately, and the pinned full-screen frame is opt-in (`--fullscreen` or `TENXGRAPH_FULLSCREEN=1`).

### Unchanged on purpose

- The error code `AGENTFLOW_VALIDATION_ERROR`, the `agentflow.cli/v1` schema id in `--format json` output, and the `AF-*` CLI error codes, so scripts that match on them keep working.

See [Coming from Agentflow](/docs/get-started/coming-from-agentflow) for the full migration.
