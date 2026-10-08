---
title: Installation
seoTitle: Install 10xGraph (Python and TypeScript)
description: Install 10xGraph and the API server with pip on Python 3.12 or newer, add provider extras and a checkpointer, verify the CLI, and install the TypeScript client.
section: "Get started"
order: 30
updated: 2026-10-08
faq:
  - q: "Which Python version does 10xGraph need?"
    a: "Python 3.12 or newer. Both the core package and the API package declare requires-python >=3.12, so pip refuses to install them on an older interpreter."
  - q: "Do I need to install a provider extra?"
    a: "Yes, for the provider you use. The base 10xgraph install does not include the OpenAI, Google GenAI, or Anthropic SDKs; install the matching extra (e.g., pip install \"10xgraph[openai]\") and set that provider's API key in an environment variable."
  - q: "Which extra do I need to run in production?"
    a: "Add pg_checkpoint, which brings in asyncpg and redis for PgCheckpointer. A durable checkpointer is required for production, enables replay-safe tools across process restarts, and lets you resume interrupted runs."
  - q: "Is the Python import name different from the package name?"
    a: "Yes. Install 10xgraph from PyPI, but import from tenxgraph (e.g., from tenxgraph.prebuilt.agent import ReactAgent). The agentflow import alias still works until 2.0 but triggers a deprecation warning."
---

10xGraph is a production-grade framework for building multi-agent AI systems. It requires Python 3.12 or newer and works on macOS, Linux, and Windows. This page covers installing the Python core, the API server, the TypeScript client, and verifying your setup.

## What are the requirements?

Start with Python 3.12 or newer and a package manager like pip or uv. You will also need API keys from the LLM provider you plan to use, and PostgreSQL and Redis if you deploy to production.

| Requirement | What it is | When you need it |
|---|---|---|
| Python | 3.12 or newer | Always, for the core framework and API server |
| Node.js | 18 or newer | Only if building a TypeScript or JavaScript client application |
| LLM API key | OpenAI, Google Gemini, or Anthropic | Always, to call a model from your agent |
| PostgreSQL and Redis | For durable state | Production only; development uses in-memory state |
| Virtual environment | venv or uv | Recommended; keeps dependencies isolated |

## How do I install the Python packages?

Install `10xgraph` (the core framework) and `10xgraph-api` (the API server and CLI) in a Python virtual environment. A virtual environment ensures the `10xgraph` command and the libraries come from the same Python interpreter, avoiding version conflicts.

Create the environment and activate it. With `pip`:

```bash
python3.12 -m venv .venv
source .venv/bin/activate  # on Windows: .venv\Scripts\activate
pip install 10xgraph 10xgraph-api
```

Or with `uv` (faster):

```bash
uv venv --python 3.12
source .venv/bin/activate  # on Windows: .venv\Scripts\activate
uv pip install 10xgraph 10xgraph-api
```

`10xgraph` is the core orchestration engine. `10xgraph-api` adds a FastAPI server, a command-line tool, and a development playground.

### Upgrading from the old names?

If you previously installed `10xscale-agentflow` or `10xscale-agentflow-cli`, uninstall them first because they provide conflicting `agentflow` modules:

```bash
pip uninstall 10xscale-agentflow-cli 10xscale-agentflow
pip install 10xgraph 10xgraph-api
```

The old names are not compatible with the new ones and will cause import errors.

## Which provider extra should I install?

10xGraph does not include LLM provider SDKs by default. You must install the extra for the provider you use. Choose one based on which model you want to call:

| Provider | Extra | Models |
|---|---|---|
| OpenAI | `openai` | GPT-4o, GPT-4 Turbo, o1 |
| Google GenAI | `google-genai` | Gemini 2.0, Gemini 1.5 Flash, Gemini 1.5 Pro |
| Anthropic | `anthropic` | Claude 3.7 Sonnet, Claude 3 Opus, Claude 3 Haiku |
| Anthropic via Vertex AI | `anthropic-vertex` | Same, called through Google Cloud |
| Anthropic via Bedrock | `anthropic-bedrock` | Same, called through AWS |

Install the extra in the same pip command or add it later:

```bash
pip install "10xgraph[openai]" 10xgraph-api
```

