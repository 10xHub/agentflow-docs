---
title: Use custom state
description: "Extend AgentState with application-specific fields and understand state reducers for controlled field updates."
section: "Build agents"
group: "Agents and graphs"
order: 40
label: Custom state
updated: "2026-10-08"
---

Every 10xGraph agent runs within an `AgentState` instance that persists data across all nodes in the graph. By default, `AgentState` holds the message conversation history and execution metadata. You extend it by subclassing to add typed, persistent application fields—like user IDs, ticket numbers, sentiment scores, or any domain-specific data your agent needs. The graph automatically threads the state and applies reducer logic when fields are updated.

## Why custom state

Custom state fields let you:
- Track data that threads through the entire agent execution
- Use placeholders in system prompts (`"Help user {user_id}"`) interpolated at runtime
- Persist application context across multiple invocations via checkpointing
- Structure decision-making (conditional edges read custom fields to route the graph)
- Pass initial values into the agent without rebuilding the graph

Without custom state, you would store this data outside the graph, losing the automatic persistence and threading benefits of the framework.

## Built-in fields

`AgentState` provides three fields you can read and build on:

| Field | Type | Description |
|---|---|---|
| `context` | `list[Message]` | The conversation history (appended via the `add_messages` reducer; never replaced) |
| `context_summary` | `str \| None` | Optional compressed summary of older messages |
| `execution_meta` | `ExecutionState` | Internal metadata tracking node progress, interrupts, and step counts. Read-only for most use cases. |

---

## Step 1: Define a custom state class

Create a Pydantic model that extends `AgentState`:

```python
from pydantic import Field
from tenxgraph.core.state import AgentState


class SupportTicketState(AgentState):
    """Custom state for a support agent."""
    
    user_id: str = ""
    ticket_id: str | None = None
    sentiment: str = "neutral"  # "positive" | "neutral" | "negative"
    escalation_count: int = 0
    resolved: bool = False
    tags: list[str] = Field(default_factory=list)
```

All Pydantic features work: type hints, validators, `default_factory`, optional fields, computed fields. The built-in fields (`context`, `context_summary`, `execution_meta`) are inherited automatically.

---

## Step 2: Pass your state class to StateGraph

Instantiate the graph with your custom state class or instance:

```python
from tenxgraph.core.graph import StateGraph

# Option A: Pass the class (StateGraph instantiates it)
graph = StateGraph(SupportTicketState)

# Option B: Pass a pre-populated instance with defaults
initial_state = SupportTicketState(user_id="user-456")
graph = StateGraph(initial_state)
```

Both approaches work. Option A creates a fresh instance for each run; Option B lets you bake in defaults that persist across invocations (when checkpointing).

---

## Step 3: Read and update custom fields in nodes

Node functions receive the state as their first argument. Read fields directly; return a dict with only the fields you changed:

```python
from tenxgraph.core.state import Message


def classify_sentiment(state: SupportTicketState, config: dict, **deps) -> dict:
    """Analyze the last user message and update sentiment."""
    last_user_msg = next(
        (m for m in reversed(state.context) if m.role == "user"), None
    )
    if not last_user_msg:
        return {}
    
    text = str(last_user_msg.content).lower()
    if any(word in text for word in ["angry", "terrible", "worst", "unacceptable"]):
        new_sentiment = "negative"
        new_escalation = state.escalation_count + 1
    elif any(word in text for word in ["great", "thanks", "excellent", "happy"]):
        new_sentiment = "positive"
        new_escalation = state.escalation_count
    else:
        new_sentiment = "neutral"
        new_escalation = state.escalation_count
    
    return {
        "sentiment": new_sentiment,
        "escalation_count": new_escalation,
    }


def resolve_ticket(state: SupportTicketState, config: dict, **deps) -> dict:
    """Mark the ticket resolved and append a closing message."""
    return {
        "resolved": True,
        "tags": ["handled", "closed"] if state.ticket_id else [],
        "context": [
            Message.text_message(
                f"Ticket {state.ticket_id} has been resolved. Thank you for using our support.",
                role="assistant"
            )
        ],
    }
```

When you return `{"context": [...]}`, the list appends to the existing context via the `add_messages` reducer. When you return `{"sentiment": "positive"}`, only the `sentiment` field updates—you never copy the whole state. This is the core benefit of reducers: controlled, predictable merging.

---

## Step 4: Use custom fields in system prompts

The `Agent` class interpolates state field values into system prompts at runtime:

