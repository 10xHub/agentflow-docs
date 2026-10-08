# Use MCP tools in agents

> Connect 10xGraph agents to MCP servers and mix local Python tools with remote MCP tools in a single graph.

Source: https://10xgraph.com/docs/guides/use-mcp
Last updated: 2026-10-08

10xGraph integrates with [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers, allowing your agents to call tools exposed by remote MCP servers alongside local Python functions. The Model Context Protocol is an open standard for LLM tool integration, maintained by Anthropic, letting you compose tools from multiple sources seamlessly.

This guide covers connecting an MCP server, invoking its tools from a graph, testing with mock clients, and mixing MCP tools with local tools. After completing it, your agent will be able to execute both local and remote tools in the same workflow.

## Prerequisites

Install the MCP extra to add fastmcp and mcp libraries:

```bash
pip install "10xgraph[mcp]"
```

## Step 1: Create an MCP client

The `fastmcp.Client` class connects to MCP servers and fetches their available tools. It supports three transport modes: a config dict (for multiple servers or HTTP), a local subprocess (stdio), or a remote URL. Choose the one that matches your server.

### Using a config dict for multiple servers or HTTP

If your MCP server is accessed over HTTP or you need to configure multiple servers at once, use a dict with the server config:

```python
from fastmcp import Client

config = {
    "mcpServers": {
        "github": {
            "url": "https://api.githubcopilot.com/mcp/",
            "headers": {"Authorization": "Bearer YOUR_GITHUB_TOKEN"},
            "transport": "streamable-http",
        },
        "filesystem": {
            "command": "python",
            "args": ["mcp_filesystem_server.py"],
        },
    }
}

client = Client(config)
```

### Using a stdio subprocess server

To run an MCP server as a subprocess on your machine, pass the command to start it:

```python
from fastmcp import Client

# Starts the server and communicates over stdio
client = Client("python my_mcp_server.py")
```

### Using a remote HTTP server

For an MCP server listening on HTTP, pass the URL directly:

```python
from fastmcp import Client

client = Client("https://my-mcp-server.example.com/mcp")
```

## Step 2: Wire the MCP client into ToolNode

Create a `ToolNode` and pass the MCP client. The `ToolNode` queries the client for available tools each time the Agent prepares its tool list before calling the LLM.

```python
from tenxgraph.core.graph import ToolNode

tool_node = ToolNode(
    tools=[],       # no local tools, or add them here
    client=client,
)
```

The first argument `tools` is a list of local Python functions (or empty if you have none). The `client` is the MCP client created in the previous step.

## Step 3: Build and wire the graph

The graph structure is identical to one using local tools. Create an `Agent` that uses the `ToolNode`, add it to the graph alongside a routing function, and compile:

```python
from tenxgraph.core.graph import StateGraph, Agent, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.utils import END

tool_node = ToolNode(tools=[], client=client)

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node=tool_node,
)

def should_use_tools(state: AgentState) -> str:
    """Route to tools if the agent requested them."""
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tool_calls", None):
        return "tools"
    return END

graph = StateGraph()
graph.add_node("agent", agent)
graph.add_node("tools", tool_node)
graph.add_conditional_edges("agent", should_use_tools, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")
graph.set_entry_point("agent")

app = graph.compile()
```

## Step 4: Invoke the agent

Call the compiled graph with a message. The agent will see the MCP tools available and call them when appropriate:

```python
result = app.invoke(
    {"messages": [Message.text_message("List the latest commits in owner/repo-name.")]},
    config={"thread_id": "mcp-demo-1"},
)
print(result["messages"][-1].content)
```

Verify that the agent used the MCP tools by checking the message history for `ToolCallBlock` and `ToolResultBlock` entries.

## Mixing local and remote tools

You can register both local Python functions and MCP tools in the same `ToolNode`. The runtime automatically routes each tool call to the correct backend (local or remote):

```python
from tenxgraph.prebuilt.tools import safe_calculator

# Local function
def my_custom_tool(query: str) -> str:
    return f"Custom result: {query}"

# Both local and MCP tools available
tool_node = ToolNode(
    tools=[safe_calculator, my_custom_tool],
    client=client,
)
```

When the LLM requests a tool, `ToolNode` checks its local registry first, then queries the MCP client. If the tool name matches both a local function and an MCP tool, the local function takes precedence.

## Forwarding user context to MCP

Many MCP servers need to know who is calling them (for access control, logging, or per-user state). Set `pass_user_info_to_mcp=True` on `ToolNode` to send the `user` dict from the execution config to the MCP server as request metadata:

```python
tool_node = ToolNode(
    tools=[],
    client=client,
    pass_user_info_to_mcp=True,
)
```

The MCP server receives the user dict in its request context and can access it in tool handlers:

```python
# Code on the MCP server (mcp library)
import mcp

@mcp.tool()
async def secure_action(query: str) -> str:
    user = mcp.current_request_context.meta.get("user", {})
    user_id = user.get("id")
    user_roles = user.get("roles", [])
    
    if "admin" not in user_roles:
        raise PermissionError(f"User {user_id} does not have permission")
    
    return f"Action completed by {user_id}"
```

Pass the user dict in the invoke config. If you have set up authentication for your graph, the authenticated user info is automatically added:

```python
result = app.invoke(
    {"messages": [Message.text_message("Do something.")]},
    config={
        "thread_id": "mcp-auth-1",
        "user": {"id": "user-123", "name": "Alice", "roles": ["admin"]},
    },
)
```

## Filtering MCP tools by tag

MCP servers can tag their tools with metadata. If the server supports it, you can filter which tools are offered to the Agent using `tools_tags` on the `Agent`:

```python
agent = Agent(
    model="gpt-4o",
    tool_node=tool_node,
    tools_tags={"read"},   # only expose tools tagged "read"
)
```

The Agent will only see MCP tools that have the specified tags. Local tools are not filtered by this setting.

## Testing MCP tools without a server

To test your graph with MCP tools without running an actual MCP server, use `MockMCPClient` from `tenxgraph.qa.testing`. It simulates tool execution and tracks calls for assertions:

```python
import pytest
from tenxgraph.qa.testing import MockMCPClient
from tenxgraph.core.graph import ToolNode, StateGraph, Agent
from tenxgraph.core.state import Message
from tenxgraph.utils import END

# Set up mock client
mock_client = MockMCPClient()
mock_client.add_tool(
    name="search",
    description="Search for information",
    parameters={"query": {"type": "string"}},
    handler=lambda query: f"Results for: {query}",
)

# Create ToolNode with mock client
tool_node = ToolNode(tools=[], client=mock_client)

# Build graph (same as before)
agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are helpful."}],
    tool_node=tool_node,
)

def should_use_tools(state) -> str:
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tool_calls", None):
        return "tools"
    return END

graph = StateGraph()
graph.add_node("agent", agent)
graph.add_node("tools", tool_node)
graph.add_conditional_edges("agent", should_use_tools, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")
graph.set_entry_point("agent")

app = graph.compile()

# Test the graph
result = app.invoke(
    {"messages": [Message.text_message("Search for AI trends.")]},
    config={"thread_id": "test-1"},
)

# Verify the tool was called
mock_client.assert_called("search")
assert mock_client.call_count("search") == 1

# Check the arguments
call = mock_client.get_last_call("search")
assert "AI trends" in call["arguments"]["query"]
```

`MockMCPClient` provides helper methods for testing:
- `add_tool(name, description, parameters, handler)`: Register a mock tool
- `was_called(name)`: Check if a tool was invoked
- `call_count(name)`: Get the number of times a tool was called
- `get_calls(name)`: Get all calls to a tool
- `get_last_call(name)`: Get the most recent call with its arguments
- `assert_called(name)`: Assert a tool was called (raises if not)
- `assert_called_with(name, **args)`: Assert a tool was called with specific arguments
- `reset()`: Clear call history but keep tool registrations

## Using ReactAgent with MCP

`ReactAgent` is a prebuilt agent that includes tool calling built-in. Pass the MCP client directly:

```python
from tenxgraph.prebuilt.agent import ReactAgent

agent = ReactAgent(
    model="gpt-4o",
    tools=[],
    client=client,
    pass_user_info_to_mcp=True,
)
app = agent.compile()
```

Invoke it the same way as the manual graph:

```python
result = app.invoke(
    {"messages": [Message.text_message("Search for the latest news.")]},
    config={"thread_id": "react-mcp-1"},
)
```

## Complete example: GitHub MCP integration

This example builds a complete agent that uses the GitHub MCP server to read repository information:

```python
import os
from fastmcp import Client
from tenxgraph.core.graph import StateGraph, Agent, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.storage.checkpointer import InMemoryCheckpointer
from tenxgraph.utils import END

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
    if last and last.role == "assistant" and getattr(last, "tool_calls", None):
        return "tools"
    return END

graph = StateGraph()
graph.add_node("agent", agent)
graph.add_node("tools", tool_node)
graph.add_conditional_edges("agent", should_use_tools, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")
graph.set_entry_point("agent")

app = graph.compile(checkpointer=InMemoryCheckpointer())

result = app.invoke(
    {"messages": [Message.text_message("List the latest commits in the 10xgraph repo.")]},
    config={"thread_id": "github-1", "recursion_limit": 10},
)
print(result["messages"][-1].content)
```

## What you learned

- Install `pip install 10xgraph[mcp]` to enable MCP support.
- Create an MCP client with `fastmcp.Client(config_dict)`, `Client(stdio_command)`, or `Client(http_url)`.
- Pass the client to `ToolNode(tools=[], client=client)` to offer MCP tools to your agent.
- Mix local and MCP tools in the same `ToolNode`; the runtime routes each call appropriately.
- Forward user context to MCP servers with `pass_user_info_to_mcp=True`.
- Filter MCP tools by tag with `tools_tags` on the `Agent`.
- Test MCP tools without a real server using `MockMCPClient`.

## Next steps

- [Build a graph](/docs/guides/build-a-graph) for complete graph construction and routing.
- [Configure Agent](/docs/guides/configure-agent) for all Agent options that work alongside MCP.
- [Use the tool decorator](/docs/guides/use-tool-decorator) to write custom local tools.
- [Test and evaluate](/docs/testing/unit-tests) to integrate MCP tests into your test suite.

## Frequently asked questions

### Can I use MCP tools without a local Python function?

Yes. Pass an empty list to ToolNode(tools=[]) and provide the MCP client. The graph will offer only the MCP server's tools.

### Do MCP tools run in parallel like local tools?

Yes. The LLM can request multiple MCP tools in one turn, and ToolNode executes them concurrently.

### How do I test MCP tools without a real server?

Use MockMCPClient from tenxgraph.qa.testing. It simulates an MCP client and tracks tool calls for assertions.
