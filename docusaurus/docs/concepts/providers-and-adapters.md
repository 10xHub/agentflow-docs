---
title: Providers and Adapters
description: Provider selection, model response conversion, reasoning options, and third-party tool adapters.
keywords:
  - agentflow providers
  - model provider adapters
  - openai provider
  - google gemini provider
  - anthropic claude provider
  - vertex ai
  - amazon bedrock
sidebar_position: 15
---

# Providers and adapters

An AgentFlow `Agent` talks to model providers through provider-specific internals and converters. The public graph API stays the same while adapters normalize provider responses into AgentFlow messages, tool calls, usage, and content blocks.

## Providers

AgentFlow supports OpenAI, Google, and Anthropic provider flows.

| Provider | Environment |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini API | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Vertex AI (Gemini) | `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, credentials |
| Anthropic | `ANTHROPIC_API_KEY` (the SDK also resolves `ANTHROPIC_AUTH_TOKEN`, an auth profile, or workload identity federation) |
| Vertex AI (Claude) | `anthropic_backend="vertex"`, plus the SDK's own project and region resolution |
| Amazon Bedrock (Claude) | `anthropic_backend="bedrock"`, plus standard AWS credential resolution |

Google switches to Vertex AI with the boolean `use_vertex_ai`; Anthropic reaches three distinct backends, so its selector is the string `anthropic_backend` (`None`, `"vertex"`, or `"bedrock"`) passed through `llm_kwargs`.

```python
from agentflow.core.graph import Agent

agent = Agent(
    model="gpt-4o",
    provider="openai",
    system_prompt=[{"role": "system", "content": "You are helpful."}],
)
```

When `provider` is omitted, AgentFlow can infer common providers from model names.

## Reasoning options

Reasoning config is provider-specific.

```python
agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    reasoning_config={"effort": "medium"},
)
```

OpenAI reasoning models, Google thinking budgets, and Anthropic extended thinking do not expose identical knobs. Keep provider docs and tests close when changing reasoning behavior.

## LLM converters

Converters translate provider-native responses into AgentFlow runtime objects.

| Converter | Purpose |
|---|---|
| `OpenAIConverter` | OpenAI chat-style response conversion. |
| `OpenAIResponsesConverter` | OpenAI Responses API response conversion. |
| `GoogleGenAIConverter` | Google GenAI response conversion. |
| `AnthropicConverter` | Anthropic Messages API response conversion. |
| `ModelResponseConverter` | Shared conversion helpers. |

Provider-native details should stay behind converter boundaries unless stored intentionally in `Message.raw`.

## Tool adapters

Tool adapters bridge third-party tool ecosystems.

| Adapter | Purpose |
|---|---|
| `LangChainAdapter` | Register LangChain tools and expose AgentFlow-compatible schemas. |
| `ComposioAdapter` | Integrate Composio tools when the dependency is installed. |

`ToolNode` can combine local Python tools, MCP tools, third-party adapters, and remote tools. Remote tool checks happen before local execution when configured.

## Related docs

- [Providers](/docs/providers)
- [OpenAI provider](/docs/providers/openai)
- [Google provider](/docs/providers/google)
- [Anthropic provider](/docs/providers/anthropic)
- [Agents and tools](./agents-and-tools.md)
