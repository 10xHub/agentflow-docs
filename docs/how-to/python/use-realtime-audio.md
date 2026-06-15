---
title: How to build a realtime audio agent
sidebar_label: Realtime audio (Gemini Live)
description: Build a live, audio-to-audio agent with AudioAgent and Gemini Live. Covers installation, session driving with arealtime, LiveInputQueue, image input, reconnection, and the API WebSocket bridge.
keywords:
  - agentflow realtime audio
  - gemini live python
  - audio agent agentflow
  - live audio to audio
  - agentflow
  - python ai agent framework
  - realtime audio agent
sidebar_position: 21
---

# How to build a realtime audio agent

The realtime subsystem adds live, audio-to-audio sessions to Agentflow. Unlike `invoke` and `stream`, which traverse a turn-based super-step loop, a realtime graph is driven by a separate runtime: the provider owns the turn loop and Agentflow wraps it.

This guide covers:
- Installing the `realtime` extra and required credentials
- Building an `AudioAgent` and compiling it
- Driving a session with `arealtime` and `LiveInputQueue`
- Handling events: audio, transcripts, tool calls
- Sending images and video frames
- Using the API server WebSocket bridge

---

## Prerequisites

- `10xscale-agentflow` >= 0.7.5
- A Gemini API key (or Vertex AI credentials)

---

## Install

```bash
pip install "10xscale-agentflow[realtime]"
```

The `realtime` extra pulls in `google-genai`. Provider SDK imports are lazy: importing `agentflow.core.realtime` never loads the SDK unless you open a session.

Set your credentials:

```bash
export GEMINI_API_KEY=your-api-key

# Optional: pick a Gemini Live model name (check Google's docs for regional availability).
# Defaults to gemini-live-2.5-flash-preview when GEMINI_LIVE_MODEL is not set.
export GEMINI_LIVE_MODEL=gemini-live-2.5-flash-preview
```

For Vertex AI, set `GOOGLE_GENAI_USE_VERTEXAI=1` and standard ADC environment variables instead of `GEMINI_API_KEY`.

---

## Audio format

| Direction | Format |
|---|---|
| Input (you -> model) | PCM16, mono, 16 kHz |
| Output (model -> you) | PCM16, mono, 24 kHz |

Raw audio is never stored. Finished transcripts are persisted as `Message` objects with `metadata={"modality": "audio"}`.

---

## Quick start: WAV file in, WAV file out

```python
import asyncio
import wave

from agentflow.core.realtime.base import OUTPUT_SAMPLE_RATE, RealtimeConfig
from agentflow.core.realtime.queue import LiveInputQueue
from agentflow.prebuilt.agent import AudioAgent

MODEL = "gemini-live-2.5-flash-preview"

# 1. Compile the agent once.
app = AudioAgent(
    MODEL,
    realtime_config=RealtimeConfig(
        model=MODEL,
        voice="Puck",
        system_instruction="You are a concise voice assistant.",
    ),
).compile()

async def main():
    # 2. Open a WAV file for output (24 kHz, mono, PCM16).
    out = wave.open("out.wav", "wb")
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(OUTPUT_SAMPLE_RATE)

    # 3. Create the input queue and load your audio.
    with wave.open("input.wav", "rb") as wf:
        sample_rate = wf.getframerate()
        pcm = wf.readframes(wf.getnframes())

    queue = LiveInputQueue()

    # 4. Stream input audio in ~100 ms chunks.
    chunk = (sample_rate // 10) * 2  # 100 ms at 2 bytes/sample
    for offset in range(0, len(pcm), chunk):
        queue.send_audio(pcm[offset : offset + chunk], sample_rate=sample_rate)
        await asyncio.sleep(0.0)  # yield so the pump can flush to the socket

    # 5. Iterate events until the session ends.
    try:
        async for event in app.arealtime(queue, {"thread_id": "demo"}):
            if event.type == "audio_delta":
                out.writeframes(event.data)
            elif event.type == "input_transcript" and event.finished:
                print(f"you:   {event.text}")
            elif event.type == "output_transcript" and event.finished:
                print(f"agent: {event.text}")
            elif event.type == "turn_complete":
                queue.close()  # end after the first model turn
    finally:
        out.close()
        await app.aclose()

asyncio.run(main())
```

`input.wav` must be mono 16-bit PCM at 16 kHz. The example in `examples/realtime/audio_agent_file.py` is the reference for this pattern.

---

## Building an AudioAgent

`AudioAgent` is a React-style builder that wraps a `LiveAgent` as the graph root. It mirrors `ReactAgent`'s construction surface.

```python
from agentflow.core.realtime.base import RealtimeConfig, VADConfig
from agentflow.prebuilt.agent import AudioAgent

def get_weather(location: str) -> str:
    """Get the current weather for a city."""
    return f"It is 22 degrees and sunny in {location}."

app = AudioAgent(
    "gemini-live-2.5-flash-preview",
    realtime_config=RealtimeConfig(
        model="gemini-live-2.5-flash-preview",
        voice="Puck",
        system_instruction="You are a helpful voice assistant. Keep answers brief.",
        input_audio_transcription=True,
        output_audio_transcription=True,
    ),
    tools=[get_weather],
).compile()
```

