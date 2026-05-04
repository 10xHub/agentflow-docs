---
title: OpenAI — AgentFlow Python AI Agent Framework
description: Configure the OpenAI provider for GPT and reasoning models. Part of the AgentFlow llm providers guide for production-ready Python AI agents.
keywords:
  - llm providers
  - ai model providers
  - agentflow providers
  - agentflow
  - python ai agent framework
  - openai
sidebar_position: 2
---


# OpenAI

Run GPT-class models (`gpt-4o`, `gpt-4o-mini`) and reasoning models (`o1`, `o3`, `o4-mini`) through the OpenAI API.

## Setup

Get an API key from [platform.openai.com](https://platform.openai.com) and export it:

```bash
export OPENAI_API_KEY="sk-..."
```

Or add it to a `.env` file:

```bash
OPENAI_API_KEY=sk-...
```

## Basic usage

```python
from agentflow.core.graph import Agent

agent = Agent(
    model="gpt-4o",
    provider="openai",
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
    model="gpt-4o",
    provider="openai",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
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

## Reasoning models

`o1`, `o3`, and `o4-mini` support extended thinking. Enable it via `reasoning_config`:

```python
# Default settings
agent = Agent(model="o4-mini", provider="openai", reasoning_config=True)

# Custom effort level
agent = Agent(
    model="o4-mini",
    provider="openai",
    reasoning_config={"effort": "high"},  # "low" | "medium" | "high"
)
```

## Responses API

For OpenAI's newer Responses API (instead of Chat Completions), set `api_style`:

```python
agent = Agent(model="gpt-4o", provider="openai", api_style="responses")
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | yes | API key from platform.openai.com |

## Common errors

| Error | Fix |
|---|---|
| `AuthenticationError` | `OPENAI_API_KEY` missing or invalid |
| `RateLimitError` | You hit a rate limit — enable retries via `retry_config=True` |
| `Model not found` | Check the model name; some models require tier-gated access |
