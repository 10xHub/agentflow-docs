---
title: "`AgentFlowClient` — Python AI Agent Framework Documentation"
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
| `authToken` | `string \| null` | ❌ | `undefined` | Convenience shorthand for `Bearer` token auth. Setting this is equivalent to setting `auth: { type: 'bearer', token: '...' }`. If both `authToken` and `auth` are set, `auth` takes precedence. |
| `auth` | `AgentFlowAuth \| null` | ❌ | `undefined` | Structured auth configuration. See [`reference/client/auth`](auth.md) for all supported auth types. |
| `headers` | `HeadersInit` | ❌ | `undefined` | Additional HTTP headers appended to every request. Use this for custom tracing headers or API gateway keys. |
| `credentials` | `RequestCredentials` | ❌ | `undefined` | The `credentials` option forwarded to the underlying `fetch` call (e.g. `'include'` for cookie-based sessions). |
| `timeout` | `number` | ❌ | `300000` | Per-request timeout in milliseconds. Default is 5 minutes. Applies to both `invoke` and `stream` calls. Set to a lower value in latency-sensitive UIs. |
| `debug` | `boolean` | ❌ | `false` | Enable verbose `console.debug` / `console.info` logging of every request and response. Useful during development; disable in production. |

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
| `ping()` | `Promise<PingResponse>` | Health check. Returns `{ pong: true }` when the server is up. |
| `graph()` | `Promise<GraphResponse>` | Fetch graph metadata including `id_type`, `id_generator`, and state schema information. |
| `graphStateSchema()` | `Promise<StateSchemaResponse>` | Fetch the JSON schema of the graph's state type. |
| `stopGraph(threadId, config?)` | `Promise<StopGraphResponse>` | Interrupt a running graph execution for `threadId`. |
| `fixGraph(threadId, config?)` | `Promise<FixGraphResponse>` | Remove incomplete tool-call messages from a thread's state (useful after an interrupted run). |

### Invoke and stream

| Method | Returns | Description |
|---|---|---|
| `invoke(messages, options?)` | `Promise<InvokeResult>` | Send messages and receive the final state. Automatically handles remote tool call loops. See [`reference/client/invoke`](invoke.md). |
| `stream(messages, options?)` | `AsyncGenerator<StreamChunk>` | Send messages and receive a stream of real-time chunks. See [`reference/client/stream`](stream.md). |

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

Every method throws an `AgentFlowError` when the server returns a non-2xx response. The error object includes:

- `status` — HTTP status code.
- `message` — Human-readable error message.
- `path` — The API path that failed.
- `method` — The HTTP method.
- `data` — The raw response body from the server, if any.

```ts
import { AgentFlowError } from '@10xscale/agentflow-client';

try {
  const result = await client.invoke([userMessage]);
} catch (err) {
  if (err instanceof AgentFlowError) {
    console.error(`API error ${err.status} on ${err.method} ${err.path}: ${err.message}`);
  } else {
    throw err;
  }
}
```

---

## What you learned

- `AgentFlowClient` is instantiated with a `baseUrl` and optional auth, headers, timeout, and debug options.
- Every API domain (invoke, stream, threads, memory, files, tools) is covered by a method on this class.
- Errors are thrown as `AgentFlowError` with `status`, `path`, and `data` properties.

## Next step

See [how-to/client/create-client](../../how-to/client/create-client.md) for a step-by-step guide to setting up and verifying the client, or jump to [`reference/client/invoke`](invoke.md) to learn the `invoke()` method in depth.
