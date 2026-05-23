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

You write the agent logic. One command later, you have a production HTTP server — REST, streaming, WebSockets, auth, rate limiting, checkpointing, observability, and a TypeScript client — all running.

That is the deal AgentFlow makes with you.

## Write an agent

Define a tool. Point a prebuilt agent at it. Compile.

```python
from agentflow.prebuilt import ReactAgent

def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny and 24°C."

app = ReactAgent(
    model="gemini-2.0-flash",
    provider="google",
    tools=[get_weather],
).compile()
```

That is the entire agent. Now tell AgentFlow where to find it:

```json title="agentflow.json"
{
  "agent": "graph.agent:app",
  "env": ".env"
}
```

## Deploy in one command

```bash
agentflow api
```

Your agent is now a production HTTP server on port 8000. Here is what that single command just gave you, without any additional configuration:

| What you get | How it works |
|---|---|
| **REST endpoint** | `POST /v1/graph/invoke` — synchronous request-response |
| **SSE streaming** | `POST /v1/graph/stream` — token-by-token output to any client |
| **WebSocket** | `WS /v1/graph/ws` — bidirectional, full-duplex for remote tool calls and live updates |
| **Thread management** | `/v1/threads/` — read and write conversation history across sessions |
| **Memory store** | `/v1/store/` — search and retrieve long-term memories per user or globally |
| **Interactive docs** | `http://localhost:8000/docs` — Swagger UI, live in the browser, try every endpoint now |
| **Checkpointing** | Graph state persisted after every step — Redis for active sessions, Postgres for permanent history |
| **Rate limiting** | Per-route and per-user limits out of the box, no code required |
| **Auth middleware** | JWT or bring your own `BaseAuth` subclass — one line in `agentflow.json` |
| **RBAC** | Role-based access control on routes and individual agent actions |
| **OpenTelemetry** | Traces, metrics, and logs on every request — wire to Grafana, Datadog, or any OTLP collector |
| **Sentry** | Error tracking and performance profiling via `SENTRY_DSN` |

None of this required code. You wrote an agent. AgentFlow wrapped it.

## Test it immediately

Open the interactive docs in your browser — `http://localhost:8000/docs` — and send your first message without writing a line of client code.

Or use the playground:

```bash
agentflow play
```

This opens a hosted chat UI connected to your running server. Send messages, inspect thread state, replay conversations, and iterate on your agent logic — before touching the TypeScript client.

Or hit it directly with curl:

```bash
curl -X POST "http://localhost:8000/v1/graph/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": [{"type": "text", "text": "Weather in London?"}]}],
    "config": {"thread_id": "test-001"}
  }'
```

## Call it from TypeScript

Install the client:

```bash
npm install @10xscale/agentflow-client
```

Invoke the agent:

```typescript
import { AgentFlowClient, Message } from "@10xscale/agentflow-client";

const client = new AgentFlowClient({ baseUrl: "http://localhost:8000" });

const result = await client.invoke(
  [Message.text_message("What is the weather in London?")],
  { config: { thread_id: "my-thread" } }
);

console.log(result.messages.at(-1)?.text());
```

Stream token by token:

```typescript
import { StreamEventType } from "@10xscale/agentflow-client";

for await (const chunk of client.stream([Message.text_message("Tell me more.")])) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
    process.stdout.write(chunk.message.text());
  }
}
```

## Containerize for any cloud

```bash
agentflow build
```

Generates a production Dockerfile — multi-stage build, non-root user, health check. Add `--docker-compose` for a complete `docker-compose.yml`. No DevOps work required.

## Build your way

### Start with a prebuilt agent

Six ready-made architectures cover the most common patterns. No graph wiring.

| Agent | Pattern |
|---|---|
| `ReactAgent` | Reason-Act loop — the standard tool-calling agent |
| `RAGAgent` | Retrieval-augmented generation with your vector store |
| `SupervisorTeamAgent` | A supervisor that routes tasks to specialist sub-agents |
| `SwarmAgent` | Peer agents that hand off to each other based on context |
| `PlanActReflectAgent` | Plan, execute, reflect, and revise until the goal is met |
| `StructuredOutputAgent` | Agent that guarantees a typed, validated response schema |

All six accept `model`, `provider`, and `tools`. All six compile to a graph you can serve immediately.

### Go deeper with StateGraph

When a prebuilt is too rigid — custom state, non-linear routing, mixing agents at different abstraction levels — build the graph yourself:

```python
from agentflow.core import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState
from agentflow.utils.constants import END

tool_node = ToolNode([get_weather])
agent = Agent(
    model="gemini-2.0-flash",
    provider="google",
    tool_node=tool_node,
)

def route(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and hasattr(last, "tools_calls") and last.tools_calls:
        return "TOOL"
    return END

graph = StateGraph(AgentState)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

Every prebuilt is built on this layer. Subclass `BaseAgent` to replace the LLM call, add custom validation, or wire in a different execution strategy. The graph is yours.

### MCP tools, parallel by default

AgentFlow's `ToolNode` integrates directly with the Model Context Protocol — connect any MCP server as a tool source, filter by tag, mix with local functions. When the LLM returns multiple tool calls, they execute concurrently via `asyncio.gather`. No configuration needed; results come back in the original call order.

## What you do not build

A production AI agent system normally requires:

- An HTTP server with REST, streaming, and WebSocket support
- Thread and session management with persistent state
- A checkpointing layer that survives restarts and scales across replicas
- Auth middleware and role-based access control
- Rate limiting per user and per route
- Distributed tracing and error tracking
- A typed client SDK for frontend teams
- A Dockerfile and container configuration
- A playground for iterating before client code exists

AgentFlow ships all of it. You write agent logic.

## Prerequisites

- Python 3.12 or newer
- An LLM provider API key — OpenAI (`OPENAI_API_KEY`) or Google Gemini (`GEMINI_API_KEY`)

The first example in [Your First Agent](./first-agent.md) does not require a real LLM call, so you can verify the framework is working before adding credentials.

## Golden path

| Step | Page | What you will have at the end |
|---|---|---|
| 1 | [Installation](./installation.md) | Python library, CLI, and a scaffolded project |
| 2 | [Your First Agent](./first-agent.md) | A running agent served as a production API |
| 3 | [Connect Client](./connect-client.md) | TypeScript code calling your agent with invoke and streaming |

Start with [Installation](./installation.md).