```python
from tenxgraph.core.graph import Agent

agent = Agent(
    model="gpt-4o",
    system_prompt=[
        {
            "role": "system",
            "content": (
                "You are a customer support agent assisting user {user_id}. "
                "Ticket: {ticket_id}. Current sentiment: {sentiment}. "
                "This is escalation #{escalation_count}."
            ),
        }
    ],
)
```

Placeholders in curly braces are filled from the current state. If a field is missing or None, the placeholder is left as-is. Use this to make agent behavior adapt to application context without rebuilding the graph.

---

## Step 5: Pass initial values at invocation

When you invoke the graph, pass initial field values in the input dict:

```python
result = app.invoke(
    {
        "context": [Message.text_message("My order hasn't arrived.")],
        "user_id": "cust-789",
        "ticket_id": "TKT-2024-001",
        "sentiment": "negative",
    },
    config={"thread_id": "support-session-1"},
)
```

Any keys matching state fields are merged into the state before the graph starts. You can omit fields you do not need to set.

---

## Reducers: controlling field updates

A reducer is a function that defines how two values merge when a node returns an update. Without reducers, each field update would **replace** the old value. Reducers let you **append**, **deduplicate**, or **summarize** instead.

10xGraph provides five reducers in `tenxgraph.core.state`:

### `add_messages` (append with deduplication)

Appends new messages and deduplicates by `message_id`. This is the default reducer for the `context` field. Use it for any message list field:

```python
from typing import Annotated
from tenxgraph.core.state import AgentState, Message
from tenxgraph.core.state.reducers import add_messages
from pydantic import Field


class PipelineState(AgentState):
    # A separate log of intermediate messages, also deduplicated by ID
    processing_log: Annotated[list[Message], add_messages] = Field(default_factory=list)
```

When a node returns `{"processing_log": [msg1, msg2]}`, those messages are appended to the existing list. If a message ID already exists, it is skipped. This prevents the same message from appearing twice.

### `replace_messages` (replace entire list)

Replaces the entire message list with a new one. Use this when you want to discard history:

```python
from typing import Annotated
from tenxgraph.core.state.reducers import replace_messages


class SummarizedState(AgentState):
    # This field is always replaced, never appended
    summary_messages: Annotated[list[Message], replace_messages] = Field(default_factory=list)
```

When a node returns `{"summary_messages": [new_msg]}`, the old list is discarded and replaced.

### `append_items` (append objects with id deduplication)

Appends items to a list and deduplicates by each item's `.id` attribute. Use this for domain objects:

```python
from typing import Annotated
from tenxgraph.core.state.reducers import append_items
from pydantic import Field, BaseModel


class ToolResult(BaseModel):
    id: str
    name: str
    value: str


class ToolState(AgentState):
    # Append tool results, deduplicated by their .id
    tool_results: Annotated[list[ToolResult], append_items] = Field(default_factory=list)
```

When a node returns `{"tool_results": [result1, result2]}`, they are appended. If an item with the same `.id` already exists, it is skipped.

### `replace_value` (replace scalar)

Replaces any scalar value. This is the default for fields without an annotation:

```python
class MyState(AgentState):
    counter: int = 0  # Uses replace_value implicitly
    status: str = "pending"  # Also uses replace_value
```

When a node returns `{"counter": 5}`, the old value (say, `3`) is replaced with `5`.

### `remove_tool_messages` (prune completed tool sequences)

Removes completed tool interaction sequences from a message list to keep context lean. A sequence is only removed if it is **complete**:

1. An assistant message with tool calls
2. One or more tool result messages
3. A final assistant message without tool calls (using the tool results)

If a sequence is incomplete (tool call made but no final response yet), all messages are kept:

```python
from typing import Annotated
from tenxgraph.core.state.reducers import remove_tool_messages


class LeanState(AgentState):
    # Tool messages are removed after use, keeping only the summary
    lean_context: Annotated[list[Message], remove_tool_messages] = Field(default_factory=list)
```

This is useful in long-running agents where you want to prune tool calls and results after they have been incorporated into the model's response, reducing token usage on subsequent calls. Incomplete sequences are preserved to avoid breaking the conversation flow.

---

## Complete example

Here is a working example that ties it together:

