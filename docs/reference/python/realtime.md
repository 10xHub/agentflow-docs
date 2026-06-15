---
title: Realtime — AgentFlow Python AI Agent Framework
sidebar_label: Realtime
description: Full API reference for the realtime audio-to-audio subsystem — LiveInputQueue, RealtimeConfig, VADConfig, ReconnectConfig, AudioAgent, RealtimeEvent union, and the WebSocket bridge protocol.
keywords:
  - agentflow realtime reference
  - gemini live api
  - audio agent python reference
  - realtime config
  - agentflow
  - python ai agent framework
  - realtime audio agent
sidebar_position: 20
---

# Realtime

The realtime subsystem provides live, audio-to-audio sessions backed by Gemini Live. It is a separate runtime from the turn-based `invoke`/`stream` path: the provider owns the turn loop, and Agentflow wraps it with a duplex pump, tool dispatch, transcript persistence, and automatic reconnection.

## Install extra

```bash
pip install "10xscale-agentflow[realtime]"
```

Provider SDK imports are lazy. Importing `agentflow.core.realtime` does not load `google-genai` until a session opens.

## Import paths

```python
# Public API surface
from agentflow.core.realtime import (
    # Input queue
    LiveInputQueue, LiveInput, LiveInputKind,
    # Config types
    RealtimeConfig, VADConfig, ReconnectConfig,
    # Event union and all event classes
    RealtimeEvent,
    AudioDeltaEvent, InputTranscriptEvent, OutputTranscriptEvent,
    ToolCallEvent, ToolResultEvent, TurnCompleteEvent, InterruptedEvent,
    SessionUpdateEvent, GoAwayEvent, AgentChangedEvent, ErrorEvent,
    # Provider client (Gemini)
    RealtimeClient, GeminiLiveClient, normalize_message,
)

# Prebuilt agent
from agentflow.prebuilt.agent import AudioAgent

# Audio format constants
from agentflow.core.realtime.base import INPUT_SAMPLE_RATE, OUTPUT_SAMPLE_RATE
```

`INPUT_SAMPLE_RATE = 16000` (Hz); `OUTPUT_SAMPLE_RATE = 24000` (Hz).

---

## AudioAgent

Prebuilt realtime agent builder. Mirrors `ReactAgent`'s construction surface and wraps a `LiveAgent` as the graph root. Compile it once and drive sessions with `CompiledGraph.arealtime()`.

```python
from agentflow.prebuilt.agent import AudioAgent
```

### Constructor

```python
AudioAgent(
    model: str,
    state: StateT | None = None,
    context_manager: BaseContextManager | None = None,
    publisher: BasePublisher | list[BasePublisher] | None = None,
    id_generator: BaseIDGenerator = DefaultIDGenerator(),
    container: Any | None = None,
    *,
    realtime_config: RealtimeConfig | None = None,
    system_prompt: list[dict[str, Any]] | None = None,
    tools: Iterable[Callable] | None = None,
    client: Any = None,                        # MCP client
    pass_user_info_to_mcp: bool = False,
    skills: SkillConfig | None = None,
    memory: MemoryConfig | None = None,
    realtime_client_factory: Callable[[], RealtimeClient] | None = None,
    live_node_name: str = "LIVE",
    **agent_kwargs,
)
```

| Parameter | Notes |
|---|---|
| `model` | Model string resolved through `detect_provider`. Must resolve to `"google"` provider; only Gemini Live is supported in v1. |
| `realtime_config` | Per-session config. Defaults to `RealtimeConfig(model=model)` if omitted. |
| `system_prompt` | List of `{"role": "system", "content": "..."}` dicts. Flattened into `system_instruction` at connect time. |
| `tools` | Callable tools passed to a `ToolNode`. Advertised to the provider at connect time. |
| `client` | MCP client (fastmcp / mcp). |
| `skills` | `SkillConfig` for dynamic skill injection. |
| `memory` | `MemoryConfig` for long-term memory. |
| `realtime_client_factory` | Override the provider client factory (useful in tests). |