Combine extras with commas if you need more than one (e.g., for MCP tools, production state, and multimodal):

```bash
pip install "10xgraph[openai,pg_checkpoint,mcp]" 10xgraph-api
```

### Other optional extras

Beyond model providers, optional extras unlock advanced features:

| Extra | Includes | Use it for |
|---|---|---|
| `pg_checkpoint` | asyncpg, redis (production durable state) | Production deployments; enables replay-safe tools |
| `mcp` | fastmcp, mcp | Tools served by Model Context Protocol servers |
| `sqlite_checkpoint` | SQLite checkpointer | Single-machine persistence without PostgreSQL or Redis |
| `qdrant` | Qdrant vector store | Long-term semantic memory and retrieval |
| `mem0` | Mem0 SDK | Managed vector memory store |
| `kafka` | kafka-python | Stream execution events to Apache Kafka |
| `rabbitmq` | pika | Stream execution events to RabbitMQ |
| `redis` | redis | Streaming and pub/sub without the checkpointer |
| `otel` | opentelemetry-api, -sdk, instrumentations | Traces, metrics, and logs to observability backends |
| `logfire` | logfire | Send traces to Pydantic's Logfire |
| `langsmith` | langsmith | Send traces to LangSmith |

The `all` extra installs most features and is useful for local development and CI, but pin specific versions before shipping to production.

Version pinning matters: 10xGraph is pre-1.0, so minor version updates may include breaking changes. Example of a safe lock:

```bash
pip install "10xgraph==0.10.1" "10xgraph-api==0.7.0"
```

Read the `CHANGELOG.md` before upgrading.

## How do I verify the installation?

Run both commands to confirm everything is set up:

```bash
10xgraph version
python -c "import tenxgraph; print(tenxgraph.__file__)"
```

The first prints the CLI version (for `10xgraph-api`) and the installed core framework version. The second confirms the Python library (`tenxgraph`) is importable from your virtual environment and shows where it is installed.

Expected output:

```bash
$ 10xgraph version
CLI Version: 0.7.0
Core Version: 0.10.1

$ python -c "import tenxgraph; print(tenxgraph.__file__)"
/path/to/.venv/lib/python3.12/site-packages/tenxgraph/__init__.py
```

If the `10xgraph` command is not found, make sure your virtual environment is activated. If the import fails, check that you ran `pip install` inside the activated environment. See [installation troubleshooting](/docs/troubleshooting/installation) for help.

## How do I set LLM provider API keys?

Each provider reads its API key from an environment variable. You can export the variable in your shell session, or store it in a `.env` file that 10xGraph reads automatically.

Export the key in your shell:

```bash
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or create a `.env` file in your project and point to it in `10xgraph.json`:

```json
{
  "env": ".env",
  "agent": "graph:app"
}
```

Then define the variables in `.env` (do not commit this file):

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

The variables 10xGraph recognizes are:

| Provider | Environment Variable |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` (first choice) or `GOOGLE_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |

Never commit `.env` or API keys to version control. Use `.gitignore` to exclude it:

```bash
# .gitignore
.env
.env.local
```

## How do I install the TypeScript client?

If you are building a JavaScript or TypeScript application that calls the 10xGraph API server, install the client SDK:

```bash
npm install @10xgraph/client
```

The TypeScript client is currently published under the name `@10xscale/agentflow-client` and will be renamed to `@10xgraph/client` in an upcoming release. Check [the client documentation](/docs/client) for usage examples and the full API.

The client talks to a running `10xgraph api` server over HTTP and WebSocket. You call the server from your app using the client, passing a thread ID to maintain conversation history across multiple runs. See [Quickstart](/docs/get-started/first-agent) for a complete example.

## What if something goes wrong?

If installation fails or the commands do not work, check these pages:

- [Installation troubleshooting](/docs/troubleshooting/installation): pip errors, command not found, import errors, and environment variable issues
- [Provider troubleshooting](/docs/troubleshooting/providers): model not found, auth failures, rate limit errors for your chosen provider
- [API server troubleshooting](/docs/troubleshooting/api-server): server startup errors and runtime issues
- [Error code reference](/docs/reference/error-codes): what each structured error code means

## Next step

Once installation is complete and verified, build your first agent in the [Quickstart](/docs/get-started/first-agent).
