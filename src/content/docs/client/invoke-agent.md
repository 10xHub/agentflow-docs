---
title: Invoke the agent
description: Call client.invoke() to send messages to your agent and get back responses with full control over threading, error handling, and response structure.
section: TypeScript client
group: Basics
order: 30
label: Invoke the agent
updated: "2026-10-08"
faq:
  - question: How do I keep conversation history between calls?
    answer: Pass a thread_id in the config object. The same thread_id will replay messages in order and maintain state across multiple invoke calls, so the agent has context from earlier turns.
  - question: "What's the difference between response_granularity values?"
    answer: "'low' returns only messages (fastest, production); 'partial' includes state for UI rendering; 'full' includes state and summary (debugging). Use 'low' unless you need the extra data."
  - question: How do I see what the agent is doing step by step?
    answer: Pass an onPartialResult callback to invoke(). It fires after each iteration, telling you if tool calls were made and when the run completes.
---

`client.invoke()` sends a message to your agent and waits for the final response. It handles multiple tool calls automatically, returns full state information, and supports persistent threads so conversations can span multiple API calls. This guide walks you through the core operations.

## Prerequisites

You need a configured `TenxGraphClient` instance and a 10xGraph API server with a compiled graph running. Set up both in [Create a client](/docs/client/create-client) first.

## Build and send a message

Messages are the fundamental unit of communication with the agent. Create a message using `Message.text_message()`, then pass it to `client.invoke()` in an array:

```ts
import { Message, TenxGraphClient } from '10xgraph-client';

const client = new TenxGraphClient({
  baseUrl: 'http://localhost:8000',
  auth: { type: 'bearer', token: 'your-token' },
});

const response = await client.invoke([
  Message.text_message('What is the capital of France?'),
]);
```

The call blocks until the agent completes, including all tool calls. The return value is an `InvokeResult` containing the final `messages` array, `meta` (thread info), and optionally `state` and `summary` depending on `response_granularity`.

You can also provide a system prompt by creating a message with role `'system'`:

```ts
const response = await client.invoke([
  Message.text_message('You are a helpful geography assistant.', 'system'),
  Message.text_message('What is the capital of France?'),
]);
```

## Extract the response text

The assistant's response is in `result.messages`. Find the last message with `role: 'assistant'`, then extract text from its `content` array:

```ts
const assistantMsg = response.messages.find(m => m.role === 'assistant');
if (assistantMsg) {
  const text = assistantMsg.content
    .filter(block => block.type === 'text')
    .map(block => (block as any).text)
    .join('');
  console.log(text);
}
```

For multimodal responses (images, audio, documents), the agent may include other block types. Check `block.type` to handle each one appropriately.

## Keep conversation history with threads

By default, each `invoke()` call is independent. To maintain conversation history, pass a `thread_id` in the `config` object. The same thread will replay all prior messages in order:

```ts
const threadId = 'user-123-session';

// First turn
const first = await client.invoke(
  [Message.text_message('Tell me about Paris.')],
  { config: { thread_id: threadId } }
);
console.log(first.messages[first.messages.length - 1].content);

// Second turn: the agent sees the first message and response automatically
const second = await client.invoke(
  [Message.text_message('And its history?')],
  { config: { thread_id: threadId } }
);
```

The result includes metadata about the thread: `result.meta.thread_id` (the ID used) and `result.meta.is_new_thread` (true only on the first call for a given ID).

## Control response size with granularity

The `response_granularity` option tells the server how much data to include in the response:

```ts
const response = await client.invoke(
  [Message.text_message('Summarize this document.')],
  {
    config: { thread_id: 'doc-summary-1' },
    response_granularity: 'low',  // Fastest, messages only
  }
);
```

| Level | Includes | Best for |
|-------|----------|----------|
| `'low'` | Messages only | Production chat, minimal latency |
| `'partial'` | Messages + state | UI that renders full state |
| `'full'` | Messages + state + summary | Debugging, admin dashboards |

In production, use `'low'` for the fastest response. Move to `'partial'` or `'full'` only if your UI needs the extra data.

## Monitor progress with partial results

When the agent makes multiple tool calls, you can see each step with the `onPartialResult` callback. It fires after every iteration:

