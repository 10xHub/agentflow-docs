---
title: How to invoke the agent — AgentFlow Python AI Agents
description: Step-by-step guide to calling client.invoke() and handling the response. Part of the AgentFlow agentflow typescript client guide for production-ready Python AI.
keywords:
  - agentflow typescript client
  - ai agent client
  - agent sdk
  - agentflow
  - python ai agent framework
  - how to invoke the agent
sidebar_position: 2
---


# How to invoke the agent

`client.invoke()` sends messages to the agent graph and waits for the final response. This guide shows you how to make a basic call, use a persistent thread, extract the response text, and handle errors.

## Prerequisites

- A configured `AgentFlowClient` instance. See [how-to/client/create-client](create-client.md).
- AgentFlow API server running with a compiled graph.

---

## Step 1: Build a message

Use `Message.text_message()` to create a plain text user message:

```ts
import { Message } from '@10xscale/agentflow-client';

const userMessage = Message.text_message('What is the capital of France?');
```

For a system prompt:

```ts
const systemPrompt = Message.text_message(
  'You are a concise geography assistant. Answer in one sentence.',
  'system'
);
```

---

## Step 2: Call invoke()

```ts
const result = await client.invoke([userMessage]);
```

With a system prompt:

```ts
const result = await client.invoke([systemPrompt, userMessage]);
```

`invoke()` returns an `InvokeResult`. The response will not arrive until the graph has finished running — all tool calls complete before the `await` resolves.

---

## Step 3: Extract the response text

The `result.messages` array contains the final messages from the last graph iteration. The assistant's response is typically the last message with `role: 'assistant'`:

```ts
const assistantMsg = result.messages.find(m => m.role === 'assistant');
if (assistantMsg) {
  // TextBlocks have a 'text' property
  const text = assistantMsg.content
    .filter(block => block.type === 'text')
    .map(block => (block as any).text as string)
    .join('');
  console.log('Answer:', text);
}
```

---

## Step 4: Use a persistent thread

Without a `thread_id` the graph runs without persistence — each call is independent. To keep conversation history across calls, pass a `thread_id` in `config`:

```ts
const THREAD_ID = 'user-123-session-1';

const result = await client.invoke(
  [Message.text_message('Tell me about Paris.')],
  {
    config: { configurable: { thread_id: THREAD_ID } },
  }
);

// After ending, continue the conversation in a later call
const followUp = await client.invoke(
  [Message.text_message('And what about its history?')],
  {
    config: { configurable: { thread_id: THREAD_ID } },
  }
);
// The agent remembers "Paris" from the first turn
```

`result.meta.thread_id` always contains the thread ID used. `result.meta.is_new_thread` is `true` on the first call for a given ID.

---

## Step 5: Choose response granularity

The `response_granularity` option controls how much the server includes in the response. Use `'low'` in production for best performance:

```ts
const result = await client.invoke(
  [Message.text_message('Summarise this document')],
  {
    config: { configurable: { thread_id: 'doc-summary-01' } },
    response_granularity: 'low',  // Only return messages, no state or summary
  }
);
```

| Value | State included | Summary included | Use when |
|---|---|---|---|
| `'full'` | ✅ | ✅ | Debugging, admin tools |
| `'partial'` | ✅ | ❌ | When you need state for UI rendering |
| `'low'` | ❌ | ❌ | Production chat, fastest response |

---

## Step 6: React to intermediate steps (optional)

If the graph makes multiple tool calls, you can observe each iteration with `onPartialResult`:

```ts
const result = await client.invoke(
  [Message.text_message('Research the latest AI news.')],
  {
    onPartialResult(partial) {
      if (partial.has_tool_calls) {
        console.log(`Step ${partial.iteration}: searching…`);
      }
    },
  }
);
console.log(`Completed in ${result.iterations} step(s)`);
```

---

## Step 7: Handle errors

Wrap the call in a `try/catch` block to handle server errors gracefully:

```ts
import { AgentFlowError } from '@10xscale/agentflow-client';

try {
  const result = await client.invoke([userMessage]);
  displayResponse(result.messages);
} catch (err) {
  if (err instanceof AgentFlowError) {
    if (err.status === 401) {
      redirectToLogin();
    } else {
      showError(`Server error [${err.status}]: ${err.message}`);
    }
  } else {
    showError('Unexpected error');
    throw err;
  }
}
```

---

## Complete working example

```ts
import {
  AgentFlowClient,
  Message,
  AgentFlowError,
} from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: { type: 'bearer', token: process.env.API_TOKEN! },
  response_granularity: 'low',
});

async function ask(question: string, threadId: string): Promise<string> {
  const result = await client.invoke(
    [Message.text_message(question)],
    {
      config: { configurable: { thread_id: threadId } },
      response_granularity: 'low',
    }
  );

  return result.messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => m.content)
    .filter(b => b.type === 'text')
    .map(b => (b as any).text as string)
    .join('');
}

// Usage
const answer = await ask('What is quantum entanglement?', 'thread-001');
console.log(answer);
```

---

## Verification

Expected console output:

```
Answer: The capital of France is Paris.
```

If you see a `401` error, your token is wrong. If you see `TypeError: Failed to fetch`, the server is not running. Start it with:

```bash
agentflow api
```

---

## What you learned

- Use `Message.text_message()` to create user and system messages.
- Pass `config: { configurable: { thread_id } }` to persist conversation state.
- Extract assistant text by filtering `result.messages` for `role === 'assistant'` and `block.type === 'text'`.
- Use `response_granularity: 'low'` for the fastest response in production.
- Catch `AgentFlowError` to handle HTTP errors by status code.

## Next step

See [how-to/client/stream-responses](stream-responses.md) to learn how to stream the response token by token for a better UI experience.
