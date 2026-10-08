---
title: "WebSocket streaming and realtime"
description: "Bidirectional WebSocket endpoints for turn-based agent streaming and realtime audio."
order: 100
group: "Interfaces"
section: "API server"
updated: "2026-10-08"
---

10xGraph exposes two WebSocket endpoints: `/v1/graph/ws` for turn-based agent interactions and `/v1/graph/live` for realtime audio conversations. WebSockets keep a persistent connection open so the server can stream responses token-by-token, the client can resume from checkpoints, and (for realtime agents) both sides can exchange audio in near-real-time. Both endpoints support the same authentication, rate limiting, and concurrency controls as REST APIs.

## When to use WebSocket

Use WebSocket when the client needs true bidirectional streaming or low-latency two-way communication. For simple invoke-and-wait workflows, REST's `/v1/graph/invoke` is simpler. For streaming where the client reads until done, REST's `/v1/graph/stream` (NDJSON) is also sufficient and works in more environments (proxies, browsers without WebSocket support).

WebSocket shines for:

- **Resume workflows**: the client detects a remote tool call in the stream, executes it, and resumes the same run without losing context.
- **Interactive agents**: the client sends new instructions mid-run without waiting for the current response.
- **Realtime audio**: the client streams audio input while the model speaks output, with near-zero latency.
- **Long-lived connections**: applications that keep one socket open for many sequential runs over hours.

## Authentication

Both endpoints use the same credential methods as REST APIs. The bearer token can come from:

1. **`Authorization` HTTP header** (standard): `Authorization: Bearer <token>`
2. **`10xgraph-bearer` Sec-WebSocket-Protocol** (recommended for browsers): avoids CORS headers at the WebSocket upgrade
3. **`?token=` query parameter** (fallback): the token is visible in logs and browser history, so avoid in production

At the WebSocket handshake, the server verifies the token once. For every graph run on the socket (only relevant for `/v1/graph/ws` where the client can send multiple messages), the token is re-verified: if it expires or is revoked between runs, the server sends an error and closes the socket with code 1008.

**Setting the subprotocol** (if using `10xgraph-bearer`):

```javascript
const socket = new WebSocket(
  "wss://api.example.com/v1/graph/ws",
  "10xgraph-bearer"  // or "agentflow-bearer" (deprecated)
);
```

The server accepts both `10xgraph-bearer` (new) and `agentflow-bearer` (deprecated until 2.0).

## Turn-based streaming: `/v1/graph/ws`

This endpoint streams graph execution as the agent runs step-by-step. The client sends one message, the server streams back chunks, and when done, the client can send another message or close the connection. It is suitable for turn-based agents (ReactAgent, PlanActReflect, etc.) where each user message is a complete turn.

### Protocol

**Fresh run (start a new thread or run on an existing one):**

```json
Client → Server:
{
  "invoke_type": "fresh",
  "messages": [
    {"role": "user", "content": [{"type": "text", "text": "What is 2 + 2?"}]}
  ],
  "config": {
    "thread_id": "optional-id-or-omit-for-new-thread"
  }
}

Server → Client:
{"event": "messages_start", "data": {...}}
{"event": "chunk", "data": {...}}
{"event": "chunk", "data": {...}}
...
{"event": "updates", "data": {"status": "done"}}
```

**Resume after remote tool call:**

The client detects a `tool_call` event in the stream, executes the tool (e.g., in the browser), and sends the result back:

```json
Client → Server:
{
  "invoke_type": "resume",
  "tool_result": [
    {"role": "tool", "content": [{"type": "text", "text": "result here"}]}
  ],
  "config": {
    "thread_id": "same-thread-from-checkpoint"
  }
}

Server → Client:
(same format: messages_start, chunk, chunk, ..., updates/status:done)
```

### Thread IDs

- Omit `thread_id` or send `"new"` to create a fresh thread each time.
- Send an existing `thread_id` to resume that thread's conversation.
- The server normalizes blank or missing `thread_id` to mean "create a new one", so every fresh run auto-generates an ID.

### Rate limiting and concurrency

Every WebSocket handshake and every graph run on the socket counts against:

- **Global rate limit**: the same bucket as REST requests (if configured in `rate_limit`).
- **Per-user cap**: `websocket.max_connections_per_user` limits how many sockets one user can hold.

