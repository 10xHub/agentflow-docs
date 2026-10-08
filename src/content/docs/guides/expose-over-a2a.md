---
title: "Expose over A2A"
description: "Serve a graph over the Agent-to-Agent (A2A) protocol or call remote A2A agents from within a graph using the official a2a-sdk."
order: 310
group: "Multi-agent and control flow"
section: "Build agents"
updated: "2026-10-08"
---

The Agent-to-Agent (A2A) protocol is a standard for agent-to-agent communication. With 10xGraph, you can expose any compiled graph as an A2A-compliant HTTP service and call remote A2A agents from within your graphs. This enables multi-agent workflows where agents can delegate work to specialized remote agents or participate in agent orchestration networks.

## Serve a graph over A2A

Exposing a 10xGraph graph over A2A turns it into an HTTP service that other agents (A2A-compliant or otherwise) can invoke. The A2A protocol handles transport, session management, and task lifecycle; 10xGraph handles the agent logic.

### Prerequisites

Install the A2A SDK extra:

```bash
pip install "10xgraph[a2a_sdk]"
```

This installs `a2a-sdk>=0.2.7`, which 10xGraph uses for the HTTP protocol implementation. The main requirement is the official `a2a-sdk` package; 10xGraph provides the glue code that plugs your graph into it.

### Step 1: Build and compile a graph

Create your graph as you normally would. For example, a currency conversion agent:

```python
# graph.py
from tenxgraph.core.graph import StateGraph, ToolNode
from tenxgraph.core.state import AgentState
from tenxgraph.storage.checkpointer import InMemoryCheckpointer
from tenxgraph.utils.constants import END
import httpx

async def get_exchange_rate(
    currency_from: str,
    currency_to: str,
    amount: float = 1.0,
) -> dict:
    """Get exchange rate between two currencies using the Frankfurter API."""
    url = f"https://api.frankfurter.app/latest"
    params = {"from": currency_from, "to": currency_to, "amount": amount}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()

tool_node = ToolNode([get_exchange_rate])

async def llm_node(state: AgentState):
    from tenxgraph.core.graph import Agent
    
    agent = Agent(model="gemini/gemini-2.5-flash")
    return await agent.ainvoke({
        "messages": state.context,
        "tools": [get_exchange_rate],
    })

graph = StateGraph()
graph.add_node("llm", llm_node)
graph.add_node("tools", tool_node)
graph.add_conditional_edges(
    "llm",
    lambda state: "tools" if state.context[-1].tool_calls else END,
    {"tools": "tools", END: END},
)
graph.add_edge("tools", "llm")
graph.set_entry_point("llm")

app = graph.compile(checkpointer=InMemoryCheckpointer[AgentState]())
```

### Step 2: Configure the A2A endpoint in 10xgraph.json

Add an `"a2a"` section to describe how to expose your graph:

```json
{
  "agent": "graph:app",
  "env": ".env",
  "a2a": {
    "name": "CurrencyAgent",
    "description": "Converts between currencies using live exchange rates.",
    "version": "1.0.0",
    "streaming": false,
    "skills": [
      {
        "id": "currency_conversion",
        "name": "Currency Conversion",
        "description": "Convert between any two currencies.",
        "tags": ["currency", "finance"]
      }
    ]
  }
}
```

**Configuration keys:**
- `name` (string): Human-readable agent name.
- `description` (string): Short description of what the agent does.
- `version` (string): Semantic version (e.g., `"1.0.0"`).
- `streaming` (bool): If `true`, use `astream` instead of `ainvoke` and emit progress updates. Default is `false`.
- `executor` (string, optional): Path to a custom executor class (e.g., `"executor:CustomExecutor"`). If omitted, uses the built-in `AgentFlowExecutor`.
- `skills` (array, optional): List of skills the agent advertises. Each has `id`, `name`, `description`, and optional `tags`.

### Step 3: Create and run the A2A server

The A2A server is started via the `10xgraph api` command with A2A support, or programmatically in your own code:

```python
# run_a2a_server.py
from graph import app
from tenxgraph.runtime.protocols.a2a import (
    AgentFlowExecutor,
    create_a2a_server,
    make_agent_card,
)

# Create an agent card describing the service
agent_card = make_agent_card(
    name="CurrencyAgent",
    description="Converts between currencies using live exchange rates.",
    url="http://localhost:9999",
    streaming=False,
    version="1.0.0",
)

# Start the A2A server
if __name__ == "__main__":
    create_a2a_server(app, agent_card, host="127.0.0.1", port=9999)
```

Run it:

```bash
python run_a2a_server.py
```

The server starts on `http://127.0.0.1:9999` and is ready to accept A2A requests.

### Step 4: Call the server

From any A2A-compliant client, send a message:

```bash
curl -X POST http://localhost:9999/agent/message \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "message": {
        "role": "user",
        "message_id": "msg-1",
        "parts": [{"text": "Convert 100 USD to EUR"}]
      }
    }
  }'
```

