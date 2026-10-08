# Remote tools

> Execute client-side tools from the agent graph, handling geolocation, clipboard, and other browser capabilities.

Source: https://10xgraph.com/docs/client/remote-tools
Last updated: 2026-10-08

Remote tools let your agent call functions that run in the browser or on the client machine. Use them for capabilities that only the client owns: geolocation, clipboard access, DOM manipulation, local file system access, or device sensors. Keep database, secrets, and backend work in server-side tools defined in your Python graph.

When the agent asks for a remote tool, 10xGraph automatically detects it, runs your registered handler on the client, collects the result, and feeds it back to the agent, all without you managing the handoff.

## How it works

The flow is transparent. When you invoke or stream the agent:

1. The Python graph calls a remote tool (one you declared in `10xgraph.json`).
2. The server returns a `RemoteToolCallBlock` to the client.
3. The client SDK finds your registered handler by name.
4. Your handler executes locally and returns a result.
5. The SDK wraps the result in a tool result message and sends it back.
6. The server continues the graph with the tool result.

This loop repeats until the graph is done or hits the recursion limit (default 25 calls).

## Step 1: Declare schemas in `10xgraph.json`

Add a `remote_tools` array to your config. Each entry describes a tool the server will advertise to the model and the agent will be allowed to call:

```json
{
  "agent": "graph.agent:app",
  "remote_tools": [
    {
      "node": "tools",
      "name": "get_location",
      "description": "Read the browser's current location using geolocation.",
      "parameters": {
        "type": "object",
        "properties": {
          "high_accuracy": {
            "type": "boolean",
            "description": "Request high-accuracy coordinates (slower)."
          }
        },
        "required": []
      }
    },
    {
      "node": "tools",
      "name": "read_clipboard",
      "description": "Read text from the user's clipboard.",
      "parameters": {
        "type": "object"
      }
    }
  ]
}
```

Schema validation happens at server startup. The server checks that:

- The `node` exists and is a `ToolNode` in your graph.
- The `name` is unique within your remote tools list.
- `description` and `parameters` are non-empty strings / valid JSON Schema objects.
- No unknown fields are present.

Restart the API after changing schemas. To validate syntax before restarting, run:

```bash
10xgraph audit
```

This command checks your `10xgraph.json` for remote tool errors and other configuration problems.

## Step 2: Register matching handlers

On the client, register a handler function for each declared tool. Do this before calling `invoke()`, `stream()`, or `wsStream()`:

```ts
import { AgentFlowClient, Message } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  authToken: 'your-bearer-token', // if auth is enabled
});

// Geolocation handler
client.registerToolHandler('get_location', async ({ high_accuracy = false }) => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      reject,
      { enableHighAccuracy: high_accuracy }
    );
  });
});

// Clipboard handler
client.registerToolHandler('read_clipboard', async () => {
  const text = await navigator.clipboard.readText();
  return { content: text };
});
```

Handler requirements:

- **Signature:** `async (args: any) => Promise<any>`: the async function receives the tool arguments as a single object and must return a JSON-serializable value.
- **Arguments:** The model generates arguments based on the schema you declared in `10xgraph.json`. Destructure them as shown, or access them as properties: `args.high_accuracy`.
- **Return value:** Must be serializable to JSON (objects, arrays, strings, numbers, booleans, null). If your result is not serializable, the tool fails.
- **Errors:** If the handler throws, the error is caught and converted to a failed tool result. The agent sees the error message and can retry or handle it.

Register handlers before any `invoke()` or `stream()` call. The SDK runs handlers automatically when the response contains a `RemoteToolCallBlock`.

## Step 3: Invoke normally

Call `invoke()` or `stream()` as usual. The client detects remote tool calls and handles them internally:

```ts
// Simple invoke
const result = await client.invoke([
  Message.text_message("Where am I right now?", "user")
]);

console.log(result.messages);
// The agent has seen the location and replied.
```

Or stream with an async loop:

```ts
const stream = client.stream([
  Message.text_message("What's on my clipboard?", "user")
]);

for await (const chunk of stream) {
  if (chunk.event === 'message') {
    console.log('Agent:', chunk.message?.content);
  } else if (chunk.event === 'tool_use') {
    console.log('Tool call:', chunk.tool_call?.name);
  }
}
```

The SDK automatically:

1. Detects `RemoteToolCallBlock` chunks.
2. Finds and runs the matching handler.
3. Sends the result back to the server.
4. Continues streaming or invoking.

If a handler is missing, the SDK creates a failed tool result with the message `Tool '{name}' not found`. The agent sees this and may retry or ask for clarification.

