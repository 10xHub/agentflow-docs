---
title: Initialize a Project
description: How to scaffold an AgentFlow project with agentflow init.
---

# Initialize a project

`agentflow init` creates the minimum files needed to run an agent behind the API: a config file and a starter graph module.

## Prerequisites

```bash
pip install 10xscale-agentflow-cli
```

## Run init

From your project directory:

```bash
agentflow init
```

This creates:

```
agentflow.json
graph/
  __init__.py
  react.py
```

If you want to initialize in a different directory:

```bash
agentflow init --path ./my-agent-project
```

## What each file does

### agentflow.json

The server configuration. The default content:

```json
{
  "agent": "graph.react:app",
  "thread_name_generator": "graph.thread_name_generator:MyNameGenerator",
  "env": ".env",
  "auth": null
}
```

- `agent` — the import path to your compiled graph
- `env` — the `.env` file loaded before the graph module is imported
- `auth` — authentication method (`null` for none, `"jwt"` for JWT)

### graph/react.py

A starter ReAct agent using a Gemini model. Replace this with your own graph, keeping the exported `app` variable.

## Overwrite existing files

If you already have `agentflow.json` and want to regenerate it:

```bash
agentflow init --force
```

## Initialize a production project

The `--prod` flag adds `pyproject.toml` and `.pre-commit-config.yaml` for a more structured project setup:

```bash
agentflow init --prod
```

## Next step

After initializing, replace `graph/react.py` with your agent and start the server:

```bash
agentflow api --host 127.0.0.1 --port 8000
```
