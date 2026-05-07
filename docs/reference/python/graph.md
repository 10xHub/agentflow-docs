---
title: Graph — AgentFlow Python AI Agent Framework
sidebar_label: Graph
description: StateGraph, CompiledGraph, START, END — the core execution engine of the agentflow library. Part of the AgentFlow agentflow python reference guide for.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - graph
sidebar_position: 1
---


# Graph

## When to use this

Use `StateGraph` and `CompiledGraph` when you are building or running a workflow. Every agentflow application starts with a graph.

## Import paths

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.utils import START, END
```

---

## Constants

| Name | Value | Description |
|---|---|---|
| `START` | `"__start__"` | Sentinel node name. Use as the source of the first edge to set the entry point. |
| `END` | `"__end__"` | Sentinel node name. Add an edge to `END` from any terminal node. |

---

## `StateGraph[StateT]`

The builder class. Construct a workflow by adding nodes and edges, then call `compile()` to get an executable `CompiledGraph`.

### Constructor

```python
from agentflow.core.graph import StateGraph
from agentflow.core.state import AgentState

graph = StateGraph()                          # default AgentState
graph = StateGraph(MyCustomState())           # custom state instance
graph = StateGraph(MyCustomState)             # custom state class (instantiated automatically)
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `state` | `StateT \| type[StateT] \| None` | `None` | Initial state instance or class. Defaults to `AgentState()`. |
| `context_manager` | `BaseContextManager \| None` | `None` | Cross-node state operation handler. |
| `publisher` | `BasePublisher \| None` | `None` | Event publisher for monitoring. |
| `id_generator` | `BaseIDGenerator` | `DefaultIDGenerator()` | ID generator for messages/threads. |
| `container` | `InjectQ \| None` | `None` | Dependency injection container. Uses global singleton if `None`. |

---

### Methods

#### `add_node`

```python
graph.add_node(func)                          # name inferred from function.__name__
graph.add_node("my_node", func)              # explicit name
graph.add_node("agent", agent_instance)      # Agent or ToolNode instance
```

Returns `StateGraph` for chaining.

| Calling pattern | When to use |
|---|---|
| `add_node(func)` | Simple function nodes where the function name is a good node name. |
| `add_node("name", func)` | When you need a custom node name. |
| `add_node("name", agent)` | When attaching an `Agent` or `ToolNode` instance. |

---

#### `add_edge`

```python
graph.add_edge(START, "entry")   # also sets the entry point
graph.add_edge("entry", END)
graph.add_edge("node_a", "node_b")
```

Static, unconditional edge. The graph always follows this route.

---

#### `add_conditional_edges`

```python
def route(state: AgentState, config: dict) -> str:
    if state.data.get("is_done"):
        return END
    return "process"

graph.add_conditional_edges("check", route)

# With a path map
graph.add_conditional_edges(
    "classify",
    lambda state, config: state.data.get("category", "default"),
    path_map={
        "urgent": "urgent_handler",
        "normal": "normal_handler",
        "default": "fallback",
    },
)
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `from_node` | `str` | Source node name. |
| `condition` | `Callable` | Function receiving `(state, config)` and returning a routing key. |
| `path_map` | `dict[str, str] \| None` | Maps condition return values to node names. If `None`, the condition must return a node name directly. |

---

#### `set_entry_point`

```python
graph.set_entry_point("my_node")
# equivalent to graph.add_edge(START, "my_node")
```

---

#### `override_node`

```python
graph.override_node("MAIN", test_agent)
```

Replaces an existing node with a new function, Agent, or ToolNode. The node must already exist. Useful for swapping production nodes with test doubles before compilation.

---

#### `compile`

```python
app: CompiledGraph = graph.compile()

app = graph.compile(
    checkpointer=my_checkpointer,
    store=my_store,
    media_store=my_media_store,
    interrupt_before=["review_node"],
    interrupt_after=["tool_node"],
    shutdown_timeout=30.0,
)
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `checkpointer` | `BaseCheckpointer \| None` | `None` | State persistence backend. Defaults to `InMemoryCheckpointer`. |
| `store` | `BaseStore \| None` | `None` | Long-term memory store. |
| `media_store` | `BaseMediaStore \| None` | `None` | Media/file storage backend. |
| `interrupt_before` | `list[str] \| None` | `None` | Node names to pause execution **before**. |
| `interrupt_after` | `list[str] \| None` | `None` | Node names to pause execution **after**. |
| `callback_manager` | `CallbackManager` | `CallbackManager()` | Hooks for evaluation collectors and monitoring. |
| `shutdown_timeout` | `float` | `30.0` | Seconds to wait for background tasks during graceful shutdown. |

**Raises:** `GraphError` if no entry point is set or interrupt nodes are invalid.

---

## `CompiledGraph[StateT]`

The executable graph produced by `StateGraph.compile()`. Do not instantiate directly.

### `invoke`

