---
title: Manage conversation context
description: "How to keep the message history within your LLM's context window using BaseContextManager and MessageContextManager."
keywords:
  - agentflow python
  - python ai agent guide
  - multi-agent python
  - agentflow
  - python ai agent framework
  - manage conversation context
---


# Manage conversation context

Every agent accumulates messages as it runs. Without bounds, the message history grows until it exceeds the LLM's context window, causing failures or degraded quality. `MessageContextManager` trims the history automatically so each agent call gets only the most recent, relevant messages.

## Prerequisites

You have a working graph with at least one `Agent` node.

## Quick start

```python
from agentflow.core import Agent, StateGraph
from agentflow.core.state import MessageContextManager
from agentflow.utils import END

context_manager = MessageContextManager(max_messages=10)

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    trim_context=True,   # tell the Agent to call the context manager
)

graph = StateGraph(context_manager=context_manager)
graph.add_node("MAIN", agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

app = graph.compile()
```

Two things are required:
1. Pass `context_manager=` to `StateGraph(...)`.
2. Set `trim_context=True` on the `Agent` that should trim.

## Configuration

```python
context_manager = MessageContextManager(
    max_messages=10,       # keep the last N user messages (default: 10)
    remove_tool_msgs=False # also strip tool call/result messages (default: False)
)
```

| Option | Type | Default | Effect |
|---|---|---|---|
| `max_messages` | `int` | `10` | How many user-role messages to keep per LLM call. |
| `remove_tool_msgs` | `bool` | `False` | If `True`, also strips AI messages that contain tool calls, and the subsequent tool result messages. Useful when tool traces clutter the context. |

## What is preserved

System messages (role `"system"`) are **always kept**, regardless of `max_messages`. Only user/assistant/tool messages are trimmed, and always from the oldest end.

## Write a custom context manager

`MessageContextManager` covers most cases. If you need different logic — for example, token-based trimming or summarisation — subclass `BaseContextManager`:

```python
from agentflow.core.state import BaseContextManager, AgentState

class TokenContextManager(BaseContextManager):
    """Keep messages within a token budget."""

    def __init__(self, max_tokens: int = 4000):
        self.max_tokens = max_tokens

    def trim_context(self, state: AgentState) -> AgentState:
        messages = state.context
        total = 0
        kept = []
        for msg in reversed(messages):
            # rough estimate: 4 chars ≈ 1 token
            total += len(msg.text()) // 4
            if total > self.max_tokens:
                break
            kept.insert(0, msg)
        state.context = kept
        return state

    async def atrim_context(self, state: AgentState) -> AgentState:
        return self.trim_context(state)  # synchronous is fine here
```

Register it the same way:

```python
graph = StateGraph(context_manager=TokenContextManager(max_tokens=3000))
```

## Verify trimming is happening

Enable debug logging to see trim events:

```python
import logging
logging.getLogger("agentflow.state").setLevel(logging.DEBUG)
```

You'll see lines like:
```
Trimmed from 42 to 21 messages (10 user messages kept)
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Context keeps growing despite `trim_context=True` | `context_manager` was not passed to `StateGraph`. | Add `context_manager=` to `StateGraph(...)`. |
| First user message is always dropped | `max_messages=1` is too low. | Increase `max_messages`. |
| Tool results disappear from follow-up replies | `remove_tool_msgs=True` is too aggressive. | Set `remove_tool_msgs=False` (default). |
