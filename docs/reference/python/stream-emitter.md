---
title: StreamEmitter
description: Emit live progress, errors, and status updates from tools during streaming execution.
sidebar_position: 14
---

# StreamEmitter

## When to use this

Use `StreamEmitter` when you want your tools to send **live progress updates** back to the caller during `app.stream(...)` / `app.astream(...)` execution. Unlike traditional tool results (which return only after completion), `StreamEmitter` allows tools to report intermediate steps, retries, and errors in real-time.

**Available only during streaming**. `StreamEmitter` is automatically injected into tool functions when the graph is run in streaming mode. During `invoke()` / `ainvoke()` (non-streaming), tools receive `emit=None`.

## Import path

```python
from agentflow.core.state.stream_emitter import StreamEmitter
```

---

## Constructor

`StreamEmitter` is created automatically by the graph runtime. You do not instantiate it directly. Instead, declare it as an optional parameter in your tool functions:

```python
def my_tool(
    location: str,
    emit: StreamEmitter | None = None,
) -> str:
    if emit:
        emit.progress("Starting work...", data={"step": 1})
    # ... work ...
    return "result"
```

---

## Core Methods

### `progress(message: str, data: dict | None = None) -> None`

Emit a progress update for the running tool.

**When to use:** Report intermediate steps, current progress, or status changes during tool execution.

**Characteristics:**
- Status is set to `"tool_progress"`
- Visible at all `ResponseGranularity` levels (default `LOW`)
- Commonly used for retry attempts, step counts, or percentage completion

**Parameters:**
- `message` (str): Human-readable description of the current step (e.g., "Fetching data...", "Attempt 2 of 3")
- `data` (dict, optional): Extra metadata as key-value pairs (e.g., `{"attempt": 2, "max_attempts": 3}`)

**Example:**

```python
def search_with_retries(query: str, emit: StreamEmitter | None = None) -> str:
    for attempt in range(3):
        if emit:
            emit.progress(
                f"Attempt {attempt + 1} of 3",
                data={"attempt": attempt + 1, "max_attempts": 3}
            )
        try:
            return _perform_search(query)
        except TemporaryError:
            if attempt == 2:
                raise
```

---

### `error(message: str, data: dict | None = None) -> None`

Emit an error update for the running tool.

**When to use:** Report failures, warnings, or issues during execution **without stopping the tool**. The tool continues and eventually returns a result.

**Characteristics:**
- Status is set to `"tool_failed"`
- Purely informational; does not interrupt execution
- The tool result is still returned normally after this call

**Parameters:**
- `message` (str): Human-readable description of the error
- `data` (dict, optional): Extra metadata

**Example:**

```python
def fetch_data(url: str, emit: StreamEmitter | None = None) -> str:
    try:
        return requests.get(url).text
    except requests.ConnectTimeout:
        if emit:
            emit.error(
                "Connection timeout, using cached data",
                data={"retry_count": 3, "cache_age_seconds": 3600}
            )
        return get_cached_data(url)
```

---

### `message(message: str, data: dict | None = None) -> None`

Emit a plain message update from the running tool.

**When to use:** Send arbitrary informational messages that don't fit the "progress" or "error" categories.

**Characteristics:**
- Status is set to `"tool_message"`
- General-purpose status/informational updates

**Parameters:**
- `message` (str): Message text
- `data` (dict, optional): Extra metadata

**Example:**

```python
def process_file(filename: str, emit: StreamEmitter | None = None) -> str:
    if emit:
        emit.message(f"Processing file: {filename}")
    # process
    if emit:
        emit.message("File processing complete", data={"lines_processed": 1000})
    return "done"
```

---

### `update(data: dict) -> None`

Emit a generic data update from the running tool.

**When to use:** Send custom metrics, counters, or structured data updates without a message.

**Characteristics:**
- Status is set via `data["status"]` if provided, otherwise omitted
- Purely data-driven; no built-in message field

**Parameters:**
- `data` (dict): Arbitrary key-value pairs to include in the stream chunk

**Example:**

```python
def batch_processor(items: list, emit: StreamEmitter | None = None) -> int:
    processed = 0
    for item in items:
        _process(item)
        processed += 1
        if emit:
            emit.update({
                "status": "batch_progress",
                "processed_count": processed,
                "total_count": len(items),
                "percentage": (processed / len(items)) * 100,
            })
    return processed
```

---

## Attributes

`StreamEmitter` carries useful metadata about the current execution:

- `tool_name` (str): Name of the tool being executed
- `tool_call_id` (str): Unique identifier for this tool invocation
- `node_name` (str): Name of the graph node executing the tool
- `thread_id` (str | None): Active thread/session identifier
- `run_id` (str | None): Active run identifier

These are automatically populated; you typically do not need to access them directly.

---

## Stream Chunk Output

When you emit via `StreamEmitter`, a `StreamChunk` is added to the stream output with the following structure:

