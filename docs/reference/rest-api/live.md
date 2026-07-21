---
title: REST API — Live WebSocket — REST API reference
sidebar_label: Live WebSocket
description: Reference for the WS /v1/graph/live WebSocket endpoint that bridges browser or SDK audio to a realtime AudioAgent (Gemini Live). Covers the init frame, upstream binary/control frames, downstream binary/JSON events, and authentication.
keywords:
  - websocket live api
  - realtime audio websocket
  - agentflow live endpoint
  - gemini live websocket
  - agentflow
  - python ai agent framework
  - websocket audio bridge
---

# REST API: Live WebSocket

`WS /v1/graph/live` is a WebSocket bridge between a client (browser, SDK, native app) and a `CompiledGraph` rooted at a `LiveAgent` (built with `AudioAgent`). It maps audio frames to `LiveInputQueue` calls and streams `RealtimeEvent` objects back.

The endpoint is only available when the graph configured in `agentflow.json` contains a `LiveAgent`. Calling it against a non-live graph sends a fatal `error` event with `code: "not_live"` and closes the socket with code `1008`. Check `info.is_realtime` on `GET /v1/graph` to decide which socket to open.

Base URL: `ws://<host>/v1/graph/live`

---

## Authentication

Uses `RequirePermission("graph", "stream")`. The server looks for a bearer token in three places, in this order:

1. **`Authorization: Bearer <token>` header** — for non-browser clients (Python, server-to-server).
2. **`Sec-WebSocket-Protocol: agentflow-bearer, <token>`** — the preferred mechanism for browsers. The token rides in a request header, so it never lands in URLs, access logs, or browser history. The server echoes the `agentflow-bearer` sentinel back on `accept()`, which browsers require.
3. **`?token=<jwt>` query parameter** — last-resort fallback. The token is exposed in URLs and access logs; use (2) instead when you can.

```javascript
// Browser: preferred subprotocol transport
const ws = new WebSocket(
  "ws://localhost:8000/v1/graph/live",
  ["agentflow-bearer", jwt],
);
```

```
# Query fallback
ws://localhost:8000/v1/graph/live?token=<jwt>
```

An authentication or authorization failure closes the handshake with code `1008` before `accept()`.

---

## Connection limits

WebSocket handshakes bypass the HTTP rate-limit and request-size middleware (Starlette runs `BaseHTTPMiddleware` for HTTP scopes only), so the endpoint re-applies two protections at the handshake itself:

- **The global rate limit.** A handshake is counted against the same bucket as REST requests, using the `rate_limit` block in `agentflow.json`. Exceeding it rejects the handshake with close code `1013`.
- **`websocket.max_connections`.** A per-process cap on concurrent WebSocket connections across `/v1/graph/live` and `/v1/graph/ws`. Exceeding it also rejects with `1013`.

```json
{
  "agent": "graph.audio:app",
  "websocket": {
    "max_connections": 100
  }
}
```

Omit the block (or use `null`/`0`) for unlimited connections. The counter is per process, like the in-memory rate-limit backend, so size it per worker.

---

## Session lifecycle

1. Client opens the WebSocket connection.
2. Client sends a JSON init frame as the first message.
3. Server starts the realtime session and begins pumping events.
4. Client sends upstream frames (audio binary, control JSON) throughout the session.
5. Server sends downstream frames (audio binary, event JSON) as the model generates.
6. Either side closes the connection to end the session.

---

## Init frame (client -> server, first frame)

The first frame from the client must be a JSON text frame. It configures the session and optionally overrides the agent's build-time `RealtimeConfig` values. All fields are optional.

```json
{
  "thread_id": "session-001",
  "model": "gemini-live-2.5-flash-preview",
  "voice": "Puck",
  "modalities": ["AUDIO"],
  "system_prompt": "You are a terse voice assistant.",
  "tools_tags": ["weather"],
  "vad": {
    "enabled": true,
    "silence_duration_ms": 800
  }
}
```

