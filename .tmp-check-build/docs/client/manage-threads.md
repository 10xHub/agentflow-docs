# Manage threads

> List, inspect, update, and delete conversation threads and messages from the TypeScript client.

Source: https://10xgraph.com/docs/client/manage-threads
Last updated: 2026-10-08

10xGraph stores conversation history and state in **threads**. This guide shows you how to manage threads from the TypeScript client: listing and searching threads, inspecting their messages and state, updating or clearing state, and deleting threads.

By the end of this guide, you will understand how to read and modify thread data in all its forms, and when to use each operation.

> **Requires a configured checkpointer**
>
> All thread operations use the checkpointer your graph was compiled with (`compile(checkpointer=...)`). If none is configured, threads live only in the server process memory and are lost on restart. For durable threads across server restarts, use a SQLite, Postgres+Redis, or custom checkpointer.

## Prerequisites

- A configured `AgentFlowClient` instance. See [Create a client](/docs/client/create-client).
- The 10xGraph API server running with a durable checkpointer (SQLite, Postgres+Redis, or custom).
- Node 18+ or a browser with fetch support.

---

## List all threads

Retrieve all threads from the server. This is useful for discovering past conversations, searching for a specific thread, or bulk operations on threads.

```ts
const response = await client.threads();
const threads = response.data.threads;

console.log(`Found ${threads.length} thread(s)`);
for (const t of threads) {
  console.log(`  [${t.thread_id}] ${t.thread_name ?? '(no name)'}, updated: ${t.updated_at}`);
}
```

### Filter threads by name

Search for threads containing a keyword in their name:

```ts
const response = await client.threads({ search: 'Paris' });
const matchingThreads = response.data.threads;

for (const thread of matchingThreads) {
  console.log(`Matched: ${thread.thread_name}`);
}
```

### Paginate through threads

Retrieve threads in pages to handle large thread lists:

```ts
const response = await client.threads({ offset: 0, limit: 20 });
const firstPage = response.data.threads;
```

For iterating through all threads, use an async generator:

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

// Iterate through all threads
for await (const thread of allThreads()) {
  console.log(`Processing: ${thread.thread_id}`);
}
```

---

## Fetch thread details

Get metadata for a single thread, including its ID, name, user, and timestamps:

```ts
const details = await client.threadDetails('thread-abc123');
const thread = details.data.thread_data.thread;

console.log(`Thread ID: ${thread.thread_id}`);
console.log(`Name: ${thread.thread_name ?? '(unnamed)'}`);
console.log(`Updated: ${thread.updated_at}`);
```

This is useful for displaying thread information in a UI or validating that a thread exists before performing operations on it.

---

## List and search messages in a thread

Retrieve all messages from a thread, optionally searching by content:

```ts
const messages = await client.threadMessages('thread-abc123');

for (const msg of messages.data.messages) {
  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text as string)
    .join('');
  console.log(`[${msg.role.toUpperCase()}] ${text.slice(0, 80)}`);
}
```

To search messages by keyword:

```ts
const results = await client.threadMessages('thread-abc123', {
  search: 'capital of France',
  limit: 10,
  offset: 0,
});

console.log(`Found ${results.data.messages.length} matching message(s)`);
```

Messages can be paginated using `offset` and `limit` parameters.

---

## Fetch a single message

Retrieve a specific message by its ID:

```ts
const msg = await client.singleMessage('thread-abc123', 'msg-001');
console.log(`Role: ${msg.data.message.role}`);
console.log(`Content: ${JSON.stringify(msg.data.message.content)}`);
```

Use this when you need to read or inspect a specific message without fetching the entire thread.

---

## Delete a message

Remove a message from the thread's history. This is useful for cleaning up incomplete tool calls or messages that shouldn't appear in the conversation:

```ts
await client.deleteMessage('thread-abc123', 'msg-001');
console.log('Message deleted');
```

The thread continues to exist with the remaining messages. You cannot delete messages once they are part of a completed checkpoint.

---

## Inspect and update thread state

The thread state is the graph's state snapshot at the last checkpoint. You can read it, modify it, or reset it.

### Read the current state

```ts
const stateResponse = await client.threadState('thread-abc123');
const state = stateResponse.data;

console.log('Current state:', JSON.stringify(state, null, 2));
```

The state object shape depends on your graph's `StateGraph` definition. It contains all values you stored in the graph's state during execution.

### Update the state

Write a new state snapshot for a thread. Use this to inject values, repair corrupted state, or seed initial data:

```ts
await client.updateThreadState(
  'thread-abc123',
  {},  // config (derived from thread_id)
  {
    user_preferences: { language: 'fr', timezone: 'Europe/Paris' },
    context_window: [],
  }
);

