---
title: invoke()
description: Reference for the AgentFlowClient.invoke() method — send messages and receive the final state.
sidebar_position: 3
---

# `invoke()`

`client.invoke()` sends a list of messages to the agent graph and awaits the final response. It automatically handles the remote tool call loop — if the server responds with `RemoteToolCallBlock` entries, the client executes the registered handlers and re-invokes the graph until the agent returns a final text response or the `recursion_limit` is reached.

Use `invoke()` when you want a complete, final answer before updating the UI. For incremental updates use [`stream()`](stream.md).

**Endpoint:** `POST /v1/graph/invoke`  
**Source:** `src/endpoints/invoke.ts`

---

## Signature

```ts
client.invoke(
  messages: Message[],
  options?: InvokeOptions
): Promise<InvokeResult>
```

---

## Parameters

### `messages`

An array of `Message` objects to send. The most recent message is typically the user's input. You can include a `system` message to set the agent's persona:

```ts
const systemMsg = Message.text_message('You are a concise assistant.', 'system');
const userMsg   = Message.text_message('What is 2 + 2?');

const result = await client.invoke([systemMsg, userMsg]);
```

The client serialises each `Message` before sending it. If `message.message_id` is `null` or `undefined`, the serialised payload uses `"0"` — the server replaces this with a real ID.

### `options` (optional)

