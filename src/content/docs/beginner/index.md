---
title: Beginner Path
description: Learn 10xGraph one concept at a time, from a single Python agent to a production-ready app with tools, memory, an API, and a TypeScript client.
section: Beginner path
order: 50
label: Beginner Path
updated: "2026-07-21"
---

This path builds a working agent step by step. Each page teaches one concept, shows a complete code example, and tells you what to try next.

By the end you will have an agent that:
- Calls tools safely
- Persists conversation state with a checkpointer
- Runs behind an HTTP API
- Can be tested in the hosted playground
- Can be called from a TypeScript application

<aside class="callout callout-tip" role="note"><p class="callout-title">Prerequisites</p>

Install 10xGraph before starting:
```bash
pip install 10xscale-agentflow
pip install 10xscale-agentflow-cli
```

</aside>

## Learning track

| Step | Page | What you build |
| --- | --- | --- |
| 1 | [Mental model](/docs/beginner/mental-model) | Understand graph, state, message, and agent boundaries |
| 2 | [Your first agent](/docs/beginner/your-first-agent) | Compile and run a single-node workflow |
| 3 | [Add a tool](/docs/beginner/add-a-tool) | Give the agent a callable function |
| 4 | [Add memory](/docs/beginner/add-memory) | Persist conversation state across calls |
| 5 | [Run with the API](/docs/beginner/run-with-api) | Expose the agent over HTTP |
| 6 | [Test with the playground](/docs/beginner/test-with-playground) | Inspect requests with `agentflow play` |
| 7 | [Call from TypeScript](/docs/beginner/call-from-typescript) | Connect a frontend or Node.js client |

## How each page is structured

Every page in this path includes:
- A brief explanation of the concept
- A complete, runnable code example
- Expected output
- A "What you learned" section
- One clear next step

Start with the [Mental model](/docs/beginner/mental-model) page.
