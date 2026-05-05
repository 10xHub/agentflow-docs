---
title: Providers and Adapters
description: Provider selection, model response conversion, reasoning options, and third-party tool adapters.
sidebar_position: 15
---

# Providers and adapters

An AgentFlow `Agent` talks to model providers through provider-specific internals and converters. The public graph API stays the same while adapters normalize provider responses into AgentFlow messages, tool calls, usage, and content blocks.

## Providers

AgentFlow supports OpenAI and Google provider flows.

| Provider | Environment |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini API | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Vertex AI | `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, credentials |

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

OpenAI reasoning models and Google thinking budgets do not expose identical knobs. Keep provider docs and tests close when changing reasoning behavior.

## LLM converters

Converters translate provider-native responses into AgentFlow runtime objects.

| Converter | Purpose |
|---|---|
| `OpenAIConverter` | OpenAI chat-style response conversion. |
| `OpenAIResponsesConverter` | OpenAI Responses API response conversion. |
| `GoogleGenAIConverter` | Google GenAI response conversion. |
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
- [Agents and tools](./agents-and-tools.md)
