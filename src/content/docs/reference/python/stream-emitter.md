---
title: StreamEmitter
seoTitle: "StreamEmitter API reference (Python)"
description: Reference for StreamEmitter, the object injected into tools during streaming that sends live progress, error and message chunks to the caller.
section: Reference
group: "Python library"
order: 110
updated: "2026-10-08"
---

`StreamEmitter` lets a tool send live updates to the caller of `app.stream(...)` or `app.astream(...)` while the tool is still running. The runtime creates one per tool call and injects it into any tool that declares an `emit` parameter. During `invoke()` and `ainvoke()` the tool receives `emit=None`.

## Import

```python
from tenxgraph.core.state.stream_emitter import StreamEmitter
# also exported from the package: from tenxgraph.core.state import StreamEmitter
```

## Declare the emitter in a tool

You never construct `StreamEmitter` yourself. Add a parameter named `emit` with a default of `None` and guard every call, because the value is `None` when the graph runs through `invoke()` or `ainvoke()`.

```python
from tenxgraph.core.state.stream_emitter import StreamEmitter


def my_tool(location: str, emit: StreamEmitter | None = None) -> str:
    # emit is None outside streaming runs, so always check it.
    if emit:
        emit.progress("Starting work...", data={"step": 1})
    return "result"
```

`emit` is a reserved injectable name and is not exposed to the model in the tool schema. The other injectable parameters (`tool_call_id`, `state`, `config`) are covered in [Dependency Injection](/docs/concepts/dependency-injection).

## Methods

All four methods return `None`, take effect immediately, and never interrupt the tool. Each puts a `StreamChunk` on the stream. The first three differ in the `status` value and the stream event they use.

| Method | `status` in chunk data | Stream event | Use for |
|---|---|---|---|
| `progress(message, data=None)` | `"tool_progress"` | `StreamEvent.MESSAGE` | Steps, retries, percentages |
| `error(message, data=None)` | `"tool_failed"` | `StreamEvent.ERROR` | Recoverable failures you want the client to see |
| `message(message, data=None)` | `"tool_message"` | `StreamEvent.MESSAGE` | General informational text |
| `update(data)` | none (set your own in `data`) | `StreamEvent.UPDATES` | Structured metrics without a message |

### progress

Signature: `progress(message: str, data: dict | None = None) -> None`

Reports an intermediate step. Because it uses the `MESSAGE` event, it is visible at every `ResponseGranularity` level, including the default `LOW`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `str` | required | Human-readable description of the current step |
| `data` | `dict \| None` | `None` | Extra keys merged into the chunk data |

```python
from tenxgraph.core.state.stream_emitter import StreamEmitter


def search_with_retries(query: str, emit: StreamEmitter | None = None) -> str:
    for attempt in range(3):
        if emit:
            emit.progress(
                f"Attempt {attempt + 1} of 3",
                data={"attempt": attempt + 1, "max_attempts": 3},
            )
        if attempt == 2:  # stand-in for a call that eventually succeeds
            return f"results for {query}"
    return ""
```

### error

Signature: `error(message: str, data: dict | None = None) -> None`

Reports a failure or warning without stopping the tool. The tool keeps running and its result is returned normally. Raising an exception is how you actually fail a tool; `error()` only informs the client.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `str` | required | Human-readable description of the error |
| `data` | `dict \| None` | `None` | Extra keys merged into the chunk data |

```python
from tenxgraph.core.state.stream_emitter import StreamEmitter


def fetch_data(url: str, emit: StreamEmitter | None = None) -> str:
    try:
        raise TimeoutError("upstream timed out")  # stand-in for a real request
    except TimeoutError:
        if emit:
            emit.error("Timeout, using cached data", data={"cache_age_seconds": 3600})
        return "cached value"
```

### message

Signature: `message(message: str, data: dict | None = None) -> None`

Sends plain informational text that is neither progress nor an error.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `str` | required | Message text |
| `data` | `dict \| None` | `None` | Extra keys merged into the chunk data |

```python
from tenxgraph.core.state.stream_emitter import StreamEmitter


def process_file(filename: str, emit: StreamEmitter | None = None) -> str:
    if emit:
        emit.message(f"Processing file: {filename}")
        emit.message("File processing complete", data={"lines_processed": 1000})
    return "done"
```

### update

Signature: `update(data: dict) -> None`

