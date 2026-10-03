---
title: Anthropic — Model providers
sidebar_label: Anthropic
description: Configure the Anthropic provider to run Claude models via the Claude API, Google Cloud Vertex AI, or Amazon Bedrock.
keywords:
  - llm providers
  - ai model providers
  - agentflow providers
  - agentflow
  - python ai agent framework
  - anthropic
  - claude
  - anthropic configuration
  - prompt caching
  - extended thinking
  - vertex ai
  - amazon bedrock
sidebar_position: 3
---

# Anthropic

Run Claude models through the Anthropic Messages API. The same provider also reaches Claude on Google Cloud Vertex AI and on Amazon Bedrock.

## Setup

```bash
pip install "10xscale-agentflow[anthropic]"
```

Get an API key from [console.anthropic.com](https://console.anthropic.com) and export it:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or add it to a `.env` file:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

An unset `ANTHROPIC_API_KEY` is not fatal. The SDK also resolves `ANTHROPIC_AUTH_TOKEN`, an `ant auth login` profile, and workload identity federation, so AgentFlow logs an informational message and lets the SDK try.

## Basic usage

```python
from agentflow.core.graph import Agent

agent = Agent(
    model="claude-opus-5",
    provider="anthropic",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
)
```

`provider` is optional here: model names starting with `claude-` or `anthropic.` resolve to the Anthropic provider, and so does an explicit `anthropic/` or `claude/` prefix on the model string.

## Backends

Google switches to Vertex AI with a boolean `use_vertex_ai`. Anthropic reaches three distinct backends, so its selector is the string `anthropic_backend`, passed through `llm_kwargs`.

| `anthropic_backend` | Client | Extra |
|---|---|---|
| omitted / `None` | `AsyncAnthropic` (Claude API) | `anthropic` |
| `"vertex"` | `AsyncAnthropicVertex` | `anthropic-vertex` |
| `"bedrock"` | `AsyncAnthropicBedrockMantle` | `anthropic-bedrock` |

```python
# Direct Claude API
agent = Agent(model="claude-opus-5")

# Google Cloud Vertex AI — bare model id
agent = Agent(model="claude-opus-5", anthropic_backend="vertex")

# Amazon Bedrock — model ids keep their `anthropic.` prefix
agent = Agent(model="anthropic.claude-opus-5", anthropic_backend="bedrock")
```

Region, project, and AWS credentials are resolved by the Anthropic SDK from the environment unless you pass them explicitly through `llm_kwargs`. Passing `use_vertex_ai=True` without an explicit `anthropic_backend` also selects the Vertex backend, so the flag means the same thing for Claude as it does for Gemini.

The Bedrock client is `AsyncAnthropicBedrockMantle`, the Messages-API endpoint. The plain `AsyncAnthropicBedrock` client is the legacy `InvokeModel` path and is deliberately not used.

## Output types

`output_type` accepts `"text"` and `"json"`. Anything else raises a `ValueError` at construction time. Claude's Messages API generates text and tool calls only; there is no image, audio, or video generation endpoint, so those output types belong to other providers.

## Reasoning

`reasoning_config={"effort": ...}` maps onto `thinking={"type": "adaptive"}` plus `output_config={"effort": ...}`.

```python
agent = Agent(
    model="claude-opus-5",
    reasoning_config={"effort": "high"},
)
```

`budget_tokens` and `thinking_budget` are **not** sent. Current Claude models return a 400 for an explicit thinking budget alongside the model's own adaptive control; AgentFlow logs a warning and drops them. Use `effort` to control depth.

## max_tokens

Anthropic requires `max_tokens` on every request, so AgentFlow supplies a default when you do not:

| Mode | Default |
|---|---|
| Non-streaming | 16000 |
| Streaming | 64000 |

Streaming gets the larger default because a high `max_tokens` on a non-streaming request risks an HTTP timeout. Pass `max_tokens` explicitly to override either one.

## Sampling parameters

Several current models reject `temperature`, `top_p`, and `top_k` with a 400. AgentFlow strips those three keys before the request for `claude-fable-5`, `claude-mythos-5`, `claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7`, and `claude-sonnet-5` (Bedrock's `anthropic.` prefix is stripped before the check). Older Claude models still accept them, so this is a per-model set rather than a blanket strip.

## Prompt caching

Set `anthropic_cache` to place `cache_control` breakpoints on the stable prefix of the request.

```python
agent = Agent(
    model="claude-opus-5",
    anthropic_cache=True,                                # ephemeral, default TTL
    # anthropic_cache={"type": "ephemeral", "ttl": "1h"} # extended retention
)
```

Caching is a prefix match. The render order is `tools` → `system` → `messages`, so the breakpoint goes at the end of the stable prefix — the last tool definition when tools are present, and the last system block — leaving volatile per-request messages after it. Any byte change invalidates everything after the change.

The minimum cacheable prefix is roughly 1024 tokens; a shorter prefix silently does not cache. Confirm with `usage.cache_read_input_tokens` on the response.

## Batch requests

`AnthropicBatch` wraps the Message Batches API for offline, high-volume work.

```python
from agentflow.core.llm import AnthropicBatch

batch = AnthropicBatch(model="claude-haiku-4-5")
batch.add("row-1", [{"role": "user", "content": "Summarise: ..."}])
batch.add("row-2", [{"role": "user", "content": "Summarise: ..."}])

batch_id = await batch.submit()
results = await batch.wait(batch_id)      # keyed by custom_id
print(results["row-1"].text)
```

Results arrive in any order, so they are keyed by `custom_id` throughout — indexing by position is the classic way to silently mismatch a batch. `status(batch_id)` polls once without blocking, and `results(batch_id)` collects a batch you already know has ended. Messages use AgentFlow's internal dialect and go through the same translation as a live call. `OpenAIBatch` exposes the same surface for the OpenAI provider.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | no (see below) | API key from console.anthropic.com |
| `ANTHROPIC_AUTH_TOKEN` | no | Alternative SDK credential |

One credential source must resolve. AgentFlow only reads `ANTHROPIC_API_KEY` itself; everything else is left to the SDK's own resolution. Vertex and Bedrock backends use their platform's standard credential chain instead.

## Common Errors

| Error | Fix |
|---|---|
| `ImportError: anthropic SDK is required` | `pip install "10xscale-agentflow[anthropic]"` |
| `ImportError: ... Vertex support` | `pip install "10xscale-agentflow[anthropic-vertex]"` |
| `ImportError: ... Bedrock support` | `pip install "10xscale-agentflow[anthropic-bedrock]"` |
| `ValueError: Unsupported anthropic_backend` | Use `None`, `"vertex"`, or `"bedrock"` |
| `ValueError: Anthropic provider doesn't support output_type=...` | Only `"text"` and `"json"` are valid |
| 400 on `budget_tokens` | Drop it; use `reasoning_config={"effort": ...}` |

## Related docs

- [Providers](/docs/providers)
- [Providers and adapters](/docs/concepts/providers-and-adapters)
- [Installation extras matrix](/docs/get-started/installation)
