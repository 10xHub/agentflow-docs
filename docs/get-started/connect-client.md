---
title: Connect Client — AgentFlow Python AI Agent Framework
sidebar_label: Connect Client
description: Call a running AgentFlow API from TypeScript using AgentFlowClient.
keywords:
  - agentflow typescript client
  - agentflow get started
  - agentflow
  - python ai agent framework
  - connect client
  - agentflow client
---

# Connect client

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
| Client setup, auth, config options | [Create a client](../how-to/client/create-client.md) |
| Invoke, stream, WebSocket, partial results | [Invoke an agent](../how-to/client/invoke-agent.md) |
| Streaming responses in depth | [Stream responses](../how-to/client/stream-responses.md) |
| Thread state, messages, history | [Manage threads](../how-to/client/manage-threads.md) |
| Long-term memory store and search | [Use memory API](../how-to/client/use-memory-api.md) |
| File uploads and multimodal messages | [Upload files](../how-to/client/upload-files.md) |
| Remote tools from the client side | [Register remote tools](../how-to/client/register-remote-tools.md) |

## Next step

Run `agentflow play` to open the hosted playground and chat with your agent interactively.