| Field | Type | Maps to | Description |
|---|---|---|---|
| `thread_id` | string | — | Thread identifier for persistence and resume. Reuse to resume a previous session. |
| `model` | string | `RealtimeConfig.model` | Override the live model for this session. |
| `voice` | string | `RealtimeConfig.voice` | Override the voice (e.g. `"Puck"`). |
| `modalities` | array or string | `RealtimeConfig.response_modalities` | Override the response modalities. Exactly one entry; `["AUDIO"]` or `["TEXT"]`. A bare string (`"AUDIO"`) is coerced to a one-element list. |
| `system_prompt` | string | `RealtimeConfig.system_instruction` | Override the system instruction for this session. |
| `tools_tags` | array | `RealtimeConfig.tools_tags` | Restrict the tools exposed to this session by tag. |
| `vad` | object | `RealtimeConfig.vad` | Override `VADConfig` fields for this session. |

Fields not present in the init frame keep the agent's compiled values. An invalid init frame (not JSON, or JSON that is not an object) closes the socket with code `1003`.

**Thread handling.** `thread_id` is optional. When it is absent the server generates a UUID for the session and persists the thread record before the first event is pumped; the generated id is not echoed back as a separate frame, so a client that needs to resume later should supply its own id. When `thread_id` **is** present it is ownership-checked before the session starts: a thread owned by another user is rejected with a fatal `error` event (`code: "not_authorized"`) and close code `1008`.

---

## Upstream frames (client -> server)

After the init frame, the client sends a mix of binary audio frames and JSON control frames.

### Binary frame — audio input

Raw PCM16 audio at 16 kHz, mono. Each frame is forwarded to `LiveInputQueue.send_audio()`.

```
Frame: <binary PCM16 bytes>
Format: 16-bit signed integer, little-endian, mono, 16000 Hz
```

100 ms chunks (~3200 bytes) are a typical packet size. There is no minimum, but the bridge enforces two bounds because WebSocket frames never pass through the HTTP request-size middleware:

| Bound | Value | Behaviour when exceeded |
|---|---|---|
| Maximum single frame | 1 MiB (`REALTIME_MAX_FRAME_BYTES`) | The frame is dropped and a warning is logged. The session continues; no error event is sent. |
| Upstream queue depth | 1000 frames (`REALTIME_INPUT_QUEUE_MAXSIZE`) | The oldest queued frame is dropped to make room. At ~50 frames/second this is roughly 20 seconds of buffered audio. |

Send audio in normal chunks (tens of KB). A 1 MiB frame is around 30 seconds of 16 kHz PCM16 in one message, far beyond any realistic capture buffer.

### JSON control frames

Send a JSON text frame with a `type` field to inject non-audio input.

**Text turn**

```json
{"type": "text", "text": "What is the weather in Paris?"}
```

Injects a text turn as user input. The model responds in audio (or text if modality is `"TEXT"`).

**Manual VAD — activity start**

```json
{"type": "activity_start"}
```

Signals the start of user speech. Only meaningful when `vad.enabled=false` (push-to-talk). The model will not respond until `activity_end` is received.

**Manual VAD — activity end**

```json
{"type": "activity_end"}
```

Signals the end of user speech.

**Close**

```json
{"type": "close"}
```

Ends the session gracefully. The server closes the input queue and gives the model up to 30 seconds (`REALTIME_DRAIN_TIMEOUT`) to drain its in-flight response before cancelling and closing the socket. The same grace period applies when the client simply disconnects.

---

## Downstream frames (server -> client)

The server sends a mix of binary audio frames and JSON event frames.

### Binary frame — audio output

Raw PCM16 model audio at 24 kHz, mono. Corresponds to `AudioDeltaEvent`.

```
Frame: <binary PCM16 bytes>
Format: 16-bit signed integer, little-endian, mono, 24000 Hz
```

### JSON event frames

All `RealtimeEvent` types other than `audio_delta` are serialized to JSON text frames. The `type` field discriminates the event.

**Input transcript (partial)**

```json
{"type": "input_transcript", "text": "What's the weath", "finished": false}
```

**Input transcript (complete)**

```json
{"type": "input_transcript", "text": "What's the weather in Paris?", "finished": true}
```

**Output transcript (partial)**

```json
{"type": "output_transcript", "text": "The weather in Par", "finished": false}
```

**Output transcript (complete)**

```json
{"type": "output_transcript", "text": "The weather in Paris is 24 degrees and sunny.", "finished": true}
```

**Tool call**

```json
{"type": "tool_call", "id": "call-abc123", "name": "get_weather", "args": {"location": "Paris"}}
```

Informational only. Agentflow dispatches the tool automatically on the server side.

**Tool result**

```json
{"type": "tool_result", "id": "call-abc123", "result": {"result": "24 degrees and sunny"}}
```

