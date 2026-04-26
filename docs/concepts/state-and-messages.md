---
title: State and Messages
description: AgentState fields, Message structure, all content block types, ToolResult, and the add_messages reducer.
sidebar_position: 3
---

# State and messages

Every node in a graph receives state and returns updates to state. `AgentState` is the default state class. `Message` carries all content — text, multimodal blocks, tool calls, tool results — between nodes and across turns.

---

## AgentState

`AgentState` is a Pydantic model with three built-in fields:

```python
class AgentState(BaseModel):
    context: Annotated[list[Message], add_messages] = []
    context_summary: str | None = None
    execution_meta: ExecMeta = ExecMeta(current_node=START)
```

| Field | Type | Description |
|---|---|---|
| `context` | `list[Message]` | Conversation history; new messages are appended via the `add_messages` reducer |
| `context_summary` | `str \| None` | Optional summary of trimmed-out context when `trim_context=True` |
| `execution_meta` | `ExecMeta` | Internal runtime metadata (current node, step count, interrupt status, stop request) |

### The `add_messages` reducer

`context` uses the `add_messages` annotated reducer. This means:
- When a node returns a `Message`, it is **appended** to `context`, not replaced.
- When a node returns a `dict`, only the keys present in the dict are merged.
- The runtime never wipes the conversation history between nodes.

### convenience methods on AgentState

```python
state.is_running()           # → bool: execution in progress
state.is_interrupted()       # → bool: graph was interrupted
state.is_stopped_requested() # → bool: a stop was requested mid-stream
state.advance_step()         # increment execution step counter
state.set_current_node(name) # update current node in execution_meta
state.complete()             # mark execution as completed
state.error("msg")           # mark execution as errored
```

### Custom state

Extend `AgentState` to add application fields:

```python
from agentflow.core.state import AgentState

class MyState(AgentState):
    user_id: str = ""
    session_data: dict = {}
    selected_city: str = ""
```

Pass the subclass to `StateGraph`:

```python
from agentflow.core.graph import StateGraph

graph = StateGraph(MyState)   # or StateGraph(MyState())
```

All nodes then receive `MyState` and can read or write any field. The built-in `context`, `context_summary`, and `execution_meta` fields are always available.

---

## Message

A `Message` represents one turn in a conversation. It holds a `role`, a list of **content blocks**, and optional metadata.

### Full Message model

```python
class Message(BaseModel):
    message_id: str | int          # auto-generated UUID or custom
    role: Literal["user", "assistant", "system", "tool"]
    content: Sequence[ContentBlock]
    delta: bool = False            # True for partial/streaming messages
    tools_calls: list[dict] | None = None   # tool call requests from the model
    reasoning: str | None = None   # chain-of-thought reasoning trace
    timestamp: float | None        # UNIX timestamp
    metadata: dict = {}
    usages: TokenUsages | None = None
    raw: dict | None = None        # provider-native raw response
```

### Roles

| Role | Description |
|---|---|
| `"user"` | Input from the human |
| `"assistant"` | Response from the model (may contain `tools_calls`) |
| `"tool"` | Result from a tool execution |
| `"system"` | System instruction (injected into prompts, not stored in context) |

### Creating messages

```python
from agentflow.core.state import Message

# Plain text user message
msg = Message.text_message("Hello!")
msg = Message.text_message("Hello!", role="user", message_id="msg-1")

# Tool result message
msg = Message.tool_message(
    content=[ToolResultBlock(call_id="call_123", output="Sunny, 22°C", status="completed")],
    message_id="tr-1",
)

# Custom multimodal message
msg = Message(
    role="user",
    content=[
        TextBlock(text="What is this?"),
        ImageBlock(media=MediaRef(kind="url", url="https://example.com/img.png", mime_type="image/png")),
    ],
)
```

### Extracting text

```python
text = msg.text()   # returns concatenated text from all TextBlocks
```

### Token usages

When the model returns usage data it is stored in `msg.usages`:

```python
class TokenUsages(BaseModel):
    completion_tokens: int
    prompt_tokens: int
    total_tokens: int
    reasoning_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    image_tokens: int | None = 0
    audio_tokens: int | None = 0
```

---

## Content block types

All block types are importable from the top-level `agentflow` package and from `agentflow.core.state`.

### TextBlock

```python
from agentflow.core.state import TextBlock, AnnotationRef

block = TextBlock(
    text="Here is the answer.",
    annotations=[
        AnnotationRef(url="https://source.example.com", title="Source"),
    ],
)
```

### ImageBlock

```python
from agentflow.core.state import ImageBlock, MediaRef

block = ImageBlock(
    media=MediaRef(kind="url", url="https://example.com/photo.png", mime_type="image/png"),
    alt_text="A landscape photo",
    bbox=[10.0, 20.0, 300.0, 400.0],  # [x1, y1, x2, y2] if applicable
)
```

### AudioBlock