### compile() parameters

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `checkpointer` | `BaseCheckpointer \| None` | `None` | Enables cross-session resume and transcript persistence. |
| `store` | `BaseStore \| None` | `None` | Long-term memory store. |
| `callback_manager` | `CallbackManager \| None` | `None` | Pass to receive lifecycle hooks. |
| `shutdown_timeout` | `float` | `30.0` | Seconds to wait for graceful shutdown. |

`compile()` does not accept `media_store`, `interrupt_before`, or `interrupt_after`. Realtime media (images, video) is sent frame-by-frame through `LiveInputQueue.send_image()` and is not stored at rest.

---

## Driving a session with arealtime

```python
queue = LiveInputQueue()

async for event in app.arealtime(
    queue,
    config={"thread_id": "my-thread"},
    state=None,       # optional AgentState; use to pre-seed custom state fields
):
    match event.type:
        case "audio_delta":
            # PCM16 chunk at 24 kHz; write to speaker or file
            speaker.write(event.data)
        case "input_transcript":
            if event.finished:
                print(f"you: {event.text}")
        case "output_transcript":
            if event.finished:
                print(f"agent: {event.text}")
        case "tool_call":
            print(f"calling {event.name}({event.args})")
        case "turn_complete":
            ...   # model finished speaking; re-enable mic if in echo-safe mode
        case "interrupted":
            ...   # barge-in; flush audio playback buffer
        case "error":
            print(f"error ({event.code}): {event.message}")
            if event.fatal:
                break

queue.close()  # signal end of input
await app.aclose()
```

`arealtime` is an async generator. It yields `RealtimeEvent` objects (see the [reference](../../reference/python/realtime.md) for the full event union).

`realtime(queue, config, state)` is the synchronous equivalent: it drives a private event loop. Do not call it from inside an async context or a running event loop.

---

## LiveInputQueue

`LiveInputQueue` decouples audio capture from the network pump. All `send_*` methods are synchronous and non-blocking (`put_nowait`), so they are safe to call from audio callbacks on any thread.

```python
from agentflow.core.realtime.queue import LiveInputQueue

queue = LiveInputQueue()

# Audio input (PCM16, default 16 kHz)
queue.send_audio(pcm16_bytes)
queue.send_audio(pcm16_bytes, sample_rate=16000)

# Text input (injected as a user turn)
queue.send_text("What is the weather in Tokyo?")

# Image input (still image or video frame)
with open("frame.jpg", "rb") as f:
    queue.send_image(f.read())                    # default mime_type="image/jpeg"
    queue.send_image(f.read(), mime_type="image/jpeg")

# Manual VAD / push-to-talk (only when vad.enabled=False)
queue.send_activity_start()
queue.send_activity_end()

# End the session
queue.close()
```

Once closed, further sends are dropped silently. Image frames are not persisted to history; on reconnect only text transcripts are reseeded.

---

## Tools

Tools are advertised to the model at connect time through the same `ToolNode` mechanism as `ReactAgent`. The model calls them during a turn; Agentflow dispatches the call and returns the result before the model continues speaking.

```python
from agentflow.utils import tool

@tool
def lookup_order(order_id: str) -> str:
    """Look up a customer order by ID."""
    return f"Order {order_id} ships tomorrow."

app = AudioAgent(
    "gemini-live-2.5-flash-preview",
    realtime_config=RealtimeConfig(model="gemini-live-2.5-flash-preview"),
    tools=[lookup_order],
).compile()
```

Tool events appear in the stream as `ToolCallEvent` (before execution) and `ToolResultEvent` (after). Sub-agents and handoff are not supported in v1.

---

## System prompt, skills, and memory

`system_prompt`, `skills`, and `memory` work the same as `ReactAgent`. They are flattened into Gemini Live's single `system_instruction` string at connect time. `{field}` placeholders in the prompt are interpolated from state at connect time.

```python
AudioAgent(
    MODEL,
    realtime_config=RealtimeConfig(model=MODEL),
    system_prompt=[
        {"role": "system", "content": "You are a helpful assistant for {user_name}."}
    ],
    skills=skill_config,
    memory=memory_config,
)
```

`system_instruction` is fixed for the session (Gemini Live does not allow mid-session instruction updates). State-dependent content is a connect-time snapshot. For mid-session dynamic behavior, use `set_skill` or memory tools.

---

## Image and video input

