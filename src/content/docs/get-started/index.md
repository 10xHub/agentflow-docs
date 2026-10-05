---
title: Get Started
seoTitle: Get started with 10xGraph in Python
description: 10xGraph turns a Python agent into a production server and keeps it correct when a run crashes mid-tool. Start here for install, first agent and client.
section: Get started
order: 10
label: Get Started
updated: "2026-10-06"
---

10xGraph is an open-source Python framework for production multi-agent AI. You write the agent. 10xGraph generates the production server around it (REST, SSE streaming and WebSocket endpoints, auth, owner-only threads, scoped access control, rate limits, Docker and Kubernetes files) and keeps runs correct under failure: a crashed run does not execute a finished tool twice.

## What you write

A graph of agents and tools in plain Python. Use the prebuilt `ReactAgent` for the standard tool-calling loop, or build your own `StateGraph`.

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.storage.checkpointer import InMemoryCheckpointer


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

Point the server at it:

```json title="agentflow.json"
{
  "agent": "agent:app",
  "env": ".env"
}
```

```bash
10xgraph api
```

## What 10xGraph generates

| Piece | What you get |
|---|---|
| API server | REST, SSE streaming, WebSocket and realtime audio endpoints on port 8000, with Swagger UI at `/docs` |
| Security | JWT or custom auth, owner-only threads, role scopes on every endpoint, rate limits |
| Reliability | [Replay-safe tools](/docs/concepts/replay-safe-tools), versioned state writes, node and tool timeouts |
| Deployment | `10xgraph build --docker-compose --k8s` writes a Dockerfile, `docker-compose.yml` and `k8s.yaml` |
| Client | An official typed TypeScript client, and a playground via `10xgraph play` |

Core library features such as graph orchestration, MCP tools, streaming and checkpointing are in the box too. They are the foundation, not the reason to pick the framework.

## Try it without client code

Open `http://localhost:8000/docs` for the interactive Swagger UI, run `10xgraph play` for the playground, or call the invoke endpoint with curl:

```bash
curl -X POST "http://localhost:8000/v1/graph/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": [{"type": "text", "text": "Where is order 1042?"}]}],
    "config": {"thread_id": "test-001"}
  }'
```

## Build your way

Six prebuilt agents cover common patterns, and all of them compile to a graph you can serve.

| Agent | Pattern |
|---|---|
| `ReactAgent` | Reason-Act loop, the standard tool-calling agent |
| `RAGAgent` | Retrieval-augmented generation with your vector store |
| `SupervisorTeamAgent` | A supervisor that routes tasks to specialist sub-agents |
| `SwarmAgent` | Peer agents that hand off to each other based on context |
| `PlanActReflectAgent` | Plan, execute, reflect, and revise until the goal is met |
| `StructuredOutputAgent` | Agent that returns a typed, validated response schema |

When a prebuilt is too rigid (custom state, non-linear routing), build the graph yourself with `StateGraph`. See [StateGraph](/docs/concepts/state-graph).

10xGraph was published as Agentflow until 2026. Python imports are unchanged: you still write `from agentflow...`.

## Prerequisites

- Python 3.12 or newer
- A key for one LLM provider: `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) or `ANTHROPIC_API_KEY`

## Golden path

| Step | Page | What you will have at the end |
|---|---|---|
| 1 | [Installation](/docs/get-started/installation) | Python packages, optional extras and the TypeScript client |
| 2 | [Quickstart](/docs/get-started/first-agent) | A running agent served over HTTP and called from curl and TypeScript |
| 3 | [Project structure](/docs/get-started/project-structure) | Every file the production template generates |
