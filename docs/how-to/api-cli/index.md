---
title: API & CLI Overview — CLI how-to
sidebar_label: Overview
description: Overview of the AgentFlow CLI commands. Install, scaffold, serve, test, evaluate, and deploy agents from the terminal.
keywords:
  - agentflow cli
  - agentflow api
  - agentflow init
  - agentflow build
  - agentflow eval
  - python ai agent framework
---

# API & CLI

The `agentflow` CLI (`10xscale-agentflow-cli`) provides every command you need to scaffold, run, test, evaluate, and containerize your agents.

## Installation

```bash
pip install 10xscale-agentflow-cli
```

Verify the installation:

```bash
agentflow --help
```

## Commands

| Command | Description |
| --- | --- |
| [`agentflow init`](./initialize-project.md) | Interactively scaffold a new agent project |
| `agentflow dev` | Start the local development server and open the playground |
| [`agentflow api`](./run-api-server.md) | Start the FastAPI development server |
| [`agentflow play`](./open-playground.md) | Start the server and open the hosted playground |
| [`agentflow build`](./generate-docker-files.md) | Generate a Dockerfile (and optionally docker-compose.yml / k8s.yaml) |
| [`agentflow skills`](./install-skills.md) | Install bundled coding-agent skills (Codex, Claude, GitHub) |
| [`agentflow test`](./run-tests.md) | Run the project test suite via pytest |
| [`agentflow eval`](./run-evals.md) | Run agent evaluations and generate HTML + JSON reports |
| `agentflow audit` | Check the interpreter, packages, project config, and port |
| `agentflow config` | Manage user-level CLI preferences |
| `agentflow demo` | Preview the CLI animations with no side effects |
| `agentflow version` | Print CLI and core framework version |

Every command is documented option by option in the
[CLI commands reference](../../reference/api-cli/commands.md).

---

## Command summaries

### `agentflow init`

Scaffolds a new agent project interactively. Prompts for agent name and setup type (Quick Start or Production). For production projects, also prompts for authentication and rate-limiting configuration. Every answer has a matching flag, so the same scaffold can be reproduced without prompts.

```bash
agentflow init                  # scaffold in the current directory
agentflow init --path ./my-bot  # scaffold in a specific directory
agentflow init --force          # overwrite existing files

# No prompts: CI, or a coding agent
agentflow init --name MyAgent --template quick-start --non-interactive
agentflow init --template production --auth jwt --rate-limit redis --yes --dry-run
```

See [Initialize a project](./initialize-project.md) for the full guide.

---

### `agentflow dev`

Starts the local development server and opens the hosted playground once the API is reachable. It runs the same server as `agentflow api` and takes the same options, plus `--open/--no-open`. This is the command to reach for while building; `api` and `play` remain available.

```bash
agentflow dev                              # 127.0.0.1:8000, reload on, playground opens
agentflow dev --host 127.0.0.1 --port 9000
agentflow dev --no-open --no-reload        # API only
agentflow dev --config production.json
```

---

### `agentflow api`

Starts a Uvicorn-backed FastAPI server that loads your compiled graph from `agentflow.json`. Auto-reload is enabled by default.

```bash
agentflow api
agentflow api --host 0.0.0.0 --port 8000
agentflow api --no-reload       # disable file-watching (production)
```

Default host: `127.0.0.1`. Default port: `8000`.

See [Run the API server](./run-api-server.md) for the full guide.

---

### `agentflow play`

Same as `agentflow api` but also opens the hosted playground in your default browser once the server is reachable.

```bash
agentflow play
agentflow play --port 8001
```

See [Open the playground](./open-playground.md) for the full guide.

---

### `agentflow build`

Generates a production `Dockerfile`. Optionally generates `docker-compose.yml` as well (omitting the `CMD` from the Dockerfile in that case), and a `k8s.yaml` with a Deployment and Service.

```bash
agentflow build
agentflow build --docker-compose
agentflow build --k8s                    # Deployment + Service in k8s.yaml
agentflow build --python-version 3.12 --port 8080
agentflow build --force         # overwrite existing Dockerfile
```

Default Python version: `3.13`. Default service name in docker-compose and k8s.yaml: `agentflow-cli`.