## registerToolHandler(name, handler)

Register a single tool handler.

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | Must exactly match a configured `remote_tools[].name` in `10xgraph.json`. Case-sensitive. |
| `handler` | `(args: any) => Promise<any>` | An async function that executes locally. Receives model-generated arguments and returns a serializable result. |

Example with error handling:

```ts
client.registerToolHandler('fetch_external_data', async ({ url }) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    // Re-throwing here causes the SDK to mark the tool as failed.
    // The error message is sent to the agent.
    throw new Error(`Failed to fetch ${url}: ${(error as Error).message}`);
  }
});
```

The deprecated method `registerTool({ name, handler, ...metadata })` still works but is not recommended for new code. Use `registerToolHandler()` instead.

## Execution behavior

When a response from the server contains one or more `RemoteToolCallBlock` objects, the client:

1. **Finds the handler** by name from your registered handlers.
2. **Executes the handler** with the arguments the model generated.
3. **Wraps the result** in a `ToolResultBlock` (or error block if the handler threw).
4. **Sends it back** in a tool result message.
5. **Continues invoking** until all remote calls are resolved or the recursion limit is reached.

The recursion limit (default 25) applies to each `invoke()` or `stream()` call. Pass a custom limit in options:

```ts
const result = await client.invoke(
  [Message.text_message("...", "user")],
  { recursion_limit: 50 }
);

const stream = client.stream(
  [Message.text_message("...", "user")],
  { recursion_limit: 10 }
);
```

## Errors and missing handlers

If a handler throws an exception or a handler is not registered:

- The exception is caught and logged at the client.
- A failed `ToolResultBlock` is created with `is_error: true` and the error message.
- The result is sent back to the server as a failed tool call.
- The agent sees the failure and can retry, ask for clarification, or continue.

Example:

```ts
// Handler throws
client.registerToolHandler('risky_tool', async () => {
  throw new Error('Something went wrong');
});

// When called, the error is caught and sent to the agent:
// { error: 'Something went wrong', is_error: true, status: 'failed' }
```

Missing handlers produce a similar failure message:

```ts
// No handler registered for 'unregistered_tool'
// Agent receives: { error: "Tool 'unregistered_tool' not found", is_error: true, status: 'failed' }
```

## WebSocket streaming

Both `stream()` (HTTP) and `wsStream()` (WebSocket) automatically handle remote tools. Choose based on your needs:

- **`stream()`**: HTTP streaming with one request per tool-call loop. Simpler; good for low latency and single-tool calls.
- **`wsStream()`**: Single persistent WebSocket for the full lifecycle. Better for multi-turn interactions or frequent tool calls.

Both have identical APIs and tool-handling behavior:

```ts
// Identical code; only the method name differs
const httpStream = client.stream([userMessage]);
const wsStream = client.wsStream([userMessage]);

for await (const chunk of httpStream) {
  // Handle chunk
}
```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Agent never calls the tool | Tool not declared in `remote_tools` or wrong `node` | Add it to `10xgraph.json` with the correct ToolNode name, then restart the API. Run `10xgraph audit` to validate. |
| `Tool 'X' not found` error | Handler not registered or name mismatch | Register the handler with the exact name from `remote_tools[].name` before calling `invoke()` or `stream()`. Names are case-sensitive. |
| API startup fails with validation error | Typo in schema, duplicate tool name, or malformed parameters | Fix the `remote_tools` entry in `10xgraph.json`. Run `10xgraph audit` to identify the error. |
| Handler result fails silently | Result is not JSON-serializable (e.g., contains a Function or circular reference) | Return only JSON-safe data: objects, arrays, strings, numbers, booleans, null. Use `JSON.stringify(result)` to test before returning. |
| WebSocket closes unexpectedly | Network issue, timeout, or server error | Check browser console and server logs for details. The stream error propagates to your catch block or `for await` error handler. Reconnect and retry. |
| Tool is called repeatedly in a loop | Agent's reasoning or parameters trigger a retry loop | Review the tool description and parameters in `10xgraph.json`. Make sure the tool description clearly states its purpose and output format. If the tool should not be retried, ensure your handler returns a clear result. |

## Next steps

- See [create-client](/docs/client/create-client) for auth token options.
- See [stream-responses](/docs/client/stream-responses) for streaming patterns.
- See [graph-utilities](/docs/client/graph-utilities) for stop, fix, and other utilities.
- See [concepts/remote-tools](/docs/concepts/remote-tools) for the underlying design.
