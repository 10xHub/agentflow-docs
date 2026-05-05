---
title: Threads — AgentFlow Python AI Agent Framework
sidebar_label: Threads
description: Reference for all thread, state, and message methods on AgentFlowClient. Part of the AgentFlow typescript client reference guide for production-ready Python AI.
keywords:
  - typescript client reference
  - agent client api
  - agentflow client sdk
  - agentflow
  - python ai agent framework
  - threads
sidebar_position: 5
---


# Threads

AgentFlow organises conversation history into **threads**. Each thread has a unique `thread_id` and stores a sequence of messages and a state snapshot (checkpoint). The client provides methods to list, inspect, update, and delete threads and their messages.

:::info Requires checkpointer
Thread endpoints require the `checkpointer` field to be configured in `agentflow.json`. Without a checkpointer the server returns empty results or 404 for single-thread operations.
:::

**Source:** `src/client.ts`, `src/endpoints/threads*.ts`, `src/endpoints/threadState.ts`

---

## Thread management

### `threads(request?)`

List all threads. Supports optional search and pagination.

```ts
// List all threads
const response = await client.threads();

// With search
const response = await client.threads({ search: 'Paris' });

// With pagination
const response = await client.threads({ offset: 0, limit: 20 });
```

**Overloads:**

```ts
client.threads(): Promise<ThreadsResponse>
client.threads(request: ThreadsRequest): Promise<ThreadsResponse>
client.threads(search?: string, offset?: number, limit?: number): Promise<ThreadsResponse>
```

**`ThreadsRequest`:**

| Field | Type | Description |
|---|---|---|
| `search` | `string` | Substring filter applied to thread names. |
| `offset` | `number` | Number of threads to skip (for pagination). Must be ≥ 0. |
| `limit` | `number` | Maximum number of threads to return. Must be > 0. |

**`ThreadsResponse`:**

```ts
interface ThreadsResponse {
  data: {
    threads: ThreadItem[];
  };
  metadata: ResponseMetadata;
}

interface ThreadItem {
  thread_id: string;
  thread_name: string | null;
  user_id: string | null;
  metadata: Record<string, any> | null;
  updated_at: string | null;
  run_id: string | null;
}
```

---

### `threadDetails(threadId)`

Fetch metadata for a single thread.

```ts
const response = await client.threadDetails('thread-123');
console.log(response.data.thread_data.thread);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `threadId` | `string \| number` | The thread ID. Must be non-empty (string) or ≥ 1 (integer). |

**`ThreadDetailsResponse`:**

```ts
interface ThreadDetailsResponse {
  data: {
    thread_data: {
      thread: Record<string, any>;
    };
  };
  metadata: ResponseMetadata;
}
```

---

### `deleteThread(threadId, config?)`

Delete a thread and all its associated state and messages. This is irreversible.

```ts
await client.deleteThread('thread-123');

// With optional config
await client.deleteThread('thread-123', { user_id: 'u-456' });
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `threadId` | `string \| number` | The thread ID to delete. |
| `config` | `Record<string, any>` | Optional configuration passed with the delete request body. |

---

## Thread state

### `threadState(threadId)`

Fetch the current state snapshot for a thread (the full graph state at the last checkpoint).

```ts
const response = await client.threadState(12345);
console.log(response.data);
// { state: { messages: [...], user_id: 'abc', ... } }
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `threadId` | `number` | The thread ID. Note: this method accepts numbers only (not strings) because state is keyed on the integer thread ID. |

---

### `updateThreadState(threadId, config, state)`

Write a new state snapshot for a thread. Use this to seed initial state, repair a corrupted thread, or inject values that the graph needs but cannot derive from messages alone.

```ts
await client.updateThreadState(
  12345,
  { configurable: {} },        // run config
  { user_preferences: { lang: 'fr' } }  // new state
);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `threadId` | `number` | The thread ID. |
| `config` | `Record<string, any>` | LangGraph-style run configuration map. |
| `state` | `any` | New state object to write. Keys must match the graph's state schema. |

---

### `clearThreadState(threadId)`

Delete all checkpointed state for a thread. The thread itself (its metadata and messages) is not deleted — only the state snapshot is cleared.

```ts
await client.clearThreadState(12345);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `threadId` | `number` | The thread ID. |

---

## Messages

### `threadMessages(threadId, request?)`

List messages for a thread with optional search and pagination.

```ts
// All messages
const response = await client.threadMessages('thread-123');

// With search term
const response = await client.threadMessages('thread-123', 'capital');

