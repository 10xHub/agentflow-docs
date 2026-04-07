---
title: State and Messages
description: How AgentState holds conversation history and how Message content blocks work.
---

# State and messages

Every node in a graph receives state and returns updates to state. `AgentState` is the default state class. `Message` is the unit that carries content between nodes and across turns.

## AgentState

`AgentState` is a Pydantic model. It has one built-in field:

| Field | Type | Description |
| --- | --- | --- |
| `context` | `list[Message]` | The conversation history |

Access the conversation in any node:

```python
from agentflow.core.state import AgentState, Message

def my_node(state: AgentState) -> Message:
    last = state.context[-1]           # most recent message
    text = last.text()                 # extract text content
    return Message.text_message(f"You said: {text}", role="assistant")
```

### Custom state

Extend `AgentState` to add fields your application needs:

```python
class MyState(AgentState):
    user_id: str = ""
    session_data: dict = {}
```

Pass your custom class to `StateGraph`:

```python
graph = StateGraph(MyState)
```

Every node then receives `MyState` and can read or write any field.

## Message

A `Message` represents a single turn in a conversation. It has a `role` and one or more content blocks.

### Roles

| Role | Description |
| --- | --- |
| `user` | Input from the user |
| `assistant` | Response from the language model |
| `tool` | Result from a tool call |
| `system` | System instruction (used in prompts, not stored in context) |

### Creating messages

```python
from agentflow.core.state import Message

# Plain text
msg = Message.text_message("Hello, world!", role="user")

# Extract text from a message
text = msg.text()
```

### Content blocks

A message can contain multiple content blocks of different types. Content block types include:

| Block type | Import | Description |
| --- | --- | --- |
| `TextBlock` | `agentflow.core.state` | Plain text |
| `ImageBlock` | `agentflow.core.state` | Image data or URL |
| `AudioBlock` | `agentflow.core.state` | Audio data |
| `AnnotationBlock` | `agentflow.core.state` | Structured annotation |

Text is the most common type. Multimodal content is covered in [Media and files](./media-and-files.md).

### Tool calls in messages

When the model wants to call a tool, the assistant message contains a `tools_calls` list. `ToolNode` reads these and executes the functions:

```python
last = state.context[-1]
if hasattr(last, "tools_calls") and last.tools_calls:
    # model requested tool calls
    ...
```

## How messages accumulate

Each invoke call appends messages to `context`. After two turns, the context might look like:

```python
[
    Message(role="user",      content="What is 2 + 2?"),
    Message(role="assistant", content="4."),
    Message(role="user",      content="And 4 + 4?"),
    Message(role="assistant", content="8."),
]
```

When a checkpointer is attached, the full context is saved and restored for each `thread_id`, so conversations continue across calls.

## Context trimming

Long conversations can exceed token limits. Set `trim_context=True` on `Agent` to automatically trim older messages before each model call:

```python
agent = Agent(
    model="google/gemini-2.5-flash",
    trim_context=True,
)
```

This modifies what is sent to the model, not the stored state. The full history is still preserved in the checkpointer.

## What you learned

- `AgentState.context` holds all messages for the current thread.
- `Message.text_message` creates a plain-text message; use `.text()` to read it.
- Extend `AgentState` to add custom fields.
- `trim_context=True` on `Agent` prevents token limit errors without losing history.

## Related concepts

- [Checkpointing and threads](./checkpointing-and-threads.md)
- [Media and files](./media-and-files.md)
