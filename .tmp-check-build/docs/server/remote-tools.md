# Remote tools

> Configure client-executed tools on the server: define them in 10xgraph.json, attach them to graph nodes, and let clients run them.

Source: https://10xgraph.com/docs/server/remote-tools
Last updated: 2026-10-08

Remote tools are trusted tool schemas configured on the server that the model can call but the client executes. This page covers server-side setup: how to declare remote tools in 10xgraph.json, attach them to graph nodes, and verify they are available when the model runs.

## Why remote tools

A remote tool runs client-side code, browser APIs, local databases, user-specific resources, that the server must not execute. The model calls them by name as if they were server tools; the framework routes the call to the client, the client runs the handler, and returns the result to the graph.

Use remote tools when your task needs:

- Browser capabilities (geolocation, clipboard, localStorage, DOM)
- Desktop APIs (native file dialogs, system notifications)
- Client-side only state or secrets (API keys the user owns, not the server)
- Integration with the client's framework or app state

Do not use remote tools for logic that belongs on the server: business data fetching, authentication, rate limiting, or audit logging. Keep server-critical operations server-side.

## Declaring remote tools in 10xgraph.json

Remote tools are defined in the `remote_tools` array at the root of 10xgraph.json. Each tool has a node name (the graph node that may invoke it), a name, a description, and parameter schemas in JSON Schema format.

```json title="10xgraph.json"
{
  "agent": "graph:app",
  "remote_tools": [
    {
      "node": "agent_node",
      "name": "get_user_location",
      "description": "Get the user's current location using the browser geolocation API.",
      "parameters": {
        "type": "object",
        "properties": {
          "timeout_ms": {
            "type": "number",
            "description": "Maximum time to wait for location in milliseconds."
          }
        },
        "required": []
      }
    },
    {
      "node": "agent_node",
      "name": "read_clipboard",
      "description": "Read text from the user's clipboard.",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  ]
}
```

### Field reference

- **`node`** (string, required): The name of the graph node where the model may call this tool. Typically the node running your agent (e.g., "agent_node", "react_agent"). The framework attaches the tool schemas only to this node.

- **`name`** (string, required): The tool's name, as the model will call it. Must not be blank and must not match a server-side tool name. Model invokes it as `tool_name`, not `node_name:tool_name`.

- **`description`** (string, required): What the tool does. The model reads this to decide whether to use the tool. Be specific: "reads user's clipboard" not just "clipboard". Minimum 1 character; blank values are rejected.

- **`parameters`** (object, optional): JSON Schema for the tool's inputs. Defaults to `{"type": "object", "properties": {}, "required": []}` (a tool that takes no arguments). The schema must be an object type; array or scalar parameters are not supported. The `properties` object maps parameter names to JSON Schema type descriptors. The `required` array lists required parameter names.

  ```json
  "parameters": {
    "type": "object",
    "properties": {
      "min_accuracy": {
        "type": "number",
        "description": "Minimum accuracy in meters"
      },
      "high_accuracy": {
        "type": "boolean",
        "description": "Request high-accuracy location"
      }
    },
    "required": ["high_accuracy"]
  }
  ```

## How remote tools reach the graph

When the server starts, it reads `remote_tools` from 10xgraph.json, validates each one, groups them by node name, and calls `CompiledGraph.attach_remote_tools(schemas, node_name)` for each group. This injects the tool schemas into the graph node's context so the model sees them.

At runtime, when a request arrives:

1. The server loads the graph and its attached remote tools.
2. The model runs. If it decides to invoke a remote tool, it emits a tool call with the tool name and arguments.
3. The server's ToolNode sees the call targets a remote tool (not a server tool).
4. The server sends the tool call to the client via the response stream (for HTTP) or WebSocket message.
5. The client's ToolExecutor looks up the registered handler by tool name, runs it with the arguments, and returns the result.
6. The server feeds the result back into the graph as a tool output message.

This flow is automatic; you do not write any plumbing code. The framework handles routing and sequencing.

## Setting up the client

The client must register a handler for every remote tool you define on the server. This is done at request time, before streaming or invoking.

For the TypeScript client (using the `@10xgraph/client` package):

```typescript
import { AgentFlowClient } from '@10xgraph/client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
});

// Register handlers for remote tools defined in 10xgraph.json
client.registerToolHandler('get_user_location', async (args) => {
  const timeout = args.timeout_ms || 10000;
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Timeout')), timeout);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(id);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        clearTimeout(id);
        reject(new Error(`Geolocation error: ${error.message}`));
      }
    );
  });
});

client.registerToolHandler('read_clipboard', async () => {
  const text = await navigator.clipboard.readText();
  return { text };
});

// Now stream or invoke. The client will run registered tools when the model calls them.
const stream = client.stream({
  threadId: 'thread-123',
  messages: [{ role: 'user', content: 'Where am I?' }],
});

for await (const chunk of stream) {
  // Process streaming response
}
```

