---
title: Auth — AgentFlow Python AI Agent Framework
sidebar_label: Auth
description: Reference for all authentication options available in AgentFlowClient. Part of the AgentFlow typescript client reference guide for production-ready Python AI.
keywords:
  - typescript client reference
  - agent client api
  - agentflow client sdk
  - agentflow
  - python ai agent framework
  - auth
sidebar_position: 8
---


# Auth

`AgentFlowClient` supports three authentication strategies, all configured via the `auth` field in `AgentFlowConfig`. It also provides a legacy `authToken` shortcut for the common bearer-token case.

**Source:** `src/request.ts`

---

## Import

```ts
import {
  AgentFlowClient,
  AgentFlowAuth,
  AgentFlowBearerAuth,
  AgentFlowBasicAuth,
  AgentFlowHeaderAuth,
} from '@10xscale/agentflow-client';
```

---

## `AgentFlowAuth` union type

```ts
type AgentFlowAuth =
  | AgentFlowBearerAuth
  | AgentFlowBasicAuth
  | AgentFlowHeaderAuth;
```

Pass a value of this type to `AgentFlowConfig.auth`. If both `authToken` and `auth` are set, `auth` takes precedence.

---

## Bearer token auth

### `AgentFlowBearerAuth`

```ts
interface AgentFlowBearerAuth {
  type: 'bearer';
  token: string;
}
```

Adds the header:

```
Authorization: Bearer <token>
```

This is the dominant auth method when the server is configured with `"auth": "jwt"` or a custom `BaseAuth` that reads the `Authorization: Bearer` header.

#### Example

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN!,
  },
});
```

#### Shorthand

For bearer tokens you can also use the `authToken` convenience field:

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  authToken: process.env.API_TOKEN,
});
```

Both examples produce the same `Authorization` header. Use `auth: { type: 'bearer', token }` when you want to keep all auth logic in one place.

---

## Basic auth

### `AgentFlowBasicAuth`

```ts
interface AgentFlowBasicAuth {
  type: 'basic';
  username: string;
  password: string;
}
```

Adds the header:

```
Authorization: Basic <base64(username:password)>
```

The encoding uses `btoa()` in browsers and `Buffer.from()` in Node.js.

#### Example

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: {
    type: 'basic',
    username: 'admin',
    password: process.env.ADMIN_PASSWORD!,
  },
});
```

:::warning
Basic auth sends credentials with every request. Always use HTTPS in production.
:::

---

## Custom header auth

### `AgentFlowHeaderAuth`

```ts
interface AgentFlowHeaderAuth {
  type: 'header';
  name: string;     // Header name, e.g. 'X-API-Key'
  value: string;    // Header value
  prefix?: string | null;  // Optional prefix prepended to the value, e.g. 'ApiKey'
}
```

Sends a custom header with the specified name and value. If `prefix` is set, the header value is `<prefix> <value>`.

#### Example: API key header

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: {
    type: 'header',
    name: 'X-API-Key',
    value: process.env.API_KEY!,
  },
});
// Sends: X-API-Key: <API_KEY>
```

#### Example: with prefix

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: {
    type: 'header',
    name: 'Authorization',
    value: process.env.API_KEY!,
    prefix: 'ApiKey',
  },
});
// Sends: Authorization: ApiKey <API_KEY>
```

---

## No auth

When the server is configured with `"auth": null` (no auth / open endpoint), omit `auth` and `authToken` entirely:

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  // No auth fields — appropriate for local development or
  // internal services behind a gateway
});
```

---

## Additional headers

All three auth strategies can be combined with `headers` for custom per-request headers such as tracing IDs or gateway credentials:

```ts
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: { type: 'bearer', token: process.env.TOKEN! },
  headers: {
    'X-Request-Source': 'web-app',
    'X-Tenant-ID': 'tenant-abc',
  },
});
```

The `headers` map is merged with the auth header and any content-type headers on every request. If a key in `headers` conflicts with a key set by auth, the auth value wins.

---

## Auth header precedence

When both `authToken` and `auth` are provided, `auth` takes precedence. When `headers` contains an `Authorization` key and `auth` also sets `Authorization`, the `auth` value wins.

| Config | Result |
|---|---|
| Only `authToken` | Sends `Authorization: Bearer <token>` |
| Only `auth` (bearer) | Sends `Authorization: Bearer <token>` |
| Both `authToken` and `auth` | `auth` wins — `authToken` is ignored |
| `headers['Authorization']` and `auth` | `auth` wins |
| `headers['Authorization']` and no `auth` | Custom header is sent |

:::caution The order is reversed on WebSocket routes
The table above describes HTTP requests (`buildHeaders` in `src/request.ts`). For `wsStream()` and `realtime()` the token is resolved by `resolveBearerToken()` in `src/ws.ts`, which checks `authToken` **first** and only falls back to `auth.token` when `authToken` is absent.

If both are set to different values, your HTTP calls and your WebSocket calls will authenticate as different principals. Set exactly one of them.

Note also that only bearer auth reaches a WebSocket. `basic` and `header` auth produce an `Authorization` or custom header that a browser cannot attach to a WebSocket handshake; on Node the `Authorization` header is still passed, so basic auth happens to work there and not in the browser. Use a bearer token if you need WebSocket streaming or realtime audio.
:::

---

## WebSocket authentication

