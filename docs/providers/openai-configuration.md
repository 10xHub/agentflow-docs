---
title: OpenAI Model Configuration — AgentFlow
sidebar_label: OpenAI Configuration
description: Complete reference for OpenAI-specific configuration in AgentFlow — API style, prompt caching, reasoning, and provider params for Agent, SummaryContextManager, and Evaluation.
keywords:
  - openai configuration
  - prompt caching
  - api style
  - chat completions
  - responses api
  - agentflow openai
sidebar_position: 4
---

# OpenAI Model Configuration

Reference for every OpenAI-specific option available in AgentFlow across the Agent class,
`SummaryContextManager`, and the evaluation judge.

---

## API Style

OpenAI exposes two distinct APIs for text generation. AgentFlow supports both.

| `api_style` | Underlying call | When to use |
|---|---|---|
| `"chat"` (default) | `client.chat.completions.create` | All GPT and O-series models. Default for the Agent class. |
| `"responses"` | `client.responses.create` | Newer Responses API. Default for `SummaryContextManager` and the evaluation judge. |

### Agent

```python
from agentflow.core.graph import Agent

# Default — Chat Completions
agent = Agent(model="gpt-4o", system_prompt=[...])

# Opt into the Responses API
agent = Agent(model="gpt-4o", api_style="responses", system_prompt=[...])
```

### SummaryContextManager

```python
from agentflow.core.state import SummaryContextManager

# Default is "responses" for the context manager
manager = SummaryContextManager(model="gpt-4o-mini", token_budget=8000)

# Older or third-party-hosted models that only support Chat Completions
manager = SummaryContextManager(
    model="gpt-4o-mini",
    api_style="chat",
    token_budget=8000,
)
```

### Evaluation judge

The evaluation judge reads `api_style` from `CriterionConfig.api_style` (defaults to
`"responses"`). Set it per-criterion when using a model that only supports Chat Completions:

```python
from agentflow.qa.evaluation import CriterionConfig, EvalConfig, CriteriaConfig

config = EvalConfig(
    criteria=CriteriaConfig(
        llm_judge=CriterionConfig.llm_judge(
            judge_model="gpt-4o",
            api_style="chat",   # override if needed
        )
    )
)
```

---

## Prompt Caching

OpenAI caches the prompt prefix automatically — no code changes required. Cache hits are
reported back in `usage.input_tokens_details.cached_tokens` and logged at `DEBUG` level
by AgentFlow. You only need to act if you want to improve hit rates.

**How it works:** OpenAI hashes the first N tokens of your request (system prompt +
conversation history + tool definitions). Requests sharing an identical prefix are routed
to a server that already has the KV cache in GPU memory. You always send the full prompt;
OpenAI serves the cached computation.

**Minimum size:** 1,024 tokens. Requests below this threshold report zero cached tokens.

**TTL:** 5-10 minutes of inactivity (in-memory, volatile). Extended to 24 hours for
`gpt-5.5` and select `gpt-5.x` models with `prompt_cache_retention="24h"`.

### `prompt_cache_key`

When multiple Agent instances (or multiple processes) share the same long system prompt,
pass a stable key to colocate them on the same cached server and raise the hit rate.

```python
agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": very_long_prompt}],
    prompt_cache_key="legal-analyst-v2",  # passed through llm_kwargs
)
```

This is an OpenAI request-level parameter forwarded directly through `llm_kwargs`. It is
**not** in `CALL_EXCLUDED_KWARGS` so it reaches the API unchanged.

### `prompt_cache_retention`

Extends the cache TTL to 24 hours. Only effective on `gpt-5.5` and select `gpt-5.x` models.

```python
agent = Agent(
    model="gpt-5.5",
    system_prompt=[...],
    prompt_cache_key="assistant-v1",
    prompt_cache_retention="24h",
)
```

### SummaryContextManager with caching

`SummaryContextManager` uses `call_llm` internally. Pass `prompt_cache_key` via
`**llm_kwargs` — it is threaded through to the underlying OpenAI call.

> `SummaryContextManager` does not currently accept `**llm_kwargs` directly.
> If you need cache keys on the summariser, subclass it or open an issue.

### Evaluation judge with caching

The evaluation judge also calls `call_llm`. Extra kwargs are not yet forwarded from
`CriterionConfig` to `call_llm`. The implicit cache still fires automatically when the
judge prompt prefix is stable (same rubric, same model).

---

## Reasoning Models

`o1`, `o3`, and `o4-mini` support extended thinking. Controlled via `reasoning_config`.

```python
# Enable with defaults (effort="medium")
agent = Agent(model="o4-mini", reasoning_config=True)

# Set effort level
agent = Agent(
    model="o4-mini",
    reasoning_config={"effort": "high"},  # "low" | "medium" | "high"
)

# Disable (useful when falling back to a non-reasoning model)
agent = Agent(model="o4-mini", reasoning_config=False)
```

`reasoning_config` is not applicable to `gpt-*` models. The Agent ignores it for models
that do not support extended thinking.

---

## Structured Output

Force the model to return a Pydantic model by passing `output_schema`. The Agent routes
this through `beta.chat.completions.parse` regardless of `api_style`.

```python
from pydantic import BaseModel

class MyOutput(BaseModel):
    answer: str
    confidence: float

agent = Agent(
    model="gpt-4o",
    output_schema=MyOutput,
    system_prompt=[...],
)
```

Caching still applies to the `beta.chat.completions.parse` path — cache hits are logged
the same way.

---

## OpenAI-Compatible Endpoints

Any OpenAI-compatible server (ollama, vllm, LM Studio, etc.) can be used by setting
`base_url`:

```python
agent = Agent(
    model="llama3.2",
    base_url="http://localhost:11434/v1",
    api_style="chat",  # most local servers only support Chat Completions
)
```

When `base_url` is set and `api_style="responses"`, the Agent tries the Responses API
first and falls back to Chat Completions automatically if the server does not support it.

Prompt caching params (`prompt_cache_key`, `prompt_cache_retention`) have no effect on
local servers unless the server explicitly implements them.

---

## `llm_kwargs` Reference

All unrecognised keyword arguments passed to `Agent(...)` land in `self.llm_kwargs` and
are forwarded to the underlying API call. The following OpenAI params are useful:

| kwarg | Type | Applies to | Notes |
|---|---|---|---|
| `prompt_cache_key` | `str` | Chat + Responses | Improves cross-request cache hit rate |
| `prompt_cache_retention` | `"in_memory"` / `"24h"` | Chat + Responses | 24h only on gpt-5.5+ |
| `temperature` | `float` | Chat + Responses | Sampling temperature (0.0–2.0) |
| `max_tokens` | `int` | Chat | Max output tokens |
| `max_output_tokens` | `int` | Responses | Max output tokens (Responses API name) |
| `reasoning_effort` | `str` | Reasoning models | `"low"` / `"medium"` / `"high"` |
| `top_p` | `float` | Chat + Responses | Nucleus sampling |
| `frequency_penalty` | `float` | Chat | Penalise repeated tokens |
| `presence_penalty` | `float` | Chat | Penalise already-seen tokens |

Keys in `CALL_EXCLUDED_KWARGS` (`organization`, `project`, `timeout`, `max_retries`,
`default_headers`, `default_query`, `http_client`, `api_key`, `base_url`) are stripped
before the request is sent and must be passed to the client constructor instead.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | yes | API key from platform.openai.com |