The response includes the agent's reply as a message or task artifact. A2A handles streaming, task tracking, and lifecycle.

## Call a remote A2A agent from a graph

You can also invoke a remote A2A agent from within your own graph, either as a standalone tool or as a dedicated node.

### Low-level: delegate_to_a2a_agent

The simplest method is to send text to the remote agent and get text back:

```python
from tenxgraph.runtime.protocols.a2a import delegate_to_a2a_agent

async def example():
    response = await delegate_to_a2a_agent(
        url="http://localhost:9999",
        text="How much is 50 GBP in JPY?",
        context_id="session-123",  # optional: ties messages together
        timeout=30.0,
    )
    print(response)
```

**Arguments:**
- `url`: Base URL of the remote A2A agent.
- `text`: User message (plain text).
- `context_id` (optional): Session ID to maintain conversation context on the remote side.
- `timeout`: HTTP request timeout in seconds (default 30).

**Returns:** The text content of the agent's response.

**Raises:** `RuntimeError` if the agent returns an error or no text.

### High-level: create_a2a_client_node

Create a graph node that delegates to a remote A2A agent:

```python
from tenxgraph.core.graph import StateGraph
from tenxgraph.runtime.protocols.a2a import create_a2a_client_node

# Create a node that calls a remote agent
remote_node = create_a2a_client_node(
    url="http://localhost:9999",
    timeout=30.0,
    response_role="assistant",
)

# Add it to your graph
graph = StateGraph()
graph.add_node("ask_currency_agent", remote_node)
graph.add_edge("some_node", "ask_currency_agent")
graph.add_edge("ask_currency_agent", END)
```

The node automatically extracts the last user message from the state, sends it to the remote agent, and appends the response as an assistant message. The `context_id` is set to the thread ID so conversation history persists.

## Customize the executor

For special behavior (e.g., detecting when the agent needs more input), subclass `AgentFlowExecutor`:

```python
# executor.py
from tenxgraph.runtime.protocols.a2a import AgentFlowExecutor
from a2a.server.agent_execution.context import RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.server.tasks.task_updater import TaskUpdater
from a2a.types import TaskState, TextPart

class CustomExecutor(AgentFlowExecutor):
    """Emits INPUT_REQUIRED when the agent asks a question."""
    
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        updater = TaskUpdater(
            event_queue=event_queue,
            task_id=context.task_id or "",
            context_id=context.context_id or "",
        )
        await updater.submit()
        await updater.start_work()
        
        try:
            user_text = context.get_user_input() if context.message else ""
            from tenxgraph.core.state import Message as AFMessage
            messages = [AFMessage.text_message(user_text, role="user")]
            
            result = await self.graph.ainvoke(
                {"messages": messages},
                config={"thread_id": context.context_id or context.task_id or ""},
            )
            response_text = self._extract_response_text(result)
            
            # Custom logic: check if agent is asking for input
            if response_text.endswith("?") or "please" in response_text.lower():
                msg = updater.new_agent_message(parts=[TextPart(text=response_text)])
                await updater.update_status(TaskState.input_required, message=msg)
            else:
                await updater.add_artifact([TextPart(text=response_text)])
                await updater.complete()
        
        except Exception as exc:
            error_msg = updater.new_agent_message(parts=[TextPart(text=f"Error: {exc}")])
            await updater.failed(message=error_msg)
```

Reference it in `10xgraph.json`:

```json
{
  "agent": "graph:app",
  "a2a": {
    "name": "CustomAgent",
    "executor": "executor:CustomExecutor"
  }
}
```

## Session and context management

A2A uses `context_id` to track sessions. 10xGraph maps `context_id` to `thread_id` so that conversation history, checkpoints, and memory persist across multiple messages in the same session.

When you serve a graph:
- Each A2A request carries a `context_id` (session identifier).
- `AgentFlowExecutor` uses it as the thread ID for the checkpointer.
- Messages and state are saved and loaded per thread, enabling multi-turn conversations.

When you call a remote agent:
- Pass the same `context_id` across multiple calls to keep the conversation stateful.
- Omit `context_id` for one-shot calls.

## Streaming responses

Set `streaming: true` in the A2A config to emit progress updates as the graph runs:

```json
{
  "a2a": {
    "streaming": true
  }
}
```

With streaming enabled:
- `AgentFlowExecutor` uses `astream` instead of `ainvoke`.
- Each message event sends a `TaskState.working` status update.
- The client observes progress in real time.
- The final response is emitted as an artifact when the graph completes.

## Related pages

- [Guides: Build a graph](/docs/guides/build-a-graph) — Fundamentals of graph construction.
- [Guides: Handoff between agents](/docs/guides/handoff-between-agents) — Multi-agent patterns and delegation.
- [Concepts: Remote tools](/docs/concepts/remote-tools) — Client-side tool execution and remote tool integration.
- [Reference: A2A SDK](https://github.com/anthropic-ai/a2a-sdk) — Official A2A protocol specification and SDK documentation.