See [Generate Docker files](./generate-docker-files.md) for the full guide.

---

### `agentflow skills`

Installs bundled AgentFlow coding-agent skills into your project for Codex, Claude, or GitHub Copilot. Without `--agent`, it shows a checklist where space toggles and enter confirms; already-installed agents are labelled and pre-checked.

```bash
agentflow skills                       # interactive agent selection
agentflow skills --agent claude
agentflow skills --agent codex
agentflow skills --agent github
agentflow skills --all                 # install for every supported agent
agentflow skills --list                # list supported agents
agentflow skills --force               # overwrite existing installation
```

See [Install skills](./install-skills.md) for the full guide.

---

### `agentflow test`

Thin pytest wrapper. Reads optional defaults (`path`, `coverage`, `coverage_threshold`) from `agentflow.json`. Extra arguments after `--` are forwarded to pytest verbatim.

```bash
agentflow test
agentflow test tests/unit
agentflow test --coverage
agentflow test --coverage --html       # open HTML coverage report
agentflow test -k "test_graph"         # keyword filter
agentflow test -- --tb=short           # forward flags to pytest
```

See [Run tests](./run-tests.md) for the full guide.

---

### `agentflow eval`

Discovers `*_eval.py` / `eval_*.py` files, collects all cases into a flat pool, runs them under a single async event loop, and writes timestamped HTML + JSON reports to `eval_reports/`.

```bash
agentflow eval
agentflow eval evals/weather_agents_eval.py
agentflow eval --parallel --max-concurrency 8
agentflow eval --threshold 0.9         # fail if pass rate < 90 %
agentflow eval --no-report             # console summary only
agentflow eval --open                  # open HTML report in browser
```

Default output directory: `eval_reports/`. Default max concurrency: `4`.

See [Run evaluations](./run-evals.md) for the full guide.

---

### `agentflow audit`

Read-only check of everything that has to be true before `dev`, `eval`, or `build` can work here: the Python interpreter, the installed `10xscale-agentflow-cli` and `10xscale-agentflow` packages, whether the installed core still exposes the evaluation API the CLI imports, whether `agentflow.json` is present and declares a valid `agent` key, and whether the default port is free.

```bash
agentflow audit                        # table of six checks
agentflow --format json audit          # machine-readable, for CI
```

Nothing is written or changed. It exits `1` if any check fails and `0` otherwise (warnings, such as a missing project config or a busy port, do not fail the run), so it works as a CI gate.

---

### `agentflow config`

Manages user-level CLI preferences, stored as JSON in the per-user config directory (for example `~/.config/agentflow/config.json` on Linux) and applied to every project. `output.format`, `output.color`, and `output.progress` become the defaults for the matching root flags; explicit flags still win.

```bash
agentflow config path
agentflow config list
agentflow config set output.format plain
agentflow config get output.format
agentflow config unset output.format
agentflow config validate
```

---

### `agentflow demo`

Previews the CLI animations, step timelines, and progress states without touching project state.

```bash
agentflow demo
agentflow demo --style eval            # typing, network, init, build, or eval
```

---

### `agentflow version`

Prints the CLI and core framework versions, both resolved from installed distribution metadata.

```bash
agentflow version
```

Example output:

```
10xscale-agentflow-cli
  Version: 0.5.0
10xscale-agentflow (core)
  Version: 0.9.0
```

Use `agentflow --version` for a script-friendly single line.

---

## Global flags

Root flags go before the command name and apply to every command: `--format` (`human`, `plain`, `json`, `jsonl`), `--json`, `--color` / `--no-color`, `--progress`, `--animation` / `--no-animation`, `--fullscreen` / `--no-fullscreen`, `--cwd`, `--debug`, `--yes` / `-y`, `--non-interactive`, and `--version` / `-V`.

```bash
agentflow --format json audit
agentflow --no-fullscreen dev
agentflow --cwd ../my-agent eval --parallel
```

Commands also accept `--verbose` / `-v` (detailed logging) and `--quiet` / `-q` (errors only). Pass `-h` or `--help` to any command for its full flag reference, and see the [CLI commands reference](../../reference/api-cli/commands.md#global-options) for the complete table.
