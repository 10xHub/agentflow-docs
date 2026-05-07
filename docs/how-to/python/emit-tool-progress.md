---
title: Emit Tool Progress Updates
description: Learn how to send live progress, errors, and status updates from tools during streaming execution.
---

# Emit Tool Progress Updates During Streaming

## Overview

When your tools perform long-running tasks (like API calls, file processing, or multi-step operations), you can use `StreamEmitter` to send **live progress updates** to the frontend during streaming execution. This gives users visibility into what the tool is doing and can provide a better UX for slow operations.

### Key Concepts

- **StreamEmitter** is injected into tools **only during streaming** (`app.stream()` / `app.astream()`)
- During normal execution (`app.invoke()` / `app.ainvoke()`), tools receive `emit=None`
- Updates are sent to the same stream output that the frontend consumes
- No external publisher setup required — works with the built-in streaming pipeline

---

## When to Use StreamEmitter

Use `StreamEmitter` when:

✅ **Do use for:**
- Long-running operations (API calls, file processing, database queries)
- Retries with multiple attempts (show which attempt is running)
- Multi-step processes (report progress per step)
- External service calls with timeout risk
- Batch processing (show item count progress)

❌ **Don't use for:**
- Fast operations that complete in &lt;100ms (overhead not worth it)
- Simple tool results that don't require intermediate feedback
- Non-streaming execution paths (emit is None anyway, so safe to call but won't do anything)

---

## Setup: Declare emit Parameter

The first step is to declare `emit` as an optional parameter in your tool function:

```python
from agentflow.core.state.stream_emitter import StreamEmitter

def my_tool(
    user_input: str,
    emit: StreamEmitter | None = None,  # Optional, auto-injected during streaming
) -> str:
    """Tool that can report progress during streaming."""
    if emit:
        emit.progress("Starting work...")
    # ... do work ...
    return "result"
```

### Key Details

- **Import:** `from agentflow.core.state.stream_emitter import StreamEmitter`
- **Parameter name:** Must be exactly `"emit"` (this is what the framework injects)
- **Type hint:** `StreamEmitter | None` tells type checkers it's optional
- **Always check:** Always do `if emit:` before calling emit methods (it's `None` during non-streaming)

---

## Example 1: Simple Progress Updates

**Scenario:** Fetching data from an external API with a known delay.

```python
import time
import requests
from agentflow.core.state.stream_emitter import StreamEmitter

def fetch_weather(location: str, emit: StreamEmitter | None = None) -> str:
    """Fetch weather data with progress updates."""
    
    if emit:
        emit.progress(f"Looking up weather for {location}...")
    
    # Simulate API delay
    time.sleep(2)
    
    if emit:
        emit.progress("Processing response...", data={"location": location})
    
    # Mock response for example
    result = f"Sunny, 72°F in {location}"
    
    if emit:
        emit.progress("Weather data ready")
    
    return result
```

**What happens during streaming:**
1. User sees "Looking up weather for Paris..." 
2. After 2 seconds: "Processing response..." with metadata
3. Finally: "Weather data ready"
4. Tool returns the actual result

**What happens during invoke():**
- All `if emit:` blocks are skipped (emit is None)
- Only the final result is returned

---

## Example 2: Retry Logic with Attempt Tracking

**Scenario:** An API call that might fail temporarily; retry with feedback.

```python
import requests
from agentflow.core.state.stream_emitter import StreamEmitter

def call_external_service(
    endpoint: str,
    emit: StreamEmitter | None = None,
) -> str:
    """Call an external service with retries and progress updates."""
    
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            if emit and attempt > 0:
                # Report retry attempt
                emit.progress(
                    f"Retry attempt {attempt} of {max_retries - 1}",
                    data={
                        "attempt": attempt,
                        "max_attempts": max_retries - 1,
                    }
                )
            
            if emit and attempt == 0:
                emit.progress(f"Calling {endpoint}...")
            
            # Actual API call
            response = requests.get(endpoint, timeout=5)
            response.raise_for_status()
            
            return response.json()
        
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                # Final attempt failed
                if emit:
                    emit.error(
                        f"Service unreachable after {max_retries} attempts: {e}",
                        data={"final_attempt": True}
                    )
                raise
            # Try again in next loop iteration
```

**Frontend sees:**
1. "Calling https://api.example.com..."
2. After timeout: "Retry attempt 1 of 2"
3. After another timeout: "Retry attempt 2 of 2"
4. If still failing: "Service unreachable after 3 attempts: ..."

**Key insight:** Retries are now visible to the user instead of hanging silently.

---

## Example 3: Multi-Step Processing with Milestones

**Scenario:** Processing a file with multiple distinct stages.

```python
import os
from agentflow.core.state.stream_emitter import StreamEmitter

def process_csv_file(filepath: str, emit: StreamEmitter | None = None) -> dict:
    """Process a CSV file with progress milestones."""
    
    # Step 1: Load file
    if emit:
        emit.progress("Loading file...")
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    if emit:
        emit.progress(
            f"File loaded: {len(lines)} rows",
            data={"row_count": len(lines)}
        )
    
    # Step 2: Validate
    if emit:
        emit.progress("Validating data format...")
    
    valid_rows = [l for l in lines if l.strip() and not l.startswith('#')]
    
    if emit:
        emit.progress(
            f"Validation complete: {len(valid_rows)} valid rows",
            data={"valid_count": len(valid_rows), "invalid_count": len(lines) - len(valid_rows)}
        )
    
    # Step 3: Transform
    if emit:
        emit.progress("Transforming data...")
    
    transformed = []
    for i, row in enumerate(valid_rows):
        # Simulate transformation
        transformed.append(row.upper())
        
        # Report progress every 100 rows
        if (i + 1) % 100 == 0 and emit:
            emit.progress(
                f"Transformed {i + 1} of {len(valid_rows)} rows",
                data={"current": i + 1, "total": len(valid_rows)}
            )
    
    if emit:
        emit.message("All steps complete!", data={"final_count": len(transformed)})
    
    return {
        "total_rows": len(lines),
        "valid_rows": len(valid_rows),
        "transformed": len(transformed),
    }
```

**Frontend progression:**
- "Loading file..."
- "File loaded: 5000 rows"
- "Validating data format..."
- "Validation complete: 4900 valid rows"
- "Transforming data..."
- "Transformed 100 of 4900 rows"
- "Transformed 200 of 4900 rows"
- ... (every 100 rows)
- "All steps complete!"

---

## Example 4: Error Recovery with Informational Messages

**Scenario:** Tool falls back to cached data when primary source fails.

```python
import requests
from agentflow.core.state.stream_emitter import StreamEmitter

def get_user_data(user_id: str, emit: StreamEmitter | None = None) -> dict:
    """Get user data, falling back to cache on failure."""
    
    if emit:
        emit.progress(f"Fetching user {user_id} from primary source...")
    
    try:
        # Try primary API
        response = requests.get(
            f"https://api.primary.com/users/{user_id}",
            timeout=3
        )
        response.raise_for_status()
        return response.json()
    
    except requests.RequestException as e:
        # Primary failed, try cache
        if emit:
            emit.error(
                f"Primary API unavailable ({e}), using cached data",
                data={"error_type": type(e).__name__, "fallback": "cache"}
            )
        
        if emit:
            emit.progress("Loading from cache...")
        
        # Get cached data
        cached = _get_cached_user(user_id)
        
        if emit:
            emit.message(
                "User data loaded from cache",
                data={"cache_age_seconds": cached.get("age", 0)}
            )
        
        return cached
```

**Frontend sees:**
1. "Fetching user 12345 from primary source..."
2. (after timeout) "Primary API unavailable (ConnectionTimeout), using cached data"
3. "Loading from cache..."
4. "User data loaded from cache"

Users understand why they're getting cached vs fresh data.

---

## Example 5: Batch Processing with Real-Time Counters

**Scenario:** Process items in a batch and report progress in real-time.

```python
from agentflow.core.state.stream_emitter import StreamEmitter
import time

def process_batch(items: list[str], emit: StreamEmitter | None = None) -> dict:
    """Process multiple items and report progress."""
    
    if emit:
        emit.progress(f"Starting batch processing: {len(items)} items")
    
    results = []
    errors = []
    
    for i, item in enumerate(items):
        try:
            if emit and i > 0 and (i + 1) % 10 == 0:
                # Report every 10 items
                percentage = ((i + 1) / len(items)) * 100
                emit.update({
                    "status": "batch_progress",
                    "processed": i + 1,
                    "total": len(items),
                    "percentage": percentage,
                    "errors_so_far": len(errors),
                })
            
            # Process item
            result = _process_item(item)
            results.append(result)
        
        except Exception as e:
            errors.append({"item": item, "error": str(e)})
            if emit:
                emit.error(f"Error processing {item}: {e}")
    
    if emit:
        emit.message(
            f"Batch complete: {len(results)} successful, {len(errors)} failed",
            data={
                "success_count": len(results),
                "error_count": len(errors),
                "success_rate": (len(results) / len(items)) * 100,
            }
        )
    
    return {
        "results": results,
        "errors": errors,
        "success_count": len(results),
        "error_count": len(errors),
    }
```

**Frontend shows:**
- "Starting batch processing: 1000 items"
- "processed: 10, total: 1000, percentage: 1%"
- "processed: 20, total: 1000, percentage: 2%"
- (errors as they occur) "Error processing item_X: reason"
- "Batch complete: 950 successful, 50 failed"

---

## Full Graph Example

Here's a complete graph that uses `StreamEmitter`:

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.core.state.stream_emitter import StreamEmitter
from agentflow.utils.constants import END
import time

# Define tool with StreamEmitter
def get_weather(
    location: str,
    tool_call_id: str | None = None,
    emit: StreamEmitter | None = None,
) -> str:
    """Get weather for a location with streaming progress."""
    if emit:
        emit.progress(f"Fetching weather for {location}...")
    
    time.sleep(1)
    
    if emit:
        emit.progress("Processing data...", data={"location": location})
    
    time.sleep(1)
    
    if emit:
        emit.progress("Finalizing...", data={"location": location})
    
    return f"Sunny, 72°F in {location}"

# Build graph
checkpointer = InMemoryCheckpointer()
tool_node = ToolNode([get_weather])

agent = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{
        "role": "system",
        "content": "You are a weather assistant. Use the get_weather tool when asked."
    }],
    tool_node=tool_node,
    trim_context=True,
)

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges(
    "MAIN",
    lambda state: "TOOL" if state.context[-1].role == "assistant" else END,
    {"TOOL": "TOOL", END: END},
)
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=checkpointer)