| Field | Type | Default | Description |
|---|---|---|---|
| `initial_state` | `Record<string, any>` | `undefined` | Initial state values to seed the graph before execution. Keys must match the graph's state schema. |
| `config` | `Record<string, any>` | `undefined` | LangGraph-style run configuration. Common keys: `{ configurable: { thread_id: 'my-thread' } }`. When `thread_id` is set the server checkpoints state between calls — omitting it runs the graph without persistence. |
| `recursion_limit` | `number` | `25` | Maximum number of invoke loop iterations. Each iteration is one call to `/v1/graph/invoke`. When the limit is reached `InvokeResult.recursion_limit_reached` is `true`. |
| `response_granularity` | `'full' \| 'partial' \| 'low'` | `'full'` | Controls how much data the server returns per call. See [Response granularity](#response-granularity) below. |
| `onPartialResult` | `InvokeCallback` | `undefined` | Callback invoked after each loop iteration with intermediate results. Useful for showing progress in the UI without full streaming. |

---

## Return value: `InvokeResult`

```ts
interface InvokeResult {
  messages: Message[];             // Final messages from the last iteration
  state?: AgentState;              // Final graph state
  context?: Message[];             // Relevant context messages (RAG results, etc.)
  summary?: string | null;         // Optional LLM-generated conversation summary
  meta: InvokeMetadata;            // Thread ID and is_new_thread flag
  all_messages: Message[];         // All messages across all iterations (including tool results)
  iterations: number;              // How many invoke loop iterations ran
  recursion_limit_reached: boolean; // true if iterations hit the recursion_limit
}
```

### `InvokeMetadata`

```ts
interface InvokeMetadata {
  is_new_thread: boolean;  // true if this call created a new thread
  thread_id: string;       // The thread ID used for this invocation
}
```

Use `meta.thread_id` if you want to continue the conversation in a later call:

```ts
const first = await client.invoke([userMsg], {
  config: { configurable: { thread_id: 'conv-001' } },
});

const followUp = await client.invoke(
  [Message.text_message('Tell me more')],
  { config: { configurable: { thread_id: first.meta.thread_id } } }
);
```

---

## Response granularity

The `response_granularity` option controls what the server includes in each response payload:

| Value | State | Context | Summary | When to use |
|---|---|---|---|---|
| `'full'` | ✅ | ✅ | ✅ | When you need complete state inspection or debugging. |
| `'partial'` | ✅ | ✅ | ❌ | When you need state but not the summary. Slightly faster. |
| `'low'` | ❌ | ❌ | ❌ | When you only need the final messages. Best for production chat UIs. |

---

## InvokeCallback

The `onPartialResult` callback receives an `InvokePartialResult` after each loop iteration:

```ts
interface InvokePartialResult {
  iteration: number;
  messages: Message[];
  state?: AgentState;
  context?: Message[];
  summary?: string | null;
  meta: InvokeMetadata;
  has_tool_calls: boolean;  // true if this iteration returned remote tool calls
  is_final: boolean;        // true if this is the last iteration
}

type InvokeCallback = (partial: InvokePartialResult) => void | Promise<void>;
```

Example — show a "thinking…" indicator while waiting for the agent:

```ts
const result = await client.invoke([userMsg], {
  onPartialResult(partial) {
    if (partial.has_tool_calls) {
      console.log(`Iteration ${partial.iteration}: running tools…`);
    }
    if (partial.is_final) {
      console.log('Final answer received');
    }
  },
});
```

---

## Remote tool call loop

When you have registered remote tools with `client.registerTool()` and the agent requests one, the loop works like this:

1. Client sends the initial messages to `POST /v1/graph/invoke`.
2. Server responds. If any `RemoteToolCallBlock` is in the response messages, the client intercepts them.
3. Client maps each `RemoteToolCallBlock.name` to its registered `ToolHandler` and executes the handlers locally.
4. Client wraps the handler results in `ToolResultBlock` objects and sends them back to `/v1/graph/invoke` as `tool` role messages.
5. Steps 2–4 repeat until the server returns no more `RemoteToolCallBlock` entries or `recursion_limit` is reached.

See [`reference/client/tools`](tools.md) for how to register handlers.

---

## `InvokeRequest` (advanced)

If you are calling the invoke endpoint directly (not through `AgentFlowClient`) the request body has this shape:

```ts
interface InvokeRequest {
  messages: any[];                           // Serialised Message objects
  initial_state?: Record<string, any>;
  config?: Record<string, any>;
  recursion_limit?: number;                  // default 25
  response_granularity?: 'full' | 'partial' | 'low';
}
```

---

## Code examples

### Minimal invoke

```ts
import { AgentFlowClient, Message } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

const result = await client.invoke([
  Message.text_message('What is the capital of Japan?'),
]);

console.log(result.messages[0].content[0]);
// { type: 'text', text: 'The capital of Japan is Tokyo.' }
```

### Persistent thread

```ts
const THREAD_ID = 'user-123-session-456';

async function chat(userInput: string) {
  const result = await client.invoke(
    [Message.text_message(userInput)],
    {
      config: { configurable: { thread_id: THREAD_ID } },
      response_granularity: 'low',
    }
  );

  // Extract the assistant's text response
  const assistantMsg = result.messages.find(m => m.role === 'assistant');
  const textBlock = assistantMsg?.content.find(b => b.type === 'text');
  return (textBlock as any)?.text ?? '';
}

await chat('Hello!');
await chat('Tell me a joke.');  // Remembers the previous message
```

### With initial state

```ts
const result = await client.invoke(
  [Message.text_message('Continue where we left off')],
  {
    initial_state: {
      user_preferences: { language: 'en', theme: 'dark' },
    },
    config: { configurable: { thread_id: 'thread-789' } },
  }
);
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `401` | Missing or invalid auth token. | Set `auth` in `AgentFlowConfig`. |
| `AgentFlowError` status `422` | Invalid request payload (e.g. empty `messages` array, bad `config` shape). | Check that `messages` is non-empty and all required fields are correct. |
| `AgentFlowError` status `500` | Server-side error during graph execution. | Check the server logs with `agentflow api --verbose`. |
| `Request timeout` | The graph took longer than `config.timeout`. | Increase `timeout` in `AgentFlowConfig` or optimise the graph. |
| `recursion_limit_reached: true` | The tool call loop ran more than `recursion_limit` iterations. | Increase `recursion_limit` in options, or check that tools are completing without infinite loops. |

---

## What you learned

- `invoke()` sends messages and returns when the agent produces a final response.
- The `config.configurable.thread_id` option enables persistent conversations with checkpointing.
- `response_granularity: 'low'` is the most efficient setting for chat UIs.
- The `onPartialResult` callback lets you react to each iteration without requiring full streaming.
- The remote tool call loop is handled automatically — just register your handlers with `registerTool()`.

## Next step

See [`reference/client/stream`](stream.md) to learn the `stream()` method for token-by-token streaming.
