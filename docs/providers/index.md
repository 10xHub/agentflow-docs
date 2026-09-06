---
title: Providers
sidebar_label: Providers
description: The three model providers AgentFlow builds clients for, and how to reach anything else through an OpenAI-compatible endpoint.
keywords:
  - agentflow providers
  - create_llm_client
  - detect_provider
  - openai provider
  - google provider
  - anthropic provider
  - claude provider
---

# Providers

AgentFlow talks to model providers through a unified `Agent` interface.

## Available providers

`create_llm_client` and `detect_provider` recognise exactly three provider values:

| `provider` | Backend | SDK | Extra |
|---|---|---|---|
| [`"openai"`](/docs/providers/openai) | OpenAI API, or any OpenAI-compatible endpoint | `openai` | `pip install "10xscale-agentflow[openai]"` |
| [`"google"`](/docs/providers/google) | Gemini API (Google AI Studio) or Vertex AI | `google-genai` | `pip install "10xscale-agentflow[google-genai]"` |
| [`"anthropic"`](/docs/providers/anthropic) | Claude Messages API, Vertex AI, or Amazon Bedrock | `anthropic` | `pip install "10xscale-agentflow[anthropic]"` |

Any other value raises `ValueError: Unsupported provider`.

When `provider` is omitted, `detect_provider` infers it from the model name: `gemini-`, `imagen-`, `veo-`, and `chirp` prefixes resolve to `"google"`; `claude-` and `anthropic.` resolve to `"anthropic"`; `gpt-`, `o1-`, `o3-`, and `o4-` resolve to `"openai"`. A recognised `provider/model` prefix (for example `gemini/gemini-2.5-flash` or `anthropic/claude-sonnet-4-5`) selects the provider directly. Anything unrecognised falls back to `"openai"` and logs that it did so.

## Other models

Self-hosted and third-party models served behind an OpenAI-compatible API — Ollama, vLLM, OpenRouter, and gateways of that shape — go through the OpenAI provider with a `base_url`.

```python
agent = Agent(
    model="my-model",
    provider="openai",
    base_url="https://my-openai-compatible-gateway.example.com/v1",
    api_key="...",
)
```

Some of those only implement the legacy Chat Completions endpoint; pass `api_style="chat"` when the Responses API is not available.

## Related docs

- [Providers and adapters](/docs/concepts/providers-and-adapters)
- [Agents and tools](/docs/concepts/agents-and-tools)
- [LLM utilities reference](/docs/reference/python/llm)