Sends a data-only chunk with no `message` key and no default `status`. Include `"status"` in `data` if your client switches on it.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | `dict` | required | Keys merged into the chunk data |

```python
from tenxgraph.core.state.stream_emitter import StreamEmitter


def batch_processor(items: list[str], emit: StreamEmitter | None = None) -> int:
    processed = 0
    for _ in items:
        processed += 1
        if emit:
            emit.update(
                {
                    "status": "batch_progress",
                    "processed_count": processed,
                    "total_count": len(items),
                }
            )
    return processed
```

## Attributes

The runtime fills these in when it creates the emitter. They are stored internally with a leading underscore, so treat them as informational rather than a stable public API.

| Attribute | Type | Meaning |
|---|---|---|
| `tool_name` | `str` | Name of the tool being executed |
| `tool_call_id` | `str` | Identifier of this tool call |
| `node_name` | `str` | Name of the graph node running the tool |
| `thread_id` | `str \| None` | Thread from the run config |
| `run_id` | `str \| None` | Run from the run config |

## Chunk shape

Every emit becomes a `StreamChunk` whose `data` always contains `tool_name`, `tool_call_id` and `node` (the node name), then your `data` keys, then `status` and `message` for `progress`, `error` and `message`. The chunk also carries the run's `thread_id` and `run_id`. Your own `data` keys are applied before `status` and `message` for those three methods, so they cannot override them. With `update()` your keys are applied last and can override the base keys.

```python
# Example chunk from emit.progress("Fetching...", data={"location": "Paris"})
{
    "event": "message",
    "data": {
        "tool_name": "get_weather",
        "tool_call_id": "call_abc123",
        "node": "TOOL",
        "location": "Paris",
        "status": "tool_progress",
        "message": "Fetching...",
    },
    "thread_id": "12345",
    "run_id": "run_123",
}
```

## Streaming versus invoke

In `app.stream()` and `app.astream()` the stream handler creates the emitter and yields each chunk to the caller as soon as the tool emits it, before the tool returns. In `app.invoke()` and `app.ainvoke()` no emitter exists, nothing is streamed, and only the final result is returned. For the full stream chunk model see [Streaming](/docs/concepts/streaming).

## Thread safety

Emit methods schedule work with `loop.call_soon_threadsafe`, so they are safe to call from async tools and from sync tools that run in a worker thread. You do not need locks.

## Complete example

This graph wires a tool that emits progress into a streaming run. It needs `pip install "10xgraph[google-genai]"` and a Google API key in your environment (see [Models and providers](/docs/integrations/models)). It follows `examples/react_stream/stream_sync.py` in the core repo.

```python
# stream_progress.py
import time

from tenxgraph.core import Agent, StateGraph, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.core.state.stream_emitter import StreamEmitter
from tenxgraph.storage.checkpointer import InMemoryCheckpointer
from tenxgraph.utils.constants import END


def get_weather(location: str, emit: StreamEmitter | None = None) -> str:
    """Get the current weather for a location."""
    if emit:
        emit.progress("Fetching weather data...", data={"location": location})
    time.sleep(1)  # simulate a slow API call
    if emit:
        emit.progress("Finalizing response...", data={"location": location})
    return f"The weather in {location} is sunny"


tool_node = ToolNode([get_weather])

main_agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[
        {
            "role": "system",
            "content": "Always call the get_weather tool for weather questions.",
        }
    ],
    tool_node=tool_node,
)


def route(state: AgentState) -> str:
    """Go to the tool node when the last assistant message has tool calls."""
    if not state.context:
        return END
    last = state.context[-1]
    if last.role == "assistant" and getattr(last, "tools_calls", None):
        return "TOOL"
    return END


graph = StateGraph(AgentState())
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())

inp = {"messages": [Message.text_message("What is the weather in Paris?")]}
config = {"thread_id": "12345", "recursion_limit": 10, "is_stream": True}

for chunk in app.stream(inp, config=config):
    print(chunk.model_dump())  # tool_progress chunks appear before the final answer
```

## Related pages

- [Streaming](/docs/concepts/streaming): stream chunks, events and `ResponseGranularity`.
- [Tools reference](/docs/reference/python/tools): defining and registering tools with `ToolNode`.
- [Dependency Injection](/docs/concepts/dependency-injection): how `emit`, `tool_call_id`, `state` and `config` reach tools.