### compile()

```python
app = AudioAgent(...).compile(
    checkpointer: BaseCheckpointer | None = None,
    store: BaseStore | None = None,
    callback_manager: CallbackManager | None = None,
    shutdown_timeout: float = 30.0,
) -> CompiledGraph
```

`compile()` does not accept `media_store`, `interrupt_before`, or `interrupt_after`. Realtime media is sent frame-by-frame through `LiveInputQueue` and is never offloaded.

---

## CompiledGraph.arealtime / realtime

```python
async def arealtime(
    input_queue: LiveInputQueue,
    config: dict[str, Any] | None = None,
    state: AgentState | None = None,
) -> AsyncIterator[RealtimeEvent]

def realtime(
    input_queue: LiveInputQueue,
    config: dict[str, Any] | None = None,
    state: AgentState | None = None,
) -> Generator[RealtimeEvent]
```

`arealtime` is an async generator; use it from async contexts. `realtime` is a synchronous wrapper that drives a private event loop and raises if called from inside a running event loop.

**Config keys:**

| Key | Description |
|---|---|
| `thread_id` | Thread for this session. Required for persistence and resume. |
| `user_id` | User identifier. Forwarded to tools via injectable params. |
| `realtime` | Dict of `RealtimeConfig` field overrides for this session only. |

**Forcing rules:**

- A graph containing a `LiveAgent` must use `arealtime()` / `realtime()`. Calling `invoke`, `ainvoke`, `stream`, or `astream` raises `RuntimeError`.
- `arealtime()` requires exactly one `LiveAgent` in the graph. Zero or more than one raises.
- `realtime()` raises if called from a thread with a running event loop.

---

## LiveInputQueue

Non-blocking upstream input queue. Feed it from any context including audio capture callbacks on other threads.

```python
LiveInputQueue(maxsize: int = 0)
```

All send methods are synchronous (`put_nowait`). Sends after `close()` are dropped silently (logged at DEBUG).

### Methods

| Method | Signature | Description |
|---|---|---|
| `send_audio` | `(data: bytes, sample_rate: int = 16000) -> None` | Send a chunk of PCM16 audio. |
| `send_text` | `(text: str) -> None` | Inject a text turn into the live session. |
| `send_image` | `(data: bytes, mime_type: str = "image/jpeg") -> None` | Send a still image or video frame. |
| `send_activity_start` | `() -> None` | Manual VAD: mark start of user speech. Only meaningful when `vad.enabled=False`. |
| `send_activity_end` | `() -> None` | Manual VAD: mark end of user speech. |
| `close` | `() -> None` | Signal end of input. Idempotent; enqueues a `close` sentinel. |

### LiveInput

The dataclass frames enqueued by `send_*`. Not normally constructed directly.

```python
@dataclass
class LiveInput:
    kind: LiveInputKind   # "audio" | "text" | "image" | "activity_start" | "activity_end" | "close"
    data: bytes | None = None
    text: str | None = None
    sample_rate: int = 16000
    mime_type: str | None = None
```

---

## RealtimeConfig

Per-session configuration for a realtime session.

```python
from agentflow.core.realtime import RealtimeConfig
```

```python
RealtimeConfig(
    model: str,
    response_modalities: list[Literal["AUDIO", "TEXT"]] = ["AUDIO"],
    voice: str | None = None,
    system_instruction: str | None = None,
    input_audio_transcription: bool = True,
    output_audio_transcription: bool = True,
    vad: VADConfig = VADConfig(),
    reconnect: ReconnectConfig = ReconnectConfig(),
    context_window_compression: bool = False,
    session_resumption: bool = True,
    tools: list[Any] | None = None,
    tools_tags: list[str] | None = None,
)
```

