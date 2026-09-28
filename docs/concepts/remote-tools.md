---
title: Remote Tools
description: How AgentFlow lets a Python graph request tools that execute in a TypeScript client or browser.
keywords:
  - remote tools
  - client-side tools
  - browser tool execution
sidebar_position: 7
---

# Remote tools

Remote tools expose a trusted schema from the server while executing the implementation in the TypeScript client. Use them for browser-only capabilities such as clipboard access, selected files, DOM state, or geolocation.

## Declare the schema on the server

Add schemas to `agentflow.json`. They are validated and attached once when the server starts:

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
from agentflow.core.graph import RemoteToolConfig

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

## Execution loop

1. Server advertises configured remote-tool schemas to the model.
2. Model emits a `RemoteToolCallBlock`.
3. TypeScript SDK runs the matching client handler.
4. SDK sends a `ToolResultBlock` and continues the graph.

`invoke()` and `stream()` handle this loop automatically. Handlers must return serializable values. Prefer Python, MCP, or backend tools when execution does not require client-owned capabilities.

## Related docs

- [TypeScript tools reference](/docs/reference/client/tools)
- [Agents and tools](./agents-and-tools.md)
- [State and messages](./state-and-messages.md)
