---
title: Get Started — AgentFlow Python AI Agent Framework
sidebar_label: Get Started
description: The golden path from installation to a running AgentFlow app. Part of the AgentFlow get started guide for production-ready Python AI agents.
keywords:
  - agentflow get started
  - python ai agent setup
  - agentflow installation
  - agentflow
  - python ai agent framework
  - get started
slug: /get-started
---

# Get started

AgentFlow is a production-ready Python framework for building AI agents. It handles everything outside your agent logic — serving, threading, memory, streaming, checkpointing, observability, authentication, and deployment — so you can focus entirely on writing agent behavior.

You write the logic. AgentFlow handles the rest.

## Deploy in one command

Once your agent is defined, a single command wraps it in a production-grade HTTP server:

```bash
agentflow api
```

To containerize for any cloud environment:

```bash
agentflow docker
```

This generates a production Dockerfile — multi-stage build, non-root user, health check included. No DevOps configuration required.

## Two ways to build — start simple, go deeper when you need to

### Prebuilt agents

Drop-in agents for the most common patterns. No graph wiring required.

```python
from agentflow.prebuilt import ReactAgent

app = ReactAgent(
    model="gpt-4o",
    tools=[search, calculator],
).compile()
```

Available prebuilt agents: `ReactAgent`, `RAGAgent`, `RouterAgent`, `SupervisorTeam`, `Swarm`, `PlanActReflect`.

### Agent class and StateGraph

When you need custom state, routing, or multi-agent orchestration — use `Agent` and `StateGraph` directly.

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState

graph = StateGraph(AgentState)
graph.add_node("agent", Agent(model="gpt-4o", tools=[search]))
graph.add_node("tools", ToolNode([search]))
graph.add_conditional_edges("agent", route_tools)
graph.add_edge("tools", "agent")

app = graph.compile()
```

Every prebuilt agent is built on this layer. Subclass `BaseAgent` to swap in your own LLM call, validation logic, or execution strategy.

### First-class MCP support

Connect any MCP server as a tool source. AgentFlow's `ToolNode` integrates directly with the Model Context Protocol — list, filter by tag, and invoke MCP tools alongside your local tools with no extra wiring.

### Parallel tool calling by default

When an LLM returns multiple tool calls in a single response, AgentFlow executes them concurrently using `asyncio.gather`. Your tools run in parallel automatically — no configuration needed, results are returned in the original order.

## What the runtime provides

The infrastructure that would otherwise take weeks to build is already in place.

### Resilience

| Feature | What it does |
|---|---|
| **Injector** | Resolves dependencies — models, tools, services — at graph startup so nodes stay pure and testable |
| **Checkpointing** | Persists graph state after every step. Redis for in-flight session data; Postgres for permanent history. Pluggable — bring your own backend |
| **ID generation** | Deterministic, collision-safe thread and run IDs across distributed deployments |
| **Lifecycle & callbacks** | Hook into `on_start`, `on_end`, `on_error`, and `on_step` events across any node — for logging, tracing, or side effects |
| **Retry & fallback** | Per-node retry policies with exponential backoff and configurable fallback nodes |

### Observability and event streaming

| Publisher | Use case |
|---|---|
| **Kafka** | High-throughput event pipelines and audit logs |
| **RabbitMQ** | Task queues and async workflows |
| **Redis** | Lightweight pub/sub and live dashboards |
| **OpenTelemetry** | Distributed tracing across your entire stack |

### Long-term memory

Connect Postgres, Qdrant, or Mem0 to give agents persistent, retrievable memory across sessions. Memory is scoped per user, per thread, or globally — your choice.

### Skill loading

Agents can dynamically load and invoke named skills at runtime. Skills are versioned, discoverable, and composable — they let you extend agent behavior without redeploying.

## What the API server provides

`agentflow api` is a production HTTP server, not a development shortcut.

### Protocols

The server exposes three transport options for every agent — choose what fits your client:

| Protocol | Endpoint | Use case |
|---|---|---|
| **REST** | `POST /v1/graph/invoke` | Request-response, batch jobs |
| **SSE streaming** | `POST /v1/graph/stream` | Token-by-token output to web clients |
| **WebSocket** | `WS /v1/graph/ws` | Full-duplex, bidirectional — remote tool calls, live updates |

### Three API layers

The API is structured around the three layers of agent state, each independently accessible:

| Layer | Base path | What it controls |
|---|---|---|
| **Graph** | `/v1/graph/` | Run, stream, stop, and resume agent execution |
| **Checkpointer** | `/v1/threads/` | Read and write thread state and message history |
| **Memory (Store)** | `/v1/store/` | Store, search, update, and delete long-term memories |

### Observability and reliability

| Capability | Detail |
|---|---|
| **OpenTelemetry** | Traces, metrics, and logs exported from every request — wire to Grafana, Datadog, or any OTLP collector |
| **Sentry** | Error tracking and performance profiling with FastAPI integration. Configure via `SENTRY_DSN` |
| **Rate limiting** | Per-route, per-user, and global limits — no code changes required |
| **Authentication** | API key auth included. Plug in custom middleware for OAuth, JWT, or internal SSO |
| **Authorization** | Role-based access control on routes and agent actions |

### TypeScript client

The `@10xscale/agentflow-client` package provides a typed TypeScript client that covers all three API layers:

```typescript
import { AgentFlowClient } from "@10xscale/agentflow-client";

const client = new AgentFlowClient({ baseUrl: "http://localhost:8000" });

// Graph layer
await client.invoke({ input: "Hello" });
await client.stream({ input: "Hello" }, onChunk);
client.wsStream({ input: "Hello" }, handlers);        // WebSocket

// Checkpointer layer
await client.threadMessages({ threadId });
await client.updateThreadState({ threadId, state });

// Memory layer
await client.storeMemory({ content: "User prefers concise answers" });
await client.searchMemory({ query: "user preferences" });
```

### Coming soon — A2UI protocol

A2UI (Agent-to-UI) is a WebSocket-based protocol for pushing live agent events directly into UI components. It ships with a TypeScript client and React hooks (`useA2UIClient`, `useAgentStatus`) for real-time status, thinking steps, tool calls, and completions — no polling required.

## Scalability built in

AgentFlow is designed to run at scale without re-architecture:

- **Stateless API layer** — scale horizontally behind any load balancer
- **Redis checkpointer** — shared ephemeral state across replicas
- **Postgres checkpointer** — durable state that survives restarts
- **Event publishers** — decouple agent outputs from downstream consumers
- **OTEL instrumentation** — full visibility into latency, errors, and throughput at every layer

## Prerequisites

- Python 3.12 or newer
- An LLM provider API key (OpenAI or Google) — only needed when making actual LLM calls

The first local example does not call an LLM, so you can verify the framework before adding credentials.

## Golden path

| Step | Page | Outcome |
|---|---|---|
| 1 | [Installation](./installation.md) | Install the Python library and CLI |
| 2 | [First Python Agent](./first-python-agent.md) | Run a graph locally |
| 3 | [Expose with API](./expose-with-api.md) | Serve the graph with `agentflow api` |
| 4 | [Connect Client](./connect-client.md) | Call the API from TypeScript |
| 5 | [Open Playground](./open-playground.md) | Chat with the agent in the hosted playground |

Start with [Installation](./installation.md).
