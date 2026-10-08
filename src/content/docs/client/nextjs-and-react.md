---
title: "Call 10xGraph from Next.js and React"
seoTitle: "10xGraph Next.js integration"
description: "Integrate a 10xGraph Python agent backend with Next.js using route handlers for secure streaming and Server Actions for non-streaming calls."
section: "TypeScript client"
group: "Frameworks"
order: 120
label: with Next.js
updated: "2026-10-08"
faq:
  - question: "Do I need to expose my 10xGraph API key in the browser?"
    answer: "No. Always proxy requests through a Next.js route handler or Server Action. The route handler runs on the server, where it can safely use your API key."
  - question: "Can I use React hooks from the SDK?"
    answer: "No. The SDK exports a typed client class, not hooks. Build your own streaming component using fetch and state management, as shown in this guide."
  - question: "Why should I use Node runtime instead of Edge runtime?"
    answer: "Long-lived HTTP connections for agent streams benefit from Node's socket handling. Edge runtime has strict timeout limits and may not support streaming in all configurations."
---

A Python agent backend running 10xGraph plus a Next.js frontend is the most common production stack. The typed TypeScript client is built for this pattern, letting you securely stream agent responses to React components without exposing credentials to the browser.

## Architecture

In this setup, your browser never talks directly to the 10xGraph API. Instead, Next.js acts as a secure proxy: it validates the user, holds the API key, and streams responses back to the client.

```
┌─────────────────────┐
│   Next.js (client)  │
│  ┌───────────────┐  │
│  │  React (UI)   │  │ ← renders streaming chunks
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼────────┐ │
│  │ Route Handler  │ │ ← keeps API key, proxies requests
│  └───────┬────────┘ │
│          │          │
└──────────┼──────────┘
           │
    ╔──────▼────────╗
    │ 10xGraph API  │
    │  (runs in     │
    │  separate     │
    │  deployment)  │
    ╚──────┬────────╝
           │
    ┌──────▼────────┐
    │ Postgres      │
    │ + Redis       │
    └───────────────┘
```

## Installation

Install the 10xGraph TypeScript client. The package is currently published as `@10xscale/agentflow-client` but is also available under the new name `@10xgraph/client`.

```bash
npm install @10xscale/agentflow-client
```

Ensure your Next.js project has `Node >= 18` for global `fetch` support, or configure your `.npmrc` to include a polyfill.

## Route handler proxy with streaming

The recommended pattern for chat-like UIs is a Next.js route handler that streams responses. The route handler runs on the Node runtime, which maintains long-lived HTTP connections needed for agent streaming. It validates the user, safely holds the API key, and forwards requests to the 10xGraph API server.

### Why not call the API directly from the browser?

Calling the 10xGraph API directly from the browser would require embedding your API key in client-side code, which is a security risk. A compromised key allows anyone to invoke your graphs. The route handler pattern keeps the key on the server.

### Build the route handler

Create a Next.js API route that accepts a message from the client, streams from the 10xGraph agent, and returns Server-Sent Events (SSE) back to the browser:

```ts title="app/api/agent/stream/route.ts"
import { NextRequest } from "next/server";
import { AgentFlowClient, Message } from "@10xscale/agentflow-client";
import { auth } from "@/lib/auth";

// Use Node runtime for streaming support
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Validate the user
  const user = await auth();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Parse the client request
  const { text } = await req.json();

  // Create a client instance with your API key
  const client = new AgentFlowClient({
    baseUrl: process.env.AGENTFLOW_URL!,
    headers: { Authorization: `Bearer ${process.env.AGENTFLOW_API_KEY}` },
  });

  // Stream from the graph
  const stream = client.stream(
    [Message.text_message(text)],
    {
      config: { thread_id: `user-${user.id}` }, // Isolate by user
      recursion_limit: 25,
    }
  );

  // Convert the client's stream to a ReadableStream and wrap as SSE
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          // SSE format: "data: " + JSON.stringify(chunk) + "\n\n"
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
          );
        }
        // Signal completion
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (e) {
        // Emit error as an SSE event
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: String(e) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  // Return streaming response with correct headers
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", // Prevent proxy buffering
    },
  });
}
```

The `recursion_limit` controls how many steps the agent can take. The `thread_id` keeps conversation history separate per user.

## React streaming component

