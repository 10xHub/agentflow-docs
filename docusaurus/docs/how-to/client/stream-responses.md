---
title: How to stream responses — TypeScript client how-to
sidebar_label: How to stream responses
description: Step-by-step guide to using client.stream() for real-time token-by-token output.
keywords:
  - agentflow typescript client
  - ai agent client
  - agent sdk
  - agentflow
  - python ai agent framework
  - how to stream responses
sidebar_position: 3
---


# How to stream responses

`client.stream()` lets you display the agent's response as it is generated — word by word — instead of waiting for the full response. This guide shows you how to start a stream, process each event type, and update a UI incrementally.

## Prerequisites

- A configured `AgentFlowClient`. See [how-to/client/create-client](create-client.md).
- The AgentFlow API server running.

---

## Step 1: Start the stream

`client.stream()` returns an `AsyncGenerator` immediately. The HTTP request starts when you begin iterating with `for await`:

```ts
import { Message, StreamEventType } from '@10xscale/agentflow-client';

const stream = client.stream([
  Message.text_message('Write a haiku about mountains.'),
]);

for await (const chunk of stream) {
  console.log(chunk.event, chunk);
}
```

---

## Step 2: Filter for message events

The `event` field on each chunk tells you what kind of update arrived. For a basic streaming chat UI you only need `StreamEventType.MESSAGE` chunks:

```ts
for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
    for (const block of chunk.message.content) {
      if (block.type === 'text') {
        process.stdout.write((block as any).text);
      }
    }
  }
}
```

When the model is streaming, it sends many small chunks with `message.delta = true` (partial content), followed by a final chunk with `message.delta = false` (the complete message).

---

## Step 3: Differentiate delta and final chunks

```ts
let buffer = '';

for await (const chunk of stream) {
  if (chunk.event !== StreamEventType.MESSAGE || !chunk.message) continue;

  const text = chunk.message.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text as string)
    .join('');

  if (chunk.message.delta) {
    // Partial token — append to the in-progress message
    buffer += text;
    updateStreamingUI(buffer);
  } else {
    // Final complete message — replace the streaming placeholder
    buffer = text;
    finaliseMessage(buffer);
    buffer = '';
  }
}
```

---

## Step 4: Use a persistent thread

Same as `invoke()` — pass `config.thread_id`:

```ts
const stream = client.stream(
  [Message.text_message('Continue our discussion about climate change.')],
  {
    config: { thread_id: 'stream-session-001' },
    response_granularity: 'low',
  }
);
```

The `thread_id` is also available on every chunk as `chunk.thread_id` and `chunk.metadata?.thread_id`.

---

## Step 5: Handle state updates (optional)

Set `response_granularity: 'full'` or `'partial'` if you want the server to emit state updates as the graph progresses:

```ts
const stream = client.stream(
  [Message.text_message('Summarise the conversation so far.')],
  { response_granularity: 'full' }
);

for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
    // Handle text tokens
  } else if (chunk.event === StreamEventType.UPDATES) {
    console.log('State updated:', chunk.state);
  } else if (chunk.event === StreamEventType.STATE) {
    console.log('Full state snapshot:', chunk.state);
  } else if (chunk.event === StreamEventType.ERROR) {
    console.error('Graph error:', chunk.data);
    break;
  }
}
```

---

## Step 6: Stop a stream early

If the user clicks a "stop" button, break out of the loop and call `stopGraph()`:

```ts
let threadId: string | undefined;

const stream = client.stream(
  [Message.text_message('Tell me everything about the universe.')],
  { config: { thread_id: 'long-thread' } }
);

let stopped = false;

// User action sets this to true
document.getElementById('stop')!.addEventListener('click', async () => {
  stopped = true;
  if (threadId) {
    await client.stopGraph(threadId);
  }
});

for await (const chunk of stream) {
  if (stopped) break;

  if (chunk.thread_id) {
    threadId = chunk.thread_id;
  }

  // Process chunks...
}
```

---

## Step 7: React component example

```tsx
import { useState } from 'react';
import { AgentFlowClient, Message, StreamEventType } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({ baseUrl: 'http://localhost:8000' });

export function StreamingChat() {
  const [output, setOutput] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');

  async function handleSend() {
    setOutput('');
    setStreaming(true);

    const stream = client.stream([Message.text_message(input)]);

    for await (const chunk of stream) {
      if (chunk.event === StreamEventType.MESSAGE && chunk.message?.delta) {
        const text = chunk.message.content
          .filter(b => b.type === 'text')
          .map(b => (b as any).text as string)
          .join('');
        setOutput(prev => prev + text);
      }
    }

    setStreaming(false);
  }

  return (
    <div>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={3} />
      <button onClick={handleSend} disabled={streaming}>
        {streaming ? 'Thinking…' : 'Send'}
      </button>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{output}</pre>
    </div>
  );
}
```