| Field | Default | Notes |
|---|---|---|
| `model` | required | Gemini Live model string. |
| `response_modalities` | `["AUDIO"]` | Exactly one modality per session (validated). Pass `["TEXT"]` for a text-only session. |
| `voice` | `None` | Provider voice name (e.g. `"Puck"`). Provider default when `None`. |
| `system_instruction` | `None` | Fixed at connect time for the lifetime of the session. When `AudioAgent.system_prompt` is set, it overrides this field at connect time. |
| `input_audio_transcription` | `True` | Enable provider-side transcription of user speech. |
| `output_audio_transcription` | `True` | Enable provider-side transcription of model speech. |
| `vad` | `VADConfig()` | Voice-activity detection settings. |
| `reconnect` | `ReconnectConfig()` | Reconnect/backoff policy. |
| `context_window_compression` | `False` | Enable provider-side context window compression. |
| `session_resumption` | `True` | Store and use Gemini session resumption handles. Requires a checkpointer for cross-session resume. |
| `tools` | `None` | Override the auto-derived tool schemas. When `None`, schemas are taken from the `ToolNode`. |
| `tools_tags` | `None` | Filter which tools are advertised by tag. |

`response_modalities` is validated: it must contain exactly one entry. Passing `["AUDIO", "TEXT"]` raises `ValueError`.

---

## VADConfig

Voice-activity detection settings. Disable for push-to-talk (manual activity) workflows.

```python
from agentflow.core.realtime import VADConfig

VADConfig(
    enabled: bool = True,
    start_sensitivity: str | None = None,
    end_sensitivity: str | None = None,
    prefix_padding_ms: int | None = None,
    silence_duration_ms: int | None = None,
)
```

| Field | Default | Notes |
|---|---|---|
| `enabled` | `True` | Set `False` to use manual push-to-talk via `send_activity_start` / `send_activity_end`. |
| `start_sensitivity` | `None` | Provider-neutral sensitivity hint. `None` uses provider default. |
| `end_sensitivity` | `None` | Provider-neutral sensitivity hint. `None` uses provider default. |
| `prefix_padding_ms` | `None` | Audio prepended before detected speech onset. |
| `silence_duration_ms` | `None` | Silence duration that triggers end-of-speech detection. |

---

## ReconnectConfig

Reconnect and backoff policy for dropped sessions.

```python
from agentflow.core.realtime import ReconnectConfig

ReconnectConfig(
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    max_attempts: int = 5,
)
```

| Field | Default | Notes |
|---|---|---|
| `base_delay` | `0.5` | Base delay in seconds for exponential backoff. |
| `max_delay` | `10.0` | Maximum delay cap in seconds. |
| `max_attempts` | `5` | Maximum error-driven reconnect attempts. Set `0` to disable error-driven reconnect entirely. |

**Reconnect rules:**

- `go_away` (planned provider rotation): reconnect immediately with no backoff, attempts counter is not incremented.
- Transient drop / receive error: attempt `n` waits `min(base_delay * 2^(n-1), max_delay)` seconds, up to `max_attempts`. After the cap, a fatal `ErrorEvent(code="reconnect_failed")` is emitted and the session ends.
- Any successful receive resets the attempts counter to 0.

---

## RealtimeEvent

Discriminated union keyed on `type`. All events are Pydantic models.

```python
from agentflow.core.realtime import RealtimeEvent
```

### AudioDeltaEvent

```python
type: Literal["audio_delta"]
data: bytes        # PCM16 chunk at OUTPUT_SAMPLE_RATE (24000 Hz)
sample_rate: int   # always 24000
```

A chunk of model audio output. Write it to a speaker or file.

### InputTranscriptEvent

```python
type: Literal["input_transcript"]
text: str
finished: bool     # True on the final chunk; text carries the complete transcript
```

Transcript of the user's speech. The provider streams partial chunks (`finished=False`) as they are transcribed. On `finished=True`, `text` carries the complete transcript for the turn. Persisted to the checkpointer thread when finished.

### OutputTranscriptEvent

```python
type: Literal["output_transcript"]
text: str
finished: bool
```

Transcript of the model's speech. Same streaming/finished semantics as `InputTranscriptEvent`. Persisted to the checkpointer thread when finished.

