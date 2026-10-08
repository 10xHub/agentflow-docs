---
title: Get Started
seoTitle: Get started with 10xGraph in Python
description: "10xGraph is a production-grade Python framework for multi-agent AI systems. Install the library, build an agent, deploy the API server, and call it from TypeScript."
section: "Get started"
order: 20
label: Get Started
updated: "2026-10-08"
---

10xGraph is an open-source, production-grade Python framework for building, orchestrating and deploying multi-agent LLM systems. You write a Python agent graph, and 10xGraph handles everything else: generating a REST API with WebSocket and realtime audio endpoints, enforcing thread ownership and role-based access control, managing state durably across crashes, and building production-ready containers for immediate deployment. The framework keeps execution correct under failure: if a tool execution completes but the service crashes before the completion is recorded, the tool is never executed twice on replay.

## What you get

10xGraph consists of three parts that work together: a Python library for building agents, an API server that turns agents into services, and a TypeScript client for integrating those services into applications.

### The Python library

The core library (`10xgraph`) provides the orchestration engine for multi-agent workflows. You write agents and tools in Python using a graph-based model where nodes represent computation (agents that call LLMs, or custom functions), edges represent flow control, and state flows through the graph as execution happens.

Start with the prebuilt `ReactAgent` for the standard agent loop that reasons about which tools to use, then calls them, then reasons about the result. Alternatively, build custom graphs with `StateGraph` when you need non-linear routing, custom state types, or multi-agent handoffs. The library handles tool parallelization by default, manages memory through a 3-layer system (working state, durable checkpoints, long-term vector stores), supports the Model Context Protocol (MCP) for dynamic tool loading, and integrates with OpenAI, Google GenAI, and Anthropic without requiring adapter code.

Example: a support agent that looks up orders and processes refunds, never executing a refund twice even if the service crashes mid-operation.

```python
from tenxgraph.prebuilt.agent import ReactAgent
from tenxgraph.storage.checkpointer import InMemoryCheckpointer


def lookup_order(order_id: str) -> dict:
    """Look up an order by id and return its status and total."""
    return {"order_id": order_id, "status": "delivered", "total": 59.0}


def refund_order(order_id: str, amount: float) -> str:
    """Refund an order. This moves money, so it must run exactly once."""
    return f"Refunded {amount:.2f} for order {order_id}"


app = ReactAgent(
    model="google/gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a support agent for an online shop."}],
    tools=[lookup_order, refund_order],
).compile(checkpointer=InMemoryCheckpointer())
```

### The API server and CLI

The API server (`10xgraph-api`) turns your compiled agent graph into a production service with zero additional code. Point a configuration file at your agent, and the server generates REST and WebSocket endpoints, enforces access control, rate-limits requests, manages user threads, and provides a memory store for long-term facts. The CLI scaffolds new projects, runs the server locally, and generates Docker and Kubernetes manifests for deployment.

The configuration is minimal. Create a `10xgraph.json` file pointing at your agent:

```json title="10xgraph.json"
{
  "agent": "agent:app",
  "env": ".env"
}
```

Then start the API server:

```bash
10xgraph api
```

The server listens on `http://127.0.0.1:8000` with a Swagger UI at `/docs`. All requests go through three layers of security by default: the authentication layer (JWT or custom), the authorization layer (per-thread ownership and role-based scopes), and the rate limiter. The `/v1/graph/invoke` endpoint runs the agent synchronously; `/v1/graph/stream` streams the response token-by-token over NDJSON; `/v1/graph/ws` provides a WebSocket interface for real-time bidirectional communication. The `/v1/threads` API manages agent memory: list threads, fetch their execution history, and delete old ones.

You can test the server immediately with curl:

```bash
curl -X POST "http://localhost:8000/v1/graph/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": [{"type": "text", "text": "Where is order 1042?"}]}],
    "config": {"thread_id": "test-001"}
  }'
```

Or open the interactive playground:

```bash
10xgraph play
```

### The TypeScript client

The TypeScript client (`@10xgraph/client`) provides a typed, streaming interface for calling the API from JavaScript or TypeScript. It handles auth tokens, reconnection, WebSocket negotiation, and streaming response parsing so you can focus on the UI. The client exports request/response types and event types, integrates with React for streaming updates, and provides helpers for managing threads and file uploads.

