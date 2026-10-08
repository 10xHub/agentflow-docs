---
title: Manage threads
description: List, inspect, update, and delete conversation threads and messages from the TypeScript client.
section: "TypeScript client"
group: "Basics"
order: 50
label: Manage threads
updated: "2026-10-08"
faq:
  - question: "What happens if no checkpointer is configured?"
    answer: "The server falls back to InMemoryCheckpointer, so threads live only in that server process and are lost on restart. For persistence, compile the graph with a SQLite, Postgres+Redis, or custom checkpointer."
  - question: "Can I update thread state while a graph is running?"
    answer: "Yes, you can call updateThreadState() at any time, but the next invoke() call will continue from the new state you set. Use this for injection, repair, or seeding initial data."
  - question: "What's the difference between clearThreadState() and deleteThread()?"
    answer: "clearThreadState() removes only the state snapshot, keeping all messages. deleteThread() removes everything: state, messages, and thread metadata. Both are irreversible."
---

10xGraph stores conversation history and state in **threads**. This guide shows you how to manage threads from the TypeScript client: listing and searching threads, inspecting their messages and state, updating or clearing state, and deleting threads.

By the end of this guide, you will understand how to read and modify thread data in all its forms, and when to use each operation.

<aside class="callout callout-note" role="note"><p class="callout-title">Requires a configured checkpointer</p>

All thread operations use the checkpointer your graph was compiled with (`compile(checkpointer=...)`). If none is configured, threads live only in the server process memory and are lost on restart. For durable threads across server restarts, use a SQLite, Postgres+Redis, or custom checkpointer.

</aside>

## Prerequisites

- A configured `AgentFlowClient` instance. See [Create a client](/docs/client/create-client).
- The 10xGraph API server running with a durable checkpointer (SQLite, Postgres+Redis, or custom).
- Node 18+ or a browser with fetch support.

---

## Step 1: List all threads

```ts
const response = await client.threads();
const threads = response.data.threads;

console.log(`Found ${threads.length} thread(s)`);
for (const t of threads) {
  console.log(`  [${t.thread_id}] ${t.thread_name ?? '(no name)'}, updated: ${t.updated_at}`);
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
  {},                     // config body (the server derives it from the path thread_id)
  {
    user_preferences: { language: 'fr', timezone: 'Europe/Paris' },
    context_window: [],
  }
);
```

<aside class="callout callout-warning" role="note"><p class="callout-title">Warning</p>

`updateThreadState()` replaces the state at the last checkpoint. The graph will continue from this state on the next `invoke()` call. Use with care, incorrect state can break the agent's logic.

</aside>

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
  {}                     // config body (the server derives it from the path thread_id)
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

Putting it all together, a basic function that loads and displays a thread history:

```ts
import {
  AgentFlowClient,
  Message,
} from '10xgraph-client';

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
| `AgentFlowError` status `404` | Thread not found, or no checkpointer configured. | Verify `thread_id` and check `10xgraph.json`. |
| `AgentFlowError` status `422` | Invalid `thread_id` (empty string or zero), `message_id` (empty), `offset` (< 0), or `limit` (≤ 0). | Check the values you pass to each method. |
| Empty `threads` list | Checkpointer not configured or no threads created yet. | Compile the graph with a checkpointer (`compile(checkpointer=...)`). |

---

## What you learned

- `threads()` lists all threads with optional search and pagination.
- `threadMessages()` lists messages in a thread with search and pagination.
- `threadState()` / `updateThreadState()` / `clearThreadState()` operate on the graph state snapshot.
- `deleteThread()` removes everything, use `clearThreadState()` if you want to keep the history but reset the state.

## Next step

See [how-to/client/use-memory-api](/docs/client/use-memory-api) to learn how to store and retrieve long-term memories.
