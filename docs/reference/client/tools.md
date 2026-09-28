---
title: Client Tools
description: TypeScript APIs for handlers that execute remote tool calls.
---

# Client tools

Remote-tool schemas are trusted server configuration. The TypeScript client stores and executes only handlers.

## `registerToolHandler(name, handler)`

```ts
client.registerToolHandler("read_clipboard", async () => ({
  text: await navigator.clipboard.readText(),
}));
```

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | Must exactly match a configured `remote_tools[].name`. |
| `handler` | `(args: any) => Promise<any>` | Executes locally and returns a serializable result. |

Register handlers before `invoke()`, `stream()`, or `wsStream()`. No setup request is needed.

## Server schema

```json
{
  "remote_tools": [
    {
      "node": "tools",
      "name": "read_clipboard",
      "description": "Read clipboard text from the client.",
      "parameters": {"type": "object", "properties": {}, "required": []}
    }
  ]
}
```

The server validates this schema at startup and advertises it to the model. The client cannot add or replace schemas.

## Compatibility API

`registerTool({ name, handler, ...metadata })` remains available for existing clients. Schema metadata supplied there stays local and is not sent to the server. New code should use `registerToolHandler()`.

## Execution behavior

When a response contains a `RemoteToolCallBlock`, the SDK:

1. Finds the handler by tool name.
2. Calls it with the model-generated arguments.
3. Wraps the result in a `ToolResultBlock`.
4. Continues execution until no remote calls remain or the recursion limit is reached.

Missing handlers and thrown errors become failed tool results rather than transport failures.