```typescript
import { AgentFlowClient } from "@10xgraph/client";

const client = new AgentFlowClient({
  baseURL: "http://localhost:8000",
  token: "your-jwt-token"
});

// Invoke an agent
const response = await client.invoke({
  messages: [{ role: "user", content: [{ type: "text", text: "Where is order 1042?" }] }],
  config: { thread_id: "test-001" }
});

// Or stream the response
const stream = await client.stream({
  messages: [{ role: "user", content: [{ type: "text", text: "Refund order 1042 for $50" }] }],
  config: { thread_id: "test-001" }
});

for await (const event of stream) {
  console.log(event.type, event.data);
}
```

## What's included

The framework comes with production-ready features out of the box, no configuration needed unless you want to customize them:

| Feature | What you get |
|---|---|
| API server | REST endpoints (`/v1/graph/invoke`, `/v1/graph/stream`), WebSocket (`/v1/graph/ws`), realtime audio, Swagger UI, and a memory store API |
| Security | JWT or custom authentication, owner-only thread access, role-based access control on every endpoint, rate limiting (memory, Redis, or custom backend) |
| Reliability | [Replay-safe tools](/docs/concepts/replay-safe-tools) ensure no double execution, versioned state writes prevent race conditions, configurable node and tool timeouts |
| State and memory | Working state in memory, durable checkpoints in SQLite or Postgres+Redis, long-term facts in Qdrant or Mem0 vector stores |
| Prebuilt agents | Six agents for common patterns: ReactAgent (tool-calling loop), RAGAgent (retrieval), SupervisorTeamAgent (task routing), SwarmAgent (peer handoff), PlanActReflectAgent (multi-step reasoning), StructuredOutputAgent (typed output) |
| Deployment | `10xgraph build` generates a Dockerfile, docker-compose.yml, and Kubernetes manifest; `10xgraph init` scaffolds a production-ready project structure |
| Observability | Logs, traces (OTEL, Logfire, LangSmith), metrics, Sentry error tracking, and a callback system for custom monitoring |
| Tools | A prebuilt tool library covering web (fetch, search), file operations, memory, and handoff, plus support for the Model Context Protocol (MCP) for dynamic tools |

## Prerequisites

To get started, you need:

- Python 3.12 or newer
- An API key for one LLM provider: `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), or `ANTHROPIC_API_KEY`
- Node 18+ and npm (optional, for the TypeScript client)

## Reading order

Follow this path to go from zero to a deployed agent:

| Step | Duration | What you'll learn |
|---|---|---|
| [Installation](/docs/get-started/installation) | 5 min | Install the Python library, API server, and TypeScript client; set up API keys |
| [Quickstart: First agent](/docs/get-started/first-agent) | 10 min | Build a working agent with two tools, serve it over HTTP, and call it from curl and TypeScript |
| [Tutorial: Mental model](/docs/get-started/tutorial/mental-model) | 10 min | Understand the core concepts: messages, state, nodes, edges, graphs, agents, and threads |
| [Tutorial: Build a graph](/docs/get-started/tutorial/build-a-graph) | 15 min | Build a graph by hand, add tools, and understand when to use ReactAgent vs custom graphs |
| [Tutorial: Threads and memory](/docs/get-started/tutorial/threads-and-memory) | 10 min | Run agents with persistent memory across invocations using checkpointers |
| [Tutorial: Serve and inspect](/docs/get-started/tutorial/serve-and-inspect) | 10 min | Serve your graph with the API server, use the Swagger UI and playground, and read thread state |
| [Tutorial: Call from your app](/docs/get-started/tutorial/call-from-your-app) | 10 min | Build a front-end with the TypeScript client, handle streaming, and manage sessions |
| [Project structure](/docs/get-started/project-structure) | 5 min | See what the production template generates and where each piece lives |

After the quickstart, you can jump to whichever tutorial step interests you. The tutorial is designed to be followed in order, building on concepts from previous steps, and covers the same agent throughout so you see how pieces connect.

The next major section, [Concepts](/docs/concepts), explains how everything works under the hood. [Guides](/docs/guides) covers task-oriented recipes (how do I add memory? How do I use MCP? How do I deploy to Kubernetes?), and [API reference](/docs/reference) documents every class, function, and route.

## Rename note

10xGraph was published under the name "Agentflow" until 2026. The Python library now imports from `tenxgraph` (e.g., `from tenxgraph.core.graph import StateGraph`), the PyPI package is `10xgraph`, and the command is `10xgraph`. The old import path `from agentflow import StateGraph` still works as a deprecated alias until version 2.0. The old package name `10xscale-agentflow` is no longer updated; install `10xgraph` instead.
