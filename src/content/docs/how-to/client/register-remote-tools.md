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
Run `agentflow audit` first to validate the schema format and duplicate names.

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

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Model never calls tool | Server schema absent or wrong node | Add it to `remote_tools` and restart API. |
| `Tool 'x' not found` | Client handler missing or name differs | Register the exact configured name before invoking. |
| Startup validation error | Typo, duplicate name, or invalid schema | Fix the named `remote_tools` entry. |
| Handler result fails | Value is not serializable | Return JSON-compatible data. |
