---
title: Tools — AgentFlow Python AI Agent Framework
description: ToolNode — the unified tool registry and executor for local functions, MCP, Composio, and LangChain tools.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - tools
sidebar_position: 6
---


# Tools

## When to use this

Use `ToolNode` when you want to expose Python functions (or MCP/Composio/LangChain tools) to an LLM agent. `ToolNode` generates JSON schemas automatically, executes calls, handles errors, and publishes execution events.

## Import path

```python
from agentflow.core.graph import ToolNode
```

---

## `ToolNode`

A unified registry and executor for callable tools from multiple sources.

### Constructor

```python
tools = ToolNode([my_function, another_function])
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `funcs` | `list[Callable]` | `[]` | Local Python functions to register. |
| `client` | `MCPClient \| None` | `None` | MCP client for remote tool access. |
| `composio` | `ComposioAdapter \| None` | `None` | Composio adapter for external integrations. |
| `langchain` | `LangChainAdapter \| None` | `None` | LangChain tools adapter. |

Only the first positional argument (`funcs`) is commonly used. The other adapters are optional integrations.

---

## Defining local tools

Any Python function can be a tool. Use docstrings and type annotations to generate accurate JSON schemas:

```python
def get_weather(location: str, unit: str = "celsius") -> str:
    """Get the current weather for a location.

    Args:
        location: City name or coordinates.
        unit: Temperature unit, either 'celsius' or 'fahrenheit'.

    Returns:
        A string describing the current weather.
    """
    # ... actual implementation
    return f"Sunny, 24°C in {location}"


def search_web(query: str, max_results: int = 5) -> list[dict]:
    """Search the web for information.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return (1-20).

    Returns:
        List of results with 'title', 'url', and 'snippet' keys.
    """
    # ... search implementation
    return [{"title": "...", "url": "...", "snippet": "..."}]


tools = ToolNode([get_weather, search_web])
```

### Supported annotation types

`ToolNode` reads Python type annotations to produce the `parameters` section of each tool's JSON Schema:

| Python type | JSON Schema type |
|---|---|
| `str` | `string` |
| `int` | `integer` |
| `float` | `number` |
| `bool` | `boolean` |
| `list` / `list[T]` | `array` |
| `dict` | `object` |
| `T \| None` | `T` with `nullable: true` |

---

## Using ToolNode in a graph (React pattern)

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.utils import START, END

def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Sunny in {location}"

tool_node = ToolNode([get_weather])

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a weather assistant."}],
    tool_node=tool_node,
)

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.set_entry_point("MAIN")

def should_use_tools(state, config):
    last = state.context[-1]
    if any(b.type == "tool_call" for b in last.content):
        return "TOOL"
    return END

graph.add_conditional_edges("MAIN", should_use_tools)
graph.add_edge("TOOL", "MAIN")

app = graph.compile()
```

---

## MCP integration

```python
from agentflow.runtime.adapters.mcp import MCPClient

async with MCPClient(server_url="http://localhost:8080") as mcp:
    tools = ToolNode(client=mcp)
    # tools.mcp_tools contains the list of available MCP tool names

    graph = StateGraph()
    graph.add_node("TOOL", tools)
    # ...
```

When `client` is provided, `ToolNode` fetches available tool schemas from the MCP server on startup and routes calls matching MCP tool names to the remote server.

---

## Filtering tools by tag

Use the `tools_tags` parameter on `Agent` to present only a subset of tools to the LLM:

```python
def search_web(query: str) -> str:
    """Search the web."""
    ...

def read_file(path: str) -> str:
    """Read a file from disk."""
    ...

tool_node = ToolNode([search_web, read_file])

# Agent only sees tools tagged "safe"
agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
    tools_tags={"safe"},
)
```

To tag a function, add a `__tags__` attribute:

```python
search_web.__tags__ = {"safe", "web"}
read_file.__tags__ = {"filesystem"}
```

---

## Tool execution result

When `ToolNode` executes a tool, it:

1. Calls the function with the arguments from `ToolCallBlock.args`.
2. Converts the return value to a string.
3. Returns a `ToolResultBlock(tool_call_id=..., content=..., is_error=False)`.

If the function raises an exception, the exception message is captured and `is_error=True` is set — the error is reported to the LLM so it can recover gracefully.

---

## Async tools

`ToolNode` supports both sync and async tool functions:

```python
import httpx

async def fetch_data(url: str) -> str:
    """Fetch content from a URL asynchronously."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.text

tools = ToolNode([fetch_data])
```

---

## `invoke` method (direct use)

In most cases you do not call `ToolNode.invoke` directly — the graph handles this. But for testing:

```python
result = await tool_node.invoke(
    name="get_weather",
    args={"location": "Paris"},
    tool_call_id="call_abc123",
    config={"thread_id": "test"},
    state=AgentState(),
)
```

---

## Getting tool schemas

`ToolNode` exposes the JSON schemas it will send to the LLM:

```python
schemas = tool_node.get_tool_schemas()
# [{"name": "get_weather", "description": "...", "parameters": {...}}, ...]
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ToolExecutionError` | The function raised an exception. | Check tool implementation. The `is_error=True` result is returned to the LLM to handle. |
| `ToolNotFoundError` | LLM requested a tool name that is not registered. | Verify the function is in the `funcs` list and that the name matches exactly. |
| `TypeError` | Tool called with wrong argument types. | Add type annotations and docstrings to improve schema accuracy. |
