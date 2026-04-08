---
title: Create and configure the client
description: Step-by-step guide to installing, instantiating, and verifying AgentFlowClient.
sidebar_position: 1
---

# How to create and configure the client

This guide walks you through installing `@10xscale/agentflow-client`, creating a client instance, and verifying that it can reach your AgentFlow API server.

## Prerequisites

- Node.js 18+ or a modern browser environment.
- An AgentFlow API server running locally (`agentflow api`) or hosted.
- If the server requires auth, have the token or credentials ready.

---

## Step 1: Install the package

```bash
npm install @10xscale/agentflow-client
```

Or with Yarn or pnpm:

```bash
yarn add @10xscale/agentflow-client
pnpm add @10xscale/agentflow-client
```

---

## Step 2: Import and instantiate

```ts
import { AgentFlowClient } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
});
```

Replace `http://localhost:8000` with the URL of your server. Do not include a trailing slash.

---

## Step 3: Verify the connection

Call `client.ping()` to confirm the server is reachable before sending real requests:

```ts
const response = await client.ping();
console.log(response); // { pong: true }
```

If this succeeds the client is ready to use.

---

## Step 4: Add authentication

If your server is configured with JWT auth, pass the token using the `auth` field:

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN!,
  },
});
```

For other auth strategies (API key header, HTTP Basic) see [`reference/client/auth`](../../reference/client/auth.md).

---

## Step 5: Tune timeout and debug

The default request timeout is 5 minutes (`300000 ms`). Lower it for latency-sensitive UIs:

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: { type: 'bearer', token: process.env.API_TOKEN! },
  timeout: 60_000,   // 1 minute
  debug: true,       // Log every request in the console during development
});
```

Disable `debug` in production — it logs request details to `console.debug`.

---

## Step 6: Confirm graph metadata

Optionally fetch the graph info to verify the server loaded your graph correctly:

```ts
const info = await client.graph();
console.log('Graph ID:', info.data.id);
console.log('ID type:', info.data.id_type);
```

A successful response confirms the server started, loaded `agentflow.json`, compiled the graph, and is ready to handle requests.

---

## Complete configuration reference

```ts
import { AgentFlowClient, AgentFlowConfig } from '@10xscale/agentflow-client';

const config: AgentFlowConfig = {
  baseUrl: 'http://localhost:8000',   // Required. No trailing slash.
  auth: {                              // Optional. Choose one auth strategy.
    type: 'bearer',
    token: process.env.API_TOKEN!,
  },
  headers: {                           // Optional. Extra headers on every request.
    'X-App-Version': '2.1.0',
  },
  credentials: 'include',             // Optional. For cookie-based sessions in browsers.
  timeout: 300_000,                   // Optional. Milliseconds. Default: 5 mins.
  debug: false,                       // Optional. Default: false.
};

const client = new AgentFlowClient(config);
```

---

## Using in a React or Next.js app

Create the client once at the module level (or in a context provider) so it is shared across components:

```ts
// lib/agentflow.ts
import { AgentFlowClient } from '@10xscale/agentflow-client';

export const client = new AgentFlowClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  auth: process.env.NEXT_PUBLIC_API_TOKEN
    ? { type: 'bearer', token: process.env.NEXT_PUBLIC_API_TOKEN }
    : undefined,
});
```

```tsx
// components/ChatWidget.tsx
import { client } from '../lib/agentflow';
import { Message } from '@10xscale/agentflow-client';

export function ChatWidget() {
  async function sendMessage(text: string) {
    const result = await client.invoke([Message.text_message(text)]);
    // Update UI with result.messages
  }
  // ...
}
```

---

## Common setup errors

| Error | Cause | Fix |
|---|---|---|
| `TypeError: Failed to fetch` | Server is not running or `baseUrl` is wrong. | Start the server with `agentflow api` and verify the URL. |
| `AgentFlowError` status `401` | Auth token is missing or invalid. | Check `auth.token` and the server's `JWT_SECRET_KEY`. |
| `AgentFlowError` status `404` on `/ping` | Server is running but the path is wrong (e.g. trailing slash in `baseUrl`). | Remove the trailing slash from `baseUrl`. |
| CORS error in browser | The server does not allow your origin. | Check the server's CORS config (FastAPI CORS middleware) or set `credentials: 'include'` if using cookies. |

---

## What you learned

- Install with `npm install @10xscale/agentflow-client`.
- Instantiate with `baseUrl` and optional `auth`, `timeout`, `headers`, `debug`.
- Verify connectivity with `client.ping()` before sending agent requests.
- Create the client once at module level and import it in components.

## Next step

See [how-to/client/invoke-agent](invoke-agent.md) to send your first message to the agent.