### ToolCallEvent

```python
type: Literal["tool_call"]
id: str
name: str
args: dict[str, Any]
```

The provider is requesting a tool invocation. Agentflow dispatches this automatically through the `ToolNode` and returns the result before the model continues. Emitted before tool execution for observability.

### ToolResultEvent

```python
type: Literal["tool_result"]
id: str
result: Any
```

Emitted after a tool finishes, for observability. The result has already been sent back to the model.

### TurnCompleteEvent

```python
type: Literal["turn_complete"]
```

The model finished generating a turn (audio and transcription complete).

### InterruptedEvent

```python
type: Literal["interrupted"]
```

Barge-in: the user spoke while the model was talking. Flush any queued audio playback. Partial transcripts for the interrupted turn are discarded.

### SessionUpdateEvent

```python
type: Literal["session_update"]
resumption_handle: str | None
```

The provider issued a session-resumption handle. Stored in the checkpointer thread metadata automatically when a checkpointer is provided.

### GoAwayEvent

```python
type: Literal["go_away"]
time_left: str | None    # provider duration string (e.g. "5s"); verbatim
```

The provider will close the socket soon (planned rotation). The runtime reconnects immediately with the cached resumption handle; no intervention is required from the caller.

### AgentChangedEvent

```python
type: Literal["agent_changed"]
author: str
```

The active agent or persona changed. Reserved for future multi-agent persona swap.

### ErrorEvent

```python
type: Literal["error"]
code: str | None
message: str
fatal: bool
```

A normalized provider error. Non-fatal errors are transient; the session continues. Fatal errors (`fatal=True`) end the session; `code="reconnect_failed"` means reconnect attempts were exhausted.

---

## RealtimeClient (Protocol)

Provider-neutral protocol that all provider clients implement. Not used directly in application code; use `AudioAgent` instead.

```python
from agentflow.core.realtime import RealtimeClient
```

| Method | Signature | Description |
|---|---|---|
| `connect` | `async (config: RealtimeConfig, resume_handle: str \| None = None) -> None` | Open a provider socket. |
| `send_audio` | `async (pcm: bytes, sample_rate: int) -> None` | Send PCM16 audio input. |
| `send_text` | `async (text: str) -> None` | Send a text turn. |
| `send_image` | `async (data: bytes, mime_type: str) -> None` | Send an image frame. |
| `send_activity_start` | `async () -> None` | Manual VAD: start marker. |
| `send_activity_end` | `async () -> None` | Manual VAD: end marker. |
| `send_tool_response` | `async (call_id: str, name: str, result: Any) -> None` | Return a tool result to the model. |
| `reseed_history` | `async (messages: list[Any]) -> None` | Seed conversation history into a fresh session. |
| `receive` | `() -> AsyncIterator[RealtimeEvent]` | Yield normalized events from the provider. |
| `close` | `async () -> None` | Close the socket. Safe to call more than once. |

### GeminiLiveClient

The Gemini Live provider client. Import path: `agentflow.core.realtime.GeminiLiveClient`. Used by `LiveAgent` internally; inject a custom factory via `AudioAgent(realtime_client_factory=...)` for testing.

```python
from agentflow.core.realtime import GeminiLiveClient, normalize_message
```

`normalize_message` converts Gemini wire messages to `RealtimeEvent` objects.

---

## GraphLifecycleHook integration

Realtime sessions fire lifecycle hooks via `GraphLifecycleHook`. Register via `CallbackManager.register_lifecycle_hook` and pass `callback_manager` to `compile()`.

