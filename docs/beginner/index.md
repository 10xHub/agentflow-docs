---
title: Beginner Path
description: Learn AgentFlow one concept at a time, from a single Python agent to a production-ready app with tools, memory, an API, and a TypeScript client.
slug: /beginner
---

# Beginner path

This path builds a working agent step by step. Each page teaches one concept, shows a complete code example, and tells you what to try next.

By the end you will have an agent that:
- Calls tools safely
- Persists conversation state with a checkpointer
- Runs behind an HTTP API
- Can be tested in the hosted playground
- Can be called from a TypeScript application

:::tip Prerequisites
Install AgentFlow before starting:
```bash
pip install 10xscale-agentflow
pip install 10xscale-agentflow-cli
```
:::

## Learning track

| Step | Page | What you build |
| --- | --- | --- |
| 1 | [Mental model](./mental-model.md) | Understand graph, state, message, and agent boundaries |
| 2 | [Your first agent](./your-first-agent.md) | Compile and run a single-node workflow |
| 3 | [Add a tool](./add-a-tool.md) | Give the agent a callable function |
| 4 | [Add memory](./add-memory.md) | Persist conversation state across calls |
| 5 | [Run with the API](./run-with-api.md) | Expose the agent over HTTP |
| 6 | [Test with the playground](./test-with-playground.md) | Inspect requests with `agentflow play` |
| 7 | [Call from TypeScript](./call-from-typescript.md) | Connect a frontend or Node.js client |

## How each page is structured

Every page in this path includes:
- A brief explanation of the concept
- A complete, runnable code example
- Expected output
- A "What you learned" section
- One clear next step

Start with the [Mental model](./mental-model.md) page.