Send still images or video frames directly through the queue. Gemini Live accepts individual frames; send video as a stream of frames (~1 fps is the model's effective ceiling).

```python
import time

cap = cv2.VideoCapture(0)  # laptop camera
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    _, jpeg = cv2.imencode(".jpg", frame)
    queue.send_image(jpeg.tobytes())
    time.sleep(1.0)  # ~1 fps
```

Image frames are not stored or persisted. On reconnect, only text transcripts are reseeded.

---

## Checkpointing and cross-session resume

Pass a checkpointer to `compile()` to persist transcripts and resumption handles across connections.

```python
from agentflow.storage.checkpointer import InMemoryCheckpointer, PgCheckpointer

# Development
app = AudioAgent(MODEL, ...).compile(
    checkpointer=InMemoryCheckpointer()
)

# Production
app = AudioAgent(MODEL, ...).compile(
    checkpointer=PgCheckpointer(database_url=os.environ["DATABASE_URL"])
)
```

Within a session, the runtime automatically reconnects on transient drops and uses the Gemini session resumption handle (stored in the checkpointer thread metadata) to restore provider-side context. When no handle is available, persisted transcripts are reseeded into the fresh session.

To resume across separate `arealtime` calls (different processes or restarts), the same `thread_id` and a persistent checkpointer are all that is required.

---

## Reconnection behavior

Reconnection is automatic and transparent. Two cases:

| Trigger | Behavior |
|---|---|
| `go_away` (planned provider rotation) | Reconnect immediately, no backoff. |
| Transient drop / receive error | Exponential backoff: `min(base * 2^(n-1), max_delay)`, up to `max_attempts`. After that, fatal `ErrorEvent(code="reconnect_failed")` ends the session. |

Configure via `RealtimeConfig.reconnect`:

```python
from agentflow.core.realtime.base import RealtimeConfig, ReconnectConfig

config = RealtimeConfig(
    model=MODEL,
    reconnect=ReconnectConfig(
        base_delay=0.5,    # seconds
        max_delay=10.0,    # seconds
        max_attempts=5,    # set 0 to disable error-driven reconnect
    ),
)
```

---

## API server WebSocket bridge

When the configured graph is rooted at a `LiveAgent` (i.e. built with `AudioAgent`), `agentflow api` automatically exposes a WebSocket endpoint at `/v1/graph/live`.

### Setup

```json
{
  "agent": "graph:app",
  "checkpointer": "graph:checkpointer",
  "env": ".env"
}
```

```python
# graph.py
import os
from agentflow.core.realtime.base import RealtimeConfig
from agentflow.prebuilt.agent import AudioAgent
from agentflow.storage.checkpointer import InMemoryCheckpointer

MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-live-2.5-flash-preview")
checkpointer = InMemoryCheckpointer()
app = AudioAgent(
    MODEL,
    realtime_config=RealtimeConfig(model=MODEL, voice="Puck"),
).compile(checkpointer=checkpointer)
```

```bash
export GEMINI_API_KEY=...
agentflow api
# WebSocket available at ws://localhost:8000/v1/graph/live
```

### Protocol

**Connection open**

First frame from the client must be a JSON object. Present fields override the agent's build-time `RealtimeConfig` for this session:

```json
{"model": "gemini-live-2.5-flash-preview", "thread_id": "abc", "voice": "Puck"}
```

**Upstream (client -> server)**

| Frame | Content |
|---|---|
| Binary | PCM16 input audio at 16 kHz |
| JSON text | `{"type": "text", "text": "..."}` — inject a text turn |
| JSON text | `{"type": "activity_start"}` — manual VAD start |
| JSON text | `{"type": "activity_end"}` — manual VAD end |
| JSON text | `{"type": "close"}` — end the session |

**Downstream (server -> client)**

| Frame | Content |
|---|---|
| Binary | PCM16 model audio at 24 kHz (`audio_delta`) |
| JSON text | All other events: transcripts, `turn_complete`, `interrupted`, `tool_call`, `tool_result`, `session_update`, `go_away`, `error` |

Image/video input is SDK-only. The WebSocket bridge does not forward image frames.

---

## Live microphone example

The `examples/realtime/audio_agent_mic.py` example shows full-duplex microphone input with speaker output and barge-in. Run it with:

```bash
pip install sounddevice
export GEMINI_API_KEY=...
python examples/realtime/audio_agent_mic.py
# say: "What's the weather in Tokyo?"   (Ctrl+C to stop)
```

---

## Forcing rules

- A graph containing a `LiveAgent` must use `arealtime()` or `realtime()`. Calling `invoke`, `ainvoke`, `stream`, or `astream` raises `RuntimeError`.
- `arealtime()` requires a graph rooted at exactly one `LiveAgent`. Passing an ordinary graph raises. Passing a graph with more than one `LiveAgent` raises.
- `realtime()` (sync) raises if called from inside a running event loop. Use `arealtime()` from async contexts.

---

## What you learned

- Install with `pip install "10xscale-agentflow[realtime]"` and set `GEMINI_API_KEY`.
- `AudioAgent` builds a single realtime agent graph with `LiveAgent` as the root; compile it once and reuse.
- Feed PCM16 audio (16 kHz) into a `LiveInputQueue`; read PCM16 audio (24 kHz) and all other events from `arealtime()`.
- Tools, system prompts, skills, and memory work the same as `ReactAgent` but are fixed at connect time.
- Checkpointing enables transcript persistence and cross-session resume.
- Reconnection is automatic; configure backoff via `ReconnectConfig`.
- `agentflow api` exposes `ws://.../v1/graph/live` when the graph uses `AudioAgent`.
