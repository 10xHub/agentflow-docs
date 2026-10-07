---
title: Installation
seoTitle: Install 10xGraph (Python and TypeScript)
description: Install 10xGraph and the API server with pip on Python 3.12 or newer, add provider extras and a checkpointer, verify the CLI, and install the TypeScript client.
section: Get started
order: 20
updated: 2026-10-08
faq:
  - q: Which Python version does 10xGraph need?
    a: Python 3.12 or newer. Both the core package and the API package declare requires-python >=3.12, so pip refuses to install them on an older interpreter.
  - q: Do I need to install a provider extra?
    a: Yes, for the provider you call. The base install does not include the OpenAI, Google GenAI or Anthropic SDKs. Install the matching extra, for example 10xgraph[openai], and set that provider's API key as an environment variable.
  - q: Which extra do I need to run in production?
    a: Add pg_checkpoint, which brings in asyncpg and redis for PgCheckpointer. A durable checkpointer is also what enables replay-safe tools across a process restart.
  - q: Is the Python import name different from the package name?
    a: No change yet. You install 10xgraph but keep importing from tenxgraph, for example from tenxgraph.prebuilt.agent import ReactAgent.
---

10xGraph needs Python 3.12 or newer. Install the framework and the API server with `pip install 10xgraph 10xgraph-api`, add an extra for your model provider, then check the install with `10xgraph version`. The TypeScript client is a separate npm package.

## What are the requirements?

| Requirement | Version |
|---|---|
| Python | 3.12 or newer |
| Node.js (TypeScript client only) | 18 or newer |
| An LLM provider key | OpenAI, Google Gemini or Anthropic |
| PostgreSQL and Redis (production only) | Needed for `PgCheckpointer` |

## How do I install the packages?

Use a virtual environment so the CLI and the libraries come from the same interpreter.

With pip:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install 10xgraph 10xgraph-api
```

With uv:

```bash
uv venv --python 3.12
source .venv/bin/activate
uv pip install 10xgraph 10xgraph-api
```

`10xgraph` is the core framework. `10xgraph-api` adds the API server and the command-line tool.

Upgrading from `10xscale-agentflow-cli` or `10xscale-agentflow`? Uninstall both first (`pip uninstall 10xscale-agentflow-cli 10xscale-agentflow`), because each ships an `agentflow` module that clashes with the new packages.

## Which extras should I add?

The base install has no model provider SDK. Add the extras you use, either in the same command or later.

```bash
pip install "10xgraph[openai]" 10xgraph-api
```

| Extra | Adds | Use it for |
|---|---|---|
| `openai` | OpenAI SDK | OpenAI models and OpenAI-compatible endpoints |
| `google-genai` | Google GenAI SDK | Gemini models |
| `anthropic` | Anthropic SDK | Claude models through the direct API |
| `pg_checkpoint` | asyncpg, redis | `PgCheckpointer`: Redis hot cache and PostgreSQL durable history |
| `mcp` | fastmcp, mcp | Tools served by MCP servers |

Combine extras with commas: `pip install "10xgraph[openai,pg_checkpoint,mcp]"`. Other extras exist for Anthropic on Vertex AI and Bedrock (`anthropic-vertex`, `anthropic-bedrock`), SQLite checkpointing (`sqlite_checkpoint`), Qdrant and Mem0 memory stores, event publishers (`kafka`, `rabbitmq`, `redis`) and observability (`otel`, `logfire`, `langsmith`). The `all` extra installs most of them at once and is meant for development and CI.

Note: 10xGraph is pre-1.0. Pin the versions you deploy and read the changelog before upgrading.

## How do I verify the install?

```bash
10xgraph version
python -c "import tenxgraph; print(tenxgraph.__file__)"
```

The first command prints the CLI version. The second confirms the library imports from your virtual environment. If the command is not found, activate the environment again and see the [installation troubleshooting](/docs/troubleshooting/installation) page.

## How do I set provider API keys?

Providers read their keys from environment variables. Export them in your shell, or put them in a `.env` file that your `10xgraph.json` points at with `"env": ".env"`. Never commit that file.

| Provider | Variable |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |

```bash
export OPENAI_API_KEY="your-key"
```

## How do I install the TypeScript client?

```bash
npm install 10xgraph-client
```

The client talks to a running `10xgraph api` server. See [Quickstart](/docs/get-started/first-agent).

## Scaffold a production project

```bash
10xgraph init --yes --template production --auth jwt --rate-limit redis
```

The production template creates your graph, a prompt-injection validator, evals, tests and an `10xgraph.json` config with JWT auth and owner-only threads turned on. Use `--auth custom` instead to also get an `auth/` module with a `BaseAuth` subclass to fill in. For a minimal start, skip this step and follow the [Quickstart](/docs/get-started/first-agent).

## Serve it

```bash
10xgraph api
```

The server listens on `http://localhost:8000` and exposes:

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/graph/invoke` | Run the graph and return the result |
| POST | `/v1/graph/stream` | Stream results over SSE |
| WS | `/v1/graph/ws` | Stream over WebSocket |
| WS | `/v1/graph/live` | Realtime audio |

## Something went wrong?

- [Installation troubleshooting](/docs/troubleshooting/installation): pip failures, command not found, imports failing, ignored environment variables.
- [API server troubleshooting](/docs/troubleshooting/api-server): startup and runtime issues.
- [Error codes](/docs/troubleshooting/error-codes): what each structured error means.

## Next step

Build your first agent in the [Quickstart](/docs/get-started/first-agent).
