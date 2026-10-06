---
title: How to use MCP tools
sidebar_label: MCP tools
description: Guide to connecting AgentFlow agents to Model Context Protocol (MCP) servers using fastmcp.Client, local stdio servers, HTTP servers, and passing user context to MCP.
keywords:
  - agentflow mcp
  - model context protocol
  - mcp tools
  - fastmcp
  - agentflow
sidebar_position: 12
---

# How to use MCP tools

AgentFlow integrates with [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers via the `fastmcp` client. Pass an MCP client to `ToolNode` alongside (or instead of) local Python tools; the graph uses the MCP server's exposed tools exactly the same way it uses local functions.

## Prerequisites

```bash
pip install "10xscale-agentflow[mcp]"
```

This installs `fastmcp` and `mcp` alongside the core framework.

---

## Step 1: Create an MCP client

`fastmcp.Client` accepts a server config dict, a command string (stdio), or a URL.

### Config dict (multi-server or HTTP)

```python
from fastmcp import Client

config = {
    "mcpServers": {
        "github": {
            "url": "https://api.githubcopilot.com/mcp/",
            "headers": {"Authorization": "Bearer YOUR_GITHUB_TOKEN"},
            "transport": "streamable-http",
        },
    }
}

client = Client(config)
```

### Local stdio server

```python
from fastmcp import Client

# Starts `python my_mcp_server.py` as a subprocess
client = Client("python my_mcp_server.py")
```

### Remote HTTP server

```python
from fastmcp import Client

client = Client("https://my-mcp-server.example.com/mcp")
```

---

## Step 2: Pass the client to ToolNode

```python
from agentflow.core.graph import ToolNode

tool_node = ToolNode(
    tools=[],       # no local tools needed, or mix in local tools
    client=client,
)
```

`ToolNode` fetches the available tools from the MCP server when the Agent prepares its tool list before each LLM call.

---

## Step 3: Wire into the graph

The graph structure is identical to a local-tool graph:

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

tool_node = ToolNode(tools=[], client=client)

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node=tool_node,
)

def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tools_calls", None):
        return "TOOL"
    return END

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

---

## Step 4: Invoke

```python
result = app.invoke(
    {"messages": [Message.text_message("List the latest commits in repo owner/repo-name.")]},
    config={"thread_id": "mcp-demo-1"},
)
print(result["messages"][-1].content)
```

---

## Mixing local and MCP tools

You can register both local Python functions and an MCP client in the same `ToolNode`. The runtime routes each tool call to the right backend:

```python
from agentflow.prebuilt.tools import safe_calculator

tool_node = ToolNode(
    tools=[safe_calculator],   # local tool
    client=client,             # MCP tools also available
)
```

---

## Passing user context to MCP

Set `pass_user_info_to_mcp=True` on `ToolNode` to forward the `user` dict from the execution config to the MCP server as request metadata. The server can access it via `ctx.request_context.meta`.

```python
tool_node = ToolNode(
    tools=[],
    client=client,
    pass_user_info_to_mcp=True,
)

# On the MCP server:
# @mcp.tool()
# async def my_tool(query: str, user: dict) -> str:
#     user_info = user or {}
#     user_id = user_info.get("user_id")
#     user_roles = user_info.get("roles", [])
#     ...
```

Pass the `user` dict in the execution config:

```python
result = app.invoke(
    {"messages": [Message.text_message("Do something.")]},
    config={
        "thread_id": "mcp-auth-1",
        "user": {"id": "user-123", "name": "Alice", "roles": ["admin"]},
    },
)
```
Note: If you setup authentication for your graph, then the authenticated user info is automatically included in the `user` dict, so you can use this feature to forward authenticated user context to your MCP server.

---

## Tag-based filtering for MCP tools

MCP tools tagged with FastMCP-specific metadata can be filtered with `tools_tags` on `Agent`. Tags are read from `tool.meta._fastmcp.tags` on each MCP tool:

```python
agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
    tools_tags={"read"},   # only expose MCP tools tagged "read"
)
```

---

## ReactAgent with MCP

`ReactAgent` accepts the MCP client directly:

```python
from agentflow.prebuilt.agent import ReactAgent

agent = ReactAgent(
    model="gpt-4o",
    tools=[],
    client=client,
    pass_user_info_to_mcp=True,
)
app = agent.compile()
```

---

## Complete example: GitHub MCP integration

```python
import os
from fastmcp import Client
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.utils import END

# Configure the GitHub MCP server
mcp_config = {
    "mcpServers": {
        "github": {
            "url": "https://api.githubcopilot.com/mcp/",
            "headers": {"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"},
            "transport": "streamable-http",
        },
    }
}

client = Client(mcp_config)
tool_node = ToolNode(tools=[], client=client)

agent = Agent(
    model="gemini-2.0-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a helpful GitHub assistant."}],
    tool_node=tool_node,
    trim_context=True,
)

def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tools_calls", None):
        return "TOOL"
    return END

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())

result = app.invoke(
    {"messages": [Message.text_message("List the latest commits in the agentflow repo.")]},
    config={"thread_id": "github-1", "recursion_limit": 10},
)
print(result["messages"][-1].content)
```

---

## What you learned

- Install `pip install 10xscale-agentflow[mcp]` to enable MCP support.
- Pass a `fastmcp.Client` to `ToolNode(client=...)`. Local tools and MCP tools can coexist.
- The graph wires exactly the same way as with local tools.
- `pass_user_info_to_mcp=True` forwards the execution config's `user` dict as MCP request metadata.
- `tools_tags` filters both local and MCP tools by tag.

## Next steps

- [Build a graph](build-a-graph.md) for the complete graph construction reference.
- [Configure Agent](configure-agent.md) for other Agent options that work alongside MCP.
