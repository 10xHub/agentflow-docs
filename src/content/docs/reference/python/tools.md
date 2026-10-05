---
title: Tools
seoTitle: "ToolNode API reference (Python)"
description: ToolNode — the unified tool registry and executor for local functions, MCP, Composio, and LangChain tools.
section: Reference
group: Python library
order: 1470
label: Tools
updated: "2026-07-21"
---

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
| `tools` | `Iterable[Callable]` | **required** | Local Python functions to register. Each is registered under its `__name__`. |
| `client` | `fastmcp.Client \| None` | `None` | MCP client for remote tool access. Requires `pip install "10xgraph[mcp]"`. |
| `pass_user_info_to_mcp` | `bool` | `False` | Forward the run config's `user` dict to MCP tool calls as request metadata, readable on the server via `ctx.request_context.meta`. |

Pass an empty list when the node only serves MCP tools: `ToolNode([], client=client)`.

**Raises:** `TypeError` when an item in `tools` is not callable, `ImportError` when a `client` is given but the MCP packages are not installed.

---

## Defining local tools

Any Python function can be a tool. Use docstrings and type annotations to generate accurate JSON schemas:

```python
def lookup_order(order_id: str) -> dict:
    """Look up an order by ID.

    Args:
        order_id: The order identifier, for example "A1001".

    Returns:
        A dict with the order status and line items.
    """
    # ... query the order system
    return {"order_id": order_id, "status": "shipped"}

def refund_order(order_id: str, amount: float, reason: str = "") -> dict:
    """Refund an order, fully or partially.

    Args:
        order_id: The order identifier.
        amount: Amount to refund in the order currency.
        reason: Optional reason recorded on the refund.

    Returns:
        A dict with the refund ID and the refunded amount.
    """
    # ... call the payment provider
    return {"refund_id": "R-1", "amount": amount}

tools = ToolNode([lookup_order, refund_order])
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

def lookup_order(order_id: str) -> dict:
    """Look up an order by ID."""
    return {"order_id": order_id, "status": "shipped"}

def refund_order(order_id: str, amount: float) -> dict:
    """Refund an order."""
    return {"refund_id": "R-1", "amount": amount}

tool_node = ToolNode([lookup_order, refund_order])

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a support agent for an online store."}],
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

`ToolNode` talks to MCP servers through a `fastmcp.Client`. Install the extra with `pip install "10xgraph[mcp]"`, then pass the client to `ToolNode`:

```python
from fastmcp import Client
from agentflow.core.graph import StateGraph, ToolNode

client = Client({
    "mcpServers": {
        "local": {"url": "http://localhost:8080/mcp", "transport": "streamable-http"},
    }
})

tools = ToolNode([], client=client)
# tools.mcp_tools contains the list of available MCP tool names

graph = StateGraph()
graph.add_node("TOOL", tools)
```

See [Use MCP servers](/docs/how-to/python/use-mcp) for the full setup.

When `client` is provided, `ToolNode` fetches available tool schemas from the MCP server on startup and routes calls matching MCP tool names to the remote server.

---

## Filtering tools by tag

Use the `tools_tags` parameter on `Agent` to present only a subset of tools to the LLM:

```python
from agentflow.utils import tool

@tool(tags=["safe", "orders"])
def lookup_order(order_id: str) -> dict:
    """Look up an order by ID."""
    ...

@tool(tags=["write", "payments"])
def refund_order(order_id: str, amount: float) -> dict:
    """Refund an order."""
    ...

tool_node = ToolNode([lookup_order, refund_order])

# Agent only sees tools tagged "safe"
agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
    tools_tags={"safe"},
)
```

The `@tool` decorator also accepts `name`, `description`, `provider`, `capabilities`, `metadata` and `parameters`. Setting a `__tags__` attribute by hand is not supported.

---

## Tool execution result

When `ToolNode` executes a tool, it:

1. Calls the function with the arguments from `ToolCallBlock.args`.
2. Wraps the return value as the block's `output`.
3. Returns a message carrying a `ToolResultBlock(call_id=..., output=..., is_error=False)`.

If the function raises an exception, the exception message is captured and `is_error=True` is set. The error is reported to the LLM so it can recover gracefully.

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
    name="lookup_order",
    args={"order_id": "A1001"},
    tool_call_id="call_abc123",
    config={"thread_id": "test"},
    state=AgentState(),
)
```

---

## Getting tool schemas

`ToolNode` exposes the JSON schemas it will send to the LLM through the async `all_tools` method, optionally filtered by tags:

```python
schemas = await tool_node.all_tools(tags={"safe"}, config=config)
# [{"type": "function", "function": {"name": "lookup_order", "description": "...", "parameters": {...}}}, ...]
```

There is also a synchronous `all_tools_sync()` for non-async code.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Tool failure result (`is_error=True`) | The function raised an exception. | Check the tool implementation. The error is returned to the LLM so it can recover. |
| Tool-not-found result | The LLM requested a tool name that is not registered. | Verify the function is in the `tools` list and that the name matches exactly. |
| `TypeError` | Tool called with wrong argument types. | Add type annotations and docstrings to improve schema accuracy. |
