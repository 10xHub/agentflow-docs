---
title: "`AgentFlowClient` — Python AI Agent Framework Documentation"
sidebar_label: "`AgentFlowClient`"
description: Complete reference for the AgentFlowClient class — the main entry point for calling AgentFlow from TypeScript or JavaScript.
keywords:
  - typescript client reference
  - agent client api
  - agentflow client sdk
  - agentflow
  - python ai agent framework
  - "`agentflowclient`"
sidebar_position: 1
---


# `AgentFlowClient`

`AgentFlowClient` is the main class in the `@10xscale/agentflow-client` package. It wraps every AgentFlow REST endpoint behind a single, strongly-typed object so that TypeScript and JavaScript applications can call an AgentFlow-powered API without writing any fetch code themselves.

**Package:** `@10xscale/agentflow-client`  
**Source:** `src/client.ts`

---

## Installation

```bash
npm install @10xscale/agentflow-client
```

---

## Import

```ts
import { AgentFlowClient } from '@10xscale/agentflow-client';
```

---

## Constructor

```ts
new AgentFlowClient(config: AgentFlowConfig)
```

### `AgentFlowConfig`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | ✅ | — | Full base URL of your AgentFlow API server, e.g. `http://localhost:8000`. Do not include a trailing slash. |
| `authToken` | `string \| null` | ❌ | `undefined` | Convenience shorthand for `Bearer` token auth. Setting this is equivalent to setting `auth: { type: 'bearer', token: '...' }`. If both `authToken` and `auth` are set, `auth` takes precedence for HTTP requests. See the note below for the WebSocket routes. |
| `auth` | `AgentFlowAuth \| null` | ❌ | `undefined` | Structured auth configuration. See [`reference/client/auth`](auth.md) for all supported auth types. |
| `headers` | `HeadersInit` | ❌ | `undefined` | Additional HTTP headers appended to every request. Use this for custom tracing headers or API gateway keys. |
| `credentials` | `RequestCredentials` | ❌ | `undefined` | The `credentials` option forwarded to the underlying `fetch` call (e.g. `'include'` for cookie-based sessions). |
| `timeout` | `number` | ❌ | `300000` | Per-request timeout in milliseconds. Default is 5 minutes. Applies to both `invoke` and `stream` calls. Set to a lower value in latency-sensitive UIs. |
| `debug` | `boolean` | ❌ | `false` | Enable verbose `console.debug` / `console.info` logging of every request and response. Useful during development; disable in production. |
| `webSocketImpl` | `typeof WebSocket` | ❌ | `undefined` | WebSocket implementation for `wsStream()` and `realtime()`. Browsers and Node 21+ have a global `WebSocket` and need nothing here; on Node 18/20 pass the [`ws`](https://www.npmjs.com/package/ws) package. |

:::note Auth precedence differs on WebSocket routes
For HTTP requests (`src/request.ts`), `auth` is applied first and `authToken` is only used when no `auth` is set. For the WebSocket routes (`wsStream()` and `realtime()`, via `resolveBearerToken()` in `src/ws.ts`) the order is reversed: `authToken` is checked first, and `auth.token` is only used when `authToken` is absent. If you set both to different values, HTTP calls and WebSocket calls will authenticate with different tokens. Set only one.
:::

### Example

```ts
import { AgentFlowClient } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN!,
  },
  timeout: 120_000,   // 2 minutes
  debug: false,
});
```

---

## Method Overview

The table below lists every public method on `AgentFlowClient` grouped by domain. Full details for each group are in the linked reference pages.

### Graph control

| Method | Returns | Description |
|---|---|---|
| `ping()` | `Promise<PingResponse>` | Health check. Returns `{ data, metadata }` where `data` is the server's pong string. |
| `graph()` | `Promise<GraphResponse>` | Fetch graph metadata including `id_type`, `id_generator`, and state schema information. |
| `graphStateSchema()` | `Promise<StateSchemaResponse>` | Fetch the JSON schema of the graph's state type. |
| `stopGraph(threadId, config?)` | `Promise<StopGraphResponse>` | Interrupt a running graph execution for `threadId`. |
| `fixGraph(threadId, config?)` | `Promise<FixGraphResponse>` | Remove incomplete tool-call messages from a thread's state (useful after an interrupted run). |
| `graphTools()` | `Promise<GraphToolsResponse>` | List the tools every tool node exposes, grouped by node, each tagged `local`, `mcp`, or `remote`. |
| `observability(threadId, runId?)` | `Promise<ObservabilityResponse>` | Fetch the reconstructed trace (spans, events, token usage) for a thread's latest run, or a specific `runId`. |

See [`reference/client/graph`](graph.md) for full details on the graph-control methods.

### Invoke and stream

| Method | Returns | Description |
|---|---|---|
| `invoke(messages, options?)` | `Promise<InvokeResult>` | Send messages and receive the final state. Automatically handles remote tool call loops. See [`reference/client/invoke`](invoke.md). |
| `stream(messages, options?)` | `AsyncGenerator<StreamChunk>` | Send messages and receive a stream of real-time chunks. See [`reference/client/stream`](stream.md). |
| `wsStream(messages, options?)` | `AsyncGenerator<StreamChunk>` | Same streaming contract as `stream()` but over a single persistent WebSocket (`WS /v1/graph/ws`), eliminating the per-tool-call HTTP round trip for remote tools. |

### Realtime audio

| Method | Returns | Description |
|---|---|---|
| `realtime(init, options?)` | `RealtimeSession` | Open a transport-only audio-to-audio session over `WS /v1/graph/live`. Send PCM16 in, receive PCM16 out, with transcripts, tool calls, and auto reconnect/resume. See [`reference/client/realtime`](realtime.md). |

### Threads and state

| Method | Returns | Description |
|---|---|---|
| `threads(request?)` | `Promise<ThreadsResponse>` | List all threads with optional search and pagination. |
| `threadDetails(threadId)` | `Promise<ThreadDetailsResponse>` | Fetch metadata for a single thread. |
| `threadState(threadId)` | `Promise<ThreadStateResponse>` | Fetch the full state snapshot for a thread. |
| `updateThreadState(threadId, config, state)` | `Promise<UpdateThreadStateResponse>` | Write a new state snapshot for a thread. |
| `clearThreadState(threadId)` | `Promise<ClearThreadStateResponse>` | Delete all checkpointed state for a thread. |
| `threadMessages(threadId, request?)` | `Promise<ThreadMessagesResponse>` | List messages in a thread with optional search and pagination. |
| `addThreadMessages(threadId, messages, config?, metadata?)` | `Promise<AddThreadMessagesResponse>` | Append messages to a thread's history. |
| `singleMessage(threadId, messageId)` | `Promise<ThreadMessageResponse>` | Fetch a single message by ID. |
| `deleteMessage(threadId, messageId, config?)` | `Promise<DeleteThreadMessageResponse>` | Delete a message by ID. |
| `deleteThread(threadId, config?)` | `Promise<DeleteThreadResponse>` | Delete a thread and all its state and messages. |

See [`reference/client/threads`](threads.md) for full details.

### Memory store

| Method | Returns | Description |
|---|---|---|
| `storeMemory(request)` | `Promise<StoreMemoryResponse>` | Store a new memory entry. |
| `searchMemory(request)` | `Promise<SearchMemoryResponse>` | Vector or keyword search over stored memories. |
| `getMemory(memoryId, options?)` | `Promise<GetMemoryResponse>` | Fetch a single memory by ID. |
| `updateMemory(memoryId, content, options?)` | `Promise<UpdateMemoryResponse>` | Update an existing memory. |
| `deleteMemory(memoryId, options?)` | `Promise<DeleteMemoryResponse>` | Delete a memory by ID. |
| `listMemories(options?)` | `Promise<ListMemoriesResponse>` | List all stored memories with optional pagination. |
| `forgetMemories(options?)` | `Promise<ForgetMemoriesResponse>` | Bulk-delete memories by type, category, or filter. |

See [`reference/client/memory`](memory.md) for full details.

### Files and media

| Method | Returns | Description |
|---|---|---|
| `uploadFile(file)` | `Promise<FileUploadResponse>` | Upload an image, audio, or document file. Returns `file_id` and access URL. |
| `getFile(fileId)` | `Promise<Blob>` | Download a file by ID as a raw `Blob`. |
| `getFileInfo(fileId)` | `Promise<FileInfoResponse>` | Fetch metadata (MIME type, size, extracted text) for a stored file. |
| `getFileAccessUrl(fileId)` | `Promise<FileAccessUrlResponse>` | Get the best access URL for a file (signed URL for cloud storage, or a direct API URL). |
| `getMultimodalConfig()` | `Promise<MultimodalConfigResponse>` | Fetch the server's multimodal configuration (storage backend, max size, etc.). |

See [`reference/client/files`](files.md) for full details.

### Remote tools

| Method | Returns | Description |
|---|---|---|
| `registerTool(registration)` | `void` | Register a browser-side tool that the server can invoke during graph execution. |
| `setup()` | `Promise<SetupGraphResponse>` | Send all registered tool definitions to the server. Must be called before `invoke` or `stream` when using remote tools. |

See [`reference/client/tools`](tools.md) for full details.

---

## Error handling

Every method throws an `AgentFlowError` when the server returns a non-2xx response. `AgentFlowError` extends the built-in `Error`, so `message` and `stack` are available as usual, plus:

| Property | Type | Description |
|---|---|---|
| `statusCode` | `number` | HTTP status code returned by the server. |
| `errorCode` | `string` | Machine-readable code from the server's error body, e.g. `VALIDATION_ERROR`, `GRAPH_RECURSION_ERROR`. |
| `requestId` | `string` | Server-generated request id, taken from `metadata.request_id`. `'unknown'` when the body could not be parsed. |
| `timestamp` | `string` | ISO timestamp of the failure. |
| `details` | `ErrorDetail[]` | Field-level details, each `{ loc?, msg?, type? }`. Populated for validation failures. |
| `context` | `Record<string, any> \| undefined` | Extra server-supplied context, set by the graph/node/storage error subclasses. |
| `endpoint` | `string \| undefined` | API path that failed. Set on unmapped status codes. |
| `method` | `string \| undefined` | HTTP method that failed. Set on unmapped status codes. |
| `recoverySuggestion` | `string \| undefined` | Human-readable hint attached by the specific error subclasses. |

Two helper methods are available on every error:

| Method | Returns | Description |
|---|---|---|
| `getUserMessage()` | `string` | The message with `recoverySuggestion` appended as `"\n\nSuggestion: ..."` when one is present. Safe to show in a UI. |
| `toJSON()` | `Record<string, any>` | Every field above plus `name` and `stack`. Use it for structured logging. |

```ts
import { AgentFlowError } from '@10xscale/agentflow-client';

try {
  const result = await client.invoke([userMessage]);
} catch (err) {
  if (err instanceof AgentFlowError) {
    console.error(`API error ${err.statusCode} (${err.errorCode}) request ${err.requestId}`);
    console.error(err.getUserMessage());
    logger.error(err.toJSON());
  } else {
    throw err;
  }
}
```

### Error taxonomy

`createErrorFromResponse()` picks the most specific subclass it can. It matches `errorCode` first, then falls back to the HTTP status. Every class below extends `AgentFlowError`, so `instanceof AgentFlowError` always catches them.

| Class | Status | `errorCode` | Raised when |
|---|---|---|---|
| `BadRequestError` | 400 | `BAD_REQUEST` | The request is malformed. |
| `AuthenticationError` | 401 | `AUTHENTICATION_FAILED` | Credentials are missing or invalid. |
| `PermissionError` | 403 | `PERMISSION_ERROR` | The caller is authenticated but not allowed. |
| `NotFoundError` | 404 | `RESOURCE_NOT_FOUND` | The thread, message, memory, or file does not exist. |
| `ValidationError` | 422 | `VALIDATION_ERROR` | The body failed schema validation. Read `details`. |
| `ServerError` | 500, 502, 503, 504 | `INTERNAL_SERVER_ERROR` (or the server's code) | Any unmapped server-side failure. |
| `GraphError` | 500 | `GRAPH_*` | Graph execution failed. |
| `NodeError` | 500 | `NODE_*` | A node failed. Adds `nodeName`. |
| `GraphRecursionError` | 500 | `GRAPH_RECURSION_*` | The run hit `recursion_limit`. Adds `recursionLimit`. |
| `StorageError` | 500 | `STORAGE_*` | The checkpointer or store could not be reached. |
| `TransientStorageError` | 503 | `TRANSIENT_STORAGE_*` | A temporary storage failure. Safe to retry. |
| `MetricsError` | 500 | `METRICS_*` | Metrics collection failed. Usually not fatal to the run. |
| `SchemaVersionError` | 422 | `SCHEMA_VERSION_*` | Client and server schema versions disagree. Adds `expectedVersion` and `actualVersion`. |
| `SerializationError` | 500 | `SERIALIZATION_*` | A payload could not be serialized or deserialized. |

Because `errorCode` is matched before the status, a `GRAPH_RECURSION_ERROR` returned with a 500 arrives as `GraphRecursionError`, not `ServerError`.

```ts
import {
  AgentFlowError,
  AuthenticationError,
  GraphRecursionError,
  TransientStorageError,
} from '@10xscale/agentflow-client';

try {
  await client.invoke([userMessage], { config: { thread_id: 'thread-1' } });
} catch (err) {
  if (err instanceof AuthenticationError) {
    redirectToLogin();
  } else if (err instanceof GraphRecursionError) {
    showError(`Run exceeded ${err.recursionLimit ?? 'the'} step limit.`);
  } else if (err instanceof TransientStorageError) {
    await retryWithBackoff();
  } else if (err instanceof AgentFlowError) {
    showError(err.getUserMessage());
  } else {
    throw err;
  }
}
```

### Building errors yourself

Both helpers used internally are exported, which is useful when you proxy AgentFlow through your own server and want to re-raise the same error types on the far side.

| Function | Signature | Description |
|---|---|---|
| `parseErrorResponse` | `(response: Response) => Promise<ApiErrorResponse \| null>` | Parse a `fetch` `Response` into `{ metadata, error }`. Returns `null` when the body is missing or not JSON. |
| `createErrorFromResponse` | `(response: Response, fallbackMessage?: string, endpoint?: string, method?: string) => Promise<AgentFlowError>` | Build the most specific error subclass for a failed `Response`. Falls back to a generic `AgentFlowError` with `errorCode: 'UNKNOWN_ERROR'` when the body cannot be parsed. |

```ts
import { createErrorFromResponse } from '@10xscale/agentflow-client';

const response = await fetch(`${base}/v1/graph/invoke`, init);
if (!response.ok) {
  throw await createErrorFromResponse(response, 'Invoke failed', '/v1/graph/invoke', 'POST');
}
```

---

## What you learned

- `AgentFlowClient` is instantiated with a `baseUrl` and optional auth, headers, timeout, and debug options.
- Every API domain (invoke, stream, threads, memory, files, tools) is covered by a method on this class.
- Errors are thrown as `AgentFlowError` (or a specific subclass) carrying `statusCode`, `errorCode`, `requestId`, `details`, and a `recoverySuggestion`.

## Next step

See [how-to/client/create-client](../../how-to/client/create-client.md) for a step-by-step guide to setting up and verifying the client, or jump to [`reference/client/invoke`](invoke.md) to learn the `invoke()` method in depth.