**Turn complete**

```json
{"type": "turn_complete"}
```

The model finished speaking for this turn.

**Interrupted (barge-in)**

```json
{"type": "interrupted"}
```

The user spoke while the model was talking. Flush any buffered audio playback and discard audio already queued for the speaker.

**Session update**

```json
{"type": "session_update", "resumption_handle": "<opaque-handle>"}
```

The provider issued a session-resumption handle. The server stores this in the checkpointer thread metadata. Clients can ignore this frame; no action required.

**Go away**

```json
{"type": "go_away", "time_left": "5s"}
```

The provider will rotate the connection soon. The server reconnects automatically; clients will see a brief gap in audio events but no explicit close.

**Agent changed**

```json
{"type": "agent_changed", "author": "billing-agent"}
```

The active agent or persona for the session changed. `author` identifies the new agent. Informational; use it to relabel the transcript in the UI.

**Error (non-fatal)**

```json
{"type": "error", "code": null, "message": "provider rate limit", "fatal": false}
```

Transient error; the session continues.

**Error (fatal)**

```json
{"type": "error", "code": "reconnect_failed", "message": "realtime session lost and could not be resumed after 5 attempts", "fatal": true}
```

Fatal error; the session ended. The server closes the WebSocket after emitting this event.

### Error event codes

Codes the bridge itself emits, in addition to any provider code passed through:

| `code` | `fatal` | Meaning | Followed by close |
|---|---|---|---|
| `not_live` | `true` | The configured graph is not a live agent. Use `WS /v1/graph/ws`. | `1008` |
| `not_authorized` | `true` | The `thread_id` in the init frame belongs to another user. | `1008` |
| `invalid_config` | `true` | The init frame produced an invalid `RealtimeConfig` (for example an unusable `modalities` value). | server close |

---

## WebSocket close codes

| Code | Meaning |
|---|---|
| `1000` | Normal closure: the session ended. |
| `1003` | Invalid init frame: the first frame was not JSON, or was JSON that is not an object. |
| `1008` | Policy violation: authentication or authorization was rejected at the handshake, or the graph is not a live agent (`not_live`), or the requested `thread_id` is owned by another user (`not_authorized`). |
| `1011` | Unexpected server error during the session (provider failure, checkpointer error). This code is used only for unhandled failures. |
| `1013` | Try again later: the global rate limit or `websocket.max_connections` was exceeded. The handshake is refused before `accept()`. |

---

## Scope: audio and text only

This socket carries **binary PCM16 audio frames and JSON control frames**. The upstream pump recognises binary audio plus the `text`, `activity_start`, `activity_end`, and `close` control types, and forwards nothing else. There is no image frame type in the live protocol.

Image and document input belongs on the turn-based run endpoints (`POST /v1/graph/invoke`, `POST /v1/graph/stream`, `WS /v1/graph/ws`), which accept `ImageBlock`/`DocumentBlock` content referencing an uploaded `file_id`. See [Multimodal and vision](../../how-to/production/multimodal-and-vision.md).

Exactly one `LiveAgent` must be present in the graph; multiple live agents per graph are not supported.

---

## Minimal client example (Python websockets)

```python
import asyncio
import json
import wave
import websockets

from agentflow.core.realtime.base import OUTPUT_SAMPLE_RATE

async def main():
    uri = "ws://localhost:8000/v1/graph/live?token=<jwt>"

    async with websockets.connect(uri) as ws:
        # 1. Send init frame.
        await ws.send(json.dumps({
            "thread_id": "demo-001",
            "voice": "Puck",
        }))

        # 2. Load and stream audio input.
        with wave.open("input.wav", "rb") as wf:
            pcm = wf.readframes(wf.getnframes())

        chunk = 3200  # 100 ms at 16 kHz, 2 bytes/sample
        for offset in range(0, len(pcm), chunk):
            await ws.send(pcm[offset : offset + chunk])

        # 3. Receive events.
        out = wave.open("out.wav", "wb")
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(OUTPUT_SAMPLE_RATE)

        async for message in ws:
            if isinstance(message, bytes):
                out.writeframes(message)
            else:
                event = json.loads(message)
                print(event)
                if event["type"] == "turn_complete":
                    await ws.send(json.dumps({"type": "close"}))
                    break

        out.close()

asyncio.run(main())
```
