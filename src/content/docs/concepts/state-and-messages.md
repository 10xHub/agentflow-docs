---
title: State and Messages
seoTitle: "AgentState and messages in 10xGraph"
description: How AgentState holds conversation history, messages carry multimodal content blocks, and reducers control state merging.
section: Concepts
order: 30
group: "Foundations"
label: State and Messages
updated: "2026-10-08"
---

Every node in a graph receives state and returns updates to state. `AgentState` is the default state class that holds the conversation history. `Message` carries all content between nodes and across turns, from plain text to multimodal blocks, tool calls, and results. Understanding how state flows through your graph and how messages accumulate is essential to building agents that remember context and handle complex interactions.

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

The `context` field is the conversation history. Every message is kept and accumulated, so your agent has full access to previous turns. The `context_summary` field holds a compressed version of messages that were trimmed away (when `trim_context=True`), so the LLM never loses the information entirely. `execution_meta` tracks runtime state internal to 10xGraph — the current node being executed, how many steps have run, whether the graph was interrupted, and whether a stop was requested mid-stream.

### The `add_messages` reducer

`context` uses the `add_messages` annotated reducer. This controls how state updates merge:

- When a node returns a `Message`, it is **appended** to `context`, not replaced.
- When a node returns a `dict`, only the keys present in the dict are merged; other state fields unchanged.
- When a node returns multiple messages, all are appended in order.
- The runtime never wipes the conversation history between nodes.

This is why full conversation history is preserved across the entire run, even as many nodes process the state.

### Convenience methods on AgentState

`AgentState` provides methods to read and modify execution state:

```python
state.is_running()           # → bool: execution in progress
state.is_interrupted()       # → bool: graph was interrupted
state.is_stopped_requested() # → bool: a stop was requested mid-stream
state.advance_step()         # increment execution step counter
state.set_current_node(name) # update current node in execution_meta
state.complete()             # mark execution as completed
state.error("msg")           # mark execution as errored
```

These are useful in custom nodes when you need to inspect or affect the execution state.

### Custom state

Extend `AgentState` to add application-specific fields:

```python
from tenxgraph.core.state import AgentState

class MyState(AgentState):
    user_id: str = ""
    session_data: dict = {}
    selected_city: str = ""
```

Pass the subclass to `StateGraph`:

```python
from tenxgraph.core.graph import StateGraph

graph = StateGraph(MyState)
```

All nodes then receive `MyState` and can read or write any field. The built-in `context`, `context_summary`, and `execution_meta` fields are always available and carry 10xGraph's internal data.

## Message

A `Message` represents one turn in a conversation. It holds a role, a list of content blocks (the actual content), metadata about that turn, and optional token usage information.

### Message structure

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

`message_id` is auto-generated (a UUID) unless you provide one. `role` indicates who said it: `"user"` for human input, `"assistant"` for the model, `"tool"` for tool results, and `"system"` for instructions (not stored in context history). `content` is a list of blocks — text, images, audio, tool calls, errors, and more. `delta` is true only for partial messages during streaming. `tools_calls` carries the raw tool request dict sent by the model (also appears as `ToolCallBlock` in `content` for convenience). `reasoning` holds chain-of-thought traces from models like o1 or Gemini Thinking. `usages` holds token counts if the provider returned them.

### Message roles

| Role | Description |
|---|---|
| `"user"` | Input from the human |
| `"assistant"` | Response from the model (may contain `tools_calls`) |
| `"tool"` | Result from a tool execution |
| `"system"` | System instruction (injected into model prompts, not stored in context) |

### Creating messages

Use factory methods for common cases:

```python
from tenxgraph.core.state import Message, TextBlock, ImageBlock, MediaRef

# Plain text user message
msg = Message.text_message("Hello!")

# Tool result message
msg = Message.tool_message(
    content=[ToolResultBlock(call_id="call_123", output="Sunny, 22°C", status="completed")],
)

# Multimodal message with custom blocks
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
text = msg.text()   # concatenate all TextBlocks
```

### Token usage tracking

When the model returns token usage data, it is stored in `msg.usages`:

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

This helps you track model cost and performance across conversations.

## Content blocks

Messages carry content in typed blocks. Each block represents a different kind of content: text, images, audio, tool calls, tool results, errors, and more. For a complete reference of every block type with detailed examples, see the [Message reference](/docs/reference/python/messages).

Common blocks include:

- **TextBlock**: Plain text or citations.
- **ImageBlock**, **AudioBlock**, **VideoBlock**: Multimodal media with metadata (duration, dimensions, transcripts).
- **DocumentBlock**: PDFs and other documents with extracted text and page numbers.
- **ToolCallBlock**: A request from the model to call a specific tool, with arguments.
- **ToolResultBlock**: The result returned from executing a tool.
- **ReasoningBlock**: Chain-of-thought traces from models that support extended reasoning.
- **ErrorBlock**: Signals an error (e.g., tool timeout, tool not found).

All block types are importable from `tenxgraph.core.state`. See the [reference](/docs/reference/python/messages) for the full API, field definitions, and examples for each block type.

## ToolResult: tools that update state

Sometimes a tool needs to send a message back to the model and also mutate state fields at the same time. Instead of returning a plain string, return a `ToolResult`:

```python
from tenxgraph.core.state.tool_result import ToolResult
from tenxgraph.core.state import AgentState

class MyState(AgentState):
    selected_city: str = ""

def select_city(city: str) -> ToolResult:
    """Set the currently selected city in the workflow."""
    return ToolResult(
        message=f"City updated to '{city}'.",  # returned to the LLM
        state={"selected_city": city},          # updates MyState.selected_city
    )
```

Only fields present in the `state` dict are updated; all other state fields are left unchanged. This pattern is useful when a tool call should trigger a state change that affects the rest of the graph, like updating a filter or selection.

## How context accumulates across turns

The context list grows as each turn completes. After several exchanges with checkpointing enabled:

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

The checkpointer persists this entire list under the thread ID, and when the thread is resumed, it is restored intact. This is why a thread-based conversation feels continuous: every prior turn is available to the agent, and the model can reference anything the human or other agents said.

## Managing context size: trimming and summarization

As conversations grow, the message list can exceed the model's context window. The `trim_context=True` option on `Agent` automatically removes old messages before sending to the model:

```python
agent = Agent(
    model="gemini-2.5-flash",
    trim_context=True,
)
```

When messages are trimmed, the removed content is summarized and stored in `state.context_summary`. The model sees the summary instead of the full old messages, so no information is lost — only made more concise. The full history is always preserved in the checkpointer for audit and debugging.

This is one way to keep conversations running without hitting token limits. Another is to use a context manager or memory store to offload long-term facts to a retrieval system, letting short-term context stay focused.

## Related concepts

- [Agents and tools](/docs/concepts/agents-and-tools): How agents invoke tools and handle responses.
- [Checkpointing and threads](/docs/concepts/checkpointing-and-threads): How conversations are persisted and resumed.
- [Media and files](/docs/concepts/media-and-files): Storing and referencing large media in your messages.
