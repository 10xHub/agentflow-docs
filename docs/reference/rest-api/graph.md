---
title: REST API — Graph
description: Reference for the graph invoke, stream, stop and details endpoints.
---

# REST API: Graph

These endpoints drive the core graph execution. All requests require a valid `thread_id` in `config` when the server has a checkpointer configured.

Base path: `/v1/graph`

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
| `messages` | array | yes | One or more messages to append to state before invoking |
| `config.thread_id` | string | yes (with checkpointer) | Conversation identifier |

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

Run the graph and stream output as server-sent events (SSE).

**Request body:** Same as `/v1/graph/invoke`.

**Response:** `Content-Type: text/event-stream`

Each event is a JSON-encoded `StreamChunk`:

```
data: {"type": "message_chunk", "content": "The capital"}
data: {"type": "message_chunk", "content": " of France is Paris."}
data: {"type": "done"}
```

### StreamChunk types

| `type` | Description |
| --- | --- |
| `message_chunk` | Partial text content |
| `message_start` | New message starting |
| `message_end` | Current message complete |
| `tool_call` | Model requested a tool call |
| `tool_result` | Tool execution result |
| `done` | Graph execution complete |

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

Get metadata about the loaded graph (node names, edges, state schema summary).

**Response:**

```json
{
  "success": true,
  "data": {
    "nodes": ["MAIN", "TOOL"],
    "entry_point": "MAIN",
    "edges": [["TOOL", "MAIN"]]
  }
}
```

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
