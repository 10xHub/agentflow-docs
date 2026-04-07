---
title: Dependency Injection
description: How AgentFlow uses injectable parameters to pass context to nodes and tools without coupling business logic to framework code.
---

# Dependency injection

AgentFlow uses a lightweight dependency injection pattern so you can write tool functions and node functions that receive context (state, config, services) without importing framework internals.

## Injectable parameters in tools

When `ToolNode` executes a tool call, it inspects the function signature and automatically injects recognized parameters. Your tool declares what it needs; AgentFlow provides it.

```python
from agentflow.core.state import AgentState

def search_database(
    query: str,                          # from the model's tool call
    state: AgentState | None = None,      # injected: current graph state
    tool_call_id: str | None = None,     # injected: ID of this tool call
) -> str:
    """Search the database for relevant records."""
    user_id = state.user_id if state else "unknown"
    return f"Results for {query} (user: {user_id})"
```

The model only sees `query` in the tool schema. `state` and `tool_call_id` are invisible to it.

## The `@tool` decorator and metadata

Use `@tool` to attach metadata to a function. The metadata does not change the injection behavior — it enriches the schema the model receives:

```python
from agentflow.utils import tool

@tool(
    name="search_database",
    description="Search internal records by natural language query",
    tags=["database", "search"],
    provider="internal",
)
def search_database(query: str, state: AgentState | None = None) -> str:
    """Search the database."""
    ...
```

## injectq: service injection

The API server uses `injectq` for service-level injection, which is how `GraphService` and `CheckpointerService` are injected into FastAPI endpoints. This is an internal detail — if you are writing graph code, you do not interact with `injectq` directly.

If you need to provide custom services to your graph nodes, configure them via `agentflow.json`:

```json
{
  "agent": "graph.react:app",
  "injectq": "graph.dependencies:container"
}
```

The `container` should be an `injectq` container that registers your services. See the `agentflow.json` configuration reference for details.

## Injecting into nodes

Regular node functions receive only `state`. There is no injection system for node functions beyond what the graph provides. If a node needs a service, resolve it at startup and close over it:

```python
from myapp.db import DatabaseClient

db = DatabaseClient()  # resolved at startup

def search_node(state: AgentState) -> Message:
    results = db.search(state.context[-1].text())
    return Message.text_message(str(results), role="assistant")
```

This pattern keeps the node function simple and the dependency explicit.

## What you learned

- `state` and `tool_call_id` are injected into tool functions automatically.
- Injectable parameters are hidden from the model's tool schema.
- The `@tool` decorator adds metadata without changing injection behavior.
- For service injection in the API layer, configure `injectq` in `agentflow.json`.

## Related concepts

- [Agents and tools](./agents-and-tools.md)
- [StateGraph and nodes](./state-graph.md)
