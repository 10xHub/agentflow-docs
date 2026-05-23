---
title: How to build a graph
sidebar_label: Build a graph
description: Step-by-step guide to constructing, compiling, and executing a StateGraph with Agent and ToolNode nodes.
keywords:
  - agentflow state graph
  - build agent graph
  - python agent framework
  - StateGraph
  - compile graph
sidebar_position: 1
---

# How to build a graph

`StateGraph` is the core orchestration primitive in AgentFlow. You construct a workflow by adding nodes (functions, `Agent` instances, or `ToolNode` instances), connecting them with edges, and compiling to get a runnable `CompiledGraph`.

## Prerequisites

```bash
pip install 10xscale-agentflow
```

Set your provider API key:

```bash
export OPENAI_API_KEY=sk-...      # for OpenAI
export GOOGLE_API_KEY=...         # for Google
```

---

## Step 1: Import the essentials

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import START, END
```

---

## Step 2: Define tools

Tools are plain Python functions. Type-annotate parameters so the LLM receives an accurate schema.

```python
def get_weather(city: str) -> str:
    """Return current weather for a city."""
    return f"Weather in {city}: 22°C, partly cloudy."

def calculate(expression: str) -> str:
    """Evaluate a safe math expression."""
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as e:
        return f"Error: {e}"
```

---

## Step 3: Create a ToolNode

Group tools in a `ToolNode`. The node registers every function by its `__name__`.

```python
tool_node = ToolNode([get_weather, calculate])
```

---

## Step 4: Create an Agent

`Agent` wraps the LLM call as a graph node.

```python
agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node=tool_node,
)
```

---

## Step 5: Build and wire the graph

```python
graph = StateGraph()

graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

# Route: if agent produced tool calls, go to TOOL, else END
def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tools_calls", None):
        return "TOOL"
    return END

graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")   # loop back after tool execution
graph.set_entry_point("MAIN")    # also adds START → MAIN edge
```

### Graph methods

| Method | Signature | Purpose |
|---|---|---|
| `add_node` | `(name_or_func, func=None)` | Register a node. Pass a function (name inferred) or an explicit name + callable/Agent/ToolNode. |
| `add_edge` | `(from_node, to_node)` | Static route between nodes. `add_edge(START, "X")` sets the entry point. |
| `add_conditional_edges` | `(from_node, condition, path_map=None)` | Dynamic routing. `condition(state)` returns a key; `path_map` maps keys to node names. Without `path_map`, condition must return the node name directly. |
| `set_entry_point` | `(node_name)` | Shorthand for `add_edge(START, node_name)`. |
| `override_node` | `(name, func)` | Replace an existing node (useful in tests). |
| `compile` | `(checkpointer, store, interrupt_before, interrupt_after, ...)` | Returns a `CompiledGraph`. |

---

## Step 6: Compile

```python
app = graph.compile()
```

Without a `checkpointer` argument, compilation defaults to `InMemoryCheckpointer`. For persistent state see [how-to/python/set-up-checkpointing](set-up-checkpointing.md).

---

## Step 7: Invoke

### Synchronous

```python
result = app.invoke(
    {"messages": [Message.text_message("What is the weather in Paris?")]},
    config={"thread_id": "session-1", "user_id": "user-42"},
)

for msg in result["messages"]:
    print(msg.role, msg.content)
```

### Asynchronous

```python
import asyncio

async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("Calculate 123 * 456")]},
        config={"thread_id": "session-2"},
    )
    for msg in result["messages"]:
        print(msg.role, msg.content)

asyncio.run(main())
```

### Config keys

| Key | Default | Notes |
|---|---|---|
| `thread_id` | auto (UUID) | Identifies the conversation thread for the checkpointer. |
| `user_id` | `"test-user-id"` | Passed to tools and publisher events. |
| `run_id` | auto (UUID) | Unique identifier for this specific execution run. |
| `recursion_limit` | 25 | Maximum node-execution steps before `GraphRecursionError`. |
| `is_stream` | `False` | Set internally by `astream()`; do not set manually. |
| `timestamp` | `datetime.now().isoformat()` | Set automatically. |

---

## Step 8: Stream responses

```python
from agentflow.utils import ResponseGranularity

async def stream_example():
    async for chunk in app.astream(
        {"messages": [Message.text_message("Tell me a short story.")]},
        config={"thread_id": "stream-1"},
        response_granularity=ResponseGranularity.LOW,
    ):
        if chunk.content:
            print(chunk.content, end="", flush=True)

asyncio.run(stream_example())
```

See [how-to/python/stream-graph](stream-graph.md) for the full streaming reference.

---

## Response granularity

Pass `response_granularity` to `invoke()`, `ainvoke()`, or `astream()`:

| Value | `invoke()` returns |
|---|---|
| `ResponseGranularity.LOW` (default) | `{"messages": [...]}` — only the final messages |
| `ResponseGranularity.PARTIAL` | `{"messages": [...], "context": [...], "context_summary": ...}` |
| `ResponseGranularity.FULL` | Complete state dict including `execution_meta` |

---

## Stop a running graph

```python
# From another coroutine or task
await app.astop({"thread_id": "session-1"})
```

`stop()` is the sync wrapper. The graph checks the stop flag between nodes and halts before the next node.

---

## Override a node for testing

```python
# Production graph
app = graph.compile()

# In tests: swap the real agent with a stub
def stub_agent(state, config, **deps):
    return {"messages": [Message.text_message("stub response", role="assistant")]}

app.override_node("MAIN", stub_agent)
```

`override_node` is available on both `StateGraph` (before compile) and `CompiledGraph` (after compile).

---

## Complete example

```python
import asyncio
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import START, END

def get_weather(city: str) -> str:
    """Return current weather for a city."""
    return f"22°C, partly cloudy in {city}."

tool_node = ToolNode([get_weather])

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node=tool_node,
)

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tools_calls", None):
        return "TOOL"
    return END

graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()

result = app.invoke(
    {"messages": [Message.text_message("What is the weather in Tokyo?")]},
    config={"thread_id": "demo-1"},
)

for msg in result["messages"]:
    print(f"[{msg.role}]", msg.content)
```

---

## What you learned

- Use `StateGraph` to build the workflow, then call `compile()` to get a runnable `CompiledGraph`.
- `add_node`, `add_edge`, `add_conditional_edges`, `set_entry_point` wire the graph topology.
- `invoke()` / `ainvoke()` run the graph; `astream()` streams chunks token by token.
- `config` dict controls `thread_id`, `user_id`, `recursion_limit`, and more.

## Next steps

- [Configure Agent in detail](configure-agent.md)
- [Set up checkpointing](set-up-checkpointing.md)
- [Streaming responses](stream-graph.md)
- [Custom state](use-custom-state.md)
