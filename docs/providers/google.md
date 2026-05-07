---
title: Google — AgentFlow Python AI Agent Framework
sidebar_label: Google
description: Configure the Google provider to run Gemini models via Google AI Studio or Vertex AI. Part of the AgentFlow llm providers guide for production-ready Python AI.
keywords:
  - llm providers
  - ai model providers
  - agentflow providers
  - agentflow
  - python ai agent framework
  - google
sidebar_position: 3
---


# Google

Run Gemini models (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`) through Google. The same provider supports two backends:

- **Gemini API** (Google AI Studio) — fastest path to get started, single API key.
- **Vertex AI** — same models, but routed through Google Cloud with IAM, audit logs, regional data residency, and VPC Service Controls.

You pick the backend with one flag: `use_vertex_ai=True` on the `Agent`, or `GOOGLE_GENAI_USE_VERTEXAI=true` in the environment.

## Setup

1. Install the Google GenAI SDK (not bundled with `10xscale-agentflow`):

    ```bash
    pip install google-genai
    ```

2. Get an API key from [Google AI Studio](https://aistudio.google.com).

3. Export it:

    ```bash
    export GEMINI_API_KEY="your-key"
    ```

    Either `GEMINI_API_KEY` or `GOOGLE_API_KEY` works; `GEMINI_API_KEY` is preferred.

## Basic usage

```python
from agentflow.core.graph import Agent

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
)
```

## Full example with tools

```python
from dotenv import load_dotenv

from agentflow.core import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.utils.constants import END

load_dotenv()


def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny"


tool_node = ToolNode([get_weather])

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    trim_context=True,
    reasoning_config=True,
    tool_node=tool_node,
)


def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and getattr(last, "tools_calls", None) and last.role == "assistant":
        return "TOOL"
    if last and last.role == "tool":
        return "MAIN"
    return END


graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())

if __name__ == "__main__":
    inp = {"messages": [Message.text_message("What is the weather in New York City?")]}
    res = app.invoke(inp, config={"thread_id": "demo", "recursion_limit": 10})
    for msg in res["messages"]:
        print(f"[{msg.role}] {msg}")
```

## Thinking models

Gemini 2.5 models support extended thinking. Configure the budget explicitly:

```python
agent = Agent(
    model="gemini-2.5-pro",
    provider="google",
    reasoning_config={"thinking_budget": 8000},
)
```

Pass `reasoning_config=True` to enable with defaults or `False` to disable.

## Using Vertex AI

Vertex AI runs the same Gemini models on Google Cloud, but authenticates with Application Default Credentials instead of an API key. Use it when you need:

- IAM-scoped access control instead of a shared API key
- Regional data residency (EU, Asia, etc.)
- GCP audit logging or VPC Service Controls
- To reuse the service account already attached to your GCP workload

### 1. Set up GCP credentials

1. Enable the **Vertex AI API** on your GCP project.
2. Create a service account with the `roles/aiplatform.user` role and download its JSON key.
3. Export the GCP environment variables:

    ```bash
    export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
    export GOOGLE_CLOUD_LOCATION="us-central1"           # optional
    export GOOGLE_APPLICATION_CREDENTIALS="./service_account.json"
    ```

   On GCP runtimes (Cloud Run, GKE, Compute Engine, etc.) the attached service account is picked up automatically — you only need `GOOGLE_CLOUD_PROJECT`.

### 2. Enable Vertex AI

You can switch the Google provider to Vertex AI in two ways. Pick whichever fits your workflow — they behave identically.

**Option A — pass `use_vertex_ai=True` on the agent:**

```python
agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node=tool_node,
    use_vertex_ai=True,  # Enable Vertex AI provider
)
```

**Option B — set `GOOGLE_GENAI_USE_VERTEXAI=true` in the environment:**

```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
```

With this set, every Google agent in your process uses Vertex AI without changing any code. Useful when the same code runs locally against Gemini API and on GCP against Vertex AI.

If both are set, the explicit `use_vertex_ai=True` argument wins.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | yes (Gemini API) | API key from Google AI Studio (preferred name) |
| `GOOGLE_API_KEY` | — | Fallback name for the Gemini API key |
| `GOOGLE_GENAI_USE_VERTEXAI` | — | Set to `true` to route the Google provider through Vertex AI |
| `GOOGLE_CLOUD_PROJECT` | yes (Vertex AI) | GCP project ID with the Vertex AI API enabled |
| `GOOGLE_CLOUD_LOCATION` | — | Region for Vertex AI calls (default `us-central1`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Path to a service-account JSON key. Not required on GCP workloads with an attached service account |

## Common errors

| Error | Fix |
|---|---|
| `ImportError: google-genai SDK is required` | `pip install google-genai` |
| `AuthenticationError` | `GEMINI_API_KEY` / `GOOGLE_API_KEY` missing or invalid |
| `Model not found` | Double-check the model name — Gemini model names are case-sensitive |
| `ValueError: GOOGLE_CLOUD_PROJECT environment variable must be set` | Export `GOOGLE_CLOUD_PROJECT` before creating the agent (Vertex AI only) |
| `PermissionDenied: Vertex AI API has not been used` | Enable the Vertex AI API on your GCP project |
| `403: caller does not have permission` | Grant the service account the `roles/aiplatform.user` role |