If the limit is exceeded, the server sends a StreamChunk error with `retry_after_seconds` and the run is skipped (the socket stays open). On the next run, the check runs again.

## Realtime audio: `/v1/graph/live`

This endpoint bridges a WebSocket to a **realtime agent** (using `CompiledGraph.arealtime()` or the `AudioAgent` prebuilt agent), enabling true two-way audio conversation. The client and server exchange audio frames and control messages in real-time, with minimal latency.

Realtime is only for agents built for it: an endpoint that uses `/v1/graph/ws` on a realtime agent will close immediately with code 1008 ("use `/v1/graph/live` instead").

### Protocol

**Init frame (JSON):**

```json
Client → Server:
{
  "type": "session.update",
  "session": {
    "model": "gemini-2.5-flash-live",
    "voice": "Puck",
    "modalities": ["audio", "text"],
    "vad": {
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "on_speak_end_ms": 1000
    }
  },
  "thread_id": "optional-thread-id"
}
```

**Downstream (Server → Client):**
- **Binary frames**: PCM16 audio deltas from the model
- **JSON text frames**: turn-complete, transcript, interrupted, error, etc.

**Upstream (Client → Server):**
- **Binary frames**: PCM16 audio input from the user/environment
- **JSON text frames**: activity_start, activity_end, text instructions, close

Refer to the [realtime audio guide](/docs/guides/use-realtime-audio) for details and examples.

## Configuration

WebSocket behavior is controlled by keys in the `websocket` object within `10xgraph.json`:

| Key | Type | Default | Purpose |
|---|---|---|---|
| `max_connections` | integer, null | 1000 | Hard cap on concurrent WebSocket connections (both `/v1/graph/ws` and `/v1/graph/live`) across this process. Set to `0` or `null` for unlimited. |
| `max_connections_per_user` | integer, null | 10 | Cap on how many WebSocket connections one verified user can hold (by `user_id`). Set to `0` or `null` for unlimited. |
| `realtime_models` | array of strings | `[]` | List of models a `/v1/graph/live` client is allowed to request (e.g., `["gemini-2.5-flash-live", "gemini-2.0-flash-live"]`). Empty means clients cannot override the agent's model. |

**Example:**

```json
{
  "agent": "graph:app",
  "websocket": {
    "max_connections": 5000,
    "max_connections_per_user": 50,
    "realtime_models": ["gemini-2.5-flash-live"]
  }
}
```

In a multi-worker deployment (Gunicorn + Uvicorn), these limits are **per process**, not global. Size them accordingly: if you run 4 workers with `max_connections: 1000`, the server can hold 4000 concurrent sockets total.

## Close codes

WebSocket close codes follow RFC 6455. The server sends these in specific situations:

| Code | Meaning | Retry? |
|---|---|---|
| 1000 | Normal closure (client initiated or clean shutdown) | No |
| 1008 | Policy violation: realtime agent on `/v1/graph/ws` (use `/v1/graph/live`), or token expired/revoked between runs | No |
| 1011 | Unexpected server error during run | May retry after brief delay |
| 1013 | Try again later: rate limit or connection cap exceeded | Yes, after `retry_after_seconds` |

An error chunk (StreamChunk with `event: "error"`) is sent before closing with code 1008 or 1013, so the client sees the reason before the connection drops.

## Proxy settings

If the API server is behind a reverse proxy (Nginx, HAProxy, CloudFlare, etc.), the proxy must be configured to preserve the WebSocket connection and pass through the upgrade headers. Additionally, when authentication is enabled and the proxy forwards client IP via `X-Forwarded-For`, the server must be told to trust that header.

### Proxy compatibility

- The proxy must support HTTP/1.1 upgrade requests (WebSocket handshake).
- Connection and Upgrade headers must be forwarded as-is.
- Most reverse proxies support this by default; confirm in their documentation.

**Nginx example** (snippet):

```nginx
location /v1/graph/ws {
  proxy_pass http://backend:8000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 86400s;  # Allow long-lived sockets
}
```

### Client IP detection

If you enable authentication and use the `trusted_proxy_headers` setting in `rate_limit`, the server reads the client IP from `X-Forwarded-For` to bucket rate limits correctly:

```json
{
  "agent": "graph:app",
  "rate_limit": {
    "enabled": true,
    "by": "ip",
    "trusted_proxy_headers": true,
    "trusted_proxy_hops": 1
  }
}
```

