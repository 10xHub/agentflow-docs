# Invoke and stream over REST

> Call your graph over HTTP: synchronous invoke, streaming with NDJSON, thread management, stop and fix operations.

Source: https://10xgraph.com/docs/server/invoke-and-stream
Last updated: 2026-10-08

The 10xGraph API server exposes your graph over HTTP, allowing you to invoke it synchronously, stream results in real time, manage thread-scoped state, and control running executions. This page covers the REST interface for graph execution.

## Invoke and wait for results

Use POST `/v1/graph/invoke` to call the graph and wait for the final result. The server processes all nodes and returns the complete output when done.

```bash
curl -X POST http://localhost:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What is the capital of France?"
      }
    ]
  }'
```

The response is a single JSON object with the graph output:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    },
    {
      "role": "assistant",
      "content": "The capital of France is Paris."
    }
  ],
  "state": {
    "step": 2
  },
  "meta": {
    "run_id": "abc123",
    "thread_id": "conv-xyz"
  }
}
```

### Request parameters

The request body is a JSON object with these fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `messages` | array | `[]` | List of message objects to send to the graph. At least one message is required unless `resume` is provided. |
| `config` | object | `{}` | Optional configuration for the run, such as `thread_id` for continuing a conversation. |
| `initial_state` | object | `null` | Optional initial state for the graph execution. |
| `recursion_limit` | integer | 25 | Maximum depth of graph execution (1-100). Raise this if your graph has deep loops. |
| `resume` | any | `null` | Set this to resume a paused thread (see human-in-the-loop section below). |

### Response fields

The response is a single JSON object:

| Field | Type | Description |
|-------|------|-------------|
| `messages` | array | Final messages from the graph after all processing. |
| `state` | object | The graph's final state (keys depend on your custom state schema). |
| `context` | array | Context messages if your graph uses a context manager. |
| `summary` | string | A summary if your graph generates one. |
| `meta` | object | Metadata: `run_id`, `thread_id`, execution timing. |

## Stream results in real time

Use POST `/v1/graph/stream` to get results as they are produced. The response is a stream of NDJSON (newline-delimited JSON), with one event per line.

```bash
curl -X POST http://localhost:8000/v1/graph/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Generate a short story"
      }
    ]
  }'
```

The stream emits events as the graph runs:

```json
{"event":"message","data":{"role":"assistant","content":"Once upon a time..."},"run_id":"run-123"}
{"event":"message","data":{"role":"assistant","content":" there was a traveler..."},"run_id":"run-123"}
{"event":"tool_call","data":{"id":"call-1","name":"search","arguments":{"query":"ancient forests"}},"run_id":"run-123"}
{"event":"updates","data":{"status":"done"},"run_id":"run-123"}
```

Each line is a separate JSON object (StreamChunk). Your client must parse and process each line independently. The last event always has `"event":"updates"` with `"status":"done"` (or `"status":"stopped"` if stopped via `/v1/graph/stop`).

### Stream event types

The `event` field in each chunk describes the data:

| Event | When emitted | Data contents |
|-------|--------------|---------------|
| `message` | When the graph produces a message | Message object with role and content. |
| `tool_call` | When the graph calls a tool | Tool ID, name, and arguments. |
| `tool_result` | When a tool completes | Tool result message. |
| `node_start` | Node execution begins | Node name and state. |
| `node_end` | Node execution completes | Node name and output. |
| `updates` | Status changes or run end | `status` field: `"running"`, `"done"`, `"stopped"`, or `"error"`. |
| `error` | An error occurred | Error message and type. |

## Use threads for conversation memory

A thread is a persistent conversation context. Use `thread_id` in the config to keep messages and state across multiple calls, so your graph can remember previous exchanges.

### Start a new thread

If you do not provide a `thread_id`, the server generates one:

```bash
curl -X POST http://localhost:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Hello"}],
    "config":{}
  }'
```

The response includes a `meta.thread_id`:

```json
{
  "messages": [...],
  "meta": {
    "thread_id": "thread-abc123"
  }
}
```

### Continue on the same thread

Pass the thread_id in the next request to continue the conversation:

```bash
curl -X POST http://localhost:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"What did I say before?"}],
    "config":{
      "thread_id":"thread-abc123"
    }
  }'