```ts
const response = await client.invoke(
  [Message.text_message('Research the latest breakthroughs in quantum computing.')],
  {
    onPartialResult(partial) {
      console.log(`Iteration ${partial.iteration}:`);
      console.log(`  Tool calls: ${partial.has_tool_calls}`);
      if (partial.is_final) {
        console.log('  Agent finished.');
      }
    },
  }
);
console.log(`Completed in ${response.iterations} steps.`);
```

The `InvokePartialResult` gives you iteration count, whether tool calls were made, and whether the run is complete. This is useful for showing progress bars or logging in production.

## Handle errors gracefully

Network errors, authentication failures, and validation errors are thrown as exceptions. Catch `TenxGraphError` to handle specific HTTP status codes:

```ts
import { TenxGraphError } from '10xgraph-client';

try {
  const response = await client.invoke([
    Message.text_message('What is the meaning of life?'),
  ]);
  displayResponse(response.messages);
} catch (err) {
  if (err instanceof TenxGraphError) {
    switch (err.statusCode) {
      case 401:
        // Auth failed: token invalid or expired
        console.error('Not authenticated. Re-login.');
        redirectToLogin();
        break;
      case 403:
        // Auth succeeded but user lacks permission
        console.error('Permission denied for this agent.');
        break;
      case 500:
        console.error('Server error. Try again later.');
        break;
      default:
        console.error(`HTTP ${err.statusCode}: ${err.message}`);
    }
  } else {
    // Network error, timeout, etc.
    console.error('Connection failed:', err);
  }
}
```

See [Error handling](/docs/client/error-handling) for the full error type reference.

## Complete working example

This example creates a client, invokes the agent in a loop to simulate a conversation, and extracts text from each response:

```ts
import {
  TenxGraphClient,
  Message,
  TenxGraphError,
} from '10xgraph-client';

const client = new TenxGraphClient({
  baseUrl: 'http://localhost:8000',
  auth: { type: 'bearer', token: process.env.API_TOKEN || '' },
});

async function askAgent(
  question: string,
  threadId: string
): Promise<string | null> {
  try {
    const result = await client.invoke(
      [Message.text_message(question)],
      {
        config: { thread_id: threadId },
        response_granularity: 'low',
      }
    );

    const assistantMsg = result.messages.find(
      m => m.role === 'assistant'
    );
    if (!assistantMsg) return null;

    return assistantMsg.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('');
  } catch (err) {
    if (err instanceof TenxGraphError) {
      console.error(`Agent error [${err.statusCode}]: ${err.message}`);
    } else {
      console.error('Unexpected error:', err);
    }
    return null;
  }
}

// Example usage
(async () => {
  const thread = 'conversation-001';
  
  const answer1 = await askAgent('What is quantum entanglement?', thread);
  console.log('Agent:', answer1);

  const answer2 = await askAgent('Can you explain it more simply?', thread);
  console.log('Agent:', answer2);
})();
```

Run this with:

```bash
NODE_OPTIONS="--loader ts-node/esm" node script.ts
```

Or compile to JavaScript first and run `node script.js`.

## Verify the setup

If you see these errors, here are the fixes:

| Error | Cause | Fix |
|-------|-------|-----|
| `TypeError: Failed to fetch` | Server not running | Start it with `10xgraph api` |
| `TenxGraphError 401` | Token invalid or missing | Check `API_TOKEN` env var |
| `TenxGraphError 404` | Agent graph not found | Verify the config file path |
| Empty messages array | Agent has no output | Check the agent code for issues |

The agent should respond within seconds. If responses take too long, check the graph's tool calls and model configuration.

## What you learned

- Create messages with `Message.text_message()` and pass them to `client.invoke()`.
- Extract text from the response by filtering for `role === 'assistant'` and `block.type === 'text'`.
- Use `thread_id` in the config to persist conversation history across calls.
- Set `response_granularity` to 'low' for production, 'full' or 'partial' for debugging.
- Monitor progress with `onPartialResult` callbacks for multi-step agent runs.
- Catch `TenxGraphError` by status code to handle auth, permission, and server errors.

## Next steps

- Stream responses token-by-token in [Stream responses](/docs/client/stream-responses).
- Manage multiple conversations with [Manage threads](/docs/client/manage-threads).
- Run tools on the client side in [Remote tools](/docs/client/remote-tools).
- Build forms and UIs around invoke in [Next.js and React](/docs/client/nextjs-and-react).
