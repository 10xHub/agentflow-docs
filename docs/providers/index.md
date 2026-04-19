---
title: Providers
description: How to choose and configure an LLM provider for your AgentFlow agents.
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
| [`google`](./google.md) | Gemini API (Google AI Studio) | `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` |
| [`vertex_ai`](./vertex-ai.md) | Gemini via Google Cloud Vertex AI | `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro` |

## Choosing a provider

- **`openai`** — the default choice for GPT-class and reasoning (`o1`, `o3`) models.
- **`google`** — the fastest path to Gemini. Sign up at Google AI Studio, copy an API key, done.
- **`vertex_ai`** — the same Gemini models, but running through Google Cloud with IAM, audit logs, regional data residency, and VPC Service Controls. Use it when you need enterprise-grade access control or you're already deployed on GCP.

`google` and `vertex_ai` share the same model names and the same features. The only difference is how the agent authenticates.

## Provider inference

If you don't pass `provider`, AgentFlow guesses from the model name:

| Model prefix | Inferred provider |
|---|---|
| `gpt`, `o1`, `o3`, `o4` | `openai` |
| `gemini` | `google` |

Vertex AI is **never** inferred — you must set `provider="vertex_ai"` explicitly, because the model names overlap with `google`.

## Switching providers

Provider is just a constructor argument. Swapping between them is a one-line change, and nothing else about your graph needs to know:

```python
# Development: API key
agent = Agent(model="gemini-2.5-flash", provider="google", ...)

# Production on GCP: same model, IAM-scoped access
agent = Agent(model="gemini-2.5-flash", provider="vertex_ai", ...)
```

See each provider page for setup details and full examples.
