---
title: Connect Client
description: Call a running 10xGraph API from TypeScript using AgentFlowClient.
section: Get started
order: 40
label: Connect Client
updated: "2026-07-21"
---

`@10xscale/agentflow-client` is a fully typed TypeScript client for every API endpoint exposed by `agentflow api` — graph execution, thread management, long-term memory, and file uploads.

Make sure the API server is running:

```bash
agentflow api --host 127.0.0.1 --port 8000
```

## Install

```bash
npm install @10xscale/agentflow-client
```

## Create a client

```typescript
import { AgentFlowClient } from "@10xscale/agentflow-client";

const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
});
```

If your server has auth enabled:

```typescript
import { AgentFlowClient, bearerAuth } from "@10xscale/agentflow-client";

const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
  auth: bearerAuth("your-api-token"),
});
```

Auth helpers: `bearerAuth(token)`, `basicAuth(username, password)`, `headerAuth(name, value)`.

## Make your first call

```typescript
import { Message } from "@10xscale/agentflow-client";

const result = await client.invoke(
  [Message.text_message("What is the weather in London?")],
  {
    config: { thread_id: "my-thread-001" },
    recursion_limit: 10,
  }
);

console.log(result.messages.at(-1)?.text());
```

## Stream responses

```typescript
import { StreamEventType } from "@10xscale/agentflow-client";

const stream = client.stream(
  [Message.text_message("Tell me a long story.")],
  { config: { thread_id: "my-thread-002" } }
);

for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
    process.stdout.write(chunk.message.text());
  }
}
```

## Go deeper

The client covers three API layers — explore the how-to guides for full usage:

| Topic | Guide |
|---|---|
| Client setup, auth, config options | [Create a client](/docs/how-to/client/create-client) |
| Invoke, stream, WebSocket, partial results | [Invoke an agent](/docs/how-to/client/invoke-agent) |
| Streaming responses in depth | [Stream responses](/docs/how-to/client/stream-responses) |
| Thread state, messages, history | [Manage threads](/docs/how-to/client/manage-threads) |
| Long-term memory store and search | [Use memory API](/docs/how-to/client/use-memory-api) |
| File uploads and multimodal messages | [Upload files](/docs/how-to/client/upload-files) |
| Remote tools from the client side | [Register remote tools](/docs/how-to/client/register-remote-tools) |

## Next step

Run `agentflow play` to open the hosted playground and chat with your agent interactively.