```python
from pydantic import Field
from tenxgraph.core.graph import StateGraph, Agent, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.utils.constants import END


# Define custom state
class ResearchState(AgentState):
    research_topic: str = ""
    findings: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    confidence: float = 0.0


# Define a node that processes custom fields
def extract_findings(state: ResearchState, config: dict, **deps) -> dict:
    """Extract key findings from the last response."""
    if not state.context:
        return {}
    
    last_msg = state.context[-1]
    text = str(last_msg.content)
    
    # Simplified extraction: split by "Finding:" markers
    findings = [
        f.strip() 
        for f in text.split("Finding:")[1:] 
        if f.strip()
    ]
    
    return {
        "findings": findings,
        "confidence": 0.85 if len(findings) > 2 else 0.5,
    }


# Build the graph
graph = StateGraph(ResearchState)

agent = Agent(
    model="gpt-4o",
    system_prompt=[
        {
            "role": "system",
            "content": (
                "You are a research assistant. "
                "Research topic: {research_topic}. "
                "Your confidence level: {confidence}%. "
                "List your findings prefixed with 'Finding:'."
            ),
        }
    ],
)

graph.add_node("research", agent)
graph.add_node("extract", extract_findings)
graph.set_entry_point("research")
graph.add_edge("research", "extract")
graph.add_edge("extract", END)

app = graph.compile()

# Invoke with initial state values
result = app.invoke(
    {
        "context": [Message.text_message("Research the benefits of remote work.")],
        "research_topic": "Remote work productivity",
    },
    config={"thread_id": "research-session-1"},
)

print("Findings:", result["findings"])
print("Confidence:", result["confidence"])
```

---

## How to verify it worked

After invoking your graph, check:

1. **State is threaded:** Inspect the returned state to confirm custom fields have the values you expect.

```python
print(result["user_id"])      # Should match what you passed
print(result["sentiment"])    # Should reflect updates from nodes
print(len(result["context"])) # Messages should be accumulated
```

2. **Reducers merged correctly:** For message lists, confirm messages were appended, not replaced.

```python
# Before the run, context has 2 messages
# After the run, context should have 4+ messages, not just 2
assert len(result["context"]) > initial_count
```

3. **Checkpointing preserves state:** If using a checkpointer, invoke the graph again with the same `thread_id` and verify your custom fields persist.

```python
result2 = app.invoke(
    {"context": [Message.text_message("Follow-up question.")]},
    config={"thread_id": "same-thread"},
)
# Custom fields from result1 should still be there
assert result2["user_id"] == result["user_id"]
```

---

## Common errors and fixes

**Error: `AttributeError: 'SupportTicketState' object has no attribute 'my_field'`**

You accessed a field in a node that is not defined in your state class. Add it:

```python
class SupportTicketState(AgentState):
    my_field: str = ""  # Add the missing field
```

**Error: `ValueError: Field 'context' cannot be assigned to; it uses a reducer`**

You tried to replace the context field directly instead of appending. Use the right reducer:

```python
# Wrong
return {"context": [msg1]}  # Replaces context

# Right
return {"context": [msg1]}  # With add_messages reducer, appends
```

If you truly want to replace context (rare), use a different field with `replace_messages` instead.

**Error: `KeyError: 'user_id'` in system prompt**

A placeholder in your system prompt references a field that is missing or None. Either provide the field at invocation or use a default:

```python
# Make the field optional with a default
class MyState(AgentState):
    user_id: str = "unknown"

# Or adjust your system prompt to handle missing values
"content": f"User: {state.get('user_id', 'anonymous')}"
```

**My custom state updates do not persist across runs.**

You are invoking the graph without a checkpointer, or the checkpointer is not configured. Checkpointing is optional but required for persistence:

```python
from tenxgraph.storage.checkpointer import InMemoryCheckpointer

app = graph.compile(checkpointer=InMemoryCheckpointer())
```

---

## Variations and best practices

**Typed reducers for custom types:** If your field is a list of domain objects, use `append_items`:

```python
class Item(BaseModel):
    id: str
    name: str

class MyState(AgentState):
    items: Annotated[list[Item], append_items] = Field(default_factory=list)
```

**Combining multiple reducers:** You can have different fields with different reducers in the same state:

```python
from typing import Annotated
from tenxgraph.core.state.reducers import add_messages, replace_value, append_items


class MultiReducerState(AgentState):
    messages_log: Annotated[list[Message], add_messages] = Field(default_factory=list)
    latest_status: Annotated[str, replace_value] = "pending"
    collected_items: Annotated[list[Item], append_items] = Field(default_factory=list)
```

**Initializing with factory defaults:** For complex fields, use `Field(default_factory=...)`:

```python
class MyState(AgentState):
    metadata: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
```

This ensures each graph instance gets its own dict/list, not a shared one (a common Python pitfall).

---

## Next steps

- [Build a graph](/docs/guides/build-a-graph) for the full workflow assembly guide
- [Set up checkpointing](/docs/guides/set-up-checkpointing) to persist custom state across requests
- [Use dependency injection](/docs/guides/use-dependency-injection) to pass runtime config into nodes
- [State and messages (concept)](/docs/concepts/state-and-messages) for a deeper dive into message content blocks
