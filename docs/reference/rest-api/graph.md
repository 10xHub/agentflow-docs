---
title: Graph endpoints — REST API reference
sidebar_label: Graph
description: Reference for the graph invoke, stream, stop and details endpoints.
keywords:
  - rest api reference
  - agent http api
  - agentflow rest endpoints
  - agentflow
  - python ai agent framework
  - rest api — graph
---


# REST API: Graph

These endpoints drive the core graph execution. All requests require a valid `thread_id` in `config` when the server has a checkpointer configured.

Base path: `/v1/graph`

## Route summary

| Method | Path | Permission |
| --- | --- | --- |
| `POST` | `/v1/graph/invoke` | `graph:invoke` |
| `POST` | `/v1/graph/stream` | `graph:stream` |
| `POST` | `/v1/graph/stop` | `graph:stop` |
| `POST` | `/v1/graph/setup` | `graph:setup` |
| `POST` | `/v1/graph/fix` | `graph:fix` |
| `GET` | `/v1/graph` | `graph:read` |
| `GET` | `/v1/graph/tools` | `graph:read` |
| `GET` | `/v1/graph:StateSchema` | `graph:read` |
| `GET` | `/v1/observability/{thread_id}` | `graph:read` |
| `WS` | `/v1/graph/ws` | `graph:stream` |
| `WS` | `/v1/graph/live` | `graph:stream` |

`/v1/observability/{thread_id}` is documented in [Observability](./observability.md) and `WS /v1/graph/live` in [Live WebSocket](./live.md).

---

## POST /v1/graph/invoke

Run the graph and return the complete result when all nodes finish.

**Request body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "config": {
    "thread_id": "my-thread-1"
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `messages` | array | yes | One or more messages to append to state before invoking. Must not be empty. |
| `initial_state` | object | no | Initial state for the run |
| `config` | object | no | Run configuration |
| `config.thread_id` | string | no | Conversation identifier. When absent or blank, the server generates one and persists the thread; the id comes back in `data.meta.thread_id`. |
| `recursion_limit` | integer | no | Maximum graph iterations. Default `25`, range `1`-`100`. |
| `response_granularity` | string | no | `full`, `partial`, or `low`. Default `low`. |

Messages may carry image and document content blocks referencing an uploaded `file_id`. Those references are resolved before the graph runs; see [Multimodal and vision](../../how-to/production/multimodal-and-vision.md).

**Response:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {"role": "user", "content": "What is the capital of France?"},
      {"role": "assistant", "content": "The capital of France is Paris."}
    ]
  }
}
```

---

## POST /v1/graph/stream

Run the graph and stream one JSON-encoded `StreamChunk` per line.

**Request body:** Same as `/v1/graph/invoke`.

**Response:** `Content-Type: text/event-stream`

Despite the content type, the body is **not** SSE-framed. There are no `data:` prefixes and no
blank-line separators. It is newline-delimited JSON, so split the body on newlines rather than
using `EventSource` or an SSE client library.

```
{"event": "message", "message": {"role": "assistant", "content": [{"type": "text", "text": "The capital"}]}, "thread_id": "t1", ...}
{"event": "message", "message": {"role": "assistant", "content": [{"type": "text", "text": " of France is Paris."}]}, "thread_id": "t1", ...}
{"event": "updates", "data": {"status": "done"}, "thread_id": "t1", ...}
```

### StreamChunk fields

| Field | Type | Description |
| --- | --- | --- |
| `event` | `string` | Chunk discriminator. One of `message`, `state`, `updates`, `error`. |
| `message` | `object \| null` | Populated when `event` is `message`. A full `Message` with a `content` block list. |
| `state` | `object \| null` | Populated when `event` is `state`. The current `AgentState`. |
| `data` | `object \| null` | Populated for `updates` (for example `{"status": "done"}`) and `error` (for example `{"reason": "..."}`). |
| `thread_id` | `string \| null` | Thread this chunk belongs to. |
| `run_id` | `string \| null` | Run this chunk belongs to. |
| `metadata` | `object \| null` | Additional per-chunk metadata. |
| `timestamp` | `number` | UNIX timestamp of chunk creation. |

Tool activity arrives as ordinary `message` chunks whose `content` carries `tool_call` and
`tool_result` blocks. There are no separate `tool_call` or `done` event types.

---

## POST /v1/graph/stop

Cancel an in-progress graph execution.

**Request body:**

```json
{
  "thread_id": "my-thread-1",
  "config": {}
}
```

**Response:**

```json
{
  "success": true,
  "data": {"status": "stopped", "thread_id": "my-thread-1"}
}
```

The running graph finishes the current node and then stops. It does not interrupt mid-node.

---

## GET /v1/graph

Get metadata about the loaded graph: its nodes, edges, and an `info` block describing how the server is wired.

**Response:**

```json
{
  "success": true,
  "data": {
    "info": {
      "node_count": 2,
      "edge_count": 3,
      "is_realtime": false,
      "checkpointer": true,
      "checkpointer_type": "PgCheckpointer",
      "publisher": false,
      "store": false,
      "interrupt_before": null,
      "interrupt_after": null,
      "context_type": null,
      "id_generator": "SnowFlakeIdGenerator",
      "id_type": "BIGINT",
      "state_type": "AgentState",
      "state_fields": ["context", "context_summary"]
    },
    "nodes": [
      {"id": "MAIN", "name": "MAIN"},
      {"id": "TOOL", "name": "TOOL"}
    ],
    "edges": [
      {"id": "MAIN-TOOL", "source": "MAIN", "target": "TOOL"}
    ]
  }
}
```

### `info.is_realtime`

`is_realtime` is `true` when the compiled graph is rooted at a live (realtime) agent. Clients use it to decide which socket to open:

| `is_realtime` | Use |
| --- | --- |
| `false` | `POST /v1/graph/invoke`, `POST /v1/graph/stream`, `WS /v1/graph/ws` |
| `true` | `WS /v1/graph/live` |

Connecting to the wrong one is rejected at the handshake with close code `1008`, so read this field once at startup and route accordingly.

---

## GET /v1/graph/tools

List the tools exposed by every `ToolNode` in the graph, grouped by node.

**Response:**

```json
{
  "success": true,
  "data": {
    "node_count": 1,
    "tool_count": 2,
    "nodes": [
      {
        "node_name": "TOOL",
        "tool_count": 2,
        "tools": [
          {
            "name": "get_weather",
            "description": "Look up the current weather for a city.",
            "source": "local",
            "parameters": {"type": "object", "properties": {"city": {"type": "string"}}}
          },
          {
            "name": "search_repos",
            "description": "Search GitHub repositories.",
            "source": "mcp",
            "parameters": {"type": "object", "properties": {"query": {"type": "string"}}}
          }
        ]
      }
    ]
  }
}
```

| Field | Description |
| --- | --- |
| `node_count` | Number of `ToolNode`s in the graph |
| `tool_count` | Total tools across all tool nodes |
| `nodes[].node_name` | Name of the tool node in the graph |
| `nodes[].tools[].source` | `local` (a Python function on the node), `mcp` (from a connected MCP server), or `remote` (a client-side tool registered via `POST /v1/graph/setup`) |
| `nodes[].tools[].parameters` | JSON Schema for the tool's parameters, in OpenAI function-calling shape |

Tool collection is best-effort per node: an MCP server that fails to respond is logged and its node contributes no tools, rather than failing the whole request.

---

## POST /v1/graph/setup

Register client-side (remote) tools with a tool node for the current process. The model then sees these tools and emits calls for them; your client executes them and resumes the run with the result.

**Request body:**

```json
{
  "tools": [
    {
      "node_name": "TOOL",
      "name": "get_user_location",
      "description": "Read the browser's geolocation.",
      "parameters": {"type": "object", "properties": {}}
    }
  ]
}
```

:::warning Development only
This endpoint returns `403 Dynamic tool setup is disabled in production/multi-tenant mode` when `MODE=production` **or** when any auth backend is configured. Registration mutates process-wide graph state, so it is unsafe to expose to multiple tenants.
:::

---

## POST /v1/graph/fix

Repair a thread whose state contains messages with tool calls that have empty content, which is what an interrupted or failed tool execution leaves behind. Those messages are removed from the state.

**Request body:**

```json
{
  "thread_id": "my-thread-1",
  "config": {}
}
```

`thread_id` is required and must not be blank.

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Removed 1 message with empty tool calls",
    "removed_count": 1,
    "state": {}
  }
}
```

