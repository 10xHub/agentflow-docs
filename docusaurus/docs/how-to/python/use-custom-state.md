---
title: How to use custom state
sidebar_label: Custom state
description: Guide to subclassing AgentState to add application-specific fields and understanding context reducers.
keywords:
  - agentflow custom state
  - agent state
  - AgentState subclass
  - state reducers
  - agentflow
sidebar_position: 4
---

# How to use custom state

`AgentState` is the base state class for every graph execution. You can subclass it to add application-specific fields. The graph persists and threads the state across all nodes automatically.

## AgentState fields

| Field | Type | Description |
|---|---|---|
| `context` | `list[Message]` | The conversation history. Uses the `add_messages` reducer. |
| `context_summary` | `str \| None` | Optional compressed summary of older context. |
| `execution_meta` | `ExecutionState` | Internal execution metadata. Do not modify directly. |

The `context` field uses a special reducer: rather than replacing the list on each update, it appends new messages and deduplicates by message ID. You do not need to manage this manually.

---

## Step 1: Define a custom state

```python
from pydantic import Field
from agentflow.core.state import AgentState

class CustomerSupportState(AgentState):
    user_id: str = ""
    ticket_id: str | None = None
    sentiment: str = "neutral"          # "positive" | "neutral" | "negative"
    escalation_count: int = 0
    resolved: bool = False
    tags: list[str] = Field(default_factory=list)
```

All standard Pydantic features work: validators, default factories, optional fields.

---

## Step 2: Pass the state class (or instance) to StateGraph

```python
from agentflow.core.graph import StateGraph

# Pass the class — StateGraph instantiates it
graph = StateGraph(CustomerSupportState)

# Or pass an instance with pre-populated defaults
state = CustomerSupportState(user_id="user-123")
graph = StateGraph(state)
```

---

## Step 3: Access custom fields in nodes

Node functions receive the state as the first argument. Read fields directly; return a dict with only the changed fields.

```python
from agentflow.core.state import Message

def classify_sentiment(state: CustomerSupportState, config: dict, **deps) -> dict:
    last_user_msg = next(
        (m for m in reversed(state.context) if m.role == "user"), None
    )
    if last_user_msg:
        text = str(last_user_msg.content)
        if any(word in text.lower() for word in ["angry", "terrible", "worst"]):
            return {"sentiment": "negative", "escalation_count": state.escalation_count + 1}
    return {"sentiment": "neutral"}


def resolve_ticket(state: CustomerSupportState, config: dict, **deps) -> dict:
    return {
        "resolved": True,
        "messages": [Message.text_message("Your issue has been resolved.", role="assistant")],
    }
```

Returning `{"messages": [...]}` appends to `context` via the reducer. Returning `{"resolved": True}` replaces only the `resolved` field. You never need to copy the whole state.

---

## Step 4: Use custom fields in an Agent's system prompt

Placeholders in `system_prompt` are replaced with state field values at runtime:

```python
from agentflow.core.graph import Agent

agent = Agent(
    model="gpt-4o",
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a customer support agent helping user {user_id}. "
            "Current ticket: {ticket_id}. Tone detected: {sentiment}."
        ),
    }],
)
```

---

## Step 5: Pass initial state values at invocation

```python
from agentflow.core.state import Message

result = app.invoke(
    {
        "messages": [Message.text_message("My order hasn't arrived.")],
        "user_id": "cust-456",
        "ticket_id": "TKT-789",
    },
    config={"thread_id": "support-session-1"},
)
```

Keys in `input_data` that match state fields are merged into the state before execution begins.

---

## Reducers

A reducer controls how a field is updated when a node returns a new value.

### `add_messages` (used by `context`)

The built-in `add_messages` reducer appends new messages to the list and deduplicates by message ID. It is already applied to `AgentState.context` — you do not need to apply it yourself unless you add a second message list field.

```python
from typing import Annotated
from agentflow.core.state.reducers import add_messages, Message

class PipelineState(AgentState):
    # A separate log of intermediate messages, also deduplicated
    intermediate_log: Annotated[list[Message], add_messages] = Field(default_factory=list)
```

### Default (replace)

Without an annotation, a field update replaces the previous value entirely. This is the standard Pydantic behavior.

```python
class MyState(AgentState):
    counter: int = 0   # each update replaces the integer
```

---

## Complete example

```python
from pydantic import Field
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

# 1. Define custom state
class AnalysisState(AgentState):
    document_text: str = ""
    category: str = "unknown"
    confidence: float = 0.0
    keywords: list[str] = Field(default_factory=list)

# 2. Define a node that reads and writes custom fields
def extract_metadata(state: AnalysisState, config: dict, **deps) -> dict:
    text = state.document_text.lower()
    keywords = [w for w in text.split() if len(w) > 6][:5]
    return {"keywords": keywords}

# 3. Agent with state interpolation
agent = Agent(
    model="gpt-4o",
    system_prompt=[{
        "role": "system",
        "content": "Analyze this document and classify it. Document: {document_text}",
    }],
)

# 4. Build graph
graph = StateGraph(AnalysisState)
graph.add_node("extract", extract_metadata)
graph.add_node("classify", agent)
graph.set_entry_point("extract")
graph.add_edge("extract", "classify")
graph.add_edge("classify", END)

app = graph.compile()

# 5. Invoke with initial state values
result = app.invoke(
    {
        "messages": [Message.text_message("Classify this document.")],
        "document_text": "This quarterly financial report shows strong revenue growth...",
    },
    config={"thread_id": "analysis-1"},
)

print(result["messages"][-1].content)
```

---

## What you learned

- Subclass `AgentState` to add typed, persisted application fields.
- Node functions return dicts with only the changed fields; the reducer or default replace logic handles the rest.
- `add_messages` is the only built-in reducer — it appends and deduplicates messages.
- `system_prompt` placeholders like `{field_name}` are interpolated from the state at runtime.
- Pass initial field values in the `input_data` dict when calling `invoke()`.

## Next steps

- [Build a graph](build-a-graph.md) for the full workflow assembly guide.
- [Set up checkpointing](set-up-checkpointing.md) to persist custom state across requests.