```python
from agentflow.utils.callbacks import CallbackManager, GraphLifecycleHook
from agentflow.core.state import AgentState

class SessionAuditHook(GraphLifecycleHook):
    async def on_graph_start(self, ctx, state: AgentState) -> AgentState:
        print("session started")
        return state

    async def on_graph_end(self, ctx, state, messages, total_steps: int) -> None:
        print(f"session ended after {total_steps} turns")

    async def on_turn_start(self, ctx, state: AgentState, turn_index: int) -> AgentState:
        print(f"turn {turn_index} starting")
        return state

    async def on_turn_end(self, ctx, state: AgentState, turn_index: int) -> AgentState:
        print(f"turn {turn_index} complete")
        return state

cb = CallbackManager()
cb.register_lifecycle_hook(SessionAuditHook())

app = AudioAgent(MODEL, ...).compile(callback_manager=cb)
```

Hook semantics in realtime:

| Hook | When | Notes |
|---|---|---|
| `on_graph_start` | Once, before the first turn | The session opened. |
| `on_graph_end` | Once, after the session closes | `total_steps` = number of turns completed. |
| `on_turn_start` | Before each model generation turn | `turn_index` is 1-based. |
| `on_turn_end` | After `turn_complete` or `interrupted` | If the session closes mid-turn (no `turn_complete`), still fired. |

These hooks are no-ops for `invoke` and `stream`. Tool/MCP before/after/error callbacks fire as usual. No AI-invocation callback or input-validator pass runs in realtime.

---

## API server WebSocket bridge

`agentflow api` exposes `ws://<host>/v1/graph/live` when the configured graph contains a `LiveAgent`.

### Protocol reference

**Auth:** `RequirePermission("graph", "stream")`. Browser WebSocket clients can pass the token as a `?token=` query parameter.

**Frame 1 (client -> server): JSON control (init)**

```json
{
  "thread_id": "abc",
  "model": "gemini-live-2.5-flash-preview",
  "voice": "Puck",
  "modalities": ["AUDIO"],
  "vad": {"enabled": true}
}
```

All fields are optional. Present fields override the agent's build-time `RealtimeConfig` for this session. A new `thread_id` is generated if absent.

**Subsequent upstream frames:**

| Frame type | Content |
|---|---|
| Binary | PCM16 input audio at 16 kHz |
| JSON text `{"type": "text", "text": "..."}` | Inject a text turn |
| JSON text `{"type": "activity_start"}` | Manual VAD start |
| JSON text `{"type": "activity_end"}` | Manual VAD end |
| JSON text `{"type": "close"}` | End the session |

**Downstream frames:**

| Frame type | Content |
|---|---|
| Binary | PCM16 model audio at 24 kHz (`audio_delta`) |
| JSON text | All other `RealtimeEvent` objects serialized via `model_dump(mode="json")` |

Image/video input is SDK-only. The WebSocket bridge does not forward image frames.

### WebSocket close codes

| Code | Meaning |
|---|---|
| `1003` | Invalid init frame (not JSON, not a dict). |
| `1011` | Internal server error (e.g. non-live graph, provider/checkpointer error). |
| `1000` | Normal close (session ended). |

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ImportError: google.generativeai` | Session opened without the `realtime` extra installed. | `pip install "10xscale-agentflow[realtime]"`. |
| `ValueError: LiveAgent v1 supports only Gemini Live (google provider)` | Model string resolved to a non-Google provider. | Use a `gemini-*` model string or prefix with `gemini/`. |
| `RuntimeError: This graph contains a LiveAgent; use .arealtime()` | Called `invoke`/`stream` on a realtime graph. | Switch to `arealtime()`. |
| `RuntimeError: arealtime() requires a graph rooted at a LiveAgent` | Called `arealtime()` on a non-realtime graph. | Use `AudioAgent` or add a `LiveAgent` node. |
| `RuntimeError: realtime() (sync) cannot be called from a running event loop` | Called `realtime()` inside an async context. | Use `await arealtime()` instead. |
| `ValueError: response_modalities must contain exactly one modality` | Passed two modalities to `RealtimeConfig`. | Pass exactly one: `["AUDIO"]` or `["TEXT"]`. |
| `ErrorEvent(code="reconnect_failed", fatal=True)` | Reconnect attempts exhausted after transient drops. | Check network stability; increase `max_attempts` or `max_delay`. |
