---
title: MCP Client — AgentFlow Python AI Agent Framework
sidebar_label: MCP Client
description: Connect to MCP servers with FastMCP Client, list remote tools, inspect metadata, and invoke tools directly.
keywords:
  - ai agent tutorial
  - multi-agent tutorial
  - agentflow examples
  - agentflow
  - python ai agent framework
  - mcp client
---


# MCP Client

**Source example:** [`agentflow/examples/react-mcp/client.py`](https://github.com/10xHub/Agentflow/blob/main/examples/react-mcp/client.py)

## What you will build

A standalone MCP client that connects to a weather server, lists the remote tools it exposes, inspects their metadata, and calls `get_weather`.

## Prerequisites

- Python 3.11 or later
- `fastmcp` installed
- the MCP server from the previous tutorial running locally

Install:

```bash
pip install fastmcp
```

Start the server in another terminal:

```bash
python agentflow/examples/react-mcp/server.py
```

## Step 1 — Define the MCP server config

The client uses a config object keyed by server name:

```python
config = {
    "mcpServers": {
        "weather": {
            "url": "http://127.0.0.1:8000/mcp",
            "transport": "streamable-http",
            "headers": {"Authorization": "Bearer TEST_WEATHER_API_KEY"},
        },
    },
}
```

This config tells the client:

- which server to connect to
- which transport to use
- which headers to send

## Step 2 — Create the client

```python
from fastmcp import Client


client_http = Client(config)
```

The client manages MCP connections with async context management.

## Step 3 — List tools

The example calls `list_tools()` and reads metadata:

```python
from mcp import Tool


async def call_tools():
    async with client_http:
        tools: list[Tool] = await client_http.list_tools()
        for i in tools:
            meta = i.meta or {}
            tags = meta.get("_fastmcp", {}).get("tags", [])
            print(f"Tool: {i.name}, Tags: {tags}")
            print(i.model_dump())
```

This is useful when you want to:

- inspect what a server can do
- build a UI for available tools
- filter tools by server-side metadata

## Discovery and invocation flow

```mermaid
sequenceDiagram
    participant App
    participant Client as FastMCP Client
    participant Server as MCP server

    App->>Client: list_tools()
    Client->>Server: MCP list tools request
    Server-->>Client: tool schemas + metadata
    Client-->>App: Tool objects
    App->>Client: call_tool("get_weather", {...})
    Client->>Server: MCP tool invocation
    Server-->>Client: structured result
    Client-->>App: CallToolResult
```

## Step 4 — Invoke a tool directly

The example then calls `get_weather`:

```python
async def invoke():
    async with client_http:
        result = await client_http.call_tool(
            "get_weather",
            {
                "location": "New York",
            },
        )
        print(result)
```

You get a structured MCP result rather than a plain string. That result may contain:

- human-readable content
- structured JSON content
- error flags

## Example run

```python
async def main():
    await call_tools()
    await invoke()


if __name__ == "__main__":
    asyncio.run(main())
```

Run it:

```bash
python agentflow/examples/react-mcp/client.py
```

Expected output:

- one or more tool definitions from the server
- a successful `CallToolResult` for `get_weather`

## How this relates to AgentFlow

This page shows raw MCP usage without a graph. AgentFlow builds on the same idea by plugging an MCP client into `ToolNode`, which lets an agent call these tools as part of a graph run.

That is the next tutorial:

- [MCP ReAct Agent](/docs/tutorials/from-examples/mcp-react-agent)

## Common mistakes

- Not starting the MCP server first.
- Pointing the client at the wrong URL or transport.
- Forgetting auth headers when the server requires them.
- Expecting direct Python return values instead of MCP response objects.

## Key concepts

| Concept | Details |
|---|---|
| `Client(config)` | Connects to one or more MCP servers |
| `list_tools()` | Discovers remote tools and their schemas |
| `call_tool(name, args)` | Invokes a remote MCP tool directly |
| `meta` | Metadata block that can include tags and server-specific hints |

## What you learned

- How to configure an MCP client.
- How to discover remote tool schemas.
- How to invoke a remote tool without AgentFlow orchestration.

## Next step

→ [MCP ReAct Agent](/docs/tutorials/from-examples/mcp-react-agent) to let an AgentFlow graph call those MCP tools automatically.
