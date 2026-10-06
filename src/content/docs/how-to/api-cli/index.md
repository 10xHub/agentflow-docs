---
title: API & CLI Overview
seoTitle: "10xGraph API server and CLI how-to guides"
description: Overview of the 10xGraph CLI commands. Install, scaffold, serve, test, evaluate, and deploy agents from the terminal.
section: How-to guides
group: CLI
order: 850
label: Overview
updated: "2026-09-29"
---

The `10xgraph` CLI (`10xgraph-api`) provides every command you need to scaffold, run, test, evaluate, and containerize your agents.

## Installation

```bash
pip install 10xgraph-api
```

Verify the installation:

```bash
10xgraph --help
```

## Commands

| Command | Description |
| --- | --- |
| [`10xgraph init`](/docs/how-to/api-cli/initialize-project) | Interactively scaffold a new agent project |
| `10xgraph dev` | Start the local development server and open the playground |
| [`10xgraph api`](/docs/how-to/api-cli/run-api-server) | Start the FastAPI development server |
| [`10xgraph play`](/docs/how-to/api-cli/open-playground) | Start the server and open the hosted playground |
| [`10xgraph build`](/docs/how-to/api-cli/generate-docker-files) | Generate a Dockerfile (and optionally docker-compose.yml / k8s.yaml) |
| [`10xgraph skills`](/docs/how-to/api-cli/install-skills) | Install bundled coding-agent skills (Codex, Claude, GitHub), or validate skills against the Agent Skills spec |
| [`10xgraph test`](/docs/how-to/api-cli/run-tests) | Run the project test suite via pytest |
| [`10xgraph eval`](/docs/how-to/api-cli/run-evals) | Run agent evaluations and generate HTML + JSON reports |
| `10xgraph audit` | Check the interpreter, packages, project config, and port |
| `10xgraph config` | Edit, validate, and save `10xgraph.json` in a browser UI |
| `10xgraph demo` | Preview the CLI animations with no side effects |
| `10xgraph version` | Print CLI and core framework version |

Every command is documented option by option in the
[CLI commands reference](/docs/reference/api-cli/commands).

---

## Command summaries

### `10xgraph init`

Scaffolds a new agent project interactively. Prompts for agent name and setup type (Quick Start or Production). For production projects, also prompts for authentication and rate-limiting configuration. Every answer has a matching flag, so the same scaffold can be reproduced without prompts.

```bash
10xgraph init                  # scaffold in the current directory
10xgraph init --path ./my-bot  # scaffold in a specific directory
10xgraph init --force          # overwrite existing files

# No prompts: CI, or a coding agent
10xgraph init --name MyAgent --template quick-start --non-interactive
10xgraph init --template production --auth jwt --rate-limit redis --yes --dry-run
```

See [Initialize a project](/docs/how-to/api-cli/initialize-project) for the full guide.

---

### `10xgraph dev`

Starts the local development server and opens the hosted playground once the API is reachable. It runs the same server as `10xgraph api` and takes the same options, plus `--open/--no-open`. This is the command to reach for while building; `api` and `play` remain available.

```bash
10xgraph dev                              # 127.0.0.1:8000, reload on, playground opens
10xgraph dev --host 127.0.0.1 --port 9000
10xgraph dev --no-open --no-reload        # API only
10xgraph dev --config production.json
```

---

### `10xgraph api`

Starts a Uvicorn-backed FastAPI server that loads your compiled graph from `10xgraph.json`. Auto-reload is enabled by default.

```bash
10xgraph api
10xgraph api --host 0.0.0.0 --port 8000
10xgraph api --no-reload       # disable file-watching (production)
```

Default host: `127.0.0.1`. Default port: `8000`.

See [Run the API server](/docs/how-to/api-cli/run-api-server) for the full guide.

---

### `10xgraph play`

Same as `10xgraph api` but also opens the hosted playground in your default browser once the server is reachable.

```bash
10xgraph play
10xgraph play --port 8001
```

See [Open the playground](/docs/how-to/api-cli/open-playground) for the full guide.

---

### `10xgraph build`

Generates a production `Dockerfile`. Optionally generates `docker-compose.yml` as well (omitting the `CMD` from the Dockerfile in that case), and a `k8s.yaml` with a Deployment and Service.

```bash
10xgraph build
10xgraph build --docker-compose
10xgraph build --k8s                    # Deployment + Service in k8s.yaml
10xgraph build --python-version 3.12 --port 8080
10xgraph build --force         # overwrite existing Dockerfile
```

Default Python version: `3.13`. Default service name in docker-compose and k8s.yaml: `agentflow-cli`.

See [Generate Docker files](/docs/how-to/api-cli/generate-docker-files) for the full guide.

---

### `10xgraph skills`

Installs bundled 10xGraph coding-agent skills into your project for Codex, Claude, or GitHub Copilot. Without `--agent`, it shows a checklist where space toggles and enter confirms; already-installed agents are labelled and pre-checked.

