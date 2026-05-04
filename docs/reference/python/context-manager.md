---
title: Context Manager — AgentFlow Python AI Agent Framework
description: "BaseContextManager and MessageContextManager — trim and bound the agent's message history before each LLM call."
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - context manager
sidebar_position: 13
---


# Context Manager

## When to use this

Use a context manager when your agents run long multi-turn conversations and you need to keep the message history within the LLM's context window. The context manager is called on every `Agent` node invocation that has `trim_context=True`.

## Import path

```python
from agentflow.core.state import BaseContextManager, MessageContextManager
```

---

## `MessageContextManager`

The built-in implementation. Keeps the most recent N user messages plus all system messages.

```python
from agentflow.core.state import MessageContextManager

ctx_mgr = MessageContextManager(
    max_messages=10,
    remove_tool_msgs=False,
)

graph = StateGraph(context_manager=ctx_mgr)
```

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `max_messages` | `int` | `10` | Maximum number of **user-role** messages to keep. Older messages are dropped. |
| `remove_tool_msgs` | `bool` | `False` | If `True`, also remove AI messages containing tool calls and their corresponding tool result messages before counting. |

### Preservation guarantee

Messages with `role == "system"` are **never** trimmed regardless of `max_messages`. They are prepended to the front of every trimmed window.

### Methods

| Method | Signature | Description |
|---|---|---|
| `trim_context` | `(state: S) → S` | Synchronous trim. Returns the state with `context` replaced by the trimmed list, or the original state if no trimming was needed. |
| `atrim_context` | `async (state: S) → S` | Async version. Internally delegates to `trim_context`. |

---

## `BaseContextManager`

Abstract base class. Subclass this to implement custom trimming strategies.

```python
from agentflow.core.state import BaseContextManager, AgentState
from typing import TypeVar

S = TypeVar("S", bound=AgentState)

class MyContextManager(BaseContextManager[S]):

    def trim_context(self, state: S) -> S:
        # return state with state.context modified
        ...

    async def atrim_context(self, state: S) -> S:
        return self.trim_context(state)
```

### Abstract methods

| Method | Signature | Description |
|---|---|---|
| `trim_context` | `(state: S) → S` | **Must implement.** Trim `state.context` and return the updated state. |
| `atrim_context` | `async (state: S) → S` | **Must implement.** Async version. |

Both methods receive the full `AgentState` (or custom subclass) and must return it after modifying `state.context` in place or replacing it.

---

## Where it fits in the graph

```
graph.compile()
  └── Agent node (trim_context=True)
        └── calls context_manager.atrim_context(state)
              before sending messages to the LLM provider
```

The context manager is called at the start of each `Agent` invocation, before the LLM API call. The trimmed state is used only for that invocation; the full state is still written to the checkpointer.

---

## Dependency injection

The context manager is registered in the dependency container automatically when you pass it to `StateGraph`. Node functions can receive it via injection if needed:

```python
from injectq import Inject
from agentflow.core.state import BaseContextManager

async def my_node(
    state,
    config: dict,
    ctx_mgr: BaseContextManager | None = Inject[BaseContextManager],
) -> ...:
    if ctx_mgr:
        state = await ctx_mgr.atrim_context(state)
    return state
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Context grows unbounded despite `trim_context=True` | `context_manager=` not passed to `StateGraph(...)`. | Add `context_manager=MessageContextManager()` to `StateGraph`. |
| `atrim_context` not found | Custom class only impl `trim_context`, not `atrim_context`. | Both abstract methods must be implemented. |
| System prompt is being dropped | System message role is not `"system"`. | Ensure `role="system"` — the check is exact string equality. |
