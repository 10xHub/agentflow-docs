---
title: Tools
description: Reference for registering and using remote (browser-side) tools with AgentFlowClient.
sidebar_position: 9
---

# Tools

AgentFlow supports **remote tools** — functions that are defined and executed in the browser (or any client environment) while the server-side agent graph coordinates the calls. The server asks the client to run a tool by embedding `RemoteToolCallBlock` entries in its response. The client detects these, executes the corresponding handler, and sends the results back.

:::note Best for browser-level operations
Remote tools are primarily designed for operations that only make sense on the client: accessing the user's camera, reading local files, interacting with the DOM, calling a browser-only API, or running lightweight compute without a round-trip to a separate backend.

For operations that can run on the server (LLM tool calls, web search, database queries), use the Python graph's built-in toolset instead.
:::

**Source:** `src/tools.ts`, `src/endpoints/setupGraph.ts`

---

## Import

```ts
import {
  AgentFlowClient,
  ToolRegistration,
  ToolDefinition,
  ToolParameter,
  Tool,
  ToolExecutor,
} from '@10xscale/agentflow-client';
```

---

## Workflow

1. Define tool handlers in the client.
2. Call `client.registerTool()` for each one before the first `invoke()` or `stream()` call.
3. Call `client.setup()` to send all tool definitions to the server.
4. Call `client.invoke()` or `client.stream()` — tool execution is handled automatically inside the loop.

---

## `registerTool(registration)`

Register a tool handler with the client. This stores the handler locally; it does not yet inform the server.

```ts
client.registerTool({
  node: 'tools',           // The graph node that can call this tool
  name: 'get_weather',
  description: 'Get the current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'Name of the city',
      },
    },
    required: ['city'],
  },
  handler: async ({ city }) => {
    // Execute locally — could call a browser API, local storage, etc.
    const response = await fetch(`https://wttr.in/${city}?format=j1`);
    const data = await response.json();
    return { temperature: data.current_condition[0].temp_C };
  },
});
```

### `ToolRegistration`

```ts
interface ToolRegistration {
  node: string;             // Name of the graph node that owns this tool
  name: string;             // Tool name — must match what the graph calls
  description?: string;     // Human-readable description (sent to the server)
  parameters?: ToolParameter; // JSON Schema for the tool's input arguments
  handler: ToolHandler;     // async function that executes the tool
}
```

### `ToolParameter`

```ts
interface ToolParameter {
  type: string;                          // Always 'object'
  properties: Record<string, any>;       // JSON Schema properties
  required: string[];                    // List of required property names
}
```

### `ToolHandler`

```ts
type ToolHandler = (args: any) => Promise<any>;
```

The `args` object matches the shape declared in `parameters.properties`. The return value can be any JSON-serialisable value. It is wrapped in a `ToolResultBlock` and sent back to the server.

---

## `setup()`

Send all registered tool definitions to the server so the graph knows which remote tools are available and what parameters they accept.

```ts
await client.setup();
```

`setup()` posts to `/v1/graph/setup` with the list of `RemoteTool` objects derived from your registrations. You **must** call this before the first `invoke()` or `stream()` call that uses tools. Calling it again after adding more tools is safe — the server replaces the previous registration.

### `SetupGraphResponse`

```ts
interface SetupGraphResponse {
  data: {
    success: boolean;
    message: string;
    registered_tools?: number;  // Number of tools registered on the server
  };
  metadata: ResponseMetadata;
}
```

### `RemoteTool` (internal)

This is the wire format sent to the server. You do not construct this manually — `client.setup()` creates it from your `ToolRegistration` objects.

```ts
interface RemoteTool {
  node_name: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
}
```

---

## How the remote tool loop works inside `invoke()`

When you call `client.invoke()` after registering tools and calling `setup()`, the client runs this loop automatically:

1. **Send:** POST to `/v1/graph/invoke` with the current messages.
2. **Check:** If the response contains any `RemoteToolCallBlock` entries, extract them.
3. **Execute:** For each `RemoteToolCallBlock`, look up the registered `ToolHandler` by `name` and call it with `block.args`.
4. **Wrap result:** Create a `ToolResultBlock` with `call_id = block.id`, `output = handler result`, `status = 'completed'`.
5. **Send tool results:** POST to `/v1/graph/invoke` again with a `tool` role message containing the `ToolResultBlock` entries.
6. **Repeat** until no more `RemoteToolCallBlock` entries appear, or `recursion_limit` is reached.

You never have to write this loop yourself when using `client.invoke()`. It is handled transparently.

For `client.stream()`, the SDK also checks streamed messages for remote tool calls after each streamed graph iteration. It yields chunks to your UI as they arrive, executes registered remote tool handlers when needed, sends tool results back, and continues until no remote tool calls remain or `recursion_limit` is reached.

---

## Complete example

```ts
import { AgentFlowClient, Message, StreamEventType } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