If a remote tool is not registered, the ToolExecutor will raise an error, which the server returns to the graph as a tool failure. The model can handle it or retry.

For Python clients or direct HTTP/WebSocket calls, the client framework (or your code) is responsible for routing tool calls to the appropriate handler. The server always sends remote tool calls in the stream; you must listen for them and respond.

## Validation and constraints

The server validates remote tool configurations at startup. Configuration errors will prevent the server from starting:

- Tool names must be non-empty strings.
- Tool descriptions must be non-empty strings.
- Node names must be non-empty strings and must exist in the compiled graph.
- Tool names must not duplicate server-side tool names in the same node.
- Remote tool names in 10xgraph.json must be unique (no duplicate names across different nodes). This prevents ambiguity in tool call routing.
- Parameter schemas must be objects (type: "object"); scalar or array top-level parameters are rejected.
- Parameter `properties` and `required` must be valid JSON Schema.

If validation fails, the server logs the error and exits with a failure code. Check `10xgraph api` output for validation messages.

## Examples

### Minimal example: geolocation

Server (10xgraph.json):

```json
{
  "agent": "graph:app",
  "remote_tools": [
    {
      "node": "agent_node",
      "name": "get_location",
      "description": "Get the user's current GPS location."
    }
  ]
}
```

Client (TypeScript):

```typescript
client.registerToolHandler('get_location', async () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }),
      (err) => reject(err),
      { timeout: 5000 }
    );
  });
});

const result = await client.invoke({
  messages: [{ role: 'user', content: 'Tell me where I am.' }],
});
```

The model will call `get_location`, the client will return the coordinates, and the model will read them and respond to the user.

### Example with parameters

Server (10xgraph.json):

```json
{
  "agent": "graph:app",
  "remote_tools": [
    {
      "node": "agent_node",
      "name": "search_local_database",
      "description": "Search the user's local SQLite database.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "SQL SELECT query to run."
          },
          "max_rows": {
            "type": "number",
            "description": "Maximum rows to return."
          }
        },
        "required": ["query"]
      }
    }
  ]
}
```

Client (TypeScript):

```typescript
client.registerToolHandler('search_local_database', async (args) => {
  const { query, max_rows = 100 } = args as {
    query: string;
    max_rows?: number;
  };

  // In a real app, use a SQLite library for the browser, e.g., sql.js
  try {
    const results = await myLocalDB.query(query, { limit: max_rows });
    return { rows: results };
  } catch (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
});
```

The model will pass the SQL query from the user's request, the client will run it, and return results. The model can then interpret them and respond.

## Troubleshooting

**Server won't start, error mentions "remote_tools"**

Check that:
- `remote_tools` is an array (not an object).
- Each tool has non-empty `node`, `name`, and `description` strings.
- The `node` name matches a node in your compiled graph. Run `10xgraph graph` to see node names.
- `parameters` (if present) is an object with type "object", `properties`, and `required` keys.

**Model doesn't call the remote tool**

- Confirm the tool was attached: run `10xgraph graph` and check the node's tools list.
- Check your graph's system prompt or routing logic. The model will only call tools you prompt it to use.
- In a React node, explicitly list remote tools in your prompt or routing logic.
- Check server logs for "Attached X configured remote tools" to confirm attachment succeeded.

**Client error: "Tool not registered"**

- Ensure you called `client.registerToolHandler(name, handler)` for every remote tool before calling `stream()` or `invoke()`.
- Verify the handler name matches exactly (case-sensitive).
- Check the ToolExecutor logs on the client side for which tool was missing.

**Tool runs but returns wrong result**

- Add logging inside your handler to debug input and output.
- Use browser DevTools (Network tab) to inspect the request and response.
- On the server, check that the result from the client was properly returned to the graph.

## Related pages

- [Concepts: Remote tools](/docs/concepts/remote-tools): the conceptual model and use cases.
- [Client: Remote tools](/docs/client/remote-tools): how the TypeScript client executes them.
- [Guide: Send media](/docs/guides/send-media): if your remote tools transfer files or media.
- [Reference: Configuration](/docs/reference/api-cli/configuration): full 10xgraph.json schema.

## Frequently asked questions

### Can a client call a tool that isn't registered as a remote tool?

No. The server only presents remote tools from 10xgraph.json to the model. If ag_ui.allow_client_tools is true, AG-UI clients can bring their own tools for that run, but plain REST/WebSocket callers cannot. See the AG-UI documentation for per-run client tools.

### What if the model calls a remote tool that the client hasn't registered?

The client's ToolExecutor will raise a 'Tool not registered' error, which the server catches and returns to the graph as a tool error. The model can then retry or handle the failure.

### Are remote tools secure for untrusted clients?

Remote tools are never exposed to untrusted clients. They are defined server-side, attached to the graph before startup, and only callable if the model's prompt or system instructions route the model toward them. Always validate tool inputs in the client handler.
