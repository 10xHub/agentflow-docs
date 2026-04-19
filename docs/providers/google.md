---
title: Google
description: Configure the Google provider to run Gemini models via Google AI Studio.
sidebar_position: 3
---

# Google

Run Gemini models (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`) through the Gemini API. This is the fastest way to get started with Gemini — a single API key is all you need.

For production workloads on Google Cloud with IAM and audit logging, use [Vertex AI](./vertex-ai.md) instead. Both providers accept the same model names.

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

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | yes | API key from Google AI Studio (preferred name) |
| `GOOGLE_API_KEY` | — | Fallback name for the Gemini API key |

## Common errors

| Error | Fix |
|---|---|
| `ImportError: google-genai SDK is required` | `pip install google-genai` |
| `AuthenticationError` | `GEMINI_API_KEY` / `GOOGLE_API_KEY` missing or invalid |
| `Model not found` | Double-check the model name — Gemini model names are case-sensitive |

## When to switch to Vertex AI

Move to [`provider="vertex_ai"`](./vertex-ai.md) when you need:

- IAM-scoped access control instead of a shared API key
- Regional data residency
- GCP audit logging and VPC Service Controls
- To reuse the service account already attached to your GCP workload
