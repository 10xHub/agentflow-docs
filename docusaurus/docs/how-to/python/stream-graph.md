---
title: How to stream graph responses
sidebar_label: Stream responses
description: Guide to streaming token-by-token output from a compiled graph using astream(), StreamChunk format, ResponseGranularity, and interrupt patterns.
keywords:
  - agentflow streaming
  - astream
  - stream agent response
  - StreamChunk
  - python ai agent framework
sidebar_position: 6
---

# How to stream graph responses

`CompiledGraph.astream()` yields incremental `StreamChunk` objects as the graph executes. Use it to display token-by-token output in chat interfaces and provide real-time feedback during long-running workflows.

---

## Step 1: Basic streaming loop

```python
import asyncio
from agentflow.core.state import Message, StreamEvent
from agentflow.utils import ResponseGranularity

async def stream_example(app, question: str):
    async for chunk in app.astream(
        {"messages": [Message.text_message(question)]},
        config={"thread_id": "stream-session-1"},
        response_granularity=ResponseGranularity.LOW,
    ):
        if chunk.event == StreamEvent.MESSAGE and chunk.message:
            print(chunk.message.text(), end="", flush=True)
    print()  # newline after stream ends

asyncio.run(stream_example(app, "What is quantum entanglement?"))
```

---

## Step 2: Understand StreamChunk

Every chunk yielded by `astream()` is a `StreamChunk`:

```python
from agentflow.core.state import StreamChunk, StreamEvent

class StreamEvent(enum.StrEnum):
    STATE = "state"
    MESSAGE = "message"
    ERROR = "error"
    UPDATES = "updates"

class StreamChunk:
    event: StreamEvent = StreamEvent.MESSAGE
    # data holders for different chunk types
    message: Message | None = None
    state: AgentState | None = None
    # Placeholder for other chunk types
    data: dict | None = None

    # Optional identifiers
    thread_id: str | None = None
    run_id: str | None = None
    # Optional metadata
    metadata: dict | None = None
    timestamp: float = Field(
        default_factory=datetime.now().timestamp,
        description="UNIX timestamp of when chunk was created",
    )
```

There is no `chunk.content` attribute. Always branch on `chunk.event` first, then read the matching holder:

| `chunk.event` | Read | Notes |
|---|---|---|
| `StreamEvent.MESSAGE` | `chunk.message` | Use `chunk.message.text()` to get the text. |
| `StreamEvent.STATE` | `chunk.state` | An `AgentState` model, so use attribute access. |
| `StreamEvent.UPDATES` | `chunk.data` | Dict describing progress, for example tool invocation. |
| `StreamEvent.ERROR` | `chunk.data` | Dict describing the failure; `reason` is always set, tool failures also carry `error`. |

`StreamChunk` is configured with `use_enum_values=True`, so `chunk.event` is a plain string at runtime. `StreamEvent` is a `StrEnum`, so comparing against the enum member still works and reads better.

For a basic streaming chat UI you usually only need `chunk.message` for the emitted message payload or `chunk.data` for event-specific data.

---

## Step 3: Differentiate tokens from complete messages

`Message.delta` is a boolean flag. When `delta` is `True` the chunk carries a partial, in-progress message; when it is `False` the message is complete. Either way the text lives in `message.text()`.

```python
from agentflow.core.state import StreamEvent

buffer = ""

async for chunk in app.astream({"messages": [Message.text_message("Explain gravity.")]},
                                config={"thread_id": "t1"}):
    if chunk.event != StreamEvent.MESSAGE or not chunk.message:
        continue

    if chunk.message.delta:
        # Partial message — append the new text to the live display
        buffer += chunk.message.text()
        update_ui_streaming(buffer)
    else:
        # Complete message — replace the streaming placeholder
        final_msg = chunk.message
        buffer = ""
        show_final_message(final_msg)
```

---

## Step 4: ResponseGranularity

`response_granularity` controls how much state data is emitted alongside the text tokens.

| Value | Chunks include |
|---|---|
| `ResponseGranularity.LOW` (default) | Text tokens + final messages only. Lowest overhead. |
| `ResponseGranularity.PARTIAL` | Text tokens + `context` list + `context_summary`. |
| `ResponseGranularity.FULL` | Text tokens + complete state dict including `execution_meta`. |

```python
from agentflow.core.state import StreamEvent
from agentflow.utils import ResponseGranularity

async for chunk in app.astream(
    {"messages": [Message.text_message("Summarise our conversation.")]},
    config={"thread_id": "t2"},
    response_granularity=ResponseGranularity.FULL,
):
    if chunk.event == StreamEvent.STATE and chunk.state:
        # chunk.state is an AgentState model, not a dict
        print("State snapshot:", chunk.state.context_summary)
    elif chunk.event == StreamEvent.MESSAGE and chunk.message:
        print(chunk.message.text(), end="", flush=True)
```

---

## Step 5: Observe tool calls in the stream

When the agent calls a tool, the stream emits an `UPDATES` chunk when the tool is invoked and a `MESSAGE` chunk carrying the tool result. There is no `chunk.node_name`: the producing node is reported under the `"node"` key, in `chunk.metadata` for state and model chunks and in `chunk.data` for tool chunks.

