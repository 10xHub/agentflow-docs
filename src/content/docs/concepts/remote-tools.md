---
title: Remote Tools
seoTitle: "Remote tools: run tools in the client"
description: How 10xGraph lets a Python graph request tools that execute in a TypeScript client or browser.
section: Concepts
order: 163
group: Serving and clients
updated: "2026-09-29"
---

Remote tools expose a trusted schema from the server while executing the implementation in the TypeScript client. Use them for browser-only capabilities such as clipboard access, selected files, DOM state, or geolocation.

## Declare the schema on the server

Add schemas to `10xgraph.json`. They are validated and attached once when the server starts:

```json
{
  "agent": "graph.agent:app",
  "remote_tools": [
    {
      "node": "tools",
      "name": "read_clipboard",
      "description": "Read the current clipboard text.",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  ]
}
```

`node_name` is accepted as an alias for `node`. Unknown keys, duplicate tool names, invalid parameter schemas, and missing graph nodes fail at startup.

For code-first graphs, use the same validated model:

```python
from tenxgraph.core.graph import RemoteToolConfig

graph.attach_remote_tools([
    RemoteToolConfig(
        node="tools",
        name="read_clipboard",
        description="Read the current clipboard text.",
    )
])
```

## Register the handler on the client

```ts
client.registerToolHandler("read_clipboard", async () => ({
  text: await navigator.clipboard.readText(),
}));

await client.invoke(messages);
```

The server schema and client handler name must match. There is no runtime setup request and clients cannot mutate the process-wide graph.

## Per-run client tools

A client can also bring tools for a single run through the run config, without changing the shared graph:

```python
await app.ainvoke(
    {"messages": [...]},
    config={
        "thread_id": "t1",
        "remote_tools": [
            {
                "name": "change_background",
                "description": "Change the page background color.",
                "parameters": {"type": "object", "properties": {"color": {"type": "string"}}},
            }
        ],
    },
)
```

Entries may use the flat shape above or the OpenAI `{"type": "function", "function": {...}}` shape. The `ToolNode` offers them to the model for that run only, and a call to one is handed to the client like any remote tool. A name the `ToolNode` already has (a server tool, an MCP tool, a configured remote tool) is ignored, so a client cannot shadow a server tool.

Over the API server, `remote_tools` is a server-owned config key: `/v1/graph/invoke` and `/v1/graph/stream` drop it from client config. The [AG-UI endpoint](/docs/integrations/agentflow-with-copilotkit#frontend-tools) fills it from the AG-UI client's own tool list.

## Execution loop

1. Server advertises the remote-tool schemas to the model.
2. Model calls one; the `ToolNode` returns a `RemoteToolCallBlock` instead of running it.
3. The graph pauses after the tool node. Any server tools called in the same step finish and are saved first.
4. The client runs its handler and sends a `ToolResultBlock` on the same thread.
5. The graph resumes after the tool node, with the result in the context.

`invoke()` and `stream()` handle this loop automatically. Handlers must return serializable values. Prefer Python, MCP, or backend tools when execution does not require client-owned capabilities.

## Related docs

- [Register remote tools](/docs/how-to/client/register-remote-tools)
- [Agents and tools](/docs/concepts/agents-and-tools)
- [State and messages](/docs/concepts/state-and-messages)
