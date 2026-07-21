---
title: LLM Utilities — AgentFlow Python AI Agent Framework
sidebar_label: LLM utilities
description: call_llm, create_llm_client, detect_provider, and the default LLM timeout controls exported from agentflow.core.llm.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - llm
sidebar_position: 18
---


# LLM utilities

## When to use this

`agentflow.core.llm` is the thin provider layer that `Agent` and the evaluation judges sit on. Use it directly when you need a single-turn LLM call outside a graph, when you want a raw provider SDK client, or when you need to change the default request timeout process-wide.

For agent behaviour inside a graph, use [`Agent`](agent.md) instead. This module has no state, no tools, and no retries.

## Import paths

```python
from agentflow.core.llm import (
    DEFAULT_LLM_TIMEOUT_SECONDS,
    call_llm,
    create_llm_client,
    detect_provider,
    get_default_llm_timeout,
    set_default_llm_timeout,
)
```

---

## `call_llm`

```python
async def call_llm(
    model: str,
    prompt: str,
    *,
    system_prompt: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.3,
    json_mode: bool = False,
    use_vertex_ai: bool = False,
    api_style: Literal["responses", "chat"] = "responses",
    **llm_kwargs: Any,
) -> tuple[str, int, int, int]
```

Single-turn call with provider auto-detection. The provider is inferred from `model` via `detect_provider`, a client is created for it, and the request is dispatched to the matching backend.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | **required** | Model identifier, e.g. `"gemini-2.0-flash"`, `"gpt-4o-mini"`. |
| `prompt` | `str` | **required** | The user-turn content. |
| `system_prompt` | `str \| None` | `None` | System instruction prepended to the request. |
| `max_tokens` | `int` | `1024` | Maximum tokens to generate. |
| `temperature` | `float` | `0.3` | Sampling temperature. |
| `json_mode` | `bool` | `False` | Instruct the provider to return valid JSON. |
| `use_vertex_ai` | `bool` | `False` | Force the Google Vertex AI client. |
| `api_style` | `"responses" \| "chat"` | `"responses"` | OpenAI only. `"responses"` uses `client.responses.create`. Use `"chat"` for models that only support the legacy Chat Completions endpoint. |
| `**llm_kwargs` | any | — | Provider-specific parameters forwarded to the underlying API call. |

**Returns:** the plain tuple `(text, input_tokens, output_tokens, cache_read_tokens)`. Token counts are `0` when the provider does not report them.

```python
text, in_tokens, out_tokens, cached = await call_llm(
    "gemini-2.5-flash",
    "Summarise this ticket in one sentence.",
    system_prompt="You are terse.",
    max_tokens=128,
)
```

### Provider-specific `llm_kwargs`

| Provider | Key | Effect |
|---|---|---|
| Google | `cached_content="cachedContents/abc123"` | Attach an explicit Gemini context cache created through the Google SDK. |
| OpenAI | `prompt_cache_key="my-agent-v1"` | Improve cache hit rates across requests that share a long system-prompt prefix. |
| OpenAI | `prompt_cache_retention="24h"` | Extend cache retention on models that support it. The default is in-memory and short-lived. |

---

## `detect_provider`

```python
def detect_provider(model: str, use_vertex_ai: bool = False) -> str
```

Infers the provider from a model name. Returns `"google"` or `"openai"`; those are the only two values.

Resolution order:

1. `use_vertex_ai=True` always returns `"google"`.
2. A recognised `provider/` prefix wins: `gemini/`, `google/` map to `"google"`; `openai/`, `gpt/` map to `"openai"`. An unrecognised prefix is stripped and detection continues on the remainder.
3. Names starting with `gemini-`, `imagen-`, `veo-`, or `chirp` map to `"google"`.
4. Names starting with `gpt-`, `o1-`, `o3-`, or `o4-` map to `"openai"`.
5. Anything else defaults to `"openai"`, logged at info level.

```python
detect_provider("gemini-2.5-flash")        # "google"
detect_provider("openai/qwen-2.5-72b")     # "openai"
detect_provider("llama-3.3-70b")           # "openai" (fallback, logged)
```

---

## `create_llm_client`

```python
def create_llm_client(
    provider: str,
    *,
    use_vertex_ai: bool = False,
    base_url: str | None = None,
    api_key: str | None = None,
    **extra_kwargs: Any,
) -> Any
```

Creates a native async SDK client for the given provider.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `provider` | `str` | **required** | `"google"` or `"openai"`. Anything else raises `ValueError`. |
| `use_vertex_ai` | `bool` | `False` | Google only. Builds a Vertex AI client from `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`. |
| `base_url` | `str \| None` | `None` | Custom base URL for OpenAI-compatible APIs such as Ollama or vLLM. |
| `api_key` | `str \| None` | `None` | Explicit API key. Falls back to the provider's environment variable when omitted. |
| `**extra_kwargs` | any | — | Forwarded to the `AsyncOpenAI` constructor. Only recognised constructor keys are passed through. |

**Raises:** `ImportError` when the provider SDK is not installed, `ValueError` for an unsupported provider or missing required configuration.

```python
client = create_llm_client(
    "openai",
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
```

---

## Request timeout

### `DEFAULT_LLM_TIMEOUT_SECONDS`

The built-in default, `600.0` seconds.

### `get_default_llm_timeout`

```python
def get_default_llm_timeout() -> float
```

Returns the timeout in seconds actually in effect. First match wins:

1. An override set through `set_default_llm_timeout`.
2. The `AGENTFLOW_LLM_TIMEOUT` environment variable, in seconds.
3. `DEFAULT_LLM_TIMEOUT_SECONDS`.

### `set_default_llm_timeout`

```python
def set_default_llm_timeout(seconds: float | None) -> None
```

Overrides the default timeout process-wide. Pass `None` to clear the override and fall back to the environment variable or built-in default. Raises `ValueError` when `seconds` is not positive.

```python
from agentflow.core.llm import get_default_llm_timeout, set_default_llm_timeout

set_default_llm_timeout(120.0)
get_default_llm_timeout()  # 120.0

set_default_llm_timeout(None)
get_default_llm_timeout()  # 600.0, or AGENTFLOW_LLM_TIMEOUT if set
```

This bounds the provider request only. Node and tool execution have their own deadlines: see `node_timeout` and `tool_timeout` in the [graph reference](graph.md#execution-deadlines). The node default (900s) is deliberately above the LLM default (600s), so a slow LLM call fails with its own error instead of being masked by the node deadline.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ValueError: Unsupported provider: '...'` | A provider other than `"google"` or `"openai"` was passed to `create_llm_client`. | Use one of the two. Reach other models through an OpenAI-compatible `base_url`. |
| `ImportError: google-genai SDK is required` | Google provider selected without the SDK. | `pip install "10xscale-agentflow[google-genai]"`. |
| `ImportError` on the OpenAI client | OpenAI provider selected without the SDK. | `pip install "10xscale-agentflow[openai]"`. |
| `ValueError: LLM timeout must be a positive number of seconds.` | `set_default_llm_timeout` called with `0` or a negative value. | Pass a positive number, or `None` to clear the override. |
| Wrong provider auto-detected | Model name matches no known prefix, so detection falls back to `"openai"`. | Pass `provider=` explicitly on `Agent`, or prefix the model, e.g. `"gemini/my-model"`. |

---

## Related docs

- [Agent reference](agent.md)
- [Providers](../../providers/index.md)
