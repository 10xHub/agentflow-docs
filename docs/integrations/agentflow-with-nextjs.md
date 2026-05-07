---
title: "AgentFlow with Next.js: Build a Streaming Agent Frontend"
sidebar_label: with Next.js
description: How to call an AgentFlow Python agent from a Next.js frontend with streaming, auth, and typed responses. Server actions, route handlers, and AgentFlow.
keywords:
  - agentflow nextjs
  - nextjs ai agent
  - python agent react frontend
  - nextjs streaming llm
  - agent chat ui nextjs
sidebar_position: 3
---

# AgentFlow with Next.js

A Python agent backend + a Next.js frontend is the most common production stack we see. AgentFlow's typed TypeScript client (`@10xscale/agentflow-client`) is built for this.

## Architecture

```
[ Next.js (App Router) ]
   ├── React UI (client component)
   └── Route Handler / Server Action (Node runtime)
              │
              ▼ HTTP / SSE
[ AgentFlow API ] ← deployed separately
              │
              ▼
[ Postgres + Redis (PgCheckpointer) ]
```

The Next.js app does not run Python. It calls AgentFlow's HTTP API.

## Install

```bash
npm install @10xscale/agentflow-client
```

## Server-side proxy (recommended)

Do not call the AgentFlow API directly from the browser. Your API key would leak. Proxy through a Next.js Route Handler:

```ts
// app/api/agent/stream/route.ts
import {NextRequest} from "next/server";
import {AgentFlowClient, Message} from "@10xscale/agentflow-client";
import {auth} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await auth();
  if (!user) return new Response("Unauthorized", {status: 401});

  const {text} = await req.json();

  const client = new AgentFlowClient({
    baseUrl: process.env.AGENTFLOW_URL!,
    headers: {Authorization: `Bearer ${process.env.AGENTFLOW_API_KEY}`},
  });

  const stream = client.stream(
    [Message.text_message(text)],
    {config: {thread_id: `user-${user.id}`, recursion_limit: 25}},
  );

  // Convert AsyncIterable to ReadableStream and re-emit as SSE
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (e) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({message: String(e)})}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
```

Note: this runs on the Node runtime, not the Edge. The Python backend connection benefits from Node's longer-lived sockets.

## Client-side hook

A small React hook for consuming the stream:

```tsx
"use client";

import {useState, useCallback} from "react";

type Chunk =
  | {type: "message_chunk"; content?: string}
  | {type: "tool_start"; name: string}
  | {type: "tool_end"};

export function useAgentStream() {
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolName, setToolName] = useState<string | null>(null);

  const send = useCallback(async (text: string) => {
    setOutput("");
    setStreaming(true);
    try {
      const r = await fetch("/api/agent/stream", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({text}),
      });
      if (!r.ok || !r.body) throw new Error("stream failed");

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buf += decoder.decode(value, {stream: true});

        // Split SSE events on "\n\n"
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const dataLine = ev.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const json = dataLine.slice(6);
          if (json === "{}") continue;
          const chunk = JSON.parse(json) as Chunk;
          if (chunk.type === "message_chunk" && chunk.content) {
            setOutput((s) => s + chunk.content);
          } else if (chunk.type === "tool_start") {
            setToolName(chunk.name);
          } else if (chunk.type === "tool_end") {
            setToolName(null);
          }
        }
      }
    } finally {
      setStreaming(false);
      setToolName(null);
    }
  }, []);

  return {output, streaming, toolName, send};
}
```

Usage in a chat component:

```tsx
"use client";
import {useAgentStream} from "./useAgentStream";

export default function Chat() {
  const {output, streaming, toolName, send} = useAgentStream();
  return (
    <div>
      <button onClick={() => send("Weather in Tokyo?")} disabled={streaming}>
        Ask
      </button>
      {toolName ? <small>Calling {toolName}…</small> : null}
      <pre>{output}</pre>
    </div>
  );
}
```

## Server Actions (alternative)

For non-streaming use, Server Actions are slightly cleaner:

```ts
// app/actions/agent.ts
"use server";
import {AgentFlowClient, Message} from "@10xscale/agentflow-client";
import {auth} from "@/lib/auth";

const client = new AgentFlowClient({
  baseUrl: process.env.AGENTFLOW_URL!,
  headers: {Authorization: `Bearer ${process.env.AGENTFLOW_API_KEY}`},
});

export async function ask(text: string) {
  const user = await auth();
  if (!user) throw new Error("Unauthorized");

  const result = await client.invoke(
    [Message.text_message(text)],
    {config: {thread_id: `user-${user.id}`}},
  );
  return result.messages.at(-1)?.text() ?? "";
}
```

Server Actions do not stream though. For chat-style UIs, use the route handler pattern above.

## Auth

Two common shapes:

1. **Pass through.** Validate the user in Next.js, send a Bearer token to AgentFlow (server-to-server API key) and use `thread_id = user.id`.
2. **JWT forwarding.** Validate the user, mint a per-request JWT, send to AgentFlow, AgentFlow re-validates. Useful when AgentFlow runs in a different security domain.

See [Auth and authorization](/docs/how-to/production/auth-and-authorization).

## Common gotchas

- **Edge runtime does not support long-lived streams** in some configurations. Default to `runtime = "nodejs"` for SSE.
- **Vercel function timeouts.** The default is 10s. SSE streams need a longer timeout. Use `maxDuration` in your route or move the agent to a long-running deployment.
- **CORS.** If you call AgentFlow from a different origin in dev, configure CORS on the AgentFlow side.
- **Browser EventSource lacks header support.** Always use `fetch` + manual SSE parsing or `@microsoft/fetch-event-source`.

## Hosting Next.js with a long-running agent

Vercel's serverless functions are not great for long-running agent streams. Common alternatives:

- **Vercel + AgentFlow on a non-Vercel host.** Next.js handles the UI; AgentFlow runs on AWS / Fly / Railway.
- **Self-host Next.js.** `next start` on the same infra as AgentFlow. Works fine.
- **Cloudflare Workers + Durable Objects.** Possible but extra plumbing.

For non-streaming, vanilla Vercel is fine.

## Further reading

- [TypeScript client guide](/docs/how-to/client/create-client)
- [Streaming agent responses with FastAPI / SSE](/blog/streaming-agent-responses-fastapi-sse)
- [Deploy AI agent to production](/blog/deploy-ai-agent-docker-aws)
- [Get started](/docs/get-started)