// As a request object
const response = await client.threadMessages('thread-123', {
  search: 'capital',
  offset: 0,
  limit: 50,
});
```

**Overloads:**

```ts
client.threadMessages(threadId: string | number): Promise<ThreadMessagesResponse>
client.threadMessages(threadId: string | number, request: ThreadMessagesRequest): Promise<ThreadMessagesResponse>
client.threadMessages(threadId: string | number, search?: string, offset?: number, limit?: number): Promise<ThreadMessagesResponse>
```

**`ThreadMessagesRequest` (without `threadId`):**

| Field | Type | Description |
|---|---|---|
| `search` | `string` | Substring filter applied to message content. |
| `offset` | `number` | Number of messages to skip (≥ 0). |
| `limit` | `number` | Maximum number to return (> 0). |

**`ThreadMessagesResponse`:**

```ts
interface ThreadMessagesResponse {
  data: {
    messages: Message[];
    total?: number;
  };
  metadata: ResponseMetadata;
}
```

---

### `addThreadMessages(threadId, messages, config?, metadata?)`

Append messages to a thread's saved history. Useful for injecting context, system prompts, or synthetic messages without running the graph.

```ts
await client.addThreadMessages(
  'thread-123',
  [Message.text_message('You are a travel guide.', 'system')],
  { configurable: {} },       // config
  { injected_by: 'setup' }    // metadata
);
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `threadId` | `string \| number` | — | The thread ID. |
| `messages` | `Message[]` | — | Messages to append. |
| `config` | `Record<string, any>` | `{}` | Run configuration map. |
| `metadata` | `Record<string, any>` | `undefined` | Optional metadata attached to the checkpoint. |

---

### `singleMessage(threadId, messageId)`

Fetch a single message from a thread by message ID.

```ts
const response = await client.singleMessage('thread-123', 'msg-001');
console.log(response.data.message);
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `threadId` | `string \| number` | The thread ID. |
| `messageId` | `string` | The message ID. Must be non-empty. |

---

### `deleteMessage(threadId, messageId, config?)`

Delete a single message from a thread by message ID.

```ts
await client.deleteMessage('thread-123', 'msg-001');
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `threadId` | `string \| number` | The thread ID. |
| `messageId` | `string` | The message ID to delete. Must be non-empty. |
| `config` | `Record<string, any>` | Optional configuration passed in the request body. |

---

## Validation rules

These rules are enforced by the server and will produce `AgentFlowError` status `422` if violated:

| Rule | Description |
|---|---|
| `thread_id` non-empty | String thread IDs must not be empty or whitespace. Integer IDs must be ≥ 1. |
| `message_id` non-empty | `messageId` must not be empty. |
| `offset` ≥ 0 | Pagination offset must be a non-negative number. |
| `limit` > 0 | Pagination limit must be a positive number. |

---

## Common patterns

### Paginate through all threads

```ts
async function* allThreads(pageSize = 50) {
  let offset = 0;
  while (true) {
    const response = await client.threads({ offset, limit: pageSize });
    const threads = response.data.threads;
    if (threads.length === 0) break;
    yield* threads;
    offset += threads.length;
    if (threads.length < pageSize) break;
  }
}

for await (const thread of allThreads()) {
  console.log(thread.thread_id, thread.thread_name);
}
```

### Display a conversation history

```ts
const response = await client.threadMessages('thread-123', {
  offset: 0,
  limit: 100,
});

for (const msg of response.data.messages) {
  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('');
  console.log(`[${msg.role}] ${text}`);
}
```

### Reset a thread

```ts
// Keep the thread metadata but wipe the state
await client.clearThreadState(12345);

// Or delete everything including metadata and messages
await client.deleteThread('thread-123');
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `404` | Thread not found, or no checkpointer configured. | Verify `thread_id`, and confirm `checkpointer` is set in `agentflow.json`. |
| `AgentFlowError` status `422` | Validation failure — invalid `thread_id`, empty `message_id`, bad pagination values. | Check the field constraints listed in [Validation rules](#validation-rules). |

---

## What you learned

- Threads persist conversation history and state between `invoke()` calls when a `thread_id` is set in `config.configurable`.
- `threadMessages()` supports search and pagination.
- `clearThreadState()` removes the state snapshot but not the thread or messages.
- All thread operations require the checkpointer to be configured in `agentflow.json`.

## Next step

See [`reference/client/memory`](memory.md) to learn how to store and search long-term memories beyond per-thread conversation history.
