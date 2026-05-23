---
title: Google Model Configuration — AgentFlow
sidebar_label: Google Configuration
description: Complete reference for Google Gemini-specific configuration in AgentFlow — implicit and explicit context caching, thinking models, Vertex AI, and provider params for Agent, SummaryContextManager, and Evaluation.
keywords:
  - google gemini configuration
  - context caching
  - gemini caching
  - thinking models
  - vertex ai
  - agentflow google
sidebar_position: 5
---

# Google Model Configuration

Reference for every Google Gemini-specific option available in AgentFlow across the Agent
class, `SummaryContextManager`, and the evaluation judge.

---

## Context Caching

Gemini offers two caching modes. Both reduce input token costs and latency for prompts
that repeat the same large prefix across requests.

### Implicit Caching (Gemini 2.5+)

Enabled automatically on all Gemini 2.5 and later models. No code changes required.
Google detects matching prefixes on their infrastructure and passes on the savings.

Cache hit counts are read from `usage_metadata.cached_content_token_count` and logged at
`DEBUG` level by AgentFlow after every non-streaming response.

```python
from agentflow.core.graph import Agent

# Implicit caching fires automatically — nothing to configure
agent = Agent(
    model="gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": long_system_prompt}],
)
```

For implicit caching to hit consistently, the prompt prefix must be **stable across
requests**. In practice this means:
- `system_prompt` is set at Agent init time and does not change per request.
- Dynamic per-request context (user name, current date, state data) is kept out of the
  system prompt and injected into the conversation messages instead.

### Explicit Caching

For guaranteed savings on very large static content (multi-page PDFs, long codebases,
reference documents), create a cache explicitly using the Google SDK and pass the cache
name to the Agent via `cached_content`.

**Step 1 — create the cache outside the Agent:**

```python
import asyncio
from google import genai
from google.genai import types

client = genai.Client(api_key="...")

async def create_cache():
    cache = await client.aio.caches.create(
        config=types.CreateCachedContentConfig(
            model="gemini-2.5-flash",
            display_name="legal-docs-v1",
            system_instruction="You are a legal analyst...",
            contents=[
                types.Content(
                    role="user",
                    parts=[types.Part(text=large_document_text)],
                )
            ],
            ttl="7200s",  # 2 hours; default is 3600s
        )
    )
    return cache.name  # e.g. "cachedContents/abc123"

cache_name = asyncio.run(create_cache())
```

**Step 2 — pass the cache name to the Agent:**

```python
agent = Agent(
    model="gemini-2.5-flash",
    system_prompt=[],         # static instruction is already inside the cache
    cached_content=cache_name,  # forwarded through llm_kwargs
)
```

**Minimum token requirements:**

| Model | Minimum cached tokens |
|---|---|
| Gemini 2.5 Flash | 1,024 |
| Gemini 2.5 Pro | 4,096 |
| Gemini 3 Pro Preview | 4,096 |

**What can be cached:** system instructions, plain text, PDF documents, video files (via
GCS URIs). The cache is stored server-side; you reference it by name.

**Cache lifecycle:** TTL defaults to 1 hour. Only TTL and expiration time can be updated
after creation. Deletion is manual or automatic on expiry. AgentFlow does not manage
cache lifecycle — create, refresh, and delete caches via the Google SDK directly.

---

## Mixing Static and Dynamic System Instructions

When using explicit caching, the Google SDK does not allow sending `system_instruction`
in `GenerateContentConfig` alongside `cached_content` — the static instruction already
lives inside the cache.

AgentFlow handles this automatically:

- If `cached_content` is set, `system_instruction` is **excluded** from the config.
- Any dynamic additions to the system prompt — from memory injections, skill prompts, or
  per-request state — are **preserved** by prepending them as a leading user message in
  `contents` before the conversation history.

This means the recommended pattern is:

```python
# Static instruction — goes into the cache at creation time
static_instruction = "You are a legal analyst. Reference the attached documents..."

# Agent with only dynamic additions in system_prompt
agent = Agent(
    model="gemini-2.5-flash",
    system_prompt=[
        # Dynamic context injected per-request by memory/skill systems
        # e.g. {"role": "system", "content": "User preference: formal tone"}
    ],
    cached_content=cache_name,
)
```

When the Agent runs and memory/skills add entries to `effective_system_prompt`, AgentFlow
concatenates them and injects the result as the first item in `google_contents`. The
model receives both the cached static instruction and the dynamic context.

If you have no dynamic system context, pass an empty `system_prompt` (or omit it). The
`cached_content` pointer alone is sufficient.

### SummaryContextManager with explicit caching

