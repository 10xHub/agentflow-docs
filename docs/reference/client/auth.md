---
title: Auth
description: Reference for all authentication options available in AgentFlowClient.
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

---

## What you learned

- Use `auth: { type: 'bearer', token }` for JWT auth (the most common case).
- Use `auth: { type: 'header', name, value }` for API-key header auth.
- Use `auth: { type: 'basic', username, password }` for HTTP Basic auth.
- Omit `auth` entirely for open/no-auth servers.
- `credentials` controls cookie handling in browser environments.

## Next step

See [`reference/client/tools`](tools.md) to learn how to register client-side tools that the agent can invoke remotely.
