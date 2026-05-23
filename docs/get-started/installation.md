---
title: Installation — AgentFlow Python AI Agent Framework
sidebar_label: Installation
description: Install the AgentFlow library, CLI, and TypeScript client. Part of the AgentFlow get started guide for production-ready Python AI agents.
keywords:
  - agentflow get started
  - python ai agent setup
  - agentflow installation
  - agentflow
  - python ai agent framework
  - installation
---

# Installation

## Install the packages

Create a virtual environment and install the core library, CLI, and at least one model provider:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install 10xscale-agentflow 10xscale-agentflow-cli
```

**You must install at least one model provider extra.** The core package does not bundle provider SDKs — pick the one you use:

```bash
# OpenAI (GPT-4o, o1, etc.)
pip install "10xscale-agentflow[openai]"

# Google Gemini
pip install "10xscale-agentflow[google-genai]"

# Both
pip install "10xscale-agentflow[openai,google-genai]"
```

Other available extras: `pg_checkpoint`, `mcp`, `redis`, `kafka`, `rabbitmq`, `qdrant`, `mem0`, `otel`, `images`.

Verify the CLI is ready:

```bash
agentflow version
```

## Set your model provider key

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GEMINI_API_KEY="..."
```

## Scaffold your project

Once installed, run:

```bash
agentflow init
```

This asks you to choose between two project templates:

### Quick start

A minimal working agent — get something running in under a minute.

```
my-agent/
├── .env.example          # Model provider keys
├── agentflow.json        # Server and agent config
└── graph/
    ├── __init__.py
    └── agent.py          # ReactAgent with your tools
```

### Production project _(recommended)_

A full project structure ready for team development, deployment, testing, and evaluation. This is the right starting point for anything beyond a prototype.

```
my-agent/
├── .env.example                        # Environment variables
├── .pre-commit-config.yaml             # Pre-commit hooks
├── .python-version                     # Pinned Python version
├── agentflow.json                      # Server and agent config
├── pyproject.toml                      # Package and dependency config
├── auth/
│   └── agent_auth.py                   # Custom auth middleware
├── graph/
│   ├── agent.py                        # Main agent entry point
│   ├── state.py                        # Custom agent state
│   ├── thread_name_generator.py        # Thread naming logic
│   ├── nodes/
│   │   ├── main_node.py                # Primary agent node
│   │   └── tool_node.py                # Tool execution node
│   ├── tools/
│   │   └── weather_tool.py             # Example tool
│   ├── utils/
│   │   └── tool_decision.py            # Routing logic
│   └── validators/
│       ├── lifecyle.py                 # Lifecycle hooks
│       ├── manager.py                  # Validator manager
│       └── validators.py              # Input/output validators
├── evals/
│   ├── user_simulator_eval.py          # Simulated user evaluation
│   └── weather_agents_eval.py          # Agent eval example
└── tests/
    ├── conftest.py                     # Shared test fixtures
    ├── test_agent_eval.py              # Agent-level tests
    ├── test_catalog_tools.py           # Tool tests
    └── test_graph_nodes.py             # Node-level unit tests
```

Everything you need is already wired up — auth, validators, lifecycle hooks, evaluations, and tests. You extend what you need and delete what you don't.

## Install the TypeScript client

If you are calling AgentFlow from a TypeScript or Node.js application:

```bash
npm install @10xscale/agentflow-client
```

The client covers all three API layers — graph execution, thread state, and long-term memory. See [Connect Client](./connect-client.md) for usage.

## Play with your agent

Once `agentflow init` is done, start the interactive playground:

```bash
agentflow play
```

This launches a hosted UI where you can chat with your agent, inspect state, replay threads, and iterate on your logic — before writing a single line of client code.

## Next step

[First Python Agent](./first-python-agent.md) — run your scaffolded agent locally and understand how the graph executes.
