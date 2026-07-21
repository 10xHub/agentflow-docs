---
title: CLI Commands — CLI reference
sidebar_label: CLI Commands
description: Complete reference for all agentflow CLI commands and their options.
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

Scaffold a new project with `agentflow.json` and a starter graph module. The command is **interactive**: prompts choose the setup type (minimal development scaffold or the fuller production scaffold), whether to wire auth, and whether to add a rate-limit block. There is no flag for the setup type.

```bash
agentflow init [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--path`, `-p` | `.` | Directory to initialize files in |
| `--force`, `-f` | `false` | Overwrite existing files |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Quick Start creates:**

```
agentflow.json
.env.example
graph/
  __init__.py
  agent.py
```

**Production creates:**

```
agentflow.json
.env.example
.pre-commit-config.yaml
.python-version
pyproject.toml
graph/
  __init__.py
  agent.py
  state.py
  thread_name_generator.py
  tools/
  validators/
auth/                 # only when the auth prompt answers "Custom"
  agent_auth.py
evals/
  weather_agents_eval.py
  user_simulator_eval.py
tests/
  conftest.py
  test_agent_eval.py
  test_catalog_tools.py
  test_graph_nodes.py
```

The Production path also writes the answers to the auth and rate-limit prompts into the generated `agentflow.json` (`auth`, `authorization`, `rate_limit`, `thread_name_generator`, `injectq`).

Assistant skill files are not part of `init`; install them separately with [`agentflow skills`](#agentflow-skills).

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
| `--host`, `-H` | `127.0.0.1` | Bind host. The default is localhost only; pass `0.0.0.0` to bind all interfaces. |
| `--port`, `-p` | `8000` | Bind port |
| `--reload/--no-reload` | `--reload` | Enable auto-reload on file changes |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Example:**

```bash
# Start with defaults (localhost only, port 8000)
agentflow api

# Bind all interfaces (containers, LAN access)
agentflow api --host 0.0.0.0 --port 8000

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

Accepts the same options as `agentflow api`, including the `127.0.0.1` default for `--host`. The `--host` and `--port` values are also used to build the `backendUrl` that is passed to the hosted playground.

**Example:**

```bash
agentflow play --host 127.0.0.1 --port 8000
```

The CLI prints the playground URL. If the browser does not open automatically, open the URL manually. The `backendUrl` query parameter tells the playground which local API to call.

---

## agentflow build

Generate a `Dockerfile` (and optionally `docker-compose.yml` and `k8s.yaml`) for deployment.

```bash
agentflow build [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--output`, `-o` | `Dockerfile` | Output Dockerfile path |
| `--force`, `-f` | `false` | Overwrite existing `Dockerfile`, `docker-compose.yml`, or `k8s.yaml` |
| `--python-version` | `3.13` | Python base image version |
| `--port`, `-p` | `8000` | Port to expose in the container |
| `--docker-compose/--no-docker-compose` | `--no-docker-compose` | Also generate `docker-compose.yml` and omit `CMD` from the Dockerfile |
| `--k8s/--no-k8s` | `--no-k8s` | Also generate `k8s.yaml` (a `Deployment` plus a `Service`) |
| `--service-name` | `agentflow-cli` | Service name used in `docker-compose.yml` and `k8s.yaml` |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

`--k8s` always writes to `k8s.yaml` in the current directory (the path is not configurable). The generated `Deployment` sets a `terminationGracePeriodSeconds` long enough that a rolling deploy does not SIGKILL an agent run mid-LLM-call, plus a `preStop` hook. Kubernetes' own 30-second default is too short for agent workloads, which is the reason to generate the manifest instead of hand-rolling one.

**Example:**

```bash
# Minimal Dockerfile
agentflow build

# Dockerfile + docker-compose.yml
agentflow build --docker-compose --service-name my-agent

# Dockerfile + Kubernetes manifest
agentflow build --k8s --service-name my-agent

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
| `--parallel`, `-p` | `false` | Collect every case from every file into one flat pool and run them concurrently |
| `--max-concurrency`, `-c` | `4` | Maximum cases running at once when `--parallel` is set (a single global semaphore) |
| `--verbose`, `-v` | `false` | Enable verbose output |
| `--quiet`, `-q` | `false` | Suppress output except errors |

Each eval file must expose one of the following entry points. They are checked in
this order, and the first match wins:

| Symbol | Description |
| --- | --- |
| `get_scenarios()` or `SCENARIOS` | Simulator protocol. Returns user-simulation scenarios; the CLI drives a simulated user against your agent. See [user simulation](../../qa/evaluation/user-simulation.md). |
| `get_eval_set()` | Standard protocol. Returns an `EvalSet`. The CLI loads the agent, applies the resolved criteria, runs the cases, and writes reports. |
| Pytest-style functions | Any public module-level function annotated `-> EvalSet` is collected as an eval. A function annotated `-> EvalConfig` supplies that file's config. |

Config is resolved per file, highest priority first:

| Source | Notes |
| --- | --- |
| `get_eval_config()` or `EVAL_CONFIG` in the file | Overrides everything for that file. Used alongside any of the entry points above. |
| `confeval.py` in the eval directory | Shared config, applied to files with no per-file config. Must expose `get_eval_config()` or `EVAL_CONFIG`. |
| Built-in defaults | Used when neither is present. |

Files matching no protocol are skipped with a warning:
`Skipping <file> — no eval entry point found.`

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

# Run every case concurrently, at most 8 at a time
agentflow eval --parallel --max-concurrency 8
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
