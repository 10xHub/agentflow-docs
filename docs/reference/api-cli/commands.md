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

Scaffold a new project with `agentflow.json` and a starter graph module. By default the command is **interactive**: prompts choose the setup type (minimal Quick Start scaffold or the fuller Production scaffold), whether to wire auth, and whether to add a rate-limit block. Every answer also has a flag, so the same scaffold can be reproduced non-interactively in CI or by a coding agent.

```bash
agentflow init [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--path`, `-p` | `.` | Directory to initialize files in |
| `--force`, `-f` | `false` | Overwrite existing files |
| `--name` | prompt | Agent name; required only when a default cannot be inferred |
| `--template` | prompt | `quick-start` or `production` |
| `--auth` | prompt | Production authentication: `none`, `jwt`, or `custom` |
| `--rate-limit` | prompt | Rate limiting: `none`, `memory`, or `redis` |
| `--yes`, `-y` | `false` | Accept the recommended defaults instead of prompting |
| `--non-interactive` | `false` | Fail instead of prompting; for CI and coding agents |
| `--dry-run` | `false` | Preview the scaffold without writing files |
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

# Reproducible, no prompts
agentflow init --path ./my-agent --name MyAgent --template quick-start --non-interactive

# Production scaffold with every answer supplied, previewed first
agentflow init --template production --auth jwt --rate-limit redis --yes --dry-run
```

---

## agentflow dev

Start the local development server and open the hosted playground once the API is
reachable. This is the goal-oriented command for day-to-day development; it runs the
same server as `agentflow api` and takes the same options, plus `--open/--no-open`.

```bash
agentflow dev [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--config`, `-c` | `agentflow.json` | Path to the project configuration file |
| `--host`, `-H` | `127.0.0.1` | Host interface for the local development server |
| `--port`, `-p` | `8000` | Port for the local development server |
| `--reload/--no-reload` | `--reload` | Reload the server when project files change |
| `--open/--no-open` | `--open` | Open the hosted playground when the API is ready |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

**Example:**

```bash
# Defaults: 127.0.0.1:8000, reload on, playground opens
agentflow dev

# Custom host and port
agentflow dev --host 127.0.0.1 --port 9000

# API only, no playground and no file watching
agentflow dev --no-open --no-reload

# A different config file
agentflow dev --config production.json
```

`agentflow api` (server only) and `agentflow play` (server plus playground) remain
available and behave exactly as before.

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

When `--agent` is omitted in an interactive terminal, the command shows a checklist —
**space toggles, enter confirms** — instead of asking for a menu number:

```text
Which agents should get the Agentflow skill?
 ◯ Codex     .agents/skills/agentflow
 ◯ Claude    .claude/skills/agentflow
 ◯ GitHub    .github/instructions/agentflow.instructions.md
```

Each row shows where it installs. Agents that are already set up are labelled and
pre-checked, and choosing one that exists offers to overwrite rather than failing.
In a terminal that cannot host a prompt, the command asks for `--agent` or `--all`
instead of raising.

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

Print the CLI and core framework versions. Both are resolved from installed
distribution metadata.

```bash
agentflow version [--verbose] [--quiet]
```

Example output:

```
10xscale-agentflow-cli
  Version: 0.5.0
10xscale-agentflow (core)
  Version: 0.9.0
```

For a script-friendly single line, use the root flag instead:

```bash
agentflow --version    # prints just the CLI version
```

---

## agentflow audit

Read-only check of everything that has to be true before `dev`, `eval`, or `build`
can work in the current directory. Nothing is written or changed, so it is always
safe to run.

```bash
agentflow audit [OPTIONS]
```

| Option | Default | Description |
| --- | --- | --- |
| `--verbose`, `-v` | `false` | Enable verbose logging |
| `--quiet`, `-q` | `false` | Suppress output except errors |

Six checks run in a fixed order and are reported twice: live through the step
timeline, and again as a summary table.

| Check | What it asserts |
| --- | --- |
| Python | The interpreter running the CLI (reported, never failed) |
| CLI package | `10xscale-agentflow-cli` is installed and resolvable |
| Core framework | `10xscale-agentflow` is installed and resolvable |
| Evaluation API | The installed core still exposes the evaluation symbols `agentflow eval` imports, catching a CLI/core version skew before it becomes an `ImportError` mid-run |
| Project configuration | `agentflow.json` exists here, parses, and declares an `agent` key in `module:attribute` form |
| Port | The default API port (`8000`) is free to bind |

Each check reports `PASS`, `WARN`, or `FAIL`. The command exits `1` if any check
fails and `0` otherwise — warnings (no project config, port already bound) are
surfaced without failing the run, which makes it usable as a CI gate.

**Example:**

```bash
# Human-readable table
agentflow audit

# Machine-readable events, for CI
agentflow --format json audit

# Static output, no motion
agentflow --no-animation audit
```

---

## agentflow config

Inspect and manage user-level CLI preferences. They are stored as JSON in the
per-user config directory (`platformdirs`), for example
`~/.config/agentflow/config.json` on Linux, and apply to every project.

```bash
agentflow config path       # print the configuration file path
agentflow config list       # list every stored preference
agentflow config get KEY    # read one preference
agentflow config set KEY VALUE
agentflow config unset KEY  # remove one preference
agentflow config validate   # parse the file and check known keys
```

Keys are dot-separated. `set` parses `VALUE` as JSON and falls back to a plain
string, so `agentflow config set output.format plain` and
`agentflow config set rate_limit.requests 100` both work.

These keys are read at startup as defaults for the root output flags:

| Key | Values | Default |
| --- | --- | --- |
| `output.format` | `human`, `plain`, `json`, `jsonl` | `human` |
| `output.color` | `auto`, `always`, `never` | `auto` |
| `output.progress` | `auto`, `tty`, `plain`, `json`, `quiet` | `auto` |

Command-line flags always win over stored values. If the file is unreadable or a
key holds an unsupported value, commands fail with a pointer to
`agentflow config validate` (the `config` sub-commands themselves still run, so
the bad value can be fixed).

---

## agentflow demo

Preview the terminal animations, step timelines, and progress states without
touching project state. Useful for checking how the CLI will render in a given
terminal, or over SSH and in CI.

```bash
agentflow demo [--style STYLE]
```

| Option | Default | Description |
| --- | --- | --- |
| `--style` | `all` | Animation theme: `all`, `typing`, `network`, `init`, `build`, or `eval` (`play` and `api` are accepted as aliases for `typing` and `network`) |

**Example:**

```bash
agentflow demo
agentflow demo --style eval
```

---

## Global options

These are **root** options: they are passed before the command name and apply to
every command.

| Option | Default | Description |
| --- | --- | --- |
| `--format` | `human` | Output format: `human`, `plain`, `json`, or `jsonl` |
| `--json` | `false` | Shorthand for `--format json` |
| `--color` | `auto` | Color policy: `auto`, `always`, or `never` |
| `--no-color` | `false` | Shorthand for `--color never` |
| `--progress` | `auto` | Progress mode: `auto`, `tty`, `plain`, `json`, or `quiet` |
| `--animation/--no-animation` | auto | Enable or disable decorative command animation |
| `--fullscreen/--no-fullscreen` | full-screen on an interactive terminal | Run on a dedicated full-screen surface with a pinned header and footer |
| `--cwd` | current directory | Run as if the CLI was started in this directory |
| `--verbose`, `-v` | `0` | Increase diagnostic verbosity; repeat for more detail |
| `--quiet`, `-q` | `false` | Suppress informational, progress, and success output |
| `--debug` | `false` | Enable debug diagnostics |
| `--yes`, `-y` | `false` | Accept recommended defaults for supported workflows |
| `--non-interactive` | `false` | Never prompt for input |
| `--version`, `-V` | — | Print the CLI version and exit |

```bash
agentflow --format json audit
agentflow --no-fullscreen dev
agentflow --cwd ../my-agent eval --parallel
```

Defaults for `--format`, `--color`, and `--progress` come from
[`agentflow config`](#agentflow-config). Set `AGENTFLOW_NO_FULLSCREEN=1` to opt out
of the full-screen surface for every invocation. Motion is disabled automatically
for redirected output, CI, `TERM=dumb`, JSON/JSONL output, and
`AGENTFLOW_NO_SPINNER=1`.

All commands also accept `--help` (`-h`) for usage information:

```bash
agentflow --help
agentflow dev --help
agentflow init --help
```
