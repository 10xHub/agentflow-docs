---
title: Providers — AgentFlow Python AI Agent Framework
description: How to choose and configure an LLM provider for your AgentFlow agents. Part of the AgentFlow llm providers guide for production-ready Python AI agents.
keywords:
  - llm providers
  - ai model providers
  - agentflow providers
  - agentflow
  - python ai agent framework
  - providers
sidebar_position: 1
---


# Providers

An AgentFlow `Agent` is a thin wrapper around an LLM call. The **provider** decides which backend service runs that call and how the agent authenticates with it.

```python
from agentflow.core.graph import Agent

agent = Agent(
    model="gpt-4o",
    provider="openai",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
)
```

## Supported providers

| Provider | Backend | Typical models |
|---|---|---|
| [`openai`](./openai.md) | OpenAI API | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3`, `o4-mini` |
| [`google`](./google.md) | Gemini API or Vertex AI | `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` |

## Choosing a provider

- **`openai`** — the default choice for GPT-class and reasoning (`o1`, `o3`) models.
- **`google`** — Gemini models, with two backends behind one provider:
  - **Gemini API** (default) — sign up at Google AI Studio, copy an API key, done.
  - **Vertex AI** — same models routed through Google Cloud with IAM, audit logs, regional data residency, and VPC Service Controls. Enable with `use_vertex_ai=True` on the agent or `GOOGLE_GENAI_USE_VERTEXAI=true` in the environment. See [Using Vertex AI](./google.md#using-vertex-ai).

## Provider inference

If you don't pass `provider`, AgentFlow guesses from the model name:

| Model prefix | Inferred provider |
|---|---|
| `gpt`, `o1`, `o3`, `o4` | `openai` |
| `gemini` | `google` |

## Switching backends within Google

Provider is just a constructor argument, and toggling Vertex AI is a one-line change:

```python
# Development: API key (Gemini API)
agent = Agent(model="gemini-2.5-flash", provider="google", ...)

# Production on GCP: same model, IAM-scoped access
agent = Agent(model="gemini-2.5-flash", provider="google", use_vertex_ai=True, ...)
```

See each provider page for setup details and full examples.
