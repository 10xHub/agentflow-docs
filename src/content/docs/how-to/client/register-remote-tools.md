---
title: Register remote tools
description: Declare trusted remote-tool schemas and register browser-side handlers.
section: How-to guides
group: TypeScript client
order: 1040
updated: "2026-09-29"
---

Use remote tools when execution needs browser or client-owned capabilities. Keep database, secret-bearing API, and backend work in server-side tools.

## 1. Declare schemas in `agentflow.json`

```json
{
  "agent": "graph.agent:app",
  "remote_tools": [
    {
      "node": "tools",
      "name": "get_location",
      "description": "Read the browser's current location.",
      "parameters": {
        "type": "object",
        "properties": {
          "high_accuracy": {"type": "boolean"}
        },
        "required": []
      }
    }
  ]
}
```

Restart the API after changing schemas. Startup fails for unknown fields, duplicate names, malformed parameters, or a `node` that is not a `ToolNode`.
Run `10xgraph audit` first to validate the schema format and duplicate names.

## 2. Register matching handlers

```ts
client.registerToolHandler("get_location", async ({ high_accuracy = false }) => {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: high_accuracy,
    });
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
});
```

## 3. Invoke normally

```ts
const result = await client.invoke([
  Message.text_message("Where am I?", "user"),
]);
```

The SDK detects remote calls, runs handlers, returns tool results, and continues the graph automatically. There is no `setup()` method or dynamic setup endpoint.

## `registerToolHandler(name, handler)`

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | Must exactly match a configured `remote_tools[].name`. |
| `handler` | `(args: any) => Promise<any>` | Executes locally and returns a serializable result. |

Register handlers before `invoke()`, `stream()`, or `wsStream()`. Schemas are trusted server configuration: the client stores and executes only handlers and cannot add or replace schemas.

`registerTool({ name, handler, ...metadata })` remains available for existing clients. Schema metadata supplied there stays local and is not sent to the server. New code should use `registerToolHandler()`.

## Execution behavior

When a response contains a `RemoteToolCallBlock`, the SDK:

1. Finds the handler by tool name.
2. Calls it with the model-generated arguments.
3. Wraps the result in a `ToolResultBlock`.
4. Continues execution until no remote calls remain or the recursion limit (`recursion_limit`, default 25) is reached.

Missing handlers and thrown errors become failed tool results rather than transport failures.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Model never calls tool | Server schema absent or wrong node | Add it to `remote_tools` and restart API. |
| `Tool 'x' not found` | Client handler missing or name differs | Register the exact configured name before invoking. |
| Startup validation error | Typo, duplicate name, or invalid schema | Fix the named `remote_tools` entry. |
| Handler result fails | Value is not serializable | Return JSON-compatible data. |
