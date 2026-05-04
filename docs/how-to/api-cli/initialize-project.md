---
title: Initialize a Project — AgentFlow Python AI Agent Framework
description: How to scaffold an AgentFlow project with agentflow init. Part of the AgentFlow agentflow api guide for production-ready Python AI agents.
keywords:
  - agentflow api
  - agentflow cli
  - agent rest api
  - agentflow
  - python ai agent framework
  - initialize a project
---


# Initialize a project

`agentflow init` scaffolds the minimum files needed to run an agent behind the API: a configuration file, a graph module, and optional project structure files.

## Prerequisites

You need AgentFlow CLI and Python 3.11 or later.

```bash
pip install 10xscale-agentflow-cli
python --version  # Verify Python 3.11+
```

If you want to use the starter agent with Gemini, also install the client:

```bash
pip install google-generativeai
```

## Create a project directory

Create and navigate to your agent project directory:

```bash
mkdir my-agent-project
cd my-agent-project
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
```

## Run init

Initialize the project scaffolding:

```bash
agentflow init
```

This creates:

```
agentflow.json
graph/
  __init__.py
  react.py
.env
```

To initialize in a different directory without changing folders:

```bash
agentflow init --path ./my-agent-project
```

## What each file does

### agentflow.json

This is the core server configuration file. The default content:

```json
{
  "agent": "graph.react:app",
  "thread_name_generator": null,
  "env": ".env",
  "auth": null
}
```

**Field explanation:**

- `agent` (required) — the import path to your compiled graph, expressed as `module:attribute`. The loader imports the module and retrieves the attribute (usually a `CompiledGraph` instance). In this case, it imports the `graph.react` module and retrieves the `app` variable.
- `env` (optional) — path to a `.env` file containing environment variables. These are loaded with `python-dotenv` before the graph module is imported, so you can reference them in your graph initialization.
- `thread_name_generator` (optional) — import path to a thread name generator. When set, the API uses it to create human-readable thread names (e.g., `thoughtful-dialogue`) automatically when threads are created.
- `auth` (optional) — authentication configuration. Set to `null` for no auth, `"jwt"` for JWT bearer tokens, or a custom auth backend configuration.

### graph/react.py

A starter ReAct (Reasoning and Acting) agent. This is a reference implementation using Google's Gemini model. The example shows:

- How to define a simple state type with message history
- How to create a graph with a single agent node
- How to compile the graph (which enables checkpointing and real-time updates)
- How to prepare the graph as a FastAPI route (via `graph.invoke()` and `graph.stream()`)

You must keep an `app` variable defined that holds the compiled graph. Replace the graph logic with your own while preserving this export.

### .env

Stored environment variables for local development. The default is empty. Add API keys and connection strings here:

```bash
# Example
GOOGLE_API_KEY=your_key_here
REDIS_URL=redis://localhost:6379/0
```

The `agentflow.json` field `env` tells the server which `.env` file to load.

## Overwrite existing files

If you have already initialized a project and want to regenerate the starter files:

```bash
agentflow init --force
```

This overwrites `agentflow.json`, `graph/__init__.py`, and `graph/react.py`. Use `--force` carefully—it will replace existing code.

## Initialize a production project

The `--prod` flag scaffolds additional files for a professional project layout:

```bash
agentflow init --prod
```

This creates:

- `pyproject.toml` — Python package definition (allows `pip install -e .`)
- `.pre-commit-config.yaml` — Git hooks for code quality checks (linting, formatting)
- Standard project structure with `src/`, `tests/`, and `docs/` directories

Use `--prod` when you are setting up a project that will be deployed or shared with a team.

## Verify the initialization

After running `init`, verify the files were created:

```bash
ls -la
cat agentflow.json
cat graph/react.py
```

You should see valid Python and JSON files with no syntax errors.

## Test the starter agent

Before modifying the starter agent, test that it runs:

```bash
# Set a Gemini API key if you want to test the starter
export GOOGLE_API_KEY=your_key_here

# Start the server
agentflow api --host 127.0.0.1 --port 8000
```

In another terminal, test the agent:

```bash
curl -X POST http://127.0.0.1:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "config": {"thread_id": "test-1"}
  }'
```

Expected response: A JSON object with messages, including the agent's response.

If this fails, check:
- Is the server running? (`curl http://127.0.0.1:8000/ping` should return `{"success": true, "data": "pong"}`)
- Is `GOOGLE_API_KEY` set? (The starter example requires it)
- Are there errors in the server logs?

## Next steps

1. **Replace the agent** — Edit `graph/react.py` with your custom graph logic. See [concepts](../../concepts/state-graph.md) for how graphs work.
2. **Add tools** — Give your agent callable functions via `ToolNode`. See [add a tool](../../beginner/add-a-tool.md) guide.
3. **Add persistence** — Configure a checkpointer in `agentflow.json` so conversations persist across server restarts. See [configure agentflow.json](./configure-agentflow-json.md).
4. **Start the server** — Run `agentflow api` to expose your agent over HTTP.
5. **Test with the playground** — Use `agentflow play` to test interactively in a browser.

## Troubleshooting

**Error: "ModuleNotFoundError: No module named 'agentflow_cli'"**
- Install the CLI: `pip install 10xscale-agentflow-cli`

**Error: "No such file or directory: agentflow.json"**
- Make sure you run `agentflow init` from the project root, or use `--path` to specify the directory.

**Error: "Overwrite existing files?" but you did not pass `--force`**
- The CLI prompts interactively. Type `yes` or pass `--force` to skip the prompt.

**The generated `graph/react.py` has syntax errors**
- This is unusual. Try deleting the directory and re-running `agentflow init` from scratch.
