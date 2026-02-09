# Async Pattern Standardization

This guide explains when and how to use synchronous and asynchronous patterns in Agentflow, following Python asyncio best practices.

## Table of Contents
- [Overview](#overview)
- [When to Use Async vs Sync](#when-to-use-async-vs-sync)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Migration Guide](#migration-guide)
- [Examples](#examples)

## Overview

Agentflow is built on asyncio for efficient handling of I/O-bound operations like:
- LLM API calls
- Database queries  
- File I/O
- Network requests
- Message queue operations

However, we provide both sync and async APIs for flexibility. Understanding when to use each is crucial for optimal performance.

## When to Use Async vs Sync

### Use Async When:

1. **Your application is async**: If your main application uses `asyncio`, use async APIs
   ```python
   async def main():
       graph = build_graph().compile()
       result = await graph.ainvoke(input_data)
       await graph.aclose()
   
   asyncio.run(main())
   ```

2. **Running in an async framework**: FastAPI, aiohttp, Quart, etc.
   ```python
   from fastapi import FastAPI
   
   app = FastAPI()
   graph = build_graph().compile()
   
   @app.post("/process")
   async def process(data: dict):
       result = await graph.ainvoke(data)
       return result
   ```

3. **Handling multiple concurrent operations**: 
   ```python
   # Process multiple requests concurrently
   results = await asyncio.gather(
       graph.ainvoke(input1),
       graph.ainvoke(input2),
       graph.ainvoke(input3),
   )
   ```

4. **Streaming responses**: Real-time processing with streaming
   ```python
   async for chunk in graph.astream(input_data):
       print(chunk.content)
   ```

### Use Sync When:

1. **Simple scripts or notebooks**: Jupyter notebooks, one-off scripts
   ```python
   # Simple script
   graph = build_graph().compile()
   result = graph.invoke(input_data)
   print(result)
   ```

2. **Interactive exploration**: REPL, debugging
   ```python
   >>> from agentflow import StateGraph
   >>> graph = StateGraph().compile()
   >>> result = graph.invoke({"messages": [...]})
   ```

3. **Integration with sync frameworks**: Flask, Django (without async views)
   ```python
   from flask import Flask
   
   app = Flask(__name__)
   graph = build_graph().compile()
   
   @app.route("/process", methods=["POST"])
   def process():
       result = graph.invoke(request.json)
       return result
   ```

4. **Testing simple scenarios**: Quick unit tests
   ```python
   def test_basic_execution():
       graph = build_graph().compile()
       result = graph.invoke(test_input)
       assert result["status"] == "success"
   ```

## Best Practices

### 1. Don't Mix Event Loops

**❌ BAD:**
```python
async def main():
    # This creates a nested event loop - will fail!
    result = graph.invoke(input_data)  # Uses asyncio.run() internally
```

**✅ GOOD:**
```python
async def main():
    # Use async API in async context
    result = await graph.ainvoke(input_data)
```

### 2. Use Context Managers for Resource Cleanup

**✅ Async context manager (preferred for async apps):**
```python
async def main():
    graph = build_graph().compile()
    try:
        result = await graph.ainvoke(input_data)
    finally:
        await graph.aclose()  # Ensure cleanup
```

### 3. Avoid Blocking Operations in Async Code

**❌ BAD:**
```python
async def process_node(state: AgentState) -> AgentState:
    # Blocks the event loop!
    time.sleep(5)
    response = requests.get("https://api.example.com")  # Blocking I/O
    return state
```

**✅ GOOD:**
```python
async def process_node(state: AgentState) -> AgentState:
    # Non-blocking
    await asyncio.sleep(5)
    async with aiohttp.ClientSession() as session:
        async with session.get("https://api.example.com") as response:
            data = await response.json()
    return state
```

### 4. Use asyncio.gather for Concurrent Operations

```python
async def parallel_processing(inputs: list[dict]):
    """Process multiple inputs concurrently."""
    tasks = [graph.ainvoke(inp) for inp in inputs]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

### 5. Handle Exceptions Properly

```python
async def safe_invoke(input_data: dict):
    try:
        result = await graph.ainvoke(input_data)
        return result
    except Exception as e:
        logger.exception("Error during graph execution: %s", e)
        raise
```

## Common Patterns

### Pattern 1: Async with Streaming

```python
async def process_with_streaming(query: str):
    """Process query with real-time streaming output."""
    async for chunk in graph.astream({"messages": [Message.from_text(query)]}):
        if chunk.content_type == "message":
            # Stream content to client
            yield chunk.content
```

### Pattern 2: Rate-Limited Concurrent Processing

```python
async def batch_process_with_limit(items: list[dict], limit: int = 5):
    """Process items concurrently with rate limiting."""
    semaphore = asyncio.Semaphore(limit)
    
    async def process_with_limit(item):
        async with semaphore:
            return await graph.ainvoke(item)
    
    tasks = [process_with_limit(item) for item in items]
    results = await asyncio.gather(*tasks)
    return results
```

### Pattern 3: Timeout Handling

```python
async def invoke_with_timeout(input_data: dict, timeout: float = 30.0):
    """Invoke graph with timeout protection."""
    try:
        result = await asyncio.wait_for(
            graph.ainvoke(input_data),
            timeout=timeout
        )
        return result
    except TimeoutError:
        logger.error("Graph execution timed out after %ss", timeout)
        raise
```

### Pattern 4: Retry Logic

```python
async def invoke_with_retry(
    input_data: dict,
    max_retries: int = 3,
    backoff: float = 1.0
):
    """Invoke graph with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            return await graph.ainvoke(input_data)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(backoff * (2 ** attempt))
            logger.warning("Retry %d/%d after error: %s", attempt + 1, max_retries, e)
```

### Pattern 5: Graceful Shutdown with Signal Handling

```python
import signal
from agentflow.utils import GracefulShutdownManager

async def main():
    shutdown_manager = GracefulShutdownManager(shutdown_timeout=30.0)
    graph = build_graph().compile(shutdown_timeout=30.0)
    
    # Register signal handlers
    shutdown_manager.register_signal_handlers()
    
    try:
        # Protected initialization
        with shutdown_manager.protect_section():
            await initialize_resources()
        
        # Normal execution
        while not shutdown_manager.shutdown_requested:
            await graph.ainvoke(get_next_input())
            
    except KeyboardInterrupt:
        logger.info("Shutdown requested via SIGINT")
    finally:
        # Protected cleanup
        with shutdown_manager.protect_section():
            await graph.aclose()
            shutdown_manager.unregister_signal_handlers()

if __name__ == "__main__":
    asyncio.run(main())
```

## Migration Guide

### Converting Sync to Async

If you're migrating from sync to async APIs:

1. **Change function signatures**:
   ```python
   # Before
   def my_node(state: AgentState) -> AgentState:
       ...
   
   # After  
   async def my_node(state: AgentState) -> AgentState:
       ...
   ```

2. **Use async APIs**:
   ```python
   # Before
   result = graph.invoke(input_data)
   
   # After
   result = await graph.ainvoke(input_data)
   ```

3. **Replace blocking calls**:
   ```python
   # Before
   import requests
   response = requests.get(url)
   
   # After
   import aiohttp
   async with aiohttp.ClientSession() as session:
       async with session.get(url) as response:
           data = await response.json()
   ```

4. **Update main entry point**:
   ```python
   # Before
   if __name__ == "__main__":
       main()
   
   # After
   if __name__ == "__main__":
       asyncio.run(main())
   ```

## Examples

### Full Async Application

```python
import asyncio
from agentflow import StateGraph, AgentState, Message
from agentflow.utils import GracefulShutdownManager

async def agent_node(state: AgentState) -> AgentState:
    """Process with async LLM call."""
    # Your async processing here
    return state

async def main():
    # Build graph
    graph = StateGraph()
    graph.add_node("agent", agent_node)
    graph.set_entry_point("agent")
    graph.add_edge("agent", "END")
    
    # Compile with shutdown configuration
    compiled = graph.compile(shutdown_timeout=30.0)
    
    # Setup graceful shutdown
    shutdown_manager = GracefulShutdownManager(shutdown_timeout=30.0)
    shutdown_manager.register_signal_handlers()
    
    try:
        # Process inputs
        result = await compiled.ainvoke({
            "messages": [Message.from_text("Hello")]
        })
        print(result)
    finally:
        # Graceful cleanup
        stats = await compiled.aclose()
        print(f"Shutdown stats: {stats}")
        shutdown_manager.unregister_signal_handlers()

if __name__ == "__main__":
    asyncio.run(main())
```

### Sync Application (Simple Scripts)

```python
from agentflow import StateGraph, AgentState, Message

def agent_node(state: AgentState) -> AgentState:
    """Simple sync node."""
    return state

def main():
    # Build and compile
    graph = StateGraph()
    graph.add_node("agent", agent_node)
    graph.set_entry_point("agent")
    graph.add_edge("agent", "END")
    compiled = graph.compile()
    
    # Execute
    result = compiled.invoke({
        "messages": [Message.from_text("Hello")]
    })
    print(result)

if __name__ == "__main__":
    main()
```

## Performance Considerations

1. **Async shines with I/O-bound workloads**: Network calls, database queries, file I/O
2. **CPU-bound work doesn't benefit from async**: Use multiprocessing for CPU-intensive tasks
3. **Context switching overhead**: For very simple, fast operations, sync might be faster
4. **Memory usage**: Async applications generally use less memory for concurrent operations than threads

## Debugging Tips

1. **Enable asyncio debug mode**:
   ```python
   asyncio.run(main(), debug=True)
   ```

2. **Use logging to track async flow**:
   ```python
   logging.basicConfig(level=logging.DEBUG)
   ```

3. **Watch for unawaited coroutines**: Enable warnings
   ```python
   import warnings
   warnings.simplefilter('always', ResourceWarning)
   ```

## References

- [Python asyncio documentation](https://docs.python.org/3/library/asyncio.html)
- [Real Python: Async IO in Python](https://realpython.com/async-io-python/)
- [Graceful Shutdown Best Practices](https://github.com/wbenny/python-graceful-shutdown)
- [Python asyncio best practices](https://discuss.python.org/t/asyncio-best-practices/12576)
