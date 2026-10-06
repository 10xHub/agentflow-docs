---
title: Initialize a Project
description: "Scaffold a new 10xGraph project with the 10xgraph init command, and see what it generates and which files to edit first."
section: How-to guides
group: CLI
order: 860
label: Initialize a Project
updated: "2026-09-29"
---

`10xgraph init` scaffolds the minimum files needed to run an agent behind the API. It is fully interactive, it prompts for your preferences and generates a project tailored to your answers.

## Prerequisites

Install the CLI:

```bash
pip install 10xgraph-api
```

## Run init

Navigate to an empty directory and run:

```bash
10xgraph init
```

To scaffold in a specific directory without changing into it first:

```bash
10xgraph init --path ./my-agent-project
```

## Interactive prompts

`10xgraph init` asks a series of questions:

### 1. Agent name

```
What is your agent name? (MyAgent)
```

Enter a name for your agent (e.g. `WeatherBot`). This is used in display strings and to derive the package slug (e.g. `weather-bot`).

### 2. Setup type

```
Quick Start or Production setup?
  > Quick Start
    Production
```

**Quick Start** generates a minimal project, a graph module, config file, and env template. Choose this when you want to get something running immediately.

**Production** generates a full project structure with tests, evaluations, a `pyproject.toml`, optional authentication, and optional rate limiting. Choose this for projects you will deploy or share with a team.

### 3. Authentication (Production only)

```
Authentication type?
  > None
    JWT
    Custom
```

- **None**, No authentication. All endpoints are open.
- **JWT**, Bearer token auth using `JWT_SECRET_KEY`. Set `JWT_SECRET_KEY` in `.env` before starting the server.
- **Custom**, Generates an `auth/agent_auth.py` stub where you implement your own `BaseAuth` subclass.

### 4. Rate limiting (Production only)

```
Rate limiting?
  > None
    Memory Based
    Redis Based
```

If you choose **Memory Based** or **Redis Based**, the CLI prompts for:

- Max requests per window (default: `100`)
- Window size in seconds (default: `60`)
- Limit by IP or globally
- Whether to read the real IP from forwarded headers (for reverse-proxy setups)

**Redis Based** requires `REDIS_URL` in `.env`.

## Files created

### Quick Start

```
10xgraph.json
.env.example
graph/
  __init__.py
  agent.py
```

### Production

```
10xgraph.json
.env.example
.python-version
pyproject.toml
graph/
  __init__.py
  agent.py
  thread_name_generator.py
  validators/
    __init__.py
    lifecyle.py
    manager.py
evals/
  __init__.py
  confeval.py
  weather_agents_eval.py
  user_simulator_eval.py
tests/
  __init__.py
  conftest.py
  test_graph_nodes.py
  test_catalog_tools.py
  test_agent_eval.py
auth/                  # only when Custom auth is selected
  __init__.py
  agent_auth.py
```

The `10xgraph.json` is generated from your answers, not copied verbatim from the template.

## What each file does

### 10xgraph.json

The core server configuration. Minimal Quick Start example:

```json
{
  "agent": "graph.agent:app",
  "env": ".env",
  "auth": null,
  "thread_name_generator": null
}
```

Production example with JWT auth and memory rate limiting:

```json
{
  "agent": "graph.agent:app",
  "env": ".env",
  "auth": {"method": "jwt"},
  "thread_name_generator": "graph.thread_name_generator:MyNameGenerator",
  "injectq": "graph.agent:container",
  "rate_limit": {
    "enabled": true,
    "backend": "memory",
    "requests": 100,
    "window": 60,
    "by": "ip",
    "trusted_proxy_headers": false,
    "exclude_paths": ["/ping", "/docs", "/redoc", "/openapi.json"]
  }
}
```

**Field explanation:**

- `agent` (required), import path to your compiled graph, expressed as `module:attribute`. The server imports the module and retrieves the attribute (a compiled `StateGraph`).
- `env`, path to a `.env` file. Loaded with `python-dotenv` before the graph module is imported.
- `auth`, `null` for no auth, `{"method": "jwt"}` for JWT bearer tokens, or `{"method": "custom", "path": "auth.agent_auth:AgentAuth"}` for a custom backend.
- `thread_name_generator`, import path to a thread name generator. When set, the API generates human-readable thread names automatically.
- `injectq`, import path to your dependency-injection container (Production only).
- `rate_limit`, rate limiting configuration. `backend` can be `memory` or `redis`.

### graph/agent.py

A starter ReAct agent. Replace the graph logic with your own while keeping the `app` variable defined, the server imports it by name.

### .env.example

A template for your local `.env` file. Copy it and fill in your API keys:

```bash
cp .env.example .env
```

### pyproject.toml (Production only)

Python package definition. Allows `pip install -e .` for editable installs and integrates with tools like `ruff` and `mypy`.

### evals/ (Production only)

Starter evaluation files. Run them with `10xgraph eval`.

### tests/ (Production only)

Starter pytest tests. Run them with `10xgraph test`.

## Overwrite existing files

If you want to regenerate files in an already-initialized project:

```bash
10xgraph init --force
```

This overwrites all files without prompting. Use carefully, it replaces your existing graph code and configuration.

## Options reference

| Option | Short | Default | Description |
| --- | --- | --- | --- |
| `--path` | `-p` | `.` | Directory to scaffold the project in |
| `--force` | `-f` | off | Overwrite existing files |
| `--verbose` | `-v` | off | Enable verbose logging |
| `--quiet` | `-q` | off | Suppress all output except errors |

## Next steps

After `10xgraph init`:

1. Run `10xgraph skills` to install coding-agent skills for your AI assistant.
2. Copy `.env.example` to `.env` and add your API keys.
3. Run `10xgraph play` to start the server and open the playground.

## Troubleshooting

**"ModuleNotFoundError: No module named 'agentflow_cli'"**
- Install the CLI: `pip install 10xgraph-api`

**"File already exists" error**
- Pass `--force` to overwrite: `10xgraph init --force`

**Server fails to start after init**
- Check that the `agent` field in `10xgraph.json` matches the actual module path.
- Verify your graph module can be imported: `python -c "from graph.agent import app; print(app)"`