`call_llm` (used internally by `SummaryContextManager`) accepts `cached_content` via
`**llm_kwargs`. When set, the same exclusion logic applies — `system_prompt` is omitted
from the config and the cache is attached instead.

```python
from agentflow.core.state import SummaryContextManager
from agentflow.core.llm.caller import call_llm

# Direct call_llm usage with explicit cache
text, inp, out, cache = await call_llm(
    "gemini-2.5-flash",
    prompt,
    cached_content=cache_name,
)

# SummaryContextManager does not yet accept cached_content directly.
# The implicit cache on Gemini 2.5+ already benefits the summariser
# when its system prompt prefix is stable across calls.
manager = SummaryContextManager(
    model="gemini-2.5-flash",
    token_budget=8000,
)
```

### Evaluation judge with caching

The evaluation judge calls `call_llm` via `LLMCallerMixin`. Implicit caching on Gemini
2.5+ fires automatically when the judge prompt prefix (rubric + instructions) is stable.
Explicit cache support is not yet wired through `CriterionConfig`.

```python
from agentflow.qa.evaluation import CriterionConfig, EvalConfig, CriteriaConfig

config = EvalConfig(
    criteria=CriteriaConfig(
        llm_judge=CriterionConfig.llm_judge(
            judge_model="gemini-2.5-flash",   # implicit cache fires automatically
        )
    )
)
```

---

## Thinking Models

Gemini 2.5 and Gemini 3 models support extended thinking. Control it via
`reasoning_config`.

```python
# Enable with defaults
agent = Agent(model="gemini-2.5-pro", reasoning_config=True)

# Set token budget explicitly (Gemini 2.5 style)
agent = Agent(
    model="gemini-2.5-pro",
    reasoning_config={"thinking_budget": 8000},  # tokens to spend on reasoning
)

# Set thinking level (Gemini 3 style)
agent = Agent(
    model="gemini-3-pro",
    reasoning_config={"thinking_level": "high"},  # "minimal"|"low"|"medium"|"high"
)

# Map from effort string (works on both generations)
agent = Agent(
    model="gemini-2.5-flash",
    reasoning_config={"effort": "medium"},  # "low" | "medium" | "high"
)

# Disable
agent = Agent(model="gemini-2.5-flash", reasoning_config=False)
```

Effort-to-budget mapping used internally:

| effort | thinking_budget |
|---|---|
| `"low"` | 512 |
| `"medium"` | 8192 |
| `"high"` | 24576 |

---

## Vertex AI

Use Vertex AI instead of Google AI Studio by setting `use_vertex_ai=True` or the
environment variable `GOOGLE_GENAI_USE_VERTEXAI=true`.

```python
agent = Agent(
    model="gemini-2.5-flash",
    use_vertex_ai=True,
)
```

All other configuration options (caching, thinking, structured output) work identically
on both backends.

Required environment variables for Vertex AI:

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | yes | GCP project with Vertex AI API enabled |
| `GOOGLE_CLOUD_LOCATION` | no | Region (default `us-central1`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | no | Path to service-account JSON; not needed on GCP workloads |

---

## Structured Output

Force the model to return a specific JSON schema by passing `output_schema`. Google does
not support combining structured output with tool calls in the same request.

```python
from pydantic import BaseModel

class ExtractedData(BaseModel):
    name: str
    amount: float
    currency: str

agent = Agent(
    model="gemini-2.5-flash",
    output_schema=ExtractedData,
    system_prompt=[...],
)
```

---

## `llm_kwargs` Reference

All unrecognised keyword arguments passed to `Agent(...)` land in `self.llm_kwargs` and
are forwarded to `GenerateContentConfig` (after provider-level extraction). The following
Google params are useful:

| kwarg | Type | Notes |
|---|---|---|
| `cached_content` | `str` | Name of an explicit Gemini cache (e.g. `"cachedContents/abc123"`). Mutually exclusive with `system_instruction` in the config — AgentFlow handles this automatically. |
| `temperature` | `float` | Sampling temperature. |
| `max_tokens` / `max_output_tokens` | `int` | Maximum output tokens. Both aliases are accepted. |
| `top_p` | `float` | Nucleus sampling. |
| `top_k` | `int` | Top-K sampling. |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | yes (Gemini API) | API key from Google AI Studio (preferred name) |
| `GOOGLE_API_KEY` | — | Fallback name for the Gemini API key |
| `GOOGLE_GENAI_USE_VERTEXAI` | — | Set to `true` to use Vertex AI globally |
| `GOOGLE_CLOUD_PROJECT` | yes (Vertex AI) | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | — | Vertex AI region (default `us-central1`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Service-account JSON path (non-GCP environments) |
