---
package: core
version: "0.9.2"
date: 2026-09-24
summary: Adds a native Anthropic provider with prompt caching, server tools and batches, token counting, an OpenAI batch helper, and several tool-node and background-task fixes. One breaking routing change.
breaking: true
---

### Breaking

- **`anthropic/` and `claude/` are now recognised model prefixes.** Previously they were unknown prefixes that fell through to the OpenAI provider, which is how Claude behind an OpenAI-compatible proxy worked. `Agent(model="anthropic/claude-3")` now selects the native Anthropic provider and strips the prefix. **Migration:** pass `provider="openai"` explicitly to keep routing through an OpenAI-compatible endpoint, for example `Agent(model="anthropic/claude-3", provider="openai", base_url=...)`.

### Added

- **Native Anthropic provider.** `model="claude-opus-5"` (or `"anthropic/..."`, `"claude/..."`) now builds a real Anthropic client instead of constructing an `AsyncOpenAI` that failed at request time. It covers non-streaming and streaming, tool calling, multimodal input, reasoning, usage accounting and retry/fallback. Install with the `anthropic`, `anthropic-vertex` or `anthropic-bedrock` extra.
  - Three backends, selected with `anthropic_backend`: `None` (direct Claude API), `"vertex"` (`AsyncAnthropicVertex`) and `"bedrock"` (`AsyncAnthropicBedrockMantle`). Bedrock model ids keep their `anthropic.` prefix.
  - `max_tokens` is required by the API and is defaulted automatically (16000 non-streaming, 64000 streaming).
  - `temperature`, `top_p` and `top_k` are stripped per model for models that reject them with a 400.
  - `reasoning_config={"effort": ...}` maps to `thinking={"type": "adaptive"}` plus `output_config.effort`. `budget_tokens` is never emitted, because it returns a 400 on current Claude models.
  - A trailing assistant turn is dropped, since prefill returns a 400 on current models. This protects the injected `context_summary`.
  - A policy `refusal` is surfaced as a message with `metadata["refusal"]` instead of being treated as a transient failure that burns the model fallback list.
- **`Agent.count_tokens(messages, tools)`** counts a request's input tokens before sending it, using the provider's own endpoint. For Anthropic it uses the exact payload the real call would send (system prompt, tool schemas, merged tool results). For Google it counts the converted `contents` only, so the system instruction and tool schemas are not included.
- **Anthropic prompt caching.** `anthropic_cache=True` (or a dict such as `{"type": "ephemeral", "ttl": "1h"}`) places `cache_control` breakpoints at the end of the stable request prefix: the last tool and the last system block. It is skipped when the caller placed their own breakpoints. Verify hits with `usage.cache_read_input_tokens`; a prefix under about 1024 tokens silently does not cache.
- **Anthropic server tools.** `web_search_tool()`, `web_fetch_tool()` and `code_execution_tool()` build correctly dated definitions. Server-tool result blocks are captured into `metadata["server_tool_results"]`, and a `server_tool_use` block is recorded without being added to `tools_calls`, so the graph does not re-run work Anthropic already did. A server-tool error is surfaced as `error_code`, and `stop_reason: "pause_turn"` is flagged as `metadata["pause_turn"]`.
- **`AnthropicBatch`** and **`OpenAIBatch`** (`agentflow.core.llm`) for batch APIs, with a shared interface: build, submit, poll and collect. Results are keyed by `custom_id`, because batch results arrive in any order. `BatchResult` is exported alongside them.
- **`call_llm` supports Anthropic**, so `SummaryContextManager`, the evaluation judge and `UserSimulator` work with Claude models.

### Changed

- Tool-result serialization has explicit rules for `datetime`, `UUID`, `Decimal`, `Enum`, `set` and `bytes` values. `Decimal` renders as a string so money values keep their precision.
- When a nested-object tool parameter fails validation and the model sent it as a JSON string, the string is decoded and validated as a fallback. Validation failures now return a readable message naming the tool and parameter.

### Fixed

- **`use_vertex_ai=True` hijacked Claude models.** The flag short-circuited provider detection to `"google"`, so `Agent(model="claude-opus-5", use_vertex_ai=True)` built a Google GenAI client with a Claude model name. It now acts as a backend selector for Anthropic (equivalent to `anthropic_backend="vertex"`), and an explicit `anthropic_backend` still wins. Behavior for non-Claude models is unchanged.
- **`call_llm` sent unrecognised model prefixes to the SDK verbatim**, so `call_llm("gemini/gemini-2.5-flash", ...)` passed the full string as the model name. It now uses `resolve_provider_and_model`.
- **The Anthropic request builder could send an empty `messages` list** when the context summary was the only turn. The lone trailing assistant turn is now sent as a user turn instead of being discarded.
- **`AnthropicBatch` skipped the trailing-assistant guard** that the live request path applies, so the same input produced two different bodies. Both paths now agree.
- **A missing required tool argument failed the whole graph run** (`NODE_001`). It is now a failed tool result that the model can correct, and on-error callbacks see the model's raw arguments.
- **Tool results serialized `Path` values with backslashes on Windows.** Paths, and resource `uri` values built from them, now use POSIX separators.
- **`wait_for_all()` returned before task cleanup callbacks ran**, leaving finished tasks and their metadata in the manager. It now yields once so the callbacks run first.