On the client, create a component that opens an SSE stream from your route handler, parses chunks, and displays them to the user. The component uses `fetch` and manual SSE parsing (the browser's `EventSource` API does not support custom headers, which you may need for authentication).

### Hook for stream management

```tsx title="lib/useAgentStream.tsx"
"use client";

import { useState, useCallback } from "react";

// Mirrors the StreamChunk type from the SDK.
// When chunks cross the network as JSON, they are plain objects, not class instances.
type StreamChunk = {
  event: "message" | "updates" | "state" | "error";
  message?: {
    role: string;
    content: Array<Record<string, unknown>>;
  } | null;
  state?: Record<string, unknown> | null;
  data?: Record<string, unknown>;
  thread_id?: string;
  run_id?: string;
};

// Extract text from a chunk's message content blocks
const extractText = (chunk: StreamChunk): string => {
  if (!chunk.message?.content) return "";
  return (chunk.message.content as Array<{ type?: string; text?: string }>)
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
};

type UseAgentStreamReturn = {
  output: string;
  streaming: boolean;
  status: string;
  error: string | null;
  send: (text: string, signal?: AbortSignal) => Promise<void>;
  abort: () => void;
};

export function useAgentStream(): UseAgentStreamReturn {
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reader, setReader] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const abort = useCallback(() => {
    if (reader) {
      reader.cancel();
      setReader(null);
      setStreaming(false);
    }
  }, [reader]);

  const send = useCallback(
    async (text: string, signal?: AbortSignal) => {
      setOutput("");
      setStatus("");
      setError(null);
      setStreaming(true);

      try {
        // Call the route handler
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read the SSE stream
        const streamReader = response.body.getReader();
        setReader(streamReader);

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await streamReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by "\n\n"
          const lines = buffer.split("\n\n");
          buffer = lines[lines.length - 1] ?? "";

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (!line) continue;

            // Parse SSE event
            const dataMatch = line.match(/^data: (.*?)$/m);
            if (!dataMatch) continue;

            try {
              const chunk = JSON.parse(dataMatch[1]) as StreamChunk;

              if (chunk.event === "message") {
                setOutput((prev) => prev + extractText(chunk));
              } else if (chunk.event === "updates") {
                // Lifecycle event: "running", "completed", etc.
                setStatus(chunk.data?.status ?? "");
              } else if (chunk.event === "error") {
                throw new Error(chunk.data?.reason ?? "Agent error");
              }
            } catch (e) {
              // JSON parse error or other issue
              if (e instanceof Error) {
                setError(e.message);
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          setError(e.message);
        }
      } finally {
        setReader(null);
        setStreaming(false);
      }
    },
    []
  );

  return { output, streaming, status, error, send, abort };
}
```

### Use the hook in a chat component

```tsx title="components/ChatBox.tsx"
"use client";

import { useRef } from "react";
import { useAgentStream } from "@/lib/useAgentStream";

export default function ChatBox() {
  const { output, streaming, status, error, send, abort } = useAgentStream();
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSend = async (message: string) => {
    abortControllerRef.current = new AbortController();
    await send(message, abortControllerRef.current.signal);
  };

  const handleAbort = () => {
    abortControllerRef.current?.abort();
    abort();
  };

  return (
    <div className="chat-container">
      <div className="chat-output">
        {output && <p>{output}</p>}
        {status && <small className="status">{status}</small>}
        {error && <small className="error">{error}</small>}
      </div>

      <div className="chat-input">
        <button
          onClick={() => handleSend("What is the weather in Tokyo?")}
          disabled={streaming}
        >
          Ask
        </button>
        {streaming && (
          <button onClick={handleAbort} className="abort-btn">
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
```

The `abort` button lets the user cancel a long-running stream. The output updates in real time as chunks arrive.

## Server Actions (non-streaming alternative)

For simple request-response interactions without streaming, Next.js Server Actions are cleaner. Use this pattern when you do not need real-time output updates.

```tsx title="app/actions/agent.ts"
"use server";

import { AgentFlowClient, Message } from "@10xscale/agentflow-client";
import { auth } from "@/lib/auth";

const client = new AgentFlowClient({
  baseUrl: process.env.AGENTFLOW_URL!,
  headers: { Authorization: `Bearer ${process.env.AGENTFLOW_API_KEY}` },
});

export async function askAgent(text: string): Promise<string> {
  const user = await auth();
  if (!user) throw new Error("Unauthorized");

  const result = await client.invoke(
    [Message.text_message(text)],
    { config: { thread_id: `user-${user.id}` } }
  );

  // Extract the last message's text
  return result.messages.at(-1)?.text() ?? "";
}
```

Invoke it from a client component:

```tsx title="components/SimpleChat.tsx"
"use client";

import { useState } from "react";
import { askAgent } from "@/app/actions/agent";

export default function SimpleChat() {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const answer = await askAgent("What is 2 + 2?");
      setResponse(answer);
    } catch (e) {
      setResponse(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "Asking..." : "Ask"}
      </button>
      {response && <p>{response}</p>}
    </div>
  );
}
```

Server Actions run on the server and return data to the client. They do not support streaming, so responses arrive all at once.

## Authentication patterns

The route handler or Server Action validates the user and creates a scoped session. Two common patterns:

### Pass-through authentication

Validate the user in Next.js, then send your API key to 10xGraph. Use the user ID as the thread ID to isolate conversations:

```tsx
const client = new AgentFlowClient({
  baseUrl: process.env.AGENTFLOW_URL!,
  headers: { Authorization: `Bearer ${process.env.AGENTFLOW_API_KEY}` },
});

const result = await client.invoke(
  messages,
  { config: { thread_id: `user-${user.id}` } }
);
```

This is the simplest and most common pattern. Use it if both Next.js and 10xGraph run in the same security domain or over HTTPS.

### JWT forwarding

For multi-tenant or isolated deployments, mint a short-lived JWT in Next.js and send it to 10xGraph:

```tsx
const token = jwt.sign({ sub: user.id, scope: "invoke" }, JWT_SECRET, {
  expiresIn: "5m",
});

const client = new AgentFlowClient({
  baseUrl: process.env.AGENTFLOW_URL!,
  headers: { Authorization: `Bearer ${token}` },
});
```

Configure 10xGraph to validate the JWT. See [Authentication and authorization](/docs/server/auth).

## Deployment and hosting considerations

### Development

In development, ensure your `.env.local` file has:

```bash
AGENTFLOW_URL=http://localhost:8000
AGENTFLOW_API_KEY=your_api_key_here
```

Run the 10xGraph API server locally (`10xgraph api`) and your Next.js dev server (`npm run dev`) in separate terminals.

### Streaming and function timeouts

Vercel's serverless functions have a default 10-second timeout, which is too short for long-running agent streams. You have several options:

1. **Increase the timeout** using `maxDuration` in your route:

```tsx
export const maxDuration = 60; // 60 seconds
```

2. **Deploy 10xGraph separately** (e.g., on AWS, Fly.io, or Railway) and Next.js to Vercel. This isolates the compute and lets you tune each independently.

3. **Self-host both** on the same infrastructure (Docker, Kubernetes, VPS). Run `next start` and `10xgraph api` on the same machine.

For non-streaming requests, Vercel's default timeout is usually fine.

### CORS and proxy headers

If your 10xGraph API runs on a different origin (different domain or port), ensure CORS is configured. Set `ORIGINS` on the 10xGraph server:

```bash
ORIGINS=https://my-next-app.vercel.app,http://localhost:3000
```

The proxy headers (like `X-Accel-Buffering: no`) tell proxies not to buffer the SSE stream. This is important in production reverse-proxy setups.

## Common issues and fixes

**Browser EventSource does not support custom headers.** If you need to add an Authorization header to SSE, do not use the browser's `EventSource`. Instead, use `fetch` and manual parsing as shown in the hook above. For complex auth, consider the `@microsoft/fetch-event-source` library.

**Edge runtime does not support long-lived streams.** Always set `runtime = "nodejs"` in your route handler. Edge runtime has strict timeout limits and may kill SSE connections.

**Connection resets or hanging requests.** Ensure the 10xGraph server is running and reachable. Check your `AGENTFLOW_URL` and network connectivity. If the server is behind a proxy, verify proxy settings and timeout configurations.

**Message type confusion.** After an SSE chunk crosses the network, the `Message` class methods are not available on plain JSON objects. Extract fields directly (as shown in the `extractText` function) or re-construct the `Message` object using `Message.from_dict()` if needed.

## Related pages

- [TypeScript client reference](/docs/reference/client/client)
- [Stream event types](/docs/reference/client/stream)
- [Create and authenticate a client](/docs/client/create-client)
- [Streaming responses in Python](/docs/guides/stream-graph)
- [Server authentication](/docs/server/auth)
- [Production deployment](/docs/server/deploy)