- **`trusted_proxy_headers`**: whether to honor `X-Forwarded-For` at all. Set `true` only if there is a proxy you control.
- **`trusted_proxy_hops`**: how many proxy layers to count back from the right of the `X-Forwarded-For` list. Set to 1 if you have one proxy, 2 for two proxies in series, etc.

Without this, clients behind a proxy appear to have the proxy's IP and all land in the same rate-limit bucket.

## Example: TypeScript client

Here's a minimal example using the 10xGraph TypeScript client:

```typescript
import { TenxGraphClient } from "10xgraph-client";

const client = new TenxGraphClient({
  baseUrl: "http://localhost:8000",
  token: "your-jwt-token"
});

// Start a fresh run
const stream = await client.stream({
  messages: [
    { role: "user", content: [{ type: "text", text: "What is 2 + 2?" }] }
  ]
});

// Read chunks as they arrive
for await (const chunk of stream) {
  console.log("Event:", chunk.event, "Data:", chunk.data);
  
  if (chunk.event === "tool_call") {
    // Client detected a remote tool call; execute it locally
    const result = await executeTool(chunk.data);
    
    // Resume the same run with the result
    const resumeStream = await client.stream({
      messages: [{ role: "tool", content: [{ type: "text", text: result }] }],
      thread_id: stream.thread_id
    });
    
    for await (const chunk of resumeStream) {
      console.log("Resumed:", chunk.event);
    }
  }
}
```

The client automatically chooses WebSocket for streaming and falls back to REST if WebSocket is not available.

## Example: Raw WebSocket in JavaScript

If you prefer to manage the WebSocket directly:

```javascript
const token = "your-jwt-token";
const url = `wss://api.example.com/v1/graph/ws?token=${encodeURIComponent(token)}`;
const socket = new WebSocket(url, "10xgraph-bearer");

socket.onopen = () => {
  console.log("Connected");
  socket.send(JSON.stringify({
    invoke_type: "fresh",
    messages: [
      { role: "user", content: [{ type: "text", text: "Hello" }] }
    ]
  }));
};

socket.onmessage = (event) => {
  const chunk = JSON.parse(event.data);
  console.log("Chunk:", chunk.event, chunk.data);
  
  if (chunk.event === "updates" && chunk.data.status === "done") {
    // Run finished
    socket.close(1000);
  }
};

socket.onerror = (event) => {
  console.error("WebSocket error:", event);
};

socket.onclose = (event) => {
  console.log(`Closed: code=${event.code}, reason=${event.reason}`);
};
```

## Troubleshooting

**Connection refused or 403 forbidden**
- Check that your token is valid and not expired. Verify it is passed via the `Authorization` header, `10xgraph-bearer` subprotocol, or `?token=` query.
- Confirm authentication is enabled and configured in `10xgraph.json` (`"auth": "jwt"` or custom).

**Socket closes with code 1008**
- If the message is "This graph is a live agent...", you're using `/v1/graph/ws` on a realtime agent. Switch to `/v1/graph/live`.
- If the message is "Session expired...", your token has expired. Reconnect with a fresh token.

**Socket closes with code 1013**
- Rate limit or connection cap exceeded. Wait the `retry_after_seconds` and try again.
- Check `websocket.max_connections` and `websocket.max_connections_per_user` in your config.

**Proxy forwarding issues**
- Confirm the proxy forwards the `Upgrade` and `Connection` headers. Most proxies do by default.
- If behind a proxy, set `trusted_proxy_headers: true` in rate_limit config so the server reads the real client IP from `X-Forwarded-For`.
- Increase proxy timeouts: WebSocket connections can be long-lived, so set read/write timeouts to several minutes or higher.

**Audio glitches or delays on `/v1/graph/live`**
- Increase `prefix_padding_ms` in the VAD config to buffer more audio before triggering speech detection.
- Reduce `vad.threshold` if speech is missed; increase it if background noise is detected as speech.
- Check network latency; realtime is sensitive to round-trip time.

## Related pages

- [Invoke and stream over REST](/docs/server/invoke-and-stream) covers HTTP POST endpoints for the same operations.
- [Realtime audio guide](/docs/guides/use-realtime-audio) provides complete examples and configuration for audio agents.
- [Client streaming](/docs/client/stream-responses) documents the TypeScript client's streaming API.
- [Authentication](/docs/server/auth) explains JWT setup and token validation.