---

## Step 8: Collect the full response from a stream

If you need the complete final response but want to use streaming for performance:

```ts
async function streamToResult(messages: Message[]) {
  const stream = client.stream(messages);
  const fullMessages: any[] = [];

  for await (const chunk of stream) {
    if (chunk.event === StreamEventType.MESSAGE && chunk.message && !chunk.message.delta) {
      fullMessages.push(chunk.message);
    }
  }

  return fullMessages;
}
```

---

## Step 9: WebSocket streaming with wsStream()

`client.wsStream()` is a drop-in replacement for `client.stream()` that uses a persistent WebSocket instead of repeated HTTP requests. The API is identical — same options, same chunk format — but the transport differs.

```ts
const stream = client.wsStream(
  [Message.text_message('Explain quantum computing.')],
  {
    config: { thread_id: 'ws-session-001' },
    response_granularity: 'low',
  }
);

for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message?.delta) {
    const text = chunk.message.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text as string)
      .join('');
    process.stdout.write(text);
  }
}
```

### When to use wsStream() vs stream()

| | `stream()` | `wsStream()` |
|---|---|---|
| Transport | HTTP NDJSON body (one request per tool-call iteration) | WebSocket (single connection for the full call) |
| Tool call handling | Opens a new HTTP request per iteration | Sends resume messages over the same socket |
| Browser auth | `Authorization` header | `agentflow-bearer` WebSocket subprotocol |
| Best for | Simple chat without remote tools | Remote-tool-heavy graphs, lower overhead per iteration |

Both methods produce identical `StreamChunk` sequences. The only difference is connection reuse. If your graph makes no remote tool calls, the two methods behave identically. If your graph loops through many tool calls, `wsStream()` avoids the overhead of re-establishing an HTTP connection on each iteration.

The response of `stream()` is sent with `Content-Type: text/event-stream`, but the body is **not** `data:`-prefixed SSE — the server writes one JSON object per line (NDJSON). You only need to care about this if you parse the raw HTTP body yourself; `client.stream()` handles both newline-separated and back-to-back JSON objects for you.

### Run boundaries over the socket

After every run finishes, the server sends a marker chunk on the same socket:

```json
{ "event": "updates", "data": { "status": "done" } }
```

`wsStream()` uses that marker to decide when a remote-tool resume can be sent. If you consume the chunks yourself, treat it as the end of the current run rather than the end of the stream — a run that made remote tool calls emits one `status: "done"` per iteration, and the generator only completes when the socket closes.

### Auth note

The bearer token is never placed in the URL. Browsers cannot set request headers on a WebSocket, so the client sends the token as the second entry of the `Sec-WebSocket-Protocol` header, using the `agentflow-bearer` subprotocol: the socket is opened with `['agentflow-bearer', '<jwt>']`. On Node runtimes whose WebSocket constructor accepts an options argument, an `Authorization: Bearer ...` header is set as well. See [`reference/client/realtime`](../../reference/client/realtime.md), which uses exactly the same handshake.

### WebSocket implementation on Node

`wsStream()` needs a `WebSocket` constructor. Browsers and Node 21+ provide a global one. On Node 18 and 20 you must supply the [`ws`](https://www.npmjs.com/package/ws) package, otherwise the first call throws `No WebSocket implementation available`:

```ts
import WebSocket from 'ws';
import { AgentFlowClient } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  authToken: process.env.API_TOKEN,
  webSocketImpl: WebSocket as unknown as typeof globalThis.WebSocket,
});
```

---

## Verification

Expected terminal output for `Write a haiku about mountains`:

```
Silent peaks arise
Snow-capped giants touch the sky
Wind whispers below
```

If you see no output, check that the server is running and that `baseUrl` is correct. Use `debug: true` in the client config to see verbose logs.

---

## What you learned

- `stream()` returns an `AsyncGenerator` — iterate it with `for await`.
- Filter for `StreamEventType.MESSAGE` chunks to get text tokens.
- `chunk.message.delta === true` means partial token; `delta === false` means the final complete message.
- Use `response_granularity: 'low'` for best streaming performance.
- Break out of the loop and call `stopGraph()` to cancel a running stream.

## Next step

See [how-to/client/manage-threads](manage-threads.md) to learn how to list, inspect, and delete conversation threads.
