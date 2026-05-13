---
title: CLI Commands — AgentFlow Python AI Agent Framework
sidebar_label: CLI Commands
description: Complete reference for all agentflow CLI commands and their options. Part of the AgentFlow agentflow api reference guide for production-ready Python AI agents.
keywords:
  - agentflow api reference
  - rest api documentation
  - agent cli reference
  - agentflow
  - python ai agent framework
  - cli commands
---


# CLI commands

Install the CLI:

```bash
pip install 10xscale-agentflow-cli
```

Verify:

```bash
agentflow version
```

---

## agentflow init

Scaffold a new project with `agentflow.json` and a starter graph module.

```bash
agentflow init [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--path`, `-p` | `.` | Directory to initialize files in |
| `--force`, `-f` | `false` | Overwrite existing files |
| `--prod` | `false` | Add `pyproject.toml` and `.pre-commit-config.yaml` |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Creates:**

```
agentflow.json
graph/
  __init__.py
  react.py
skills/
  agent-skills/
    SKILL.md
    references/
      skill-concepts.md
      agentflow.md
      claude.md
      codex.md
      github.md
```

**With `--prod`:**

```
agentflow.json
graph/
  __init__.py
  react.py
skills/
  agent-skills/
    SKILL.md
    references/
      skill-concepts.md
      agentflow.md
      claude.md
      codex.md
      github.md
pyproject.toml
.pre-commit-config.yaml
```

**Example:**

```bash
# Initialize in the current directory
agentflow init

# Initialize in a specific folder
agentflow init --path ./my-agent

# Overwrite an existing project
agentflow init --force
```

---

## agentflow api

Start the FastAPI server that serves your compiled graph.

```bash
agentflow api [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--config`, `-c` | `agentflow.json` | Path to config file |
| `--host`, `-H` | `0.0.0.0` | Bind host (use `127.0.0.1` for localhost only) |
| `--port`, `-p` | `8000` | Bind port |
| `--reload/--no-reload` | `--reload` | Enable auto-reload on file changes |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Example:**

```bash
# Start with defaults (binds to all interfaces)
agentflow api

# Start on localhost only
agentflow api --host 127.0.0.1 --port 8000

# Disable auto-reload for production
agentflow api --no-reload

# Use a different config file
agentflow api --config ./config/prod.json
```

---

## agentflow play

Start the API server and open the hosted playground in a browser.

```bash
agentflow play [OPTIONS]
```

Accepts the same options as `agentflow api`. The `--host` and `--port` values are also used to build the `backendUrl` that is passed to the hosted playground.

**Example:**

```bash
agentflow play --host 127.0.0.1 --port 8000
```

The CLI prints the playground URL. If the browser does not open automatically, open the URL manually. The `backendUrl` query parameter tells the playground which local API to call.

---

## agentflow build

Generate a `Dockerfile` (and optionally `docker-compose.yml`) for deployment.

```bash
agentflow build [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--output`, `-o` | `Dockerfile` | Output Dockerfile path |
| `--force`, `-f` | `false` | Overwrite existing Dockerfile |
| `--python-version` | `3.13` | Python base image version |
| `--port`, `-p` | `8000` | Port to expose in the container |
| `--docker-compose/--no-docker-compose` | `--no-docker-compose` | Also generate `docker-compose.yml` |
| `--service-name` | `agentflow-cli` | Service name in `docker-compose.yml` |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Example:**

```bash
# Minimal Dockerfile
agentflow build

# Dockerfile + docker-compose.yml
agentflow build --docker-compose --service-name my-agent

# Custom Python version
agentflow build --python-version 3.12
```

---

## agentflow skills

Install bundled AgentFlow skills into project-local assistant skill directories.

```bash
agentflow skills [OPTIONS]
```

When `--agent` is omitted in an interactive terminal, the command prompts:

```text
Which agent?
- 1. Codex
- 2. Claude
- 3. GitHub
```

| Option | Default | Description |
| --- | --- | --- |
| `--agent`, `-a` | prompt | Target agent: `codex`, `claude`, `github`, or menu number `1`, `2`, `3` |
| `--path`, `-p` | `.` | Project directory where the skills should be installed |
| `--force`, `-f` | `false` | Overwrite the existing installed AgentFlow skill directory |
| `--all` | `false` | Install skills for every supported agent |
| `--list`, `-l` | `false` | List supported agents and exit |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

Install locations:

