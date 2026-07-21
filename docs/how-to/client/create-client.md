---
title: Create and configure the client
sidebar_label: Create and configure the client
description: Step-by-step guide to installing, instantiating, and verifying AgentFlowClient.
keywords:
  - agentflow typescript client
  - ai agent client
  - agent sdk
  - agentflow
  - python ai agent framework
  - create and configure the client
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
console.log(response.data); // 'pong'
```

If this succeeds the client is ready to use.

---

## Step 4: Add authentication

The `auth` field accepts three strategies. Use the factory helpers (`bearerAuth`, `basicAuth`, `headerAuth`) exported from the package, or pass the object literal directly.

### Bearer token (JWT)

The most common strategy. Sends `Authorization: Bearer <token>` on every request.

```ts
import { AgentFlowClient, bearerAuth } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: bearerAuth(process.env.API_TOKEN!),
  // or equivalently:
  // auth: { type: 'bearer', token: process.env.API_TOKEN! },
});
```

### HTTP Basic auth

Sends `Authorization: Basic <base64(username:password)>`.

```ts
import { basicAuth } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: basicAuth('admin', process.env.BASIC_PASSWORD!),
  // or: auth: { type: 'basic', username: 'admin', password: '...' }
});
```

### Custom header

Useful for API keys sent in a custom header (e.g. `X-API-Key`), or when the server uses a non-standard scheme.

```ts
import { headerAuth } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  // Sends: X-API-Key: my-api-key
  auth: headerAuth('X-API-Key', process.env.API_KEY!),

  // Or with a prefix — sends: ApiKey my-api-key
  // auth: headerAuth('Authorization', process.env.API_KEY!, 'ApiKey'),
});
```

### Auth helpers reference

| Helper | Sends | Type |
|---|---|---|
| `bearerAuth(token)` | `Authorization: Bearer <token>` | `AgentFlowBearerAuth` |
| `basicAuth(user, pass)` | `Authorization: Basic <b64>` | `AgentFlowBasicAuth` |
| `headerAuth(name, value, prefix?)` | `<name>: [<prefix> ]<value>` | `AgentFlowHeaderAuth` |

If multiple headers match the same name (case-insensitive), the last one wins. Auth is applied after any headers set via `headers: {...}` on the config.

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
console.log('Nodes:', info.data.nodes.map(n => n.name));
console.log('Checkpointer:', info.data.info.checkpointer_type);
console.log('ID type:', info.data.info.id_type);
```

A successful response confirms the server started, loaded `agentflow.json`, compiled the graph, and is ready to handle requests.

---

## Complete configuration reference

```ts
import {
  AgentFlowClient,
  AgentFlowConfig,
  bearerAuth,
  basicAuth,
  headerAuth,
} from '@10xscale/agentflow-client';

const config: AgentFlowConfig = {
  baseUrl: 'http://localhost:8000',   // Required. No trailing slash.

  // auth — pick one strategy (or omit for no auth):
  auth: bearerAuth(process.env.API_TOKEN!),
  // auth: basicAuth('user', 'pass'),
  // auth: headerAuth('X-API-Key', process.env.API_KEY!),
  // auth: { type: 'bearer', token: '...' },  // object literal also accepted

  authToken: undefined,               // Legacy: shorthand for bearerAuth(token). Use auth instead.

  headers: {                           // Optional. Extra headers on every request.
    'X-App-Version': '2.1.0',
  },
  credentials: 'include',             // Optional. For cookie-based sessions in browsers.
  timeout: 300_000,                   // Optional. Milliseconds. Default: 5 mins (300000).
  debug: false,                       // Optional. Default: false. Logs requests to console.debug.

  // Optional. WebSocket constructor for wsStream() and realtime().
  // Browsers and Node 21+ have a global WebSocket and need nothing here.
  // On Node 18 or 20 this is required, or the first wsStream()/realtime()
  // call throws "No WebSocket implementation available".
  webSocketImpl: undefined,
};

const client = new AgentFlowClient(config);
```

### WebSockets on Node 18 and 20

`wsStream()` and `realtime()` need a `WebSocket` constructor. Node only exposes a global one from version 21, so on Node 18 and 20 install [`ws`](https://www.npmjs.com/package/ws) and pass it through:

```bash
npm install ws
```

```ts
import WebSocket from 'ws';
import { AgentFlowClient } from '@10xscale/agentflow-client';

const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  authToken: process.env.API_TOKEN,
  webSocketImpl: WebSocket as unknown as typeof globalThis.WebSocket,
});
```

Everything else — `invoke()`, `stream()`, threads, memory, files — goes over `fetch` and works without it.

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
