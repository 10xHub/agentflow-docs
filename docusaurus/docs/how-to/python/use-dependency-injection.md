---
title: How to use dependency injection
sidebar_label: Dependency injection
description: Guide to using InjectQ for binding services and injecting them into node functions, tool functions, and agents via Inject[T] parameter defaults.
keywords:
  - agentflow dependency injection
  - injectq
  - inject services
  - python agent framework
  - agentflow
sidebar_position: 11
---

# How to use dependency injection

AgentFlow uses [InjectQ](https://github.com/10xHub/injectq) for dependency injection. Any function registered as a graph node or tool can declare services as parameters with `Inject[Type]` as the default value. The DI container resolves and injects those dependencies automatically at call time.

Built-in bindings (registered by the framework after `compile()`):

| Binding | Type |
|---|---|
| `CompiledGraph` | `CompiledGraph` |
| `StateGraph` | `StateGraph` |
| Checkpointer | `BaseCheckpointer` |
| Store | `BaseStore` |
| Media store | `BaseMediaStore` |
| Publisher | `BasePublisher` |
| Context manager | `BaseContextManager` |
| Callback manager | `CallbackManager` |
| ID generator | `BaseIDGenerator` |
| Background task manager | `BackgroundTaskManager` |
| `get_node` | factory that returns `self.nodes[name]` |
| `get_entry_point_node` | factory that returns the entry-point node |
| `generated_id_type` | the current ID type from the ID generator |
| `generated_id` | `str` — a freshly generated ID on each call |

These bindings are available automatically to node functions and tools. You can also register your own bindings alongside them.

---

## Step 1: Access the DI container

```python
from injectq import InjectQ

container = InjectQ.get_instance()
```

`InjectQ.get_instance()` returns the global singleton. `StateGraph` uses this same instance unless you pass a different one via `StateGraph(container=...)`.

---

## Step 2: Bind a service

### Bind an instance (singleton)

```python
from injectq import InjectQ

class DatabaseClient:
    def __init__(self, dsn: str):
        self.dsn = dsn

    def query(self, sql: str) -> list:
        # run SQL ...
        return []

container = InjectQ.get_instance()
container.bind_instance(DatabaseClient, DatabaseClient("postgresql://localhost/mydb"))
```

### Bind a key-value pair

```python
container["api_key"] = "sk-..."
container["max_results"] = 10
```

### Bind a factory

```python
import uuid

container.bind_factory("request_id", lambda: str(uuid.uuid4()))
```

---

## Step 3: Inject into a node function

Declare the injectable parameter with `Inject[Type]` as its default:

```python
from injectq import Inject
from agentflow.core.state import AgentState, Message
from agentflow.core.state.message_block import TextBlock

def query_database(
    state: AgentState,
    config: dict,
    db: DatabaseClient = Inject[DatabaseClient],  # injected automatically
) -> dict:
    results = db.query("SELECT * FROM users LIMIT 5")
    content = f"Found {len(results)} users."
    return {
        "messages": [Message.text_message(content, role="assistant")],
    }
```

The framework calls `query_database(state, config, db=<resolved_instance>)` at runtime. You never pass `db` manually.

---

## Step 4: Inject into a tool function

Injection works the same way in tool functions. The `tool_call_id`, `state`, and `config` parameters are automatically provided by the runtime; any additional parameters with `Inject[T]` defaults are resolved from the container.

```python
from injectq import Inject
from agentflow.core.state import AgentState, Message
from agentflow.core.state.message_block import ToolResultBlock

def search_products(
    query: str,
    limit: int = 5,
    # --- injected by the framework ---
    tool_call_id: str = "",
    state: AgentState = None,
    config: dict = None,
    db: DatabaseClient = Inject[DatabaseClient],
) -> Message:
    """Search for products in the catalogue."""
    results = db.query(f"SELECT * FROM products WHERE name LIKE '%{query}%' LIMIT {limit}")
    return Message.tool_message(
        content=[ToolResultBlock(call_id=tool_call_id, output=str(results))],
    )
```

The LLM only sees `query` and `limit` in the schema. `tool_call_id`, `state`, `config`, and `db` are invisible to the LLM and resolved internally.

---

## Step 5: Pass a custom container to StateGraph

When you need a scoped or non-global container (e.g. in tests), pass it explicitly:

```python
from injectq import InjectQ
from agentflow.core.graph import StateGraph

# Create an isolated container for this graph
container = InjectQ()
container.bind_instance(DatabaseClient, DatabaseClient("postgresql://test/testdb"))

graph = StateGraph(container=container)
# container is activated automatically when passed to StateGraph
```

---

## Step 6: Read values from the container inside a node

For computed values like a fresh generated ID, use `InjectQ.get_instance().try_get()`:

```python
from injectq import InjectQ

def my_node(state, config, **deps):
    container = InjectQ.get_instance()

    new_id = container.try_get("generated_id")       # returns None if not bound
    api_key = container.try_get("api_key", "fallback") # second arg = default
    # ...
    return {}
```

---

## Complete example

```python
from injectq import Inject, InjectQ
from agentflow.core.graph import StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.core.state.message_block import TextBlock, ToolResultBlock
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.utils.constants import END


class UserRepository:
    def get_user(self, user_id: str) -> dict:
        # Normally a DB call; hardcoded here for the example
        return {"id": user_id, "name": "Alice", "plan": "pro"}


# Register in the global container before building the graph
container = InjectQ.get_instance()
container.bind_instance(UserRepository, UserRepository())


# --- Tool with injection ---
def get_user_info(
    user_id: str,
    tool_call_id: str = "",
    repo: UserRepository = Inject[UserRepository],
) -> Message:
    """Get information about a user by their ID."""
    user = repo.get_user(user_id)
    return Message.tool_message(
        content=[ToolResultBlock(call_id=tool_call_id, output=str(user))],
    )


# --- Node function with injection ---
def log_request(
    state: AgentState,
    config: dict,
    repo: UserRepository = Inject[UserRepository],
) -> dict:
    user_id = config.get("user_id", "unknown")
    user = repo.get_user(user_id)
    print(f"Request from: {user['name']} ({user['plan']} plan)")
    return {}   # no state change, just a side effect


from agentflow.core.graph import Agent

tool_node = ToolNode([get_user_info])
agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
)

graph = StateGraph()
graph.add_node("log", log_request)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tools_calls", None):
        return "TOOL"
    return END

graph.add_edge("log", "MAIN")
graph.set_entry_point("log")
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())

result = app.invoke(
    {"messages": [Message.text_message("Get info for user ID user-42")]},
    config={"thread_id": "di-demo", "user_id": "user-42"},
)
print(result["messages"][-1].content)
```

---

## What you learned

- `InjectQ.get_instance()` returns the global singleton container used by all graphs.
- `container.bind_instance(Type, instance)` registers a singleton for injection.
- `container["key"] = value` registers a plain key-value pair.
- Declare `param: MyService = Inject[MyService]` in any node function or tool function to receive the service automatically.
- Tool functions also receive `tool_call_id`, `state`, and `config` from the runtime — declare them as plain parameters with no default when you need them.
- Pass `StateGraph(container=container)` for an isolated container in tests or scoped graphs.

## Next steps

- [Build a graph](build-a-graph.md) to see how DI fits into the full graph lifecycle.
- [Use the @tool decorator](use-tool-decorator.md) for tool metadata alongside injection.
