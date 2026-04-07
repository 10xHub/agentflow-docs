# A2A Integration (Agent-to-Agent)

Agentflow's A2A integration lets you expose any `CompiledGraph` as a standard [A2A Protocol](https://github.com/google/A2A) agent, and call remote A2A agents from within your graphs. This enables multi-agent systems where agents can be written in any framework that speaks A2A.

## What is A2A?

A2A (Agent-to-Agent) is Google's open protocol for agents to communicate with each other over HTTP. It standardizes:

- **Agent Cards** - Metadata describing an agent's capabilities
- **Message Format** - How agents exchange text and structured data
- **Task Lifecycle** - States like `submitted`, `working`, `completed`, `input_required`
- **Streaming** - Server-sent events for progressive responses

## Why Use A2A?

| Use Case | Description |
|----------|-------------|
| **Microservices Architecture** | Deploy agents as independent services that communicate via HTTP |
| **Language Interoperability** | Mix Python, TypeScript, or any A2A-compatible agents |
| **Team Isolation** | Different teams build and deploy their own agents |
| **Scaling** | Scale just the agents that need it |
| **Reusability** | Expose your graph for other applications to consume |

## Installation

A2A integration requires the `a2a-sdk` extra:

```bash
pip install 10xscale-agentflow[a2a_sdk]
```

## Quick Start

There are two ways to deploy an A2A server:

### Option 1: Using the Agentflow CLI (Recommended)

1. Install the CLI:
```bash
pip install 10xscale-agentflow[a2a_sdk]
pip install 10xscale-agentflow-cli
```

2. Create `agentflow.json`:
```json
{
  "agent": "graph:app",
  "a2a": {
    "name": "MyAgent",
    "description": "A helpful assistant",
    "version": "1.0.0"
  }
}
```

3. Start the server:
```bash
agentflow a2a --port 9999
```

See [CLI Deployment Guide](./cli.md) for complete details.

### Option 2: Programmatic (Python Code)

```python
from agentflow.a2a_integration import create_a2a_server, make_agent_card

# Your existing compiled graph
app = graph.compile()

# Create an agent card (metadata)
card = make_agent_card(
    name="MyAgent",
    description="A helpful assistant",
    url="http://localhost:9999",
)

# Start the server (blocking)
create_a2a_server(app, card, port=9999)
```

### Calling Remote A2A Agents

```python
from agentflow.a2a_integration import delegate_to_a2a_agent

# Send a message and get a response
response = await delegate_to_a2a_agent(
    "http://localhost:9999",
    "What's 2 + 2?",
)
print(response)  # "2 + 2 equals 4"
```

### Use a Remote Agent as a Graph Node

```python
from agentflow.a2a_integration import create_a2a_client_node

# Create a node that delegates to a remote agent
remote_node = create_a2a_client_node("http://currency-agent:9999")

# Add it to your graph
graph.add_node("currency", remote_node)
graph.add_edge("main", "currency")
```

## Architecture

```
┌─────────────────┐         HTTP/A2A           ┌─────────────────┐
│   Your Graph    │ ◄──────────────────────────► │  Remote Agent   │
│                 │                             │  (any framework)│
│ ┌─────────────┐ │                             │                 │
│ │ a2a_client  │ │  delegate_to_a2a_agent()   │                 │
│ │   node      │───────────────────────────────►│                 │
│ └─────────────┘ │                             │                 │
│                 │                             └─────────────────┘
└─────────────────┘

┌─────────────────┐         HTTP/A2A           ┌─────────────────┐
│   Your Graph    │ ◄──────────────────────────► │  External       │
│                 │                             │  Caller         │
│                 │   AgentFlowExecutor +      │  (any client)   │
│                 │   A2AStarletteApplication  │                 │
└─────────────────┘                             └─────────────────┘
```

## Key Components

### Server Side

| Component | Purpose |
|-----------|---------|
| `AgentFlowExecutor` | Bridges `CompiledGraph` to the A2A execution model |
| `make_agent_card()` | Creates metadata describing your agent |
| `build_a2a_app()` | Returns a Starlette ASGI app for composing with other routes |
| `create_a2a_server()` | One-call to start a uvicorn server |

### Client Side

| Component | Purpose |
|-----------|---------|
| `delegate_to_a2a_agent()` | Async one-shot: send text, get text back |
| `create_a2a_client_node()` | Factory for graph nodes that delegate to remote agents |

## Streaming vs Blocking

The executor supports two modes:

**Blocking (default):**
- Uses `CompiledGraph.ainvoke()`
- Returns a single response when complete

**Streaming:**
- Uses `CompiledGraph.astream()`
- Sends `TaskState.working` progress events
- Client sees incremental updates

```python
# Enable streaming
create_a2a_server(app, card, streaming=True)
```

## Task States

A2A tasks go through these states:

| State | Meaning |
|-------|---------|
| `submitted` | Task received by server |
| `working` | Agent is processing (streaming only) |
| `completed` | Success, response available |
| `failed` | Error occurred |
| `input_required` | Agent needs more information from user |

## Session Management

The A2A integration uses `context_id` to maintain conversation history:

- Server uses `context_id` as `thread_id` for its checkpointer
- Conversation history persists across multiple A2A tasks
- Pass the same `context_id` to continue a conversation

```python
# Client side
await delegate_to_a2a_agent(
    url="http://localhost:9999",
    text="Hello",
    context_id="session-123",  # Ties turns together
)
```

## Next Steps

- [CLI Deployment Guide](./cli.md) - Deploy servers using the Agentflow CLI
- [Server Guide](./server.md) - Detailed server configuration (programmatic)
- [Client Guide](./client.md) - Calling remote agents
- [Custom Executors](./executor.md) - Advanced task handling
- [A2A Tutorial](../../../Tutorial/a2a.md) - Step-by-step example
