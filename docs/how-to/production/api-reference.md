---
title: API Reference — AgentFlow Python AI Agent Framework
sidebar_label: API Reference
description: Complete REST and WebSocket API reference for the AgentFlow server. Covers all endpoints, request/response schemas, authentication, and error codes.
keywords:
  - agentflow api reference
  - agentflow rest api
  - agentflow websocket
  - agentflow endpoints
  - python ai agent framework
---

# API reference

This is the complete reference for every endpoint exposed by the AgentFlow server. All endpoints return JSON by default (using ORJSON for performance). The interactive Swagger UI at `/docs` reflects the live server and can be used for manual testing.

## Conventions

### Base URL

All API routes (except `/ping`) are prefixed with `/v1/`.

### Response envelope

Every successful endpoint wraps its payload in a uniform envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message",
  "timestamp": "2026-05-23T10:00:00Z"
}
```

Errors (4xx / 5xx) return FastAPI's standard detail format:

```json
{
  "detail": "Not authorized to invoke graph"
}
```

### Authentication

When auth is configured in `agentflow.json`, all endpoints except `/ping` require a Bearer token:

```
Authorization: Bearer <token>
```

WebSocket connections that cannot set an `Authorization` header have two options, in order of preference:

```javascript
// Preferred for browsers: the token rides in a request header, not the URL
new WebSocket("ws://host/v1/graph/ws", ["agentflow-bearer", token]);
```

```
# Last-resort fallback: the token lands in URLs and access logs
/v1/graph/ws?token=<token>
```

The server echoes the `agentflow-bearer` sentinel back on `accept()`, which browsers require to complete the handshake.

If auth is not configured (`"auth": null`), credentials are not required and the auth layer is skipped entirely.

Authentication failures return HTTP `403` with an `error.code` such as `REVOKED_TOKEN` or `EXPIRED_TOKEN`, not `401`. On WebSocket routes the same failures become close code `1008`.

### Permission model

Each endpoint requires a specific `(resource, action)` pair. The table below lists them. When an `AuthorizationBackend` is configured, the `authorize(user, resource, action)` method is called. The built-in `DefaultAuthorizationBackend` allows all requests as long as `user_id` is present.

---

## Health

### `GET /ping`

No authentication. Returns a pong response. Use as a load-balancer or monitoring health check.

**Response**

```json
{
  "success": true,
  "data": "pong"
}
```

**cURL**

```bash
curl http://127.0.0.1:8000/ping
```

---

## Graph

All graph endpoints require the `graph` resource. The graph is loaded at startup from the `agent` field in `agentflow.json`.

### `POST /v1/graph/invoke`

Execute the graph with a list of messages and return the final result synchronously.

**Permission:** `graph:invoke`

**Request body**

```json
{
  "messages": [
    {"role": "user", "content": "What is the weather in London?"}
  ],
  "config": {
    "thread_id": "thread-abc123"
  },
  "initial_state": null,
  "recursion_limit": 25,
  "response_granularity": "low"
}
```

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `messages` | `Message[]` | Yes | — | At least one message. The last message is the input to the graph. |
| `config` | `object` | No | `null` | Forwarded to the graph as run config. Include `thread_id` to resume a thread. |
| `initial_state` | `object` | No | `null` | Override the initial graph state before the run. |
| `recursion_limit` | `int` | No | `25` | Max number of graph iterations (1–100). Increase for complex multi-step tasks. |
| `response_granularity` | `string` | No | `"low"` | How much of the graph state to include in the response. Values: `"low"`, `"partial"`, `"full"`. |

**Response data**

```json
{
  "messages": [
    {"role": "user", "content": "What is the weather in London?"},
    {"role": "assistant", "content": "The weather in London is 15°C and cloudy."}
  ],
  "state": null,
  "context": null,
  "summary": null,
  "meta": null
}
```

| Field | Type | Description |
| --- | --- | --- |
| `messages` | `Message[]` | Full conversation history after the run. |
| `state` | `object \| null` | Graph state snapshot (populated when `response_granularity` is `"full"`). |
| `context` | `Message[] \| null` | Context messages used by the graph. |
| `summary` | `string \| null` | Conversation summary if the graph produces one. |
| `meta` | `object \| null` | Additional metadata from the graph run. |

---

### `POST /v1/graph/stream`

Execute the graph with streaming output. Returns a Server-Sent Events (SSE) stream.

**Permission:** `graph:stream`

**Request body:** Same as `POST /v1/graph/invoke`.

**Response:** `Content-Type: text/event-stream`

Each event is a JSON-encoded `StreamChunk`:

```json
{"event": "updates", "data": {"messages": [...], "node": "agent"}}
```

`StreamChunk` events:

| Event | When |
| --- | --- |
| `updates` | A graph node has produced new output |
| `error` | A recoverable error occurred mid-stream |
| `done` | Stream has finished (final chunk) |

**SSE headers set by the server:**

```
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
Content-Encoding: identity
```

The `X-Accel-Buffering: no` header disables nginx buffering for true real-time delivery.

---

### `WebSocket /v1/graph/ws`

Bidirectional WebSocket for streaming graph execution. Supports fresh runs and resuming after remote tool calls.

**Permission:** `graph:stream`

**Authentication:** Pass the Bearer token as the `Authorization` header during the WebSocket upgrade, or as `?token=<value>` in the URL.

**Client → Server messages (JSON)**

```json
{
  "invoke_type": "fresh",
  "messages": [{"role": "user", "content": "Hello"}],
  "config": {"thread_id": "abc"},
  "initial_state": null,
  "recursion_limit": 25,
  "response_granularity": "low"
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `invoke_type` | `"fresh" \| "resume"` | `"fresh"` | `"fresh"` starts a new run; `"resume"` continues after a remote tool call. |
| `messages` | `Message[]` | `[]` | Required and non-empty for `fresh` runs. |
| `tool_result` | `Message[] \| null` | `null` | Required for `resume` runs — the tool-result messages to inject. |
| `config` | `object \| null` | `null` | Must include `thread_id` for `resume` runs. |
| `initial_state` | `object \| null` | `null` | Initial state override. |
| `recursion_limit` | `int` | `25` | Max iterations (1–100). |
| `response_granularity` | `string` | `"low"` | Response detail level. |

**Server → Client messages**

The server sends `StreamChunk` JSON messages identical to the SSE stream, followed by a final done chunk:

```json
{"event": "updates", "data": {"status": "done"}}
```

**Close codes:**

| Code | Meaning |
| --- | --- |
| `1000` | Normal closure — client disconnected cleanly |
| `1011` | Server error — unexpected exception |

**Resume flow (remote tool calls):**

1. Client receives a `StreamChunk` with `event: "remote_tool_call"` mid-stream.
2. Client executes the tool locally.
3. Client sends a `resume` message with `tool_result` containing the tool outputs and `config.thread_id` matching the original thread.
4. Server resumes the graph from the checkpoint and continues streaming.

---

### `GET /v1/graph`

Return the graph structure and metadata (nodes, edges, capabilities).

**Permission:** `graph:read`

**Response data**

```json
{
  "info": {
    "node_count": 3,
    "edge_count": 4,
    "is_realtime": false,
    "checkpointer": true,
    "checkpointer_type": "PgCheckpointer",
    "publisher": false,
    "store": false,
    "interrupt_before": null,
    "interrupt_after": null,
    "context_type": null,
    "id_generator": "snowflake",
    "id_type": "int",
    "state_type": "AgentState",
    "state_fields": ["messages", "context", "summary"]
  },
  "nodes": [
    {"id": "agent", "name": "agent"},
    {"id": "tools", "name": "tools"},
    {"id": "__end__", "name": "__end__"}
  ],
  "edges": [
    {"id": "e1", "source": "agent", "target": "tools"},
    {"id": "e2", "source": "tools", "target": "agent"}
  ]
}
```

`is_realtime` tells the client which socket to open: `false` means `/v1/graph/ws`, `true` means `/v1/graph/live`. Connecting to the wrong one is rejected at the handshake with close code `1008`.

---

### `GET /v1/graph/tools`

List the tools exposed by every `ToolNode` in the graph, grouped by node.

**Permission:** `graph:read`

**Response data**

```json
{
  "node_count": 1,
  "tool_count": 2,
  "nodes": [
    {
      "node_name": "tools",
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
```

`source` is `local` (a Python function on the node), `mcp` (from a connected MCP server), or `remote` (registered by a client through `POST /v1/graph/setup`). Tool collection is best-effort per node: an MCP server that fails to respond is logged and contributes no tools rather than failing the request.

---

### `WebSocket /v1/graph/live`

Realtime audio bridge for a graph rooted at a live agent. Binary PCM16 frames upstream and downstream, JSON control and event frames alongside them.

**Permission:** `graph:stream`

Only available when `info.is_realtime` is `true`. A turn-based graph is rejected with an `error` event carrying `code: "not_live"` and close code `1008`.

Full protocol, init frame fields, event catalogue, and close codes: [Live WebSocket](/docs/reference/rest-api/live).

---

### `GET /v1/observability/{thread_id}`

Reconstruct a run trace for a thread: span tree, event list, aggregated token usage, and call counts.

**Permission:** `graph:read`

**Query parameters:** `run_id` (optional) selects a specific run instead of the latest.

The trace comes from an in-process telemetry store that is bound **only outside production**. With `MODE=production` the endpoint returns an empty payload (`run_count: 0`, `run: null`) rather than an error. Use OpenTelemetry or the `observability` block for production tracing.

Full response schema: [Observability](/docs/reference/rest-api/observability).

---

### `GET /v1/graph:StateSchema`

Return the state schema of the graph as a JSON object.

**Permission:** `graph:read`

**Response data:** A JSON object describing the graph's state fields and their types.

---

### `POST /v1/graph/stop`

Stop a running graph execution for a specific thread. Useful when a graph is in a long-running loop.

**Permission:** `graph:stop`

**Request body**

```json
{
  "thread_id": "thread-abc123",
  "config": null
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `thread_id` | `string` | Yes | Non-empty thread ID to stop. |
| `config` | `object \| null` | No | Optional additional config forwarded to the stop operation. |

---

### `POST /v1/graph/setup`

Register remote tools with the graph. Used by the TypeScript client to inform the graph server which client-side tools are available before starting a run.

**Permission:** `graph:setup`

**Request body**

```json
{
  "tools": [
    {
      "node_name": "client_tools",
      "name": "get_location",
      "description": "Get the user's current geolocation",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  ]
}
```

---

### `POST /v1/graph/fix`

Remove messages with empty tool-call content from a thread's state. Useful for recovering from interrupted or failed tool executions.

**Permission:** `graph:fix`

**Request body**

```json
{
  "thread_id": "thread-abc123",
  "config": null
}
```

**Response data**

```json
{
  "success": true,
  "message": "Removed 2 messages with empty tool calls",
  "removed_count": 2,
  "state": { ... }
}
```

---

## Threads

Thread endpoints require a checkpointer to be configured. Without a checkpointer these endpoints return errors.

### `GET /v1/threads/{thread_id}/state`

Get the current state snapshot for a thread.

**Permission:** `checkpointer:read`

**Path params:** `thread_id` (string or integer, non-empty)

**Response data**

```json
{
  "state": {
    "messages": [...],
    "context": null
  }
}
```

---

### `PUT /v1/threads/{thread_id}/state`

Overwrite the state for a thread.

**Permission:** `checkpointer:write`

**Request body**

```json
{
  "state": {
    "messages": [...],
    "context": null
  },
  "config": null
}
```

---

### `DELETE /v1/threads/{thread_id}/state`

Clear the state for a thread (removes the checkpoint).

**Permission:** `checkpointer:delete`

---

### `GET /v1/threads/{thread_id}/messages`

List messages for a thread, with optional search and pagination.

**Permission:** `checkpointer:read`

**Query params**

| Param | Type | Description |
| --- | --- | --- |
| `search` | `string` | Optional text search filter. |
| `offset` | `int` | Number of messages to skip (must be ≥ 0). |
| `limit` | `int` | Max messages to return (must be > 0). |

**Response data**

```json
{
  "messages": [
    {"role": "user", "content": "Hello", "id": "msg-1"},
    {"role": "assistant", "content": "Hi there!", "id": "msg-2"}
  ]
}
```

---

### `GET /v1/threads/{thread_id}/messages/{message_id}`

Get a single message by ID.

**Permission:** `checkpointer:read`

---

### `POST /v1/threads/{thread_id}/messages`

Append messages to a thread's history.

**Permission:** `checkpointer:write`

**Request body**

```json
{
  "messages": [
    {"role": "user", "content": "Follow-up message"}
  ],
  "metadata": null,
  "config": null
}
```

---

### `DELETE /v1/threads/{thread_id}/messages/{message_id}`

Delete a specific message from a thread.

**Permission:** `checkpointer:delete`

**Request body**

```json
{
  "config": null
}
```

---

### `GET /v1/threads`

List all threads, with optional search and pagination.

**Permission:** `checkpointer:read`

**Query params**

| Param | Type | Description |
| --- | --- | --- |
| `search` | `string` | Optional text search filter applied to thread metadata. |
| `offset` | `int` | Number of threads to skip. |
| `limit` | `int` | Max threads to return. |

**Response data**

```json
{
  "threads": [
    {"thread_id": "abc", "name": "thoughtful-dialogue", "created_at": "..."},
    {"thread_id": "def", "name": "my-thread", "created_at": "..."}
  ]
}
```

---

### `GET /v1/threads/{thread_id}`

Get metadata for a single thread.

**Permission:** `checkpointer:read`

**Response data**

```json
{
  "thread_data": {
    "thread_id": "abc",
    "name": "thoughtful-dialogue",
    "created_at": "..."
  }
}
```

---

### `DELETE /v1/threads/{thread_id}`

Delete a thread and all its associated state and messages.

**Permission:** `checkpointer:delete`

**Request body**

```json
{
  "config": null
}
```

---

## Store (memory)

Store endpoints require a store backend to be configured. The store is a semantic memory layer — content is embedded and retrieved by similarity.

### `POST /v1/store/memories`

Store a new memory item.

**Permission:** `store:write`

**Request body**

```json
{
  "content": "The user prefers dark mode",
  "memory_type": "episodic",
  "category": "preferences",
  "metadata": {"source": "conversation"},
  "config": null,
  "options": null
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | `string \| Message` | — | Memory text or structured message. |
| `memory_type` | `string` | `"episodic"` | Memory classification. Values: `"episodic"`, `"semantic"`, `"procedural"`. |
| `category` | `string` | `"general"` | Arbitrary category label. |
| `metadata` | `object \| null` | `null` | Arbitrary key-value metadata. |
| `config` | `object \| null` | `null` | Config forwarded to the store backend. |
| `options` | `object \| null` | `null` | Extra keyword args forwarded to the store backend. |

**Response data**

```json
{
  "memory_id": "mem-abc123"
}
```

---

### `POST /v1/store/search`

Search memories by semantic similarity.

**Permission:** `store:read`

**Request body**

```json
{
  "query": "user interface preferences",
  "memory_type": null,
  "category": null,
  "limit": 10,
  "score_threshold": null,
  "filters": null,
  "retrieval_strategy": "similarity",
  "distance_metric": "cosine",
  "max_tokens": 4000,
  "config": null,
  "options": null
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | `string` | — | Required. Semantic search query text. |
| `memory_type` | `string \| null` | `null` | Filter by memory type. |
| `category` | `string \| null` | `null` | Filter by category. |
| `limit` | `int` | `10` | Max results. |
| `score_threshold` | `float \| null` | `null` | Minimum similarity score to include. |
| `filters` | `object \| null` | `null` | Backend-specific additional filters. |
| `retrieval_strategy` | `string` | `"similarity"` | How to retrieve results: `"similarity"`, `"hybrid"`, etc. |
| `distance_metric` | `string` | `"cosine"` | Distance function: `"cosine"`, `"euclidean"`, `"dot_product"`. |
| `max_tokens` | `int` | `4000` | Max tokens for truncation during similarity calculation. |

**Response data**

```json
{
  "results": [
    {
      "memory_id": "mem-abc123",
      "content": "The user prefers dark mode",
      "score": 0.92,
      "memory_type": "episodic",
      "category": "preferences",
      "metadata": {}
    }
  ]
}
```

---

### `POST /v1/store/memories/{memory_id}`

Get a single memory by ID.

**Permission:** `store:read`

**Request body (optional)**

```json
{
  "config": null,
  "options": null
}
```

---

### `POST /v1/store/memories/list`

List all memories from the store.

**Permission:** `store:read`

**Request body (optional)**

```json
{
  "limit": 100,
  "config": null,
  "options": null
}
```

**Response data**

```json
{
  "memories": [...]
}
```

---

### `PUT /v1/store/memories/{memory_id}`

Update the content or metadata of a stored memory.

**Permission:** `store:write`

**Request body**

```json
{
  "content": "Updated memory content",
  "metadata": {"updated": true},
  "config": null,
  "options": null
}
```

---

### `DELETE /v1/store/memories/{memory_id}`

Delete a memory by ID.

**Permission:** `store:delete`

**Request body (optional)**

```json
{
  "config": null,
  "options": null
}
```

---

### `POST /v1/store/memories/forget`

Bulk-delete memories matching the provided filters.

**Permission:** `store:delete`

**Request body**

```json
{
  "memory_type": "episodic",
  "category": "preferences",
  "filters": null,
  "config": null,
  "options": null
}
```

All fields are optional. Omitting a filter means it does not constrain the deletion.

---

## Files

File endpoints handle multimodal content (images, audio, documents). Requires a `MediaStore` backend. The default storage type is `local` (disk).

### `POST /v1/files/upload`

Upload a file. Accepts `multipart/form-data`.

**Permission:** `files:upload`

**Form field:** `file` (the file binary)

**Response data**

```json
{
  "file_id": "f-abc123",
  "mime_type": "image/png",
  "size_bytes": 204800,
  "filename": "chart.png",
  "extracted_text": null,
  "url": "/v1/files/f-abc123",
  "direct_url": null,
  "direct_url_expires_at": null
}
```

| Field | Description |
| --- | --- |
| `file_id` | Opaque storage key used in all subsequent requests. |
| `mime_type` | MIME type detected from the `Content-Type` header or file extension. |
| `size_bytes` | File size in bytes. |
| `filename` | Original filename from the upload. |
| `extracted_text` | For documents: text extracted for use in graph context. `null` for images/audio. |
| `url` | Relative URL to retrieve the raw file binary. |
| `direct_url` | Pre-signed URL for cloud storage (if configured). `null` for local storage. |
| `direct_url_expires_at` | Unix timestamp when `direct_url` expires. `null` for local storage. |

Maximum file size is controlled by `MEDIA_MAX_SIZE_MB` (default `25 MB`). Exceeding this limit returns `413`.

---

### `GET /v1/files/{file_id}`

Download raw file binary.

**Permission:** `files:read`

**Response:** Raw binary with correct `Content-Type`.

---

### `GET /v1/files/{file_id}/info`

Get file metadata without downloading the binary.

**Permission:** `files:read`

**Response data**

```json
{
  "file_id": "f-abc123",
  "mime_type": "image/png",
  "size_bytes": 204800,
  "filename": "chart.png",
  "extracted_text": null,
  "direct_url": null,
  "direct_url_expires_at": null
}
```

---

### `GET /v1/files/{file_id}/url`

Get a direct access URL for a file. For local storage this returns the `/v1/files/{file_id}` path. For cloud storage this returns a pre-signed URL with a TTL controlled by `MEDIA_SIGNED_URL_TTL_SECONDS`.

**Permission:** `files:read`

**Response data**

```json
{
  "file_id": "f-abc123",
  "url": "https://bucket.s3.amazonaws.com/...",
  "expires_at": 1748000000,
  "mime_type": "image/png"
}
```

---

## Config

### `GET /v1/config/multimodal`

Return the current multimodal (file storage) configuration. Useful for client-side feature detection.

**Permission:** `config:read`

**Response data**

```json
{
  "media_storage_type": "local",
  "media_storage_path": "./uploads",
  "media_max_size_mb": 25.0,
  "document_handling": "extract_text"
}
```

| Field | Values | Description |
| --- | --- | --- |
| `media_storage_type` | `"memory"`, `"local"`, `"cloud"`, `"pg"` | Where files are stored. |
| `media_storage_path` | `string` | Local path or cloud prefix. |
| `media_max_size_mb` | `float` | Upload size limit in MB. |
| `document_handling` | `"extract_text"`, `"pass_raw"`, `"skip"` | How uploaded documents are processed. |

---

## Permission reference

The table below lists every `(resource, action)` pair enforced by the server. When an `AuthorizationBackend` is configured, each request calls `authorize(user, resource, action)`.

| Endpoint | Resource | Action |
| --- | --- | --- |
| `POST /v1/graph/invoke` | `graph` | `invoke` |
| `POST /v1/graph/stream` | `graph` | `stream` |
| `WebSocket /v1/graph/ws` | `graph` | `stream` |
| `WebSocket /v1/graph/live` | `graph` | `stream` |
| `GET /v1/graph` | `graph` | `read` |
| `GET /v1/graph/tools` | `graph` | `read` |
| `GET /v1/observability/{thread_id}` | `graph` | `read` |
| `GET /v1/graph:StateSchema` | `graph` | `read` |
| `POST /v1/graph/stop` | `graph` | `stop` |
| `POST /v1/graph/setup` | `graph` | `setup` |
| `POST /v1/graph/fix` | `graph` | `fix` |
| `GET /v1/threads/{id}/state` | `checkpointer` | `read` |
| `PUT /v1/threads/{id}/state` | `checkpointer` | `write` |
| `DELETE /v1/threads/{id}/state` | `checkpointer` | `delete` |
| `GET /v1/threads/{id}/messages` | `checkpointer` | `read` |
| `GET /v1/threads/{id}/messages/{msg}` | `checkpointer` | `read` |
| `POST /v1/threads/{id}/messages` | `checkpointer` | `write` |
| `DELETE /v1/threads/{id}/messages/{msg}` | `checkpointer` | `delete` |
| `GET /v1/threads` | `checkpointer` | `read` |
| `GET /v1/threads/{id}` | `checkpointer` | `read` |
| `DELETE /v1/threads/{id}` | `checkpointer` | `delete` |
| `POST /v1/store/memories` | `store` | `write` |
| `POST /v1/store/search` | `store` | `read` |
| `POST /v1/store/memories/{id}` | `store` | `read` |
| `POST /v1/store/memories/list` | `store` | `read` |
| `PUT /v1/store/memories/{id}` | `store` | `write` |
| `DELETE /v1/store/memories/{id}` | `store` | `delete` |
| `POST /v1/store/memories/forget` | `store` | `delete` |
| `POST /v1/files/upload` | `files` | `upload` |
| `GET /v1/files/{id}` | `files` | `read` |
| `GET /v1/files/{id}/info` | `files` | `read` |
| `GET /v1/files/{id}/url` | `files` | `read` |
| `GET /v1/config/multimodal` | `config` | `read` |
| `GET /ping` | (none) | (none) |
| `GET /v1/evals/runs` | (none) | (none) |
| `GET /v1/evals/runs/{run_id}` | (none) | (none) |

The last three rows are the complete public allowlist. Every other route must carry a `RequirePermission` guard, and the server refuses to start if one does not.

:::warning The eval endpoints are unauthenticated
`/v1/evals/runs*` serves the contents of `eval_reports/` to anyone who can reach the port, regardless of your `auth` setting. Keep `eval_reports/` out of the deployed working directory, or block `/v1/evals/*` at your ingress. See [REST API: Evals](/docs/reference/rest-api/evals).
:::

---

## HTTP status codes

| Code | When |
| --- | --- |
| `200` | Success |
| `400` | Empty file upload or missing required field |
| `401` | Token missing or invalid (when auth is configured) |
| `403` | Authorization check failed |
| `404` | Resource not found (file, thread, message) |
| `413` | Uploaded file exceeds `MEDIA_MAX_SIZE_MB` |
| `422` | Request validation error (malformed body or invalid param) |
| `500` | Unexpected server error |
