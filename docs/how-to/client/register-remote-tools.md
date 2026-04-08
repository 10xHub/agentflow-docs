---
title: Register remote tools
description: Step-by-step guide to registering browser-side tool handlers that the agent can call during graph execution.
sidebar_position: 7
---

# How to register remote tools

Remote tools let the agent's server-side graph call functions that run in the browser — accessing the clipboard, webcam, local storage, or any other client-only API. This guide shows you how to define, register, and test remote tools end to end.

:::warning Best for browser-level operations
Remote tools are designed for operations that only make sense on the client side (clipboard, camera, DOM, local storage, browser APIs).

If your operation can run on the server (web search, database query, LLM call, file system), implement it as a normal Python tool inside the graph instead. Routing tool calls through the browser adds latency and complexity.
:::

## Prerequisites

- A configured `AgentFlowClient`. See [how-to/client/create-client](create-client.md).
- An AgentFlow Python graph that declares remote tool nodes.
- The API server running with the graph loaded.

---

## Step 1: Understand the flow

1. The Python graph includes a node that is declared as a remote tool executor.
2. When the agent wants to call a remote tool, the server embeds a `RemoteToolCallBlock` in the response.
3. The `client.invoke()` loop detects these blocks, calls your registered handler with the tool arguments, and sends the results back automatically.

---

## Step 2: Define a tool handler

A tool handler is an `async` function that takes the tool arguments and returns any JSON-serialisable value:

```ts
async function getClipboardText(args: {}) {
  // The browser Clipboard API requires user gesture; call this from a click handler
  const text = await navigator.clipboard.readText();
  return { text };
}

async function getBrowserInfo(args: {}) {
  return {
    locale: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  };
}

async function getGeoLocation(args: {}) {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      reject
    );
  });
}
```

---

## Step 3: Register the tools

Call `client.registerTool()` once for each handler before the first `invoke()` or `stream()` call:

```ts
client.registerTool({
  node: 'tools',                  // Must match the graph node name on the server
  name: 'get_clipboard_text',
  description: 'Read the current clipboard text content',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: getClipboardText,
});

client.registerTool({
  node: 'tools',
  name: 'get_browser_info',
  description: 'Get browser locale, language preferences, and platform info',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: getBrowserInfo,
});

client.registerTool({
  node: 'tools',
  name: 'get_geo_location',
  description: 'Get the user\'s current GPS latitude and longitude. Only call if the user has asked location-based questions.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: getGeoLocation,
});
```

### Tools with arguments

If the server needs to pass arguments to your handler, declare them in `parameters`:

```ts
client.registerTool({
  node: 'tools',
  name: 'read_local_storage',
  description: 'Read a value from the browser\'s localStorage by key',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The localStorage key to read',
      },
    },
    required: ['key'],
  },
  handler: async ({ key }: { key: string }) => {
    const value = localStorage.getItem(key);
    return { key, value, found: value !== null };
  },
});
```

---

## Step 4: Send tool definitions to the server

Call `client.setup()` to POST all registered tool definitions to the server:

```ts
const result = await client.setup();
console.log('Registered tools on server:', result.data.registered_tools);
```

You **must** call `setup()` before the first `invoke()` call that might trigger tool use. Calling it again after adding more tools is safe.

---

## Step 5: Invoke — tool calls are automatic

Once tools are registered and set up, `client.invoke()` handles everything automatically:

```ts
import { Message } from '@10xscale/agentflow-client';

const result = await client.invoke([
  Message.text_message('What is in my clipboard and what language is my browser set to?'),
]);

console.log('Answer:', result.messages);
console.log('Iterations:', result.iterations);  // > 1 means tools were called
```

The client:
1. Sends the message to the server.
2. Receives a response with `RemoteToolCallBlock` entries.
3. Calls your registered handlers with the tool arguments.
4. Sends the `ToolResultBlock` results back to the server.
5. Repeats until the agent returns a final non-tool response.