```bash
10xgraph skills                       # interactive agent selection
10xgraph skills --agent claude
10xgraph skills --agent codex
10xgraph skills --agent github
10xgraph skills --all                 # install for every supported agent
10xgraph skills --list                # list supported agents
10xgraph skills --force               # overwrite existing installation
10xgraph skills --validate ./.agents/skills  # check skills against the Agent Skills spec
```

See [Install skills](/docs/how-to/api-cli/install-skills) for the full guide.

---

### `10xgraph test`

Thin pytest wrapper. Reads optional defaults (`path`, `coverage`, `coverage_threshold`) from `10xgraph.json`. Extra arguments after `--` are forwarded to pytest verbatim.

```bash
10xgraph test
10xgraph test tests/unit
10xgraph test --coverage
10xgraph test --coverage --html       # open HTML coverage report
10xgraph test -k "test_graph"         # keyword filter
10xgraph test -- --tb=short           # forward flags to pytest
```

See [Run tests](/docs/how-to/api-cli/run-tests) for the full guide.

---

### `10xgraph eval`

Discovers `*_eval.py` / `eval_*.py` files, collects all cases into a flat pool, runs them under a single async event loop, and writes timestamped HTML + JSON reports to `eval_reports/`.

```bash
10xgraph eval
10xgraph eval evals/weather_agents_eval.py
10xgraph eval --parallel --max-concurrency 8
10xgraph eval --threshold 0.9         # fail if pass rate < 90 %
10xgraph eval --no-report             # console summary only
10xgraph eval --open                  # open HTML report in browser
```

Default output directory: `eval_reports/`. Default max concurrency: `4`.

See [Run evaluations](/docs/how-to/api-cli/run-evals) for the full guide.

---

### `10xgraph audit`

Read-only check of everything that has to be true before `dev`, `eval`, or `build` can work here: the Python interpreter, the installed `10xgraph-api` and `10xgraph` packages, whether the installed core still exposes the evaluation API the CLI imports, whether `10xgraph.json` is present and declares a valid `agent` key, and whether the default port is free.

```bash
10xgraph audit                        # table of six checks, including remote_tools format
10xgraph audit --config custom.json   # validate a nondefault project config
10xgraph --format json audit          # machine-readable, for CI
```

Nothing is written or changed. It exits `1` if any check fails and `0` otherwise (warnings, such as a missing project config or a busy port, do not fail the run), so it works as a CI gate.

---

### `10xgraph config`

Opens a local web editor for `10xgraph.json`. Every supported key is listed in the page: optional sections such as authentication, authorization, rate limiting, and observability have an on/off switch, and their fields are filled in with inputs instead of hand-written JSON.

```bash
10xgraph config                      # edit ./10xgraph.json (created on first save)
10xgraph config -c path/to/10xgraph.json
10xgraph config --port 8765 --no-open
```

- **Validate** checks the current form with the same parsers the API server uses and lists errors and warnings per section. Nothing is written.
- **Save** validates again and refuses to write while there are errors. The previous file is kept as `10xgraph.json.bak`, keys the editor does not know about are preserved, and the save is rejected if the file changed on disk after the page loaded.
- Secrets such as `JWT_SECRET_KEY` or `LOGFIRE_TOKEN` stay in your `.env` file; the editor never asks for them.

The editor only listens on `127.0.0.1` and each run uses a random session token in the printed link. Press Ctrl+C to stop it. The page loads Tailwind CSS from the jsDelivr CDN, so without internet access it still works but is unstyled.

---

### `10xgraph demo`

Previews the CLI animations, step timelines, and progress states without touching project state.

```bash
10xgraph demo
10xgraph demo --style eval            # typing, network, init, build, or eval
```

---

### `10xgraph version`

Prints the CLI and core framework versions, both resolved from installed distribution metadata.

```bash
10xgraph version
```

Example output:

```
10xgraph-api
  Version: 0.5.0
10xgraph (core)
  Version: 0.9.0
```

Use `10xgraph --version` for a script-friendly single line.

---

## Global flags

Root flags go before the command name and apply to every command: `--format` (`human`, `plain`, `json`, `jsonl`), `--json`, `--color` / `--no-color`, `--progress`, `--animation` / `--no-animation`, `--fullscreen` / `--no-fullscreen`, `--cwd`, `--debug`, `--yes` / `-y`, `--non-interactive`, and `--version` / `-V`.

```bash
10xgraph --format json audit
10xgraph --no-fullscreen dev
10xgraph --cwd ../my-agent eval --parallel
```

Commands also accept `--verbose` / `-v` (detailed logging) and `--quiet` / `-q` (errors only). Pass `-h` or `--help` to any command for its full flag reference, and see the [CLI commands reference](/docs/reference/api-cli/commands#global-options) for the complete table.
