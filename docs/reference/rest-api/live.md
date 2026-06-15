---
title: REST API — Live WebSocket — AgentFlow Python AI Agent Framework
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

The endpoint is only available when the graph configured in `agentflow.json` contains a `LiveAgent`. Calling it against a non-live graph closes the socket with code `1011`.

Base URL: `ws://<host>/v1/graph/live`

---

## Authentication

Uses `RequirePermission("graph", "stream")`. For browser WebSocket clients that cannot send HTTP headers at connection time, pass the token as a query parameter:

```
ws://localhost:8000/v1/graph/live?token=<jwt>
```

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
  "vad": {
    "enabled": true,
    "silence_duration_ms": 800
  }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `thread_id` | string | auto-generated UUID | Thread identifier for persistence and resume. Reuse to resume a previous session. |
| `model` | string | agent build-time value | Override the Gemini Live model for this session. |
| `voice` | string | agent build-time value | Override the voice (e.g. `"Puck"`). |
| `modalities` | array | `["AUDIO"]` | Override `response_modalities`. Exactly one entry; `["AUDIO"]` or `["TEXT"]`. |
| `vad` | object | agent build-time value | Override `VADConfig` fields for this session. |

Fields not present in the init frame keep the agent's compiled values. An invalid init frame (not JSON, not a dict) closes the socket with code `1003`.

---

## Upstream frames (client -> server)

After the init frame, the client sends a mix of binary audio frames and JSON control frames.

### Binary frame — audio input

Raw PCM16 audio at 16 kHz, mono. Each frame is forwarded to `LiveInputQueue.send_audio()`.

```
Frame: <binary PCM16 bytes>
Format: 16-bit signed integer, little-endian, mono, 16000 Hz
```

There is no minimum or maximum frame size. 100 ms chunks (~3200 bytes) are a typical packet size.

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

Ends the session gracefully. The server drains any in-flight model response before closing.

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

---

## WebSocket close codes

| Code | Meaning |
|---|---|
| `1000` | Normal closure: session ended. |
| `1003` | Invalid init frame (not a JSON dict). |
| `1011` | Internal error: non-live graph, provider failure, or checkpointer error. |

---

## Limitations

- Image and video frame input is SDK-only (`LiveInputQueue.send_image()`). The WebSocket bridge does not forward image frames; there is no binary image frame type in the protocol.
- Exactly one `LiveAgent` must be present in the graph. Multiple live agents per graph are not supported in v1.

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
