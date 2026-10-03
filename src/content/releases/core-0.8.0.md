---
package: core
version: "0.8.0"
date: 2026-06-15
summary: Introduces the realtime audio-to-audio subsystem, with LiveAgent, AudioAgent and a Gemini Live client, plus an LLM circuit breaker, default request timeouts and secret redaction in logs.
breaking: false
---

### Added

- **Realtime (audio-to-audio) subsystem** in `agentflow.core.realtime`. It includes provider-neutral contracts (`RealtimeConfig`, `RealtimeClient` and typed events such as `AudioDeltaEvent`, `ToolCallEvent` and `TurnCompleteEvent`), an upstream `LiveInputQueue`, and a `GeminiLiveClient`. Provider SDK imports are lazy.
- **`LiveAgent` and `AudioAgent`.** `LiveAgent` runs the duplex session loop, dispatches tool calls through the existing `ToolNode`, persists finished transcripts as messages and reconnects on `go_away` or a dropped socket. `CompiledGraph.arealtime` is the entry point. `AudioAgent` builds and compiles a single realtime audio agent graph.
- **`realtime` optional extra** (`pip install "10xscale-agentflow[realtime]"`), which pulls in `google-genai`.
- **LLM circuit breaker.** `RetryConfig` gains `circuit_breaker_enabled` (default `False`), `circuit_breaker_threshold` (default `5`) and `circuit_breaker_reset_timeout` (default `30.0` seconds). A failing `(provider, model)` pair is skipped and the call moves to the next fallback until the cooldown ends.
- **Default LLM request timeout** of 600 seconds, applied to client construction for Google GenAI and OpenAI-style clients. Override it with the `AGENTFLOW_LLM_TIMEOUT` environment variable or `set_default_llm_timeout()`; read it with `get_default_llm_timeout()`.
- **Secret redaction in logs.** `mask_secrets()` masks common API key formats, `Bearer` tokens, `key=value` secrets and signed-URL credential parameters. This is best-effort, not a guarantee.
- `CompiledGraph` can be used as an async context manager (`async with graph:`), which runs `aclose()` on exit. Calling `aclose()` more than once is a no-op.
- A `py.typed` marker, so type information reaches consumers.

### Changed

- Token usage is now calculated in the graph invoke and stream handlers.
- `ConsolePublisher` accepts a logger.
- Provider detection and model resolution in `Agent` was reworked around `resolve_provider_and_model`.