```

The graph now sees all previous messages in the thread, so it can answer contextually. The checkpointer (configured in `10xgraph.json`) stores the thread state durably.

### Read thread history

To see all messages in a thread without running the graph, use GET `/v1/threads/{thread_id}/messages`:

```bash
curl http://localhost:8000/v1/threads/thread-abc123/messages
```

Returns an array of messages:

```json
{
  "messages": [
    {"role":"user","content":"Hello"},
    {"role":"assistant","content":"Hi there"},
    {"role":"user","content":"What did I say before?"},
    {"role":"assistant","content":"You said hello"}
  ]
}
```

## Stop a running execution

If a graph is running and you want to halt it, POST to `/v1/graph/stop` with the thread_id:

```bash
curl -X POST http://localhost:8000/v1/graph/stop \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id":"thread-abc123"
  }'
```

The server stops the graph at the next node boundary and returns the partial result:

```json
{
  "success": true,
  "message": "Graph execution stopped",
  "messages": [...],
  "state": {...}
}
```

The graph does not crash; it cleanly exits, and the checkpoint is saved. You can resume the thread later by sending a new invoke or stream request with the same thread_id.

## Fix corrupted graph state

If a graph execution is interrupted or fails mid-tool-call, the checkpoint may contain tool-call messages with empty content. Use POST `/v1/graph/fix` to clean these up:

```bash
curl -X POST http://localhost:8000/v1/graph/fix \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id":"thread-abc123"
  }'
```

The response shows how many messages were removed:

```json
{
  "success": true,
  "message": "Fixed 2 messages with empty tool calls",
  "removed_count": 2,
  "state": {...}
}
```

After fixing, the thread is safe to resume. Empty tool calls typically occur when:
- A tool was called but the client disconnected before sending the result.
- An interrupt happened while a tool was running.
- A network error cut off the tool response.

## Human-in-the-loop: pause and resume

If your graph calls `interrupt()` to pause for human approval, the stream or invoke response will include a `meta.execution_meta.interrupted_node` field with the node name. To resume, send a `resume` request with your approval:

```bash
curl -X POST http://localhost:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "resume":{"approved":true,"comment":"Looks good"},
    "config":{
      "thread_id":"thread-abc123"
    }
  }'
```

The graph resumes from the paused node with your response. The `resume` value is passed directly to the `interrupt()` call, so shape it however your node expects.

## Error handling

If an error occurs during execution, the response will include an error chunk:

```json
{"event":"error","data":{"message":"Tool call failed","error":"Invalid input"},"run_id":"run-123"}
```

The stream continues after non-fatal errors (e.g., a tool fails but the graph can recover), or terminates if the error is fatal. For synchronous invoke, the entire call fails with an HTTP error status:

| Status | Meaning |
|--------|---------|
| 400 | Invalid request (bad schema or missing required fields). |
| 401 | Authentication required (token missing or invalid). |
| 403 | Permission denied (you do not own this thread). |
| 429 | Rate limit exceeded. Retry after the `Retry-After` header. |
| 500 | Internal server error (bug in your graph or infrastructure failure). |

## Common issues

**Message rejected: "messages must contain at least one message"**

You sent an empty messages array. Include at least one message, or use `resume` to continue an interrupted thread.

**"Thread not found" error**

The thread_id does not exist or was deleted. Create a new thread or check the ID.

**Stream stops abruptly**

Your graph may have crashed or the server restarted. Check server logs and the thread checkpoint to diagnose. Use `/v1/graph/fix` if needed.

**Tool call returns empty result**

The client may not have sent the tool result back to the server. Resend it with `invoke` or `stream` and use the same thread_id to let the graph retry.

## Next steps

- See [Manage threads](/docs/server/websockets) for WebSocket real-time updates and bidirectional communication.
- Learn how to [handle authentication](/docs/server/auth) for production deployments.
- Read [stream and approve](/docs/get-started/tutorial/stream-and-approve) to add human-in-the-loop workflows.
