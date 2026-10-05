---
title: Connect Client
seoTitle: Connect the 10xGraph TypeScript client
description: "Install 10xgraph-client and call a running 10xGraph API from TypeScript with AgentFlowClient: invoke, stream, bearer auth and thread ids."
section: Get started
order: 40
label: Connect Client
updated: 2026-10-06
---

`10xgraph-client` is a typed TypeScript client for the endpoints exposed by `10xgraph api`: graph execution, thread management, long-term memory, and file uploads. It needs Node.js 18 or newer.

Make sure the API server is running:

```bash
10xgraph api --host 127.0.0.1 --port 8000
```

## Install

```bash
npm install 10xgraph-client
```

## Create a client

```typescript
import { AgentFlowClient } from "10xgraph-client";

const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
});
```

If your server has auth enabled:

```typescript
import { AgentFlowClient, bearerAuth } from "10xgraph-client";

const client = new AgentFlowClient({
  baseUrl: "http://127.0.0.1:8000",
  auth: bearerAuth("your-api-token"),
});
```

Auth helpers: `bearerAuth(token)`, `basicAuth(username, password)`, `headerAuth(name, value)`.

## Make your first call

```typescript
import { Message } from "10xgraph-client";

const result = await client.invoke(
  [Message.text_message("Where is order 1042?")],
  {
    config: { thread_id: "my-thread-001" },
    recursion_limit: 10,
  }
);

console.log(result.messages.at(-1)?.text());
```

## Stream responses

```typescript
import { StreamEventType } from "10xgraph-client";

const stream = client.stream(
  [Message.text_message("Refund order 1042 for 59.00.")],
  { config: { thread_id: "my-thread-002" } }
);

for await (const chunk of stream) {
  if (chunk.event === StreamEventType.MESSAGE && chunk.message) {
    process.stdout.write(chunk.message.text());
  }
}
```

## Go deeper

The how-to guides cover each part of the client in depth:

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

Run `10xgraph play` to open the hosted playground and chat with your agent interactively.