console.log('State updated. Next invoke() will use this state.');
```

> **State updates are immediate and final**
>
> `updateThreadState()` replaces the state at the last checkpoint. The next `invoke()` call will continue from your new state. Use with care: incorrect state can cause the agent to fail or behave unexpectedly.

### Clear the state

Remove the state snapshot without deleting messages. The thread exists but will start fresh on the next `invoke()` call:

```ts
await client.clearThreadState('thread-abc123');
console.log('State cleared. Thread messages remain.');
```

This is useful if you want to reset a conversation while keeping the message history.

---

## Add messages to a thread

Inject messages directly into a thread's history. This is useful for synthetic context (system prompts), importing data, or continuing a conversation from an external source:

```ts
import { Message } from '@10xgraph/client';

await client.addThreadMessages(
  'thread-abc123',
  [
    Message.text_message('You are a Paris travel expert.', 'system'),
  ],
  {}  // config (derived from thread_id)
);

console.log('Messages added to thread');
```

Added messages become part of the thread history and will be included when you list messages or start a new invoke.

---

## Delete a thread

Delete a thread and all its associated state and messages permanently. This operation is irreversible:

```ts
await client.deleteThread('thread-abc123');
console.log('Thread deleted');
```

After deletion, the thread ID cannot be reused. If you want to keep the message history but reset the state, use `clearThreadState()` instead.

---

## Complete example: thread history viewer

Putting all operations together in a utility function that displays a thread's full history:

```ts
import { AgentFlowClient, Message } from '@10xgraph/client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

async function displayThreadHistory(threadId: string) {
  try {
    // Fetch thread details
    const details = await client.threadDetails(threadId);
    const thread = details.data.thread_data.thread;
    console.log(`\n=== Thread: ${thread.thread_name ?? threadId} ===`);
    console.log(`Created: ${thread.created_at}`);
    console.log(`Updated: ${thread.updated_at}`);

    // Fetch all messages with pagination
    const messagesResponse = await client.threadMessages(threadId, {
      offset: 0,
      limit: 100,
    });

    const messages = messagesResponse.data.messages;
    console.log(`\n--- Messages (${messages.length} total) ---`);

    for (const msg of messages) {
      const text = msg.content
        .filter(b => b.type === 'text')
        .map(b => (b as any).text as string)
        .join('') || '[non-text content]';
      
      console.log(`[${msg.role.toUpperCase()}] ${text.slice(0, 120)}`);
    }

    // Fetch and display current state
    const stateResponse = await client.threadState(threadId);
    console.log(`\n--- Current State ---`);
    console.log(JSON.stringify(stateResponse.data, null, 2));

  } catch (error) {
    console.error(`Failed to display thread: ${error}`);
  }
}

// Usage
await displayThreadHistory('thread-abc123');
```

---

## Troubleshooting: common errors

| Error | Cause | Solution |
|---|---|---|
| `404 Not Found` | Thread does not exist, or no checkpointer is configured. | Verify the thread ID exists. Check that the API server has a checkpointer configured. |
| `422 Unprocessable Entity` | Invalid parameter: empty/invalid thread ID, message ID, negative offset, or non-positive limit. | Ensure all parameters match their type and constraints (thread IDs are strings, offsets are >= 0, limits are > 0). |
| Empty `threads` list | Checkpointer is not configured, or no threads have been created yet. | Compile your graph with a checkpointer: `compile(checkpointer=PgCheckpointer(...))`. Run a test invocation to create a thread. |
| `State is null` | The thread exists but has no state snapshot (e.g., after `clearThreadState()`). | Call `updateThreadState()` to set a state, or `addThreadMessages()` to add messages to the thread. |

---

## Key takeaways

- **List threads** with `threads()` to discover or search for conversations.
- **Thread details** via `threadDetails()` give you metadata (ID, name, timestamps).
- **Messages** are read with `threadMessages()`, modified with `addThreadMessages()`, and deleted individually with `deleteMessage()`.
- **Thread state** (checkpoint) is read with `threadState()`, updated with `updateThreadState()`, and cleared with `clearThreadState()`.
- **Deletion** is permanent: `deleteThread()` removes everything, while `clearThreadState()` keeps messages but resets state.
- **Idempotency**: thread operations are safe to retry; the API prevents duplicate messages or state changes.

---

## Next step

Learn how to store and retrieve long-term memories separate from conversation history. See [Memory API](/docs/client/use-memory-api).

## Frequently asked questions

### What happens if no checkpointer is configured?

The server falls back to InMemoryCheckpointer, so threads live only in that server process and are lost on restart. For persistence, compile the graph with a SQLite, Postgres+Redis, or custom checkpointer.

### Can I update thread state while a graph is running?

Yes, you can call updateThreadState() at any time, but the next invoke() call will continue from the new state you set. Use this for injection, repair, or seeding initial data.

### What's the difference between clearThreadState() and deleteThread()?

clearThreadState() removes only the state snapshot, keeping all messages. deleteThread() removes everything: state, messages, and thread metadata. Both are irreversible.