```python
from agentflow.core.state import StreamEvent

async for chunk in app.astream({"messages": [Message.text_message("What is 123 * 456?")]},
                                config={"thread_id": "t3"}):
    node = (chunk.metadata or {}).get("node") or (chunk.data or {}).get("node") or "unknown"

    if chunk.event == StreamEvent.UPDATES and chunk.data:
        # Tool lifecycle, for example {"status": "invoking_tool", "tool_name": "multiply"}
        print(f"\n[{node}] {chunk.data.get('status')} {chunk.data.get('tool_name', '')}")
    elif chunk.event == StreamEvent.MESSAGE and chunk.message:
        if chunk.message.role == "tool":
            print(f"\n[{node}] tool result: {chunk.message.text()}")
        else:
            print(f"[{node}] {chunk.message.text()}", end="")
    elif chunk.event == StreamEvent.ERROR and chunk.data:
        print(f"\n[{node}] failed: {chunk.data.get('reason')}")
```

---

## Step 6: Collect the full response from a stream

If you need the complete final messages but still want to use streaming for lower latency:

There is no `chunk.messages`. Collect the completed messages yourself, skipping deltas and de-duplicating on `message_id`:

```python
from agentflow.core.state import StreamEvent

async def stream_to_messages(app, input_messages: list[Message]) -> list[Message]:
    final_messages: list[Message] = []
    seen: set[str | int] = set()

    async for chunk in app.astream(
        {"messages": input_messages},
        config={"thread_id": "collect-1"},
    ):
        if chunk.event != StreamEvent.MESSAGE or not chunk.message:
            continue
        if chunk.message.delta:
            continue  # partial update, the complete message arrives later
        if chunk.message.message_id in seen:
            continue
        seen.add(chunk.message.message_id)
        final_messages.append(chunk.message)

    return final_messages
```

Alternatively, run with `ResponseGranularity.FULL` and keep the `chunk.state.context` list from the last `StreamEvent.STATE` chunk.

---

## Step 7: Stop a running stream

Call `app.astop()` from another task or coroutine to cancel the running execution. The graph checks the stop flag between nodes and halts cleanly.

```python
import asyncio

from agentflow.core.state import StreamEvent

thread_id = "long-run-1"
stopped = False

async def run_stream():
    async for chunk in app.astream(
        {"messages": [Message.text_message("Write a very long essay.")]},
        config={"thread_id": thread_id},
    ):
        if stopped:
            break
        if chunk.event == StreamEvent.MESSAGE and chunk.message:
            print(chunk.message.text(), end="", flush=True)

async def stop_after(seconds: float):
    await asyncio.sleep(seconds)
    global stopped
    stopped = True
    await app.astop({"thread_id": thread_id})

async def main():
    await asyncio.gather(run_stream(), stop_after(5.0))

asyncio.run(main())
```

The sync wrapper `app.stop(config)` is available for non-async contexts.

---

## Step 8: Interrupt and resume

`interrupt_before` and `interrupt_after` pause the graph at named nodes and resume on the next `ainvoke()` or `astream()` call with the same `thread_id`.

```python
from agentflow.core.state import StreamEvent

app = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["review_step"],  # pause before this node runs
)

# First call: runs up to (but not including) "review_step"
async for chunk in app.astream(
    {"messages": [Message.text_message("Start the workflow.")]},
    config={"thread_id": "workflow-1"},
):
    if chunk.event == StreamEvent.MESSAGE and chunk.message:
        print(chunk.message.text(), end="")

# User reviews the state here ...

# Second call on the same thread_id: resumes from "review_step"
async for chunk in app.astream(
    {"messages": [Message.text_message("Approved, continue.")]},
    config={"thread_id": "workflow-1"},
):
    if chunk.event == StreamEvent.MESSAGE and chunk.message:
        print(chunk.message.text(), end="")
```

---

## Complete example: streaming chat

```python
import asyncio
from agentflow.core.graph import StateGraph, Agent
from agentflow.core.state import AgentState, Message, StreamEvent
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.utils import END, ResponseGranularity

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
)

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

app = graph.compile(checkpointer=InMemoryCheckpointer())

async def chat(thread_id: str, user_input: str):
    print(f"User: {user_input}")
    print("Assistant: ", end="")

    async for chunk in app.astream(
        {"messages": [Message.text_message(user_input)]},
        config={"thread_id": thread_id},
        response_granularity=ResponseGranularity.LOW,
    ):
        if chunk.event == StreamEvent.MESSAGE and chunk.message:
            print(chunk.message.text(), end="", flush=True)

    print()

async def main():
    await chat("session-1", "Hello! My name is Alice.")
    await chat("session-1", "What is my name?")

asyncio.run(main())
```

---

## What you learned

- `app.astream()` is an async generator; iterate it with `async for`.
- Branch on `chunk.event`, then read `chunk.message`, `chunk.state`, or `chunk.data`. `StreamChunk` has no `content` attribute.
- `chunk.message.text()` extracts the text from a message's content blocks.
- `chunk.message.delta` is a boolean: `True` for a partial update, `False` for the complete message.
- `ResponseGranularity.LOW` (default) is the lowest overhead option.
- Break out of the loop and call `app.astop()` to cancel execution early.
- `interrupt_before` / `interrupt_after` pause execution for human-in-the-loop workflows.

## Next steps

- [Set up checkpointing](set-up-checkpointing.md) to persist state between sessions.
- [Build a graph](build-a-graph.md) for the full graph construction reference.
