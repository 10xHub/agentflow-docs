---
title: stream()
description: Reference for the AgentFlowClient.stream() method — receive real-time streaming chunks from the agent.
sidebar_position: 4
---

# `stream()`

`client.stream()` sends a list of messages to the agent graph and returns an `AsyncGenerator` that yields `StreamChunk` objects in real time as the server produces them. Use streaming when you want to show incremental output to the user — token by token, update by update — instead of waiting for the full response.

**Endpoint:** `POST /v1/graph/stream`  
**Source:** `src/endpoints/stream.ts`

---

## Signature

```ts
client.stream(
  messages: Message[],
  options?: StreamOptions
): AsyncGenerator<StreamChunk, void, unknown>
```

`stream()` is synchronous — it returns the generator immediately without making a network call. The HTTP request starts when you begin iterating with `for await`.

---

## Parameters

### `messages`

Same as [`invoke()`](invoke.md#parameters). An array of `Message` objects.

### `options` (optional)

| Field | Type | Default | Description |
|---|---|---|---|
| `initial_state` | `Record<string, any>` | `undefined` | Initial state values to seed the graph. |
| `config` | `Record<string, any>` | `undefined` | Run config. Set `configurable.thread_id` for persistent state. |
| `recursion_limit` | `number` | `25` | Maximum recursion depth for the graph. |
| `response_granularity` | `'full' \| 'partial' \| 'low'` | `'low'` | Controls how much data is included in state/update events. Default is `'low'` for streaming (unlike invoke where the default is `'full'`). |

---

## Return value: `AsyncGenerator<StreamChunk>`

The generator yields `StreamChunk` objects. Iteration ends when the server closes the stream.

### `StreamChunk`

```ts
interface StreamChunk {
  event: StreamEventType | string;
  message?: Message | null;
  state?: AgentState | null;
  data?: any;
  thread_id?: string;
  run_id?: string;
  metadata?: StreamMetadata | Record<string, any>;
  timestamp?: number;
}

interface StreamMetadata {
  is_new_thread: boolean;
  thread_id: string;
  [key: string]: any;
}
```

---

## `StreamEventType`

The `event` field on a `StreamChunk` is a string matching one of these values (exported as the `StreamEventType` enum):

| Event | Enum value | Description |
|---|---|---|
| `'message'` | `StreamEventType.MESSAGE` | A new or updated `Message` from the agent. The `message` field contains the full `Message` object. On streaming models this fires multiple times with partial token content (`message.delta = true`), followed by a final chunk with `delta = false`. |
| `'updates'` | `StreamEventType.UPDATES` | The graph state was updated. The `state` field contains the updated `AgentState`. Only emitted when `response_granularity` is `'partial'` or `'full'`. |
| `'state'` | `StreamEventType.STATE` | The complete current state snapshot. Only emitted when `response_granularity` is `'full'`. |
| `'error'` | `StreamEventType.ERROR` | An error occurred during graph execution. The `data` field contains the error details. |

---

## Async iterator examples

### Basic streaming

```ts
import { AgentFlowClient, Message, StreamEventType } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

const stream = client.stream([
  Message.text_message('Write me a short poem about the ocean.'),
]);

for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
    const textBlock = chunk.message.content.find(b => b.type === 'text');
    if (textBlock && 'text' in textBlock) {
      process.stdout.write(textBlock.text);
    }
  }
}
console.log('\n--- Stream complete ---');
```

### Streaming with state updates

```ts
const stream = client.stream(
  [Message.text_message('Analyse this dataset.')],
  {
    config: { configurable: { thread_id: 'analysis-001' } },
    response_granularity: 'full',
  }
);

for await (const chunk of stream) {
  switch (chunk.event) {
    case StreamEventType.MESSAGE:
      if (chunk.message?.delta) {
        // Partial token — append to UI
        appendTokenToUI(chunk.message);
      } else if (chunk.message) {
        // Final message — replace partial content
        setFinalMessage(chunk.message);
      }
      break;

    case StreamEventType.UPDATES:
      console.log('State updated:', chunk.state);
      break;

    case StreamEventType.STATE:
      console.log('Full state snapshot:', chunk.state);
      break;

    case StreamEventType.ERROR:
      console.error('Stream error:', chunk.data);
      break;
  }
}
```

### Streaming in a React component

```tsx
import { useState } from 'react';
import { AgentFlowClient, Message, StreamEventType } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

function ChatBox() {
  const [output, setOutput] = useState('');

  async function sendMessage(text: string) {
    setOutput('');

    const stream = client.stream([Message.text_message(text)]);

    for await (const chunk of stream) {
      if (chunk.event === StreamEventType.MESSAGE && chunk.message?.delta) {
        const textBlock = chunk.message.content.find(b => b.type === 'text');
        if (textBlock && 'text' in textBlock) {
          setOutput(prev => prev + textBlock.text);
        }
      }
    }
  }

  return (
    <div>
      <button onClick={() => sendMessage('Hello!')}>Send</button>
      <pre>{output}</pre>
    </div>
  );
}
```

### Collecting the full response from a stream

If you want to wait for the complete stream but still use streaming internally:

```ts
async function streamToString(messages: Message[]): Promise<string> {
  const stream = client.stream(messages);
  let fullText = '';

  for await (const chunk of stream) {
    if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
      for (const block of chunk.message.content) {
        if (block.type === 'text') {
          fullText += block.text;
        }
      }
    }
  }

  return fullText;
}
```

### Stopping a stream mid-way

The generator supports early exit via `break` or `return`. The server keeps running until the `stopGraph()` call is sent:

```ts
const stream = client.stream([Message.text_message('Tell me a very long story')]);
let wordCount = 0;

for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
    const textBlock = chunk.message.content.find(b => b.type === 'text');
    if (textBlock && 'text' in textBlock) {
      wordCount += textBlock.text.split(' ').length;
    }
  }

  if (wordCount > 500) {
    // Stop iterating locally and request server-side stop
    const threadId = '...'; // from chunk.thread_id or your config
    await client.stopGraph(threadId);
    break;
  }
}
```

---

## `StreamRequest` (advanced)

The shape of the request body sent to `POST /v1/graph/stream`:

```ts
interface StreamRequest {
  messages: any[];
  initial_state?: Record<string, any>;
  config?: Record<string, any>;
  recursion_limit?: number;       // default 25
  response_granularity?: 'full' | 'partial' | 'low';
}
```

---

## Stream format

The server sends the stream as **NDJSON** (newline-delimited JSON) over HTTP. Each line is a JSON object matching the `StreamChunk` shape. The client's parser also handles concatenated JSON objects (no newlines) for compatibility with some proxy configurations.

Response header: `Content-Type: text/event-stream`

Example raw stream output:

```
{"event":"message","message":{"role":"assistant","content":[{"type":"text","text":"The"}],"delta":true},"thread_id":"abc123"}
{"event":"message","message":{"role":"assistant","content":[{"type":"text","text":" capital"}],"delta":true},"thread_id":"abc123"}
{"event":"message","message":{"role":"assistant","content":[{"type":"text","text":" of France is Paris."}],"delta":false},"thread_id":"abc123"}
{"event":"updates","state":{"messages":[...]},"thread_id":"abc123"}
```

### Using curl

```bash
curl --no-buffer -X POST http://localhost:8000/v1/graph/stream \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "messages": [{ "role": "user", "content": [{"type": "text", "text": "Hello"}], "message_id": "0" }],
    "response_granularity": "low"
  }'
```

---

## invoke() vs stream() comparison

| Aspect | `invoke()` | `stream()` |
|---|---|---|
| Network requests | One per loop iteration | One streaming connection |
| When result arrives | After full graph execution | Token by token in real time |
| Default `response_granularity` | `'full'` | `'low'` |
| Remote tool handling | Automatic loop | Manual — check for `RemoteToolCallBlock` in message chunks |
| Return type | `Promise<InvokeResult>` | `AsyncGenerator<StreamChunk>` |
| Best for | Background tasks, batch | Chat UIs, real-time displays |

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `401` | Missing or invalid auth. | Set `auth` in config. |
| Stream stops mid-response | Server timeout or network issue. | Wrap the `for await` loop in try/catch and retry. |
| `event: 'error'` chunks | Graph execution error. | Read `chunk.data` for the error message and check server logs. |

---

## What you learned

- `stream()` returns an `AsyncGenerator` — iterate it with `for await`.
- `StreamEventType.MESSAGE` with `delta: true` is a partial token; `delta: false` is the final message.
- `StreamEventType.UPDATES` and `STATE` require `response_granularity: 'partial'` or `'full'`.
- Use `response_granularity: 'low'` for the best streaming performance in chat UIs.
- Use `stopGraph()` to cancel a running stream on the server.

## Next step

See [`reference/client/threads`](threads.md) to learn how to manage persistent conversation threads.