# Stream with progress updates
inp = {"messages": [Message.text_message("What's the weather in Paris?")]}
config = {"thread_id": "user_123", "is_stream": True}

print("Streaming response with progress updates:")
for chunk in app.stream(inp, config=config):
    # Check if this is a progress chunk from StreamEmitter
    if hasattr(chunk, 'event') and chunk.event.name == "message":
        if chunk.data.get("status") == "tool_progress":
            print(f"  📊 {chunk.data['message']} ({chunk.data['tool_name']})")
    else:
        print(chunk)
```

---

## Best Practices

### ✅ Do

1. **Check before emitting:** Always do `if emit:` before calling emit methods
2. **Use meaningful messages:** Messages should tell users what's happening
3. **Add metadata:** Include `data` for important metrics (attempt numbers, percentages, etc.)
4. **Report milestones:** Emit at meaningful progress points, not every step
5. **Include duration:** For batch work, emit frequency (every N items) not on every item

### ❌ Don't

1. **Don't emit too frequently:** Thousands of updates per second will slow down streaming
2. **Don't rely on emit:** Tool should always return a valid result regardless
3. **Don't emit sensitive data:** Progress chunks are exposed to frontend; sanitize if needed
4. **Don't use for critical flow:** Emit is informational only; never branch on it

### Performance Tips

```python
# ❌ Bad: Emits 1000 times per second
for item in items:
    if emit:
        emit.progress(f"Processing {item}")
    process(item)

# ✅ Good: Emits once per batch
for i, item in enumerate(items):
    if (i + 1) % 100 == 0 and emit:
        emit.progress(f"Processed {i + 1} of {len(items)}")
    process(item)
```

---

## See Also

- [StreamEmitter Reference](../../reference/python/stream-emitter.md) — Complete API documentation
- [Streaming Architecture](../../concepts/streaming.md) — How streaming chunks and granularity work
- [Dependency Injection](../../concepts/dependency-injection.md) — How parameters like `emit` and `state` are injected
- [Example: react_stream/stream_sync.py](https://github.com/10xHub/Agentflow/blob/main/examples/react_stream/stream_sync.py) — Full working example in the repository
