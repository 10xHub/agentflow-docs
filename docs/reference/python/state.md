---
title: State
description: AgentState, custom state, reducers, and the add_messages pattern for the agentflow Python library.
sidebar_position: 3
---

# State

## When to use this

Read this page when you need to understand how data flows through graph nodes, how to add your own fields to the state, or how message deduplication works.

## Import paths

```python
from agentflow.core.state import AgentState
from agentflow.core.state.reducers import add_messages, replace_messages, append_items, replace_value
```

---

## `AgentState`

The default state class for all AgentFlow graphs. Pydantic `BaseModel` subclass — all fields are validated and serialised automatically.

```python
from agentflow.core.state import AgentState

state = AgentState()
```

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `context` | `Annotated[list[Message], add_messages]` | `[]` | Conversation message history. Uses `add_messages` reducer — new messages are appended; duplicates by `message_id` are dropped. |
| `context_summary` | `str \| None` | `None` | Optional rolling summary of the conversation. Written by summary nodes. |
| `execution_meta` | `ExecutionState` | auto | Internal execution tracking. Managed by the framework — read-only for application code. |

---

### Status methods

These methods delegate to `execution_meta` and are safe to call in any node:

| Method | Signature | Description |
|---|---|---|
| `is_running()` | `() -> bool` | `True` while the graph is executing. |
| `is_interrupted()` | `() -> bool` | `True` when execution paused at an interrupt point. |
| `is_stopped_requested()` | `() -> bool` | `True` when `compiled.stop()` was called for this thread. |

---

### Lifecycle methods (framework use only)

| Method | Description |
|---|---|
| `set_interrupt(node, reason, status, data=None)` | Record an interrupt at the given node. |
| `clear_interrupt()` | Clear the interrupt, allowing execution to resume. |
| `advance_step()` | Increment the step counter in `execution_meta`. |
| `set_current_node(node)` | Update the `current_node` pointer. |
| `complete()` | Mark execution as completed. |
| `error(error_msg)` | Record an error message in `execution_meta`. |

---

## Subclassing `AgentState`

Add your own fields by inheriting from `AgentState`. All internal framework fields are preserved.

```python
from typing import Annotated
from pydantic import BaseModel, Field
from agentflow.core.state import AgentState
from agentflow.core.state.reducers import add_messages

class OrderState(AgentState):
    """State for an order-processing agent."""
    order_id: str | None = None
    cart: list[dict] = Field(default_factory=list)
    confirmed: bool = False
    discount_code: str | None = None
```

Use the custom state when building the graph:

```python
from agentflow.core.graph import StateGraph

graph = StateGraph(OrderState())
```

Inside nodes, the state parameter is typed as your custom class:

```python
def process_order(state: OrderState, config: dict) -> list:
    if state.confirmed:
        order_id = state.order_id
        # ...
    return [Message.text_message("Order confirmed!", role="assistant")]
```

### Adding custom reducers to fields

Use `Annotated` and a reducer function to control how a field merges across node updates:

```python
from typing import Annotated
from agentflow.core.state import AgentState
from agentflow.core.state.reducers import append_items

class AnalysisState(AgentState):
    # Append new items; deduplicate by .id
    findings: Annotated[list[Finding], append_items] = Field(default_factory=list)
    # Full replacement — always overwritten
    current_step: str = "init"
```

---

## Reducers

Reducers are functions that control how field values merge when a node returns a partial update. They are applied automatically by the framework when a node returns a `dict` or `list`.

### `add_messages`

```python
from agentflow.core.state.reducers import add_messages
```

The default reducer for `AgentState.context`. Merges two lists of `Message` objects:

- Appends `right` to `left`.
- Skips any message in `right` whose `message_id` already exists in `left`.
- Skips delta messages (`message.delta == True`) — these are streaming intermediates, not stored.

### `replace_messages`

```python
from agentflow.core.state.reducers import replace_messages
```

Replaces the entire message list. Use when you want a node to overwrite all history.

```python
class MyState(AgentState):
    context: Annotated[list[Message], replace_messages] = Field(default_factory=list)
```

### `append_items`

```python
from agentflow.core.state.reducers import append_items
```

Appends new items by `.id` deduplication. Use for any list of Pydantic models that have an `id` field.

### `replace_value`

```python
from agentflow.core.state.reducers import replace_value
```

Always replaces with the new value. Equivalent to the default Pydantic field update behavior.

---

## How nodes update state

A node function may return one of:

| Return type | Effect |
|---|---|
| `list[Message]` | Appended to `state.context` via `add_messages`. |
| `dict` | Each key-value pair updates the corresponding field using its reducer. |
| `None` | No state update — the state is passed through unchanged. |

```python
# Return a list of messages
def answer_node(state: AgentState, config: dict) -> list:
    return [Message.text_message("Here is the answer.", role="assistant")]

# Return a partial state dict
def summarise_node(state: AgentState, config: dict) -> dict:
    summary = generate_summary(state.context)
    return {"context_summary": summary}

# Update both messages and a custom field
def checkout_node(state: OrderState, config: dict) -> dict:
    return {
        "context": [Message.text_message("Order placed!", role="assistant")],
        "confirmed": True,
    }
```

---

## `ExecutionState` (internal)

The `execution_meta` field of `AgentState`. Holds framework-managed execution tracking. Application code should not mutate this directly.

| Field | Type | Description |
|---|---|---|
| `current_node` | `str` | The node currently executing. |
| `step` | `int` | Step counter (number of node transitions). |
| `status` | `ExecutionStatus` | `RUNNING`, `INTERRUPTED`, `COMPLETED`, `ERROR`. |
| `interrupt_node` | `str \| None` | Node where the last interrupt occurred. |
| `interrupt_reason` | `str \| None` | Reason string for the interrupt. |
| `stop_current_execution` | `StopRequestStatus` | `NONE` or `STOP_REQUESTED`. |

---

## Common patterns

### Seed initial data into state

Pass a state instance with pre-filled fields as `input_data`:

```python
initial = OrderState(order_id="ORD-001", cart=[{"sku": "ABC", "qty": 1}])
result = app.invoke(
    {"messages": [Message.text_message("Process my order")]},
    config={"thread_id": "order-session-1"},
)
```

### Read state after invoke (FULL granularity)

```python
from agentflow.utils import ResponseGranularity

result = await app.ainvoke(
    {"messages": [Message.text_message("Hello")]},
    config={"thread_id": "t1"},
    response_granularity=ResponseGranularity.FULL,
)
state: OrderState = result["state"]
print(state.confirmed, state.order_id)
```