// 1. Register tools
client.registerTool({
  node: 'tools',
  name: 'read_clipboard',
  description: 'Read the current system clipboard content',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async () => {
    return { text: await navigator.clipboard.readText() };
  },
});

client.registerTool({
  node: 'tools',
  name: 'get_browser_locale',
  description: 'Get the browser locale and preferred language',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async () => ({
    locale: navigator.language,
    languages: navigator.languages,
  }),
});

// 2. Send tool definitions to the server
await client.setup();

// 3. Invoke — tool calls are handled automatically
const result = await client.invoke([
  Message.text_message('What is in my clipboard and what is my preferred language?'),
]);

console.log(result.messages);
console.log('Iterations:', result.iterations);       // Will be > 1 if tools were called
```

---

## `ToolExecutor` (advanced)

The `ToolExecutor` class manages the internal tool registry. You do not normally use it directly, but it is exported if you need to build custom tool management outside of `AgentFlowClient`.

```ts
class ToolExecutor {
  constructor(tools?: ToolDefinition[]);

  registerTool(registration: ToolRegistration): void;

  getToolsForNode(node: string): ToolDefinition[];

  all_tools(): Tool[];

  async executeToolCalls(messages: Message[]): Promise<Message[]>;
}
```

### `executeToolCalls(messages)`

Scans `messages` for `RemoteToolCallBlock` entries, executes the corresponding handlers, and returns an array of `tool` role messages containing `ToolResultBlock` results.

This is the method `invoke()` calls internally after each server response.

---

## Tool definitions in OpenAI format

`toolExecutor.all_tools()` returns tools in the OpenAI-compatible `Function Calling` format. This is what gets serialised when you call `client.setup()`:

```ts
interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameter;
  };
}
```

---

## Error handling in tool handlers

If your handler throws, the client wraps the error in a `ToolResultBlock` with `is_error: true` and `status: 'failed'`. The server receives this and can handle the error gracefully (e.g. tell the user the tool call failed).

```ts
client.registerTool({
  node: 'tools',
  name: 'risky_operation',
  description: 'Might fail',
  parameters: { type: 'object', properties: {}, required: [] },
  handler: async () => {
    // Throwing is ok — the client catches it and sends is_error: true
    throw new Error('Something went wrong');
  },
});
```

---

## Registering tools by node

The `node` field links a tool to a specific graph node. This is important when the graph has multiple nodes that each call different tool sets. The server can use it to route tool calls to the right handler.

```ts
client.registerTool({ node: 'search_agent', name: 'web_search', ... });
client.registerTool({ node: 'code_agent', name: 'run_code', ... });
```

When `invoke()` receives a `RemoteToolCallBlock`, the `ToolExecutor` first looks by name alone. If multiple tools share a name across nodes, the one registered last wins.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Tool not executed | `client.setup()` was not called before `invoke()`. | Always call `setup()` after registering tools and before the first invoke. |
| `AgentFlowError` status `422` on setup | Invalid tool definition (missing `name`, bad `parameters` schema). | Check that `parameters` is a valid JSON Schema object with `type: 'object'`. |
| Tool called with wrong args | Parameter schema does not match what the graph produces. | Verify the `parameters` schema matches the Python tool definition on the server. |
| `recursion_limit_reached: true` | Tool handler keeps returning values that cause another tool call. | Check for logic loops in your graph's tool-calling conditions. |

---

## What you learned

- `registerTool()` stores a handler locally; `setup()` sends definitions to the server.
- `invoke()` runs the tool call loop automatically — you do not need to handle `RemoteToolCallBlock` yourself.
- Remote tools are best for browser-level operations (clipboard, camera, local storage, DOM interactions).
- Use `is_error: true` (thrown errors) to signal failure to the server.

## Next step

For a step-by-step guide on wiring tools end-to-end, see [how-to/client/register-remote-tools](../../how-to/client/register-remote-tools.md).
