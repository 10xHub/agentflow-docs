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
from agentflow.core.state import Message
from agentflow.utils import ResponseGranularity

async def stream_example(app, question: str):
    async for chunk in app.astream(
        {"messages": [Message.text_message(question)]},
        config={"thread_id": "stream-session-1"},
        response_granularity=ResponseGranularity.LOW,
    ):
        if chunk.content:
            print(chunk.content, end="", flush=True)
    print()  # newline after stream ends

asyncio.run(stream_example(app, "What is quantum entanglement?"))
```

---

## Step 2: Understand StreamChunk

Every chunk yielded by `astream()` is a `StreamChunk`:

```python
from agentflow.core.state.stream_chunks import StreamChunk

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

For a basic streaming chat UI you usually only need `chunk.message` for the emitted message payload or `chunk.data` for event-specific data.

---

## Step 3: Differentiate tokens from complete messages

The stream emits `message.delta` for partial updates. When `delta` is present, treat the chunk as an in-progress message; when `delta` is absent, treat it as the complete message.

```python
buffer = ""

async for chunk in app.astream({"messages": [Message.text_message("Explain gravity.")]},
                                config={"thread_id": "t1"}):
    if chunk.message and getattr(chunk.message, "delta", None):
        # Partial message — append the delta to the live display
        buffer += chunk.message.delta
        update_ui_streaming(buffer)
    elif chunk.message:
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
from agentflow.utils import ResponseGranularity

async for chunk in app.astream(
    {"messages": [Message.text_message("Summarise our conversation.")]},
    config={"thread_id": "t2"},
    response_granularity=ResponseGranularity.FULL,
):
    if chunk.state:
        print("State snapshot:", chunk.state.get("context_summary"))
    if chunk.content:
        print(chunk.content, end="", flush=True)
```

---

## Step 5: Observe tool calls in the stream

When the agent calls a tool, the stream emits chunks for the tool call and the tool result. You can watch `chunk.node_name` to know which node produced each chunk.

```python
async for chunk in app.astream({"messages": [Message.text_message("What is 123 * 456?")]},
                                config={"thread_id": "t3"}):
    node = chunk.node_name or "unknown"
    if chunk.content:
        print(f"[{node}] {chunk.content}", end="")
    elif chunk.messages:
        for msg in chunk.messages:
            if msg.role == "tool":
                print(f"\n[tool result] {msg.content}")
```

---

## Step 6: Collect the full response from a stream

If you need the complete final messages but still want to use streaming for lower latency:

```python
async def stream_to_messages(app, input_messages: list[Message]) -> list[Message]:
    final_messages: list[Message] = []

    async for chunk in app.astream(
        {"messages": input_messages},
        config={"thread_id": "collect-1"},
    ):
        if chunk.messages:
            final_messages = chunk.messages  # each update replaces with the latest

    return final_messages
```

---

## Step 7: Stop a running stream

Call `app.astop()` from another task or coroutine to cancel the running execution. The graph checks the stop flag between nodes and halts cleanly.

```python
import asyncio

thread_id = "long-run-1"
stopped = False

async def run_stream():
    async for chunk in app.astream(
        {"messages": [Message.text_message("Write a very long essay.")]},
        config={"thread_id": thread_id},
    ):
        if stopped:
            break
        if chunk.content:
            print(chunk.content, end="", flush=True)

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
app = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["review_step"],  # pause before this node runs
)

# First call: runs up to (but not including) "review_step"
async for chunk in app.astream(
    {"messages": [Message.text_message("Start the workflow.")]},
    config={"thread_id": "workflow-1"},
):
    print(chunk.content or "", end="")

# User reviews the state here ...

# Second call on the same thread_id: resumes from "review_step"
async for chunk in app.astream(
    {"messages": [Message.text_message("Approved — continue.")]},
    config={"thread_id": "workflow-1"},
):
    print(chunk.content or "", end="")
```

---

## Complete example: streaming chat

```python
import asyncio
from agentflow.core.graph import StateGraph, Agent
from agentflow.core.state import AgentState, Message
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
        if chunk.content:
            print(chunk.content, end="", flush=True)

    print()

async def main():
    await chat("session-1", "Hello! My name is Alice.")
    await chat("session-1", "What is my name?")

asyncio.run(main())
```

---

## What you learned

- `app.astream()` is an async generator; iterate it with `async for`.
- `chunk.message.delta` carries partial message updates; a message without `delta` is complete.
- `ResponseGranularity.LOW` (default) is the lowest overhead option.
- Break out of the loop and call `app.astop()` to cancel execution early.
- `interrupt_before` / `interrupt_after` pause execution for human-in-the-loop workflows.

## Next steps

- [Set up checkpointing](set-up-checkpointing.md) to persist state between sessions.
- [Build a graph](build-a-graph.md) for the full graph construction reference.
