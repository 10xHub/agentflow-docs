---
title: Dependency Injection — AgentFlow Python AI Agent Framework
sidebar_label: Dependency Injection
description: Injectable parameters, injectq service containers, and how to wire custom services into AgentFlow nodes and tools.
keywords:
  - agentflow concepts
  - agent architecture
  - multi-agent orchestration
  - agentflow
  - python ai agent framework
  - dependency injection
sidebar_position: 11
---


# Dependency injection

AgentFlow uses a lightweight dependency injection system based on [`injectq`](https://github.com/10XScale-in/injectq). Both tool functions and pure async node functions can declare parameters that are automatically resolved and injected at runtime — without coupling your code to framework internals.

---

## Automatically injected parameters

The following parameters are injected by AgentFlow whenever they appear in a function signature — no registration needed:

| Parameter name | Type | Available in | Description |
|---|---|---|---|
| `state` | `AgentState` (or subclass) | tools + nodes | Full current graph state |
| `config` | `dict` | tools + nodes | Thread config: `thread_id`, `user_id`, `run_id`, etc. |
| `tool_call_id` | `str` | tools only | ID of the model's tool call request |

```python
from agentflow.core.state import AgentState

def get_weather(
    location: str,          # from the model's tool call arguments
    state: AgentState,      # injected — full current state
    tool_call_id: str,      # injected — tool call ID
    config: dict,           # injected — thread config
) -> str:
    """Return current weather for a location."""
    print(f"thread: {config.get('thread_id')}")
    print(f"history length: {len(state.context)}")
    return f"The weather in {location} is sunny."
```

The model only sees `location` in the tool schema. The other three are invisible to the LLM.

---

## Service injection with `Inject[T]`

For application-level services (database clients, custom checkpointers, callback managers) you can use `injectq`'s `Inject[T]` default syntax:

```python
from injectq import Inject, InjectQ
from agentflow.storage.checkpointer import InMemoryCheckpointer

checkpointer = InMemoryCheckpointer()

# Register the service in the shared container
container = InjectQ.get_instance()
container.bind_instance(InMemoryCheckpointer, checkpointer)

# Now declare Inject[T] as the default value
def get_weather(
    location: str,
    tool_call_id: str,
    state: AgentState,
    config: dict,
    checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],
) -> str:
    """Weather tool that also receives the checkpointer."""
    print("checkpointer:", checkpointer)
    return f"The weather in {location} is sunny."
```

The same pattern works in async node functions:

```python
from injectq import Inject, InjectQ
from agentflow.utils.callbacks import CallbackManager
from agentflow.storage.store.base_store import BaseStore

async def main_agent(
    state: AgentState,
    config: dict,
    callback: CallbackManager = Inject[CallbackManager],
    checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],
    store: BaseStore | None = Inject[BaseStore],
):
    # All three services are resolved from the container at call time
    ...
    return Message.text_message("Done.", role="assistant")
```

---

## Setting up the container

### Bind a singleton instance

```python
from injectq import InjectQ

class DatabaseClient:
    def query(self, sql: str) -> list: ...

db = DatabaseClient()

container = InjectQ.get_instance()
container.bind_instance(DatabaseClient, db)
```

### Bind by string key

```python
container["run_key"] = "abc-123"

# Retrieve later
inq = InjectQ.get_instance()
value = inq.get("run_key")         # raises KeyError if missing
fallback = inq.try_get("run_key2", "default-value")   # safe get
```

### Bind a factory

```python
container.bind_factory("get_node", lambda name: graph.nodes[name])
```

---

## Passing the container to StateGraph

Tell the graph which container to use by passing `container=` to `StateGraph`:

```python
from injectq import InjectQ
from agentflow.core.graph import StateGraph
from agentflow.storage.checkpointer import InMemoryCheckpointer

checkpointer = InMemoryCheckpointer()
container = InjectQ.get_instance()
container.bind_instance(InMemoryCheckpointer, checkpointer)

graph = StateGraph(container=container)
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=checkpointer)
```

Without `container=`, `StateGraph` uses the global `InjectQ` singleton.

---

## Full example

This is the pattern from `examples/react-injection/react_di.py`:

```python
from injectq import Inject, InjectQ
from agentflow.core.graph import StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer


class AnalyticsClient:
    def record(self, event: str): ...


# Set up container
checkpointer = InMemoryCheckpointer()
analytics = AnalyticsClient()

container = InjectQ.get_instance()
container.bind_instance(InMemoryCheckpointer, checkpointer)
container.bind_instance(AnalyticsClient, analytics)
container["session_id"] = "sess-001"


# Tool with injection
def search(
    query: str,
    state: AgentState,
    tool_call_id: str,
    config: dict,
    analytics: AnalyticsClient = Inject[AnalyticsClient],
) -> str:
    analytics.record(f"search:{query}")
    return f"Results for {query}"


# Node with injection
async def main_agent(
    state: AgentState,
    config: dict,
    checkpointer: InMemoryCheckpointer = Inject[InMemoryCheckpointer],
) -> Message:
    inq = InjectQ.get_instance()
    session_id = inq.try_get("session_id", "unknown")
    print("session:", session_id)
    ...
    return Message.text_message("Done.", role="assistant")


tool_node = ToolNode([search])

graph = StateGraph(container=container)
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=checkpointer)

result = app.invoke(
    {"messages": [Message.text_message("Search for AI trends")]},
    config={"thread_id": "t1", "recursion_limit": 10},
)
```

---

## Configuring via `agentflow.json`

If your container is defined in a separate module, register it in `agentflow.json` so the CLI server picks it up automatically:

```json
{
  "agent": "graph.react:app",
  "injectq": "graph.dependencies:container"
}
```

The server will import your container and use it for all dependency resolution.

---

## Related concepts

- [Agents and tools](./agents-and-tools.md)
- [StateGraph and nodes](./state-graph.md)
- [Architecture](./architecture.md)
- Injectable parameters are hidden from the model's tool schema.
- The `@tool` decorator adds metadata without changing injection behavior.
- For service injection in the API layer, configure `injectq` in `agentflow.json`.

## Related concepts

- [Agents and tools](./agents-and-tools.md)
- [StateGraph and nodes](./state-graph.md)