```python
result = app.invoke(
    {"messages": [Message.text_message("Hello")]},
    config={"thread_id": "session-1", "user_id": "alice"},
    response_granularity=ResponseGranularity.LOW,
)
```

Synchronous execution. Blocks until the graph finishes.

**Uses `asyncio.run()` internally — do not call from an async context.** Use `ainvoke()` instead.

---

### `ainvoke`

```python
result = await app.ainvoke(
    {"messages": [Message.text_message("Hello")]},
    config={"thread_id": "session-1"},
    response_granularity=ResponseGranularity.FULL,
)
```

Asynchronous execution. Auto-detects whether to start fresh or resume from an interrupted state.

**Parameters (both `invoke` and `ainvoke`):**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `input_data` | `dict[str, Any]` | required | Input dict. Must contain `"messages"` for new runs. |
| `config` | `dict[str, Any] \| None` | `None` | Execution config. Keys: `thread_id`, `user_id`, `run_id`, `recursion_limit`. |
| `response_granularity` | `ResponseGranularity` | `LOW` | Controls how much is included in the response. See table below. |

**`ResponseGranularity` values:**

| Value | Import | What is returned |
|---|---|---|
| `LOW` | `from agentflow.utils import ResponseGranularity` | `messages` only |
| `PARTIAL` | — | `messages`, `context`, `summary` |
| `FULL` | — | `messages`, `context`, `summary`, full `state` object |

**Returns:** `dict` with keys depending on granularity.

---

### `stream` / `astream`

```python
# Sync
for chunk in app.stream({"messages": [msg]}, config={"thread_id": "t1"}):
    if chunk.event == "message":
        print(chunk.message.content)

# Async
async for chunk in app.astream({"messages": [msg]}, config={"thread_id": "t1"}):
    if chunk.event == "message":
        print(chunk.message.content)
```

Yields `StreamChunk` objects as the graph executes.

**`StreamChunk` fields:**

| Field | Type | Description |
|---|---|---|
| `event` | `StreamEvent` | One of `MESSAGE`, `STATE`, `UPDATES`, `ERROR`. |
| `message` | `Message \| None` | Populated for `MESSAGE` events. |
| `state` | `AgentState \| None` | Populated for `STATE` events. |
| `data` | `dict \| None` | Populated for `UPDATES` and `ERROR` events. |
| `thread_id` | `str \| None` | Thread ID for this execution. |
| `run_id` | `str \| None` | Run ID for this execution. |
| `timestamp` | `float` | UNIX timestamp of chunk creation. |

---

### `stop` / `astop`

```python
# Async — call from within an async route handler
resp = await app.astop(config={"thread_id": "session-1"})
# {"ok": True, "running": True}

# Sync
resp = app.stop(config={"thread_id": "session-1"})
```

Sets a stop flag on the running execution. The graph checks this flag between node transitions and halts cleanly.

**Returns:** `dict` with `ok`, `running`, and optional `reason` keys.

---

### `override_node` (on CompiledGraph)

```python
compiled.override_node("MAIN", test_agent)
```

Same semantics as `StateGraph.override_node()` but on an already-compiled graph. Useful when testing a compiled production graph without rebuilding it.

---

### `aclose`

```python
await app.aclose()
```

Cleanup method for graceful shutdown. Stops background tasks, closes publisher connections, and releases any held resources. Always call this when shutting down a long-lived application.

---

## Config dictionary keys

| Key | Type | Auto-generated if missing | Description |
|---|---|---|---|
| `thread_id` | `str \| int` | Yes (UUID or from ID generator) | Identifies the conversation thread for checkpointing. |
| `user_id` | `str` | Yes (`"test-user-id"`) | User identifier. Override in production. |
| `run_id` | `str \| int` | Yes | Unique run identifier. |
| `recursion_limit` | `int` | No (framework default: 25) | Maximum node transitions before `GraphRecursionError`. |
| `timestamp` | `str` | Yes | ISO 8601 timestamp of the run. |

---

## Node function signature

Node functions receive the current state and config as their first two positional arguments. Additional keyword arguments are resolved from the dependency injection container:

```python
from agentflow.core.state import AgentState
from agentflow.storage.store import BaseStore

def my_node(state: AgentState, config: dict, store: BaseStore) -> list:
    # Return a list of Message objects to append to state.context
    return [Message.text_message("response", role="assistant")]
```

Alternatively, functions can return an updated state dict:

```python
def my_node(state: AgentState, config: dict) -> dict:
    return {"context_summary": "Updated summary"}
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `GraphError GRAPH_002` | `compile()` called with no entry point. | Call `set_entry_point()` or `add_edge(START, "node")`. |
| `GraphError GRAPH_004` | `interrupt_before` or `interrupt_after` contains a node name that does not exist. | Check node names against `graph.nodes.keys()`. |
| `GraphRecursionError` | Execution exceeded `recursion_limit`. | Increase `recursion_limit` in config or fix a cycle in the graph. |
| `RuntimeError` in async context | `invoke()` called inside an async function. | Use `ainvoke()` instead. |