```python
from agentflow.core.state import AudioBlock

block = AudioBlock(
    media=MediaRef(kind="data", data_base64="<b64>", mime_type="audio/wav"),
    transcript="Hello, world.",   # optional pre-existing transcript
    sample_rate=16000,
    channels=1,
)
```

### VideoBlock

```python
from agentflow.core.state import VideoBlock

block = VideoBlock(
    media=MediaRef(kind="data", data_base64="<b64>", mime_type="video/mp4"),
    thumbnail=MediaRef(kind="url", url="https://example.com/thumb.jpg", mime_type="image/jpeg"),
)
```

### DocumentBlock

```python
from agentflow.core.state import DocumentBlock

block = DocumentBlock(
    media=MediaRef(kind="file_id", file_id="doc-key", mime_type="application/pdf"),
    text="Extracted body text (optional).",
    pages=[1, 2, 3],
    excerpt="Short preview snippet.",
)
```

### DataBlock

Generic binary block for anything not covered by the above:

```python
from agentflow.core.state import DataBlock

block = DataBlock(
    mime_type="application/octet-stream",
    data_base64="<b64>",
    media=MediaRef(kind="file_id", file_id="data-key", mime_type="application/octet-stream"),
)
```

### ToolCallBlock

Present in assistant messages when the model requests a tool:

```python
from agentflow.core.state import ToolCallBlock

block = ToolCallBlock(
    id="call_abc123",
    name="get_weather",
    args={"location": "Tokyo"},
    tool_type=None,    # "web_search" | "file_search" | "computer_use" | None
)
```

The same information is also in `message.tools_calls` as a raw dict list (provider-native format).

### ToolResultBlock

Present in `"tool"` role messages returned by `ToolNode`:

```python
from agentflow.core.state import ToolResultBlock

block = ToolResultBlock(
    call_id="call_abc123",   # matches ToolCallBlock.id
    output="Sunny, 22°C.",
    status="completed",      # "completed" | "error"
)
```

### ReasoningBlock

Chain-of-thought traces (supported by o1, o3, Gemini Thinking):

```python
from agentflow.core.state.message_block import ReasoningBlock

block = ReasoningBlock(text="Let me think step by step...")
```

### ErrorBlock

Signals an error that occurred during tool execution or processing:

```python
from agentflow.core.state import ErrorBlock

block = ErrorBlock(error="Tool timed out after 30 s.", tool_call_id="call_abc123")
```

### AnnotationBlock

Structured citations and references returned by search-enabled models:

```python
from agentflow.core.state.message_block import AnnotationBlock

block = AnnotationBlock(
    annotation=AnnotationRef(url="https://example.com", title="Source article")
)
```

---

## ToolResult — tools that update state

When a tool needs to both send a message back to the model **and** mutate state fields simultaneously, return `ToolResult` instead of a plain string:

```python
from agentflow.core.state.tool_result import ToolResult

class MyState(AgentState):
    selected_city: str = ""

def select_city(city: str) -> ToolResult:
    """Set the currently selected city in the workflow."""
    return ToolResult(
        message=f"City updated to '{city}'.",  # returned to the LLM
        state={"selected_city": city},          # updates MyState.selected_city
    )
```

Only fields present in `state` dict are updated; all other state fields are left unchanged.

---

## How the context accumulates

After several turns with a checkpointer:

```python
[
    Message(role="user",      content=[TextBlock(text="What is 2 + 2?")]),
    Message(role="assistant", content=[TextBlock(text="4.")]),
    Message(role="user",      content=[TextBlock(text="Now call get_weather for Tokyo.")]),
    Message(role="assistant", content=[TextBlock(text="..."), ToolCallBlock(id="c1", name="get_weather", args={"location": "Tokyo"})]),
    Message(role="tool",      content=[ToolResultBlock(call_id="c1", output="Cloudy, 18°C", status="completed")]),
    Message(role="assistant", content=[TextBlock(text="The weather in Tokyo is cloudy and 18°C.")]),
]
```

The checkpointer saves this entire list per `thread_id` and restores it on the next call.

---

## Context trimming and summarization

Set `trim_context=True` on `Agent` to automatically trim oldest messages before each model call. When messages are trimmed, the summarized content is stored in `state.context_summary`:

```python
agent = Agent(
    model="gemini-2.5-flash",
    trim_context=True,
)
```

---

## Related concepts

- [Agents and tools](./agents-and-tools.md)
- [Media and files](./media-and-files.md)
- [Checkpointing and threads](./checkpointing-and-threads.md)

This modifies what is sent to the model, not the stored state. The full history is still preserved in the checkpointer.

## What you learned

- `AgentState.context` holds all messages for the current thread.
- `Message.text_message` creates a plain-text message; use `.text()` to read it.
- Extend `AgentState` to add custom fields.
- `trim_context=True` on `Agent` prevents token limit errors without losing history.

## Related concepts

- [Checkpointing and threads](./checkpointing-and-threads.md)
- [Media and files](./media-and-files.md)