---

## Step 6: Observe tool calls with onPartialResult

Use the `onPartialResult` callback to log or show progress while tools are running:

```ts
const result = await client.invoke(
  [Message.text_message('What city am I in right now?')],
  {
    onPartialResult(partial) {
      if (partial.has_tool_calls) {
        console.log(`Step ${partial.iteration}: running browser tools…`);
      }
      if (partial.is_final) {
        console.log('Tool loop complete');
      }
    },
  }
);
```

---

## Step 7: Handle tool errors

If a handler throws, the client wraps the error in a `ToolResultBlock` with `is_error: true`. The server receives this and can handle the failure gracefully:

```ts
client.registerTool({
  node: 'tools',
  name: 'access_camera',
  description: 'Capture a photo from the webcam',
  parameters: { type: 'object', properties: {}, required: [] },
  handler: async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // ... capture frame ...
    const track = stream.getVideoTracks()[0];
    track.stop();
    return { image_base64: '...' };
    // If getUserMedia throws (permission denied), the client sends is_error: true
  },
});
```

---

## Complete application example

```ts
import {
  AgentFlowClient,
  Message,
} from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
});

// Register all browser tools
client.registerTool({
  node: 'tools',
  name: 'get_browser_info',
  description: 'Get browser locale and language preferences',
  parameters: { type: 'object', properties: {}, required: [] },
  handler: async () => ({
    locale: navigator.language,
    languages: [...navigator.languages],
  }),
});

client.registerTool({
  node: 'tools',
  name: 'get_local_storage_item',
  description: 'Read a value from localStorage',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Storage key to read' }
    },
    required: ['key'],
  },
  handler: async ({ key }: { key: string }) => ({
    value: localStorage.getItem(key),
  }),
});

// Initialise — send definitions to server
await client.setup();

// Now invoke; tools will be called automatically if needed
const result = await client.invoke([
  Message.text_message('Greet me in my preferred language based on my browser settings.'),
]);

const text = result.messages
  .filter(m => m.role === 'assistant')
  .flatMap(m => m.content)
  .filter(b => b.type === 'text')
  .map(b => (b as any).text as string)
  .join('');

console.log(text);
```

---

## Matching client tool names to the Python graph

The `name` and `node` fields in `ToolRegistration` must match what the Python graph expects. Check the server-side graph code to confirm the node name and the tool name it broadcasts to the client.

For example, if the Python graph has:

```python
# graph/react.py — a node named 'tools' that can call remote tools
```

Then your registration must use `node: 'tools'` and the `name` must match what the graph calls.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Tool handler not called | `client.setup()` was not called before `invoke()`. | Always call `setup()` after registering all tools. |
| Tool result ignored by server | Tool `name` does not match what the graph expects. | Check the Python graph node definition for the tool name. |
| `recursion_limit_reached: true` | Tool call loop is not converging. | Check the graph logic — ensure the agent stops calling tools after receiving results. |
| Permission error in handler | Browser permission (clipboard, camera, geolocation) denied. | Handler throws — the client sends `is_error: true`. Handle this in the graph. |
| `AgentFlowError` status `422` on setup | Invalid tool definition format. | Check `parameters` is a valid JSON Schema object with `type: 'object'`. |

---

## What you learned

- `registerTool()` stores a handler locally. `setup()` sends definitions to the server.
- `invoke()` runs the remote tool loop automatically — you do not interact with `RemoteToolCallBlock` directly.
- Use `onPartialResult.has_tool_calls` to observe while tools are running.
- Handler errors are wrapped in `is_error: true` and sent to the server — they do not throw from `invoke()`.
- Always match `node` and `name` to the Python graph's declarations.

## Next step

See [`reference/client/tools`](../../reference/client/tools.md) for the full API reference on `ToolRegistration`, `ToolExecutor`, and the remote tool wire format.
