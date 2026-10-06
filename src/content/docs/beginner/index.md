---
title: Beginner Path
seoTitle: "10xGraph beginner path: first agent to API"
description: "A seven-step beginner path for 10xGraph: build a Python agent with a tool and memory, serve it over an HTTP API, and call it from TypeScript."
section: Beginner path
order: 50
label: Beginner Path
updated: "2026-10-06"
---

The beginner path is a seven-step tutorial that takes you from an empty folder to a Python agent with a tool and saved conversation state, served over an HTTP API and called from TypeScript. It is for developers who can write Python and have not used 10xGraph before. Each page teaches one concept with a complete example, so you can stop after any step and still have something that runs.

## Start here

Read [Mental model](/docs/beginner/mental-model) first. It explains the four ideas everything else builds on: graph, state, message and agent. Then follow [Your first agent](/docs/beginner/your-first-agent) to compile and run a one-node workflow, and [Add a tool](/docs/beginner/add-a-tool) to let the agent call a function you write.

Steps four and five are where a demo becomes a service. [Add memory](/docs/beginner/add-memory) saves conversation state with a checkpointer, and [Run with the API](/docs/beginner/run-with-api) exposes the agent over HTTP using the server that ships with 10xGraph, so you do not write routes, streaming or thread endpoints yourself. The checkpointer is also what later lets a crashed run resume without repeating finished tool calls, covered in [Replay-safe tools](/docs/concepts/replay-safe-tools).

Finish with [Test with the playground](/docs/beginner/test-with-playground) and [Call from TypeScript](/docs/beginner/call-from-typescript). If you prefer a single guide, [Get started](/docs/get-started) is shorter and skips the explanations.

By the end you will have an agent that:
- Calls tools safely
- Persists conversation state with a checkpointer
- Runs behind an HTTP API
- Can be tested in the hosted playground
- Can be called from a TypeScript application

<aside class="callout callout-tip" role="note"><p class="callout-title">Prerequisites</p>

Install 10xGraph before starting:
```bash
pip install 10xgraph
pip install 10xgraph-api
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