| Agent | Installed files |
| --- | --- |
| Codex | `.agents/skills/agentflow/` |
| Claude | `.claude/skills/agentflow/` |
| GitHub | `.github/instructions/agentflow.instructions.md` and `.github/skills/agentflow/` |

**Example:**

```bash
# Prompt for target agent
agentflow skills

# Install for Codex
agentflow skills --agent codex

# Install for Claude in another project directory
agentflow skills --agent claude --path ./my-agent

# Install for every supported assistant
agentflow skills --all

# List supported assistants
agentflow skills --list

# Overwrite an existing install
agentflow skills --agent github --force
```

---

## agentflow test

Run the project's test suite with pytest.

```bash
agentflow test [PATH] [OPTIONS] [-- PYTEST_ARGS]
```

| Option | Default | Description |
| --- | --- | --- |
| `PATH` | — | Path to a tests directory or file. When omitted, pytest auto-discovers tests across the whole project. |
| `--coverage`, `-C` | `false` | Run with coverage (`--cov=. --cov-report=term-missing --cov-report=html:htmlcov`) |
| `--html` | `false` | Open the HTML coverage report in a browser after the run (requires `--coverage`) |
| `-k EXPR` | — | Only run tests whose name matches the given expression (forwarded to pytest) |
| `--verbose`, `-v` | `false` | Enable verbose output |
| `--quiet`, `-q` | `false` | Suppress output except errors |

Any arguments after `--` are forwarded verbatim to pytest.

When `PATH` is omitted, no path argument is passed to pytest and pytest's own discovery rules apply (it searches `testpaths` from `pytest.ini`/`pyproject.toml`, or the current directory if none are configured). Supplying `PATH` restricts the run to that directory or file only.

The command also reads the optional `test` section from `agentflow.json` for project-level defaults. CLI flags take precedence over config file values. If `path` is set in `agentflow.json`, it is used only when no `PATH` argument is given on the CLI.

**Example:**

```bash
# Run tests/ with verbose output (default)
agentflow test

# Run with coverage
agentflow test --coverage

# Run with coverage and open the HTML report
agentflow test --coverage --html

# Target a specific path
agentflow test tests/unit

# Run only tests matching a keyword
agentflow test -k "weather"

# Pass raw pytest arguments after --
agentflow test -- --no-header -q --tb=short

# Combine: coverage + keyword filter + extra args
agentflow test --coverage -k "agent" -- --tb=long
```

---

## agentflow eval

Run agent evaluations from an `evals/` directory (or a specific file/folder). Always generates HTML and JSON reports unless `--no-report` is set.

```bash
agentflow eval [TARGET] [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `TARGET` | `evals/` | File or directory to evaluate. When omitted, uses `evaluation.directory` from `agentflow.json`, or `evals/` if not set. |
| `--output`, `-o` | `eval_reports` | Directory for generated report files |
| `--no-report` | `false` | Skip file report generation (console summary only) |
| `--threshold`, `-t` | — | Fail if overall pass rate is below this value (0.0–1.0) |
| `--open` | `false` | Open the HTML report in the default browser after the run |
| `--verbose`, `-v` | `false` | Enable verbose output |
| `--quiet`, `-q` | `false` | Suppress output except errors |

Each eval file must expose one of the following:

| Symbol | Description |
| --- | --- |
| `get_eval_set()` | Required minimum. CLI loads agent, applies default criteria, runs evaluation, writes reports. |
| `get_eval_config()` or `EVAL_CONFIG` | Optional. Override criteria/thresholds for this file. Used alongside `get_eval_set()`. |
| `run()` | Full control. Module handles agent loading and evaluation. Returns an `EvalReport`. |

Files not matching any protocol are skipped with a warning.

**Reports generated per run (unless `--no-report`):**

- `eval_reports/eval_<timestamp>.html` — visual dashboard
- `eval_reports/eval_<timestamp>.json` — machine-readable results

**Example:**

```bash
# Auto-discover evals/ and generate reports
agentflow eval

# Run a specific file
agentflow eval evals/weather_agents_eval.py

# Run all evals in a subdirectory
agentflow eval evals/regression/

# Custom output directory
agentflow eval --output reports/

# Fail if pass rate is below 80 %
agentflow eval --threshold 0.8

# Skip file output (console only)
agentflow eval --no-report

# Open the HTML report when done
agentflow eval --open
```

---

## agentflow version

Print the CLI and library versions.

```bash
agentflow version [--verbose]
```

---

## Global options

All commands accept `--help` (`-h`) for usage information:

```bash
agentflow --help
agentflow api --help
agentflow init --help
```