```python
{
    "event": "message" | "error" | "update",  # StreamEvent enum
    "data": {
        "status": "tool_progress" | "tool_failed" | "tool_message" | ...,
        "tool_name": "my_tool",
        "tool_call_id": "call_abc123",
        "node": "TOOL",
        "message": "...",  # if progress/error/message emitted
        "thread_id": "thread_xyz",
        "run_id": "run_123",
        # ... plus any extra data you passed
    },
    "thread_id": "thread_xyz",
    "run_id": "run_123",
}
```

Frontend clients consume these chunks from `app.stream(...)` / `app.astream(...)` to display live updates.

---

## Usage Patterns

### Pattern 1: Retry with Progress

Track retry attempts and emit updates after each failure:

```python
def call_external_api(endpoint: str, emit: StreamEmitter | None = None) -> str:
    max_retries = 3
    for attempt in range(max_retries):
        try:
            if emit and attempt > 0:
                emit.progress(f"Retry attempt {attempt}", data={"attempt": attempt})
            return requests.get(endpoint).json()
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                if emit:
                    emit.error(f"All {max_retries} retries failed: {e}")
                raise
```

### Pattern 2: Long-Running Task with Status Milestones

For tasks that take time, emit updates at key milestones:

```python
def process_large_file(filepath: str, emit: StreamEmitter | None = None) -> dict:
    if emit:
        emit.progress("Opening file...")
    with open(filepath) as f:
        lines = f.readlines()
    
    if emit:
        emit.progress(f"Loaded {len(lines)} lines, starting processing...")
    
    results = []
    for i, line in enumerate(lines):
        results.append(_process_line(line))
        if (i + 1) % 100 == 0 and emit:
            emit.progress(f"Processed {i + 1} of {len(lines)} lines")
    
    if emit:
        emit.message("Processing complete", data={"total_processed": len(results)})
    
    return {"count": len(results), "results": results}
```

### Pattern 3: Multi-Step Tool with Conditional Branching

Emit different updates based on tool behavior:

```python
def intelligent_search(query: str, emit: StreamEmitter | None = None) -> str:
    if emit:
        emit.progress("Analyzing query...", data={"step": 1})
    
    query_type = _classify_query(query)
    
    if query_type == "simple":
        if emit:
            emit.progress("Using fast path", data={"step": 2})
        return _fast_search(query)
    else:
        if emit:
            emit.progress("Using deep search path", data={"step": 2})
        
        # Complex search with fallbacks
        try:
            if emit:
                emit.progress("Querying primary index...", data={"step": 3})
            return _deep_search_primary(query)
        except IndexError:
            if emit:
                emit.error("Primary index unavailable, falling back...", data={"step": 3})
                emit.progress("Querying secondary index...", data={"step": 4})
            return _deep_search_secondary(query)
```

---

## Behavior During `invoke()` vs `stream()`

### During `app.stream()` / `app.astream()`:
- `emit: StreamEmitter` is automatically created and injected
- Tools can call `emit.progress()`, `emit.error()`, etc.
- Emitted chunks appear in the stream output
- Frontend clients see live updates in real-time

### During `app.invoke()` / `app.ainvoke()`:
- `emit: None` is injected (or the parameter is absent)
- Tools should check `if emit:` before calling any emit methods
- No streaming output is generated
- Only the final tool result is returned

---

## Thread Safety

`StreamEmitter` is thread-safe. All emit methods use `loop.call_soon_threadsafe` internally, so:

- **Sync tools** (running in `asyncio.to_thread`) can call emit methods safely
- **Async tools** can call emit methods safely
- No need for locks or explicit synchronization

---

## Example: Complete Tool with StreamEmitter

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.core.state import AgentState
from agentflow.core.state.stream_emitter import StreamEmitter
import time

def get_weather(
    location: str,
    tool_call_id: str | None = None,
    state: AgentState | None = None,
    emit: StreamEmitter | None = None,
) -> str:
    """Get the current weather for a specific location.
    
    Injectable parameters: tool_call_id and state are automatically injected.
    emit is only injected during streaming; it's None during invoke().
    """
    if emit:
        emit.progress("Fetching weather data...", data={"location": location})

    time.sleep(1)  # Simulate API call

    if emit:
        emit.progress("Processing weather data...", data={"location": location})

    if tool_call_id:
        print(f"Tool call ID: {tool_call_id}")
    
    if state and hasattr(state, "context"):
        print(f"Message count: {len(state.context)}")

    if emit:
        emit.progress("Finalizing response...", data={"location": location})

    return f"The weather in {location} is sunny"

# Use in a graph
tool_node = ToolNode([get_weather])

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful weather assistant. Call get_weather when asked.",
    }],
    tool_node=tool_node,
)

# Streaming will show progress updates in real-time
config = {"thread_id": "12345", "is_stream": True}
for chunk in graph.stream(input_data, config=config):
    print(chunk.model_dump())
```

---

## See Also

- [Streaming](streaming.md) — Overview of streaming chunks and `ResponseGranularity`
- [Tools](tools.md) — Defining and registering tools with `ToolNode`
- [Dependency Injection](dependency-injection.md) — How `emit`, `tool_call_id`, `state`, and other parameters are injected into tools
