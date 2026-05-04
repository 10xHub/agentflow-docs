---
title: How to manage threads — AgentFlow Python AI Agent Framework
description: Step-by-step guide to listing, inspecting, updating, and deleting conversation threads and messages.
keywords:
  - agentflow typescript client
  - ai agent client
  - agent sdk
  - agentflow
  - python ai agent framework
  - how to manage threads
sidebar_position: 4
---


# How to manage threads

AgentFlow stores conversation history and state in **threads**. This guide shows you how to list threads, inspect their messages and state, update state directly, and delete threads when they are no longer needed.

:::info Requires checkpointer
All thread operations require the `checkpointer` field to be configured in `agentflow.json`. Without a checkpointer, endpoints return empty results or 404.
:::

## Prerequisites

- A configured `AgentFlowClient`. See [how-to/client/create-client](create-client.md).
- The API server running with a checkpointer configured.

---

## Step 1: List all threads

```ts
const response = await client.threads();
const threads = response.data.threads;

console.log(`Found ${threads.length} thread(s)`);
for (const t of threads) {
  console.log(`  [${t.thread_id}] ${t.thread_name ?? '(no name)'} — updated: ${t.updated_at}`);
}
```

### Filter by name

Search for threads whose name contains a keyword:

```ts
const response = await client.threads({ search: 'Paris' });
```

### Paginate

Retrieve 20 threads at a time starting from the first:

```ts
const response = await client.threads({ offset: 0, limit: 20 });
```

### Paginate through all threads

```ts
async function* allThreads(pageSize = 50) {
  let offset = 0;
  while (true) {
    const res = await client.threads({ offset, limit: pageSize });
    const page = res.data.threads;
    if (page.length === 0) break;
    yield* page;
    offset += page.length;
    if (page.length < pageSize) break;
  }
}

for await (const thread of allThreads()) {
  console.log(thread.thread_id, thread.thread_name);
}
```

---

## Step 2: Fetch thread details

Get metadata for a single thread (ID, name, user, timestamps):

```ts
const details = await client.threadDetails('thread-abc123');
console.log(details.data.thread_data.thread);
```

---

## Step 3: List messages in a thread

```ts
const messages = await client.threadMessages('thread-abc123');

for (const msg of messages.data.messages) {
  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text as string)
    .join('');
  console.log(`[${msg.role}] ${text.slice(0, 100)}`);
}
```

### Search messages

```ts
const results = await client.threadMessages('thread-abc123', {
  search: 'capital of France',
  limit: 10,
});
```

---

## Step 4: Fetch a single message

```ts
const msg = await client.singleMessage('thread-abc123', 'msg-001');
console.log(msg.data.message);
```

---

## Step 5: Delete a message

Remove an individual message from the thread's history. Useful for cleaning up tool call messages that should not appear in the conversation:

```ts
await client.deleteMessage('thread-abc123', 'msg-001');
```

---

## Step 6: Inspect thread state

Fetch the full graph state snapshot (the last checkpoint):

```ts
const stateResponse = await client.threadState(12345);
console.log(stateResponse.data);
```

The state object shape depends on your graph's `StateGraph` definition.

---

## Step 7: Update thread state

Write a new state snapshot for a thread. Use this to inject values, repair corrupted state, or seed initial data:

```ts
await client.updateThreadState(
  12345,
  { configurable: {} },   // run config
  {
    user_preferences: { language: 'fr', timezone: 'Europe/Paris' },
    context_window: [],
  }
);
```

:::warning
`updateThreadState()` replaces the state at the last checkpoint. The graph will continue from this state on the next `invoke()` call. Use with care — incorrect state can break the agent's logic.
:::

---

## Step 8: Clear thread state

Remove the state snapshot without deleting the thread or its messages. The thread exists but will start fresh on the next `invoke()` call:

```ts
await client.clearThreadState(12345);
```

---

## Step 9: Add messages to a thread

Inject messages directly into the thread's history (useful for synthetic context or importing data):

```ts
await client.addThreadMessages(
  'thread-abc123',
  [
    Message.text_message('You are a Paris travel expert.', 'system'),
  ],
  { configurable: {} }   // run config
);
```

---

## Step 10: Delete a thread

Delete a thread and all its associated state and messages. This is irreversible:

```ts
await client.deleteThread('thread-abc123');
```

---

## Build a thread history viewer

Putting it all together — a basic function that loads and displays a thread history:

```ts
import {
  AgentFlowClient,
  Message,
} from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

async function showThreadHistory(threadId: string) {
  // Get details
  const details = await client.threadDetails(threadId);
  const thread = details.data.thread_data.thread;
  console.log(`Thread: ${thread.thread_name ?? threadId}`);

  // Get messages
  const msgs = await client.threadMessages(threadId, {
    offset: 0,
    limit: 100,
  });

  for (const msg of msgs.data.messages) {
    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text as string)
      .join('') || '[non-text content]';
    console.log(`[${msg.role.toUpperCase()}] ${text}`);
  }

  console.log(`\nTotal: ${msgs.data.messages.length} messages`);
}

await showThreadHistory('thread-abc123');
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `404` | Thread not found, or no checkpointer configured. | Verify `thread_id` and check `agentflow.json`. |
| `AgentFlowError` status `422` | Invalid `thread_id` (empty string or zero), `message_id` (empty), `offset` (< 0), or `limit` (≤ 0). | Check the values you pass to each method. |
| Empty `threads` list | Checkpointer not configured or no threads created yet. | Configure `checkpointer` in `agentflow.json`. |

---

## What you learned

- `threads()` lists all threads with optional search and pagination.
- `threadMessages()` lists messages in a thread with search and pagination.
- `threadState()` / `updateThreadState()` / `clearThreadState()` operate on the graph state snapshot.
- `deleteThread()` removes everything — use `clearThreadState()` if you want to keep the history but reset the state.

## Next step

See [how-to/client/use-memory-api](use-memory-api.md) to learn how to store and retrieve long-term memories.
