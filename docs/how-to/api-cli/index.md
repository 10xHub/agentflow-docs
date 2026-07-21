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
| [`agentflow api`](./run-api-server.md) | Start the FastAPI development server |
| [`agentflow play`](./open-playground.md) | Start the server and open the hosted playground |
| [`agentflow build`](./generate-docker-files.md) | Generate a Dockerfile (and optionally docker-compose.yml) |
| [`agentflow skills`](./install-skills.md) | Install bundled coding-agent skills (Codex, Claude, GitHub) |
| [`agentflow test`](./run-tests.md) | Run the project test suite via pytest |
| [`agentflow eval`](./run-evals.md) | Run agent evaluations and generate HTML + JSON reports |
| `agentflow version` | Print CLI and package version |

---

## Command summaries

### `agentflow init`

Scaffolds a new agent project interactively. Prompts for agent name and setup type (Quick Start or Production). For production projects, also prompts for authentication and rate-limiting configuration.

```bash
agentflow init                  # scaffold in the current directory
agentflow init --path ./my-bot  # scaffold in a specific directory
agentflow init --force          # overwrite existing files
```

See [Initialize a project](./initialize-project.md) for the full guide.

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

Generates a production `Dockerfile`. Optionally generates `docker-compose.yml` as well (omitting the `CMD` from the Dockerfile in that case).

```bash
agentflow build
agentflow build --docker-compose
agentflow build --python-version 3.12 --port 8080
agentflow build --force         # overwrite existing Dockerfile
```

Default Python version: `3.13`. Default service name in docker-compose: `agentflow-api`.

See [Generate Docker files](./generate-docker-files.md) for the full guide.

---

### `agentflow skills`

Installs bundled AgentFlow coding-agent skills into your project for Codex, Claude, or GitHub Copilot.

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

### `agentflow version`

Prints the CLI version constant and the installed package version read from `pyproject.toml`.

```bash
agentflow version
```

Example output:

```
agentflow-cli CLI
  Version: 1.0.0
agentflow-cli Package
  Version: 0.3.2.8
```

---

## Global flags

Every command accepts `--verbose` / `-v` (detailed logging) and `--quiet` / `-q` (errors only). Pass `-h` or `--help` to any command for its full flag reference.