---

## WS /v1/graph/ws

Turn-based streaming over a WebSocket. Same payloads as `POST /v1/graph/stream`, but the connection stays open across runs, which is what makes client-side tool execution possible without a second HTTP request.

**Authentication.** Bearer token via the `Authorization` header, the `agentflow-bearer` `Sec-WebSocket-Protocol` (preferred for browsers), or the `?token=` query fallback. Identical to the [live socket](./live.md#authentication).

**Fresh run.** Client sends:

```json
{
  "invoke_type": "fresh",
  "messages": [{"role": "user", "content": "What is the weather in Paris?"}],
  "config": {"thread_id": "my-thread-1"}
}
```

`messages` must be non-empty. `config.thread_id` is optional; omit it to start a new thread.

**Resume after a remote tool call.** When the stream contains a remote tool call, the client executes the tool and sends:

```json
{
  "invoke_type": "resume",
  "tool_result": [{"role": "tool", "content": "24 degrees and sunny"}],
  "config": {"thread_id": "my-thread-1"}
}
```

`tool_result` must be non-empty and `config.thread_id` is required, so the server can resume the right checkpoint.

Both frames also accept `initial_state`, `recursion_limit`, and `response_granularity` with the same meaning as `POST /v1/graph/invoke`.

**Server frames.** The server sends `StreamChunk` JSON messages, identical to the HTTP stream, followed by a terminator:

```json
{"event": "updates", "data": {"status": "done"}}
```

The server does not inspect chunks for tool calls; detecting a remote tool call is the client's job. `invoke_type` is used only for validation and logging.

**Close codes.**

| Code | Meaning |
| --- | --- |
| `1000` | Normal closure |
| `1008` | Auth or authorization rejected, or the graph is a live agent (use `/v1/graph/live`) |
| `1011` | Unexpected server error |
| `1013` | Rate limit or `websocket.max_connections` exceeded |

Recoverable problems (an invalid frame, an unauthorized `thread_id`) are sent as an `error` `StreamChunk` and the connection stays open for the next request.

---

## GET /v1/graph:StateSchema

Get the JSON schema for the graph's state class.

**Response:**

```json
{
  "success": true,
  "data": {
    "type": "object",
    "properties": {
      "context": {"type": "array"},
      "user_id": {"type": "string"}
    }
  }
}
```

---

## Authentication

When auth is configured, all endpoints require an `Authorization` header:

```
Authorization: Bearer <token>
```

See [Authentication](../api-cli/auth.md) for configuration details.
