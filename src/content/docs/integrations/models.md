---
title: Providers
seoTitle: "Model providers: OpenAI, Google, Anthropic"
description: 10xGraph supports OpenAI, Google (Gemini, Vertex AI) and Anthropic (direct, Vertex AI, Bedrock), plus any OpenAI-compatible endpoint, via one Agent interface.
section: Integrations
group: "Models"
order: 20
label: Overview
updated: "2026-10-06"
---

10xGraph talks to model providers through a unified `Agent` interface. It has built-in clients for three provider families: OpenAI, Google (Gemini API and Vertex AI) and Anthropic (Claude Messages API, Vertex AI and Amazon Bedrock). Anything that speaks the OpenAI API, such as Ollama, vLLM or OpenRouter, works through the OpenAI client with a `base_url`. This page is for engineers choosing a model or switching one: the graph and tools stay the same, only the `model` and `provider` arguments change.

## Start here

Pick the page for the provider you use: [OpenAI](/docs/integrations/openai), [Google](/docs/integrations/google) or [Anthropic](/docs/integrations/anthropic). Each lists the install extra, the credentials it reads and the options specific to that backend. If you are not sure how a model string becomes a client, read [Providers and adapters](/docs/integrations/models), and for the exact function signatures see the [LLM utilities reference](/docs/reference/python/llm).

Provider choice is a small decision in 10xGraph. The same tools, state and checkpointer work with all of them, so you can start with one and swap later. What does not change is the production layer around the agent: the API server, auth and replay-safe tool calls described in [Production runtime](/docs/concepts/serving-agents). If you want to see a first agent running before choosing, follow [Your first agent](/docs/get-started/first-agent).

## Extras at a glance

The core package declares these install extras for providers: `openai`, `google-genai`, `anthropic`, `anthropic-vertex` and `anthropic-bedrock`. A separate `realtime` extra, built on `google-genai`, supports live audio sessions.

## Available providers

`create_llm_client` and `detect_provider` recognise exactly three provider values:

| `provider` | Backend | SDK | Extra |
|---|---|---|---|
| [`"openai"`](/docs/integrations/openai) | OpenAI API, or any OpenAI-compatible endpoint | `openai` | `pip install "10xgraph[openai]"` |
| [`"google"`](/docs/integrations/google) | Gemini API (Google AI Studio) or Vertex AI | `google-genai` | `pip install "10xgraph[google-genai]"` |
| [`"anthropic"`](/docs/integrations/anthropic) | Claude Messages API, Vertex AI, or Amazon Bedrock | `anthropic` | `pip install "10xgraph[anthropic]"` |

Any other value raises `ValueError: Unsupported provider`.

When `provider` is omitted, `detect_provider` infers it from the model name: `gemini-`, `imagen-`, `veo-`, and `chirp` prefixes resolve to `"google"`; `claude-` and `anthropic.` resolve to `"anthropic"`; `gpt-`, `o1-`, `o3-`, and `o4-` resolve to `"openai"`. A recognised `provider/model` prefix (for example `gemini/gemini-2.5-flash` or `anthropic/claude-sonnet-4-5`) selects the provider directly. Anything unrecognised falls back to `"openai"` and logs that it did so.

## Other models

Self-hosted and third-party models served behind an OpenAI-compatible API, Ollama, vLLM, OpenRouter, and gateways of that shape, go through the OpenAI provider with a `base_url`.

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

- [Agents and tools](/docs/concepts/agents-and-tools)
- [LLM utilities reference](/docs/reference/python/llm)
