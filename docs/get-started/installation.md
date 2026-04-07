---
title: Installation
description: Install AgentFlow and prepare your first local project.
---

# Installation

:::note Draft
This page is a sprint-0 placeholder. Exact package install commands will be validated before the golden path is marked ready.
:::

AgentFlow is currently organized as a multi-package workspace:

| Package | Purpose |
| --- | --- |
| `agentflow` | Core Python library for agents, state, tools, checkpoints, and storage. |
| `agentflow-api` | API and CLI layer for exposing and operating AgentFlow apps. |
| `agentflow-client` | TypeScript client for calling AgentFlow APIs from application code. |
| `agentflow-playground` | Hosted playground opened by `agentflow play` for testing a running API. |

## Python environment

From the repository root:

```bash
source /Users/shudipto/Projects/agentflow/.venv/bin/activate
```

Then work inside the package you are changing:

```bash
cd /Users/shudipto/Projects/agentflow/agentflow
```

## First install target

For most backend examples, start with the Python library:

```bash
uv sync
```

If you are working on the API or CLI package:

```bash
cd /Users/shudipto/Projects/agentflow/agentflow-api
uv sync
```

## Environment variables

Set the model provider key required by your example:

```bash
export OPENAI_API_KEY="your-api-key"
```

Later docs will include provider-specific setup for OpenAI, Gemini, Claude, local models, and deployment environments.

## Next step

Build the [first agent](./first-agent.md).