Browsers cannot set request headers on a WebSocket, so the client sends the bearer token as a WebSocket subprotocol: the socket is opened with `['agentflow-bearer', '<token>']` and the server reads the second entry. The token is never placed in the URL. On Node runtimes whose `WebSocket` constructor accepts an options argument, an `Authorization: Bearer ...` header is passed as well.

`wsStream()` and `realtime()` do this for you. The pieces are also exported, for building your own socket against the same server:

| Export | Signature | Description |
|---|---|---|
| `WS_BEARER_SUBPROTOCOL` | `'agentflow-bearer'` | The subprotocol token the server recognises for bearer auth. |
| `resolveBearerToken` | `(context: { authToken?, auth? }) => string \| null` | Returns `authToken` if set, else `auth.token` for bearer auth, else `null`. |
| `buildWsUrl` | `(context: { baseUrl }, path: string) => string` | Converts `http:` to `ws:` and `https:` to `wss:`, strips a trailing slash, and appends `path`. |
| `openWebSocket` | `(url: string, context: WsAuthContext) => WebSocket` | Opens the socket with the subprotocol pair, adding the `Authorization` header on Node. Throws `No WebSocket implementation available` when there is no global `WebSocket` and no `webSocketImpl`. |
| `WebSocketImpl` | `new (url, protocols?, options?) => WebSocket` | The constructor shape shared by the browser `WebSocket` and the Node `ws` package. This is the type of the `webSocketImpl` config field. |
| `WsAuthContext` | interface | The fields the helpers read: `baseUrl`, `authToken`, `auth`, `headers`, `credentials`, `debug`, `webSocketImpl`. |

```ts
import {
  buildWsUrl,
  openWebSocket,
  resolveBearerToken,
  WS_BEARER_SUBPROTOCOL,
} from '@10xscale/agentflow-client';

const context = {
  baseUrl: 'https://api.example.com',
  authToken: process.env.API_TOKEN,
};

resolveBearerToken(context);                     // the token, or null
buildWsUrl(context, '/v1/graph/ws');             // 'wss://api.example.com/v1/graph/ws'

const socket = openWebSocket(buildWsUrl(context, '/v1/graph/ws'), context);
// equivalent to: new WebSocket(url, [WS_BEARER_SUBPROTOCOL, token])
```

If a reverse proxy in front of your API strips `Sec-WebSocket-Protocol`, the handshake arrives unauthenticated and is rejected. Configure the proxy to forward it.

---

## Matching client auth to server auth configuration

Use the following table to choose the right client-side auth type based on the `auth` field in `agentflow.json`:

| Server `agentflow.json` auth | Recommended client auth |
|---|---|
| `null` (no auth) | Omit `auth` entirely |
| `"jwt"` | `{ type: 'bearer', token: jwtToken }` |
| `{ "method": "custom", "path": "..." }` with API key check | `{ type: 'header', name: 'X-API-Key', value: apiKey }` |
| `{ "method": "custom", "path": "..." }` with bearer check | `{ type: 'bearer', token: apiToken }` |

See the server-side auth documentation at [`reference/api-cli/auth`](../api-cli/auth.md) for how to generate JWT tokens and implement custom auth handlers.

---

## Obtaining a JWT token

When the server is configured with `"auth": "jwt"`, obtain a signed token with PyJWT on the server side and pass it to the client:

```python
# Python: generate a test token
import jwt, os, datetime

token = jwt.encode(
    {
        "sub": "user-123",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    },
    os.environ["JWT_SECRET_KEY"],
    algorithm=os.environ.get("JWT_ALGORITHM", "HS256"),
)
print(token)
```

```ts
// TypeScript: use the token
const client = new AgentFlowClient({
  baseUrl: 'http://localhost:8000',
  auth: {
    type: 'bearer',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
});
```

---

## Cookie credentials

For browser apps that rely on session cookies (e.g. an API gateway that sets a cookie), configure `credentials`:

```ts
const client = new AgentFlowClient({
  baseUrl: 'https://api.example.com',
  credentials: 'include',
  // No auth field — the cookie is sent automatically by the browser
});
```

`credentials` is forwarded directly to the `fetch` call. Valid values are `'omit'`, `'same-origin'`, and `'include'`.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `AgentFlowError` status `401` | Missing or invalid token. | Check the `auth` config and the server `JWT_SECRET_KEY` / custom auth handler. |
| `AgentFlowError` status `403` | Token is valid but lacks permission for the requested operation. | Check the server-side `AuthorizationBackend` configuration. |
| `TypeError: Failed to fetch` | CORS blocked due to missing credentials or wrong origin. | Set `credentials: 'include'` and verify CORS headers on the server. |
| WebSocket rejected while HTTP works | Non-bearer auth (browser), or a proxy stripping `Sec-WebSocket-Protocol`. | Use a bearer token, and forward the subprotocol header through the proxy. |
| HTTP and WebSocket authenticate as different users | `authToken` and `auth` are both set to different values; the two paths pick opposite winners. | Set only one. |

---

## What you learned

- Use `auth: { type: 'bearer', token }` for JWT auth (the most common case).
- Use `auth: { type: 'header', name, value }` for API-key header auth.
- Use `auth: { type: 'basic', username, password }` for HTTP Basic auth.
- Omit `auth` entirely for open/no-auth servers.
- `credentials` controls cookie handling in browser environments.
- WebSocket routes authenticate with the `agentflow-bearer` subprotocol, never a URL parameter, and resolve `authToken` before `auth` — the reverse of HTTP.

## Next step

See [`reference/client/tools`](tools.md) to learn how to register client-side tools that the agent can invoke remotely.
