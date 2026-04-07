# Background Task Manager

## Overview

The `BackgroundTaskManager` is a core component in Agentflow that handles asynchronous background tasks throughout the agent execution lifecycle. It ensures proper task tracking, error logging, and graceful cleanup during shutdown.

The `BackgroundTaskManager` is automatically created and registered in the dependency injection container (`InjectQ`) when you create a `StateGraph`, making it available to all nodes and utilities that need to spawn background work.

## Key Features

- **Automatic task tracking**: All background tasks are registered and monitored
- **Error logging**: Exceptions in background tasks are caught and logged without crashing the main flow
- **Timeout support**: Set per-task timeouts to prevent runaway operations
- **Graceful shutdown**: Cancel and wait for all tasks during application cleanup
- **Metadata tracking**: Track task names, creation time, context for debugging
- **Async context manager**: Use `async with` for automatic cleanup

## How It Works

When a `StateGraph` is initialized:

1. A `BackgroundTaskManager` instance is created
2. It's bound to the InjectQ dependency injection container
3. Any function that needs to create background tasks can inject it
4. During shutdown, the manager ensures all tasks are properly cleaned up

### Example: Event Publishing

The most common use case in Agentflow is event publishing. The `publish_event` function uses `BackgroundTaskManager` to publish events without blocking node execution:

```python
from injectq import Inject
from agentflow.publisher.events import EventModel
from agentflow.publisher.base_publisher import BasePublisher
from agentflow.utils.background_task_manager import BackgroundTaskManager


async def _publish_event_task(
    event: EventModel,
    publisher: BasePublisher | None,
) -> None:
    """Publish an event asynchronously."""
    if publisher:
        try:
            await publisher.publish(event)
        except Exception as e:
            logger.error("Failed to publish event: %s", e)


def publish_event(
    event: EventModel,
    publisher: BasePublisher | None = Inject[BasePublisher],
    task_manager: BackgroundTaskManager = Inject[BackgroundTaskManager],
) -> None:
    """Publish an event in the background without blocking."""
    # Create background task with name and context for observability
    task_manager.create_task(
        _publish_event_task(event, publisher),
        name="publish_event",
        context={
            "event": event.event,
            "thread_id": event.thread_id,
        }
    )
```

This pattern ensures that:
- Event publishing doesn't block agent execution
- Failed publishes are logged but don't crash the agent
- Tasks are tracked and cleaned up during shutdown

## Using BackgroundTaskManager

### Basic Usage with Dependency Injection

The recommended way to use `BackgroundTaskManager` is through dependency injection:

```python
from injectq import Inject
from agentflow.utils.background_task_manager import BackgroundTaskManager
from agentflow.state import AgentState


async def my_background_work(data: str):
    """Some async work that runs in the background."""
    await asyncio.sleep(2)
    print(f"Processed: {data}")


async def my_node(
    state: AgentState,
    config: dict,
    task_manager: BackgroundTaskManager = Inject[BackgroundTaskManager],
):
    """Node that spawns background work."""
    # Spawn a background task
    task_manager.create_task(
        my_background_work(state.data.get("input", "")),
        name="process_data",
        context={"thread_id": config.get("thread_id")}
    )
    
    # Return immediately without waiting
    return state
```

### Creating Tasks with Metadata

Provide meaningful names and context to make debugging easier:

```python
task_manager.create_task(
    send_notification(user_id, message),
    name="send_notification",
    timeout=10.0,  # Auto-cancel after 10 seconds
    context={
        "user_id": user_id,
        "notification_type": "email",
        "thread_id": config["thread_id"],
    }
)
```

### Standalone Usage (Advanced)

If you need a `BackgroundTaskManager` outside of a graph context:

```python
import asyncio
from agentflow.utils.background_task_manager import BackgroundTaskManager


async def main():
    # Create manager with 30-second shutdown timeout
    manager = BackgroundTaskManager(default_shutdown_timeout=30.0)
    
    # Create some background tasks
    manager.create_task(
        fetch_data_async("https://api.example.com"),
        name="fetch_api_data",
        timeout=5.0
    )
    
    # Do other work...
    await asyncio.sleep(1)
    
    # Gracefully shutdown and wait for tasks
    stats = await manager.shutdown()
    print(f"Shutdown stats: {stats}")


asyncio.run(main())
```

### Using as Context Manager

For automatic cleanup:

```python
async def process_batch():
    async with BackgroundTaskManager() as manager:
        for item in batch:
            manager.create_task(
                process_item(item),
                name=f"process_{item.id}"
            )
        # Do other work...
        await asyncio.sleep(2)
    # All tasks automatically cleaned up when exiting context
```

## Task Lifecycle

### 1. Task Creation

```python
task = task_manager.create_task(
    my_coroutine(),
    name="my_task",
    timeout=30.0,
    context={"user": "alice"}
)
```

When a task is created:
- It's added to the internal tracking set
- Metadata (name, creation time, timeout, context) is recorded
- A done callback is registered for cleanup
- If timeout is set, an automatic cancellation is scheduled

### 2. Task Execution

The task runs in the background:
- Normal completion → logged at DEBUG level
- Exception → logged at ERROR level with full traceback
- Cancellation → logged at DEBUG level
- Timeout → logged at WARNING level, task is cancelled

### 3. Task Completion

When a task completes (success, error, or cancellation):
- It's removed from the tracking set
- Metadata is cleaned up
- Metrics are updated (if enabled)
- Done callback logs the outcome

### 4. Shutdown

During graceful shutdown:
```python
stats = await manager.shutdown(timeout=30.0)
```

The manager:
1. Cancels all active tasks
2. Waits up to `timeout` seconds for tasks to finish
3. Force-cancels any remaining tasks after timeout
4. Returns shutdown statistics

## Monitoring and Debugging

### Get Active Task Count

```python
active_count = task_manager.get_task_count()
print(f"Currently running {active_count} background tasks")
```

### Get Detailed Task Information

```python
task_info = task_manager.get_task_info()
for task in task_info:
    print(f"Task: {task['name']}")
    print(f"  Age: {task['age_seconds']:.2f}s")
    print(f"  Timeout: {task['timeout']}s")
    print(f"  Context: {task['context']}")
    print(f"  Done: {task['done']}")
```

### Manually Cancel All Tasks

```python
# Cancel all background tasks immediately
await task_manager.cancel_all()
```

### Wait for All Tasks

```python
# Wait for all tasks to complete (with timeout)
await task_manager.wait_for_all(timeout=60.0)
```

## Integration with StateGraph

The `BackgroundTaskManager` is automatically integrated into every `StateGraph`:

```python
from agentflow.graph import StateGraph

# Create a graph
graph = StateGraph()
# ... add nodes and edges ...

# Compile the graph
app = graph.compile(shutdown_timeout=30.0)

# The graph's BackgroundTaskManager is now registered in InjectQ
# All nodes can inject it via: task_manager: BackgroundTaskManager = Inject[BackgroundTaskManager]

# During shutdown, the manager is cleaned up
stats = await app.aclose()
print(stats["background_tasks"])
# {
#   "status": "completed",
#   "initial_tasks": 5,
#   "completed_tasks": 5,
#   "remaining_tasks": 0,
#   "duration_seconds": 2.3
# }
```

The `shutdown_timeout` you pass to `compile()` is used by the `BackgroundTaskManager` to determine how long to wait for tasks during shutdown.

## Shutdown Statistics

When you call `await app.aclose()` or `await manager.shutdown()`, you get detailed statistics:

```python
{
    "status": "completed",           # or "timeout" or "already_shutdown"
    "initial_tasks": 5,              # Number of tasks when shutdown started
    "completed_tasks": 5,            # Number that finished cleanly
    "remaining_tasks": 0,            # Number still running (if timeout)
    "duration_seconds": 2.3          # How long shutdown took
}
```

## Best Practices

### 1. Always Provide Meaningful Names

```python
# ✅ GOOD
task_manager.create_task(
    send_email(user),
    name="send_welcome_email"
)

# ❌ BAD
task_manager.create_task(send_email(user))  # Generic "background_task" name
```

### 2. Use Timeouts for External Calls

```python
# ✅ GOOD - Timeout prevents hanging forever
task_manager.create_task(
    fetch_external_api(),
    name="fetch_api",
    timeout=10.0
)

# ❌ RISKY - No timeout, could hang indefinitely
task_manager.create_task(
    fetch_external_api(),
    name="fetch_api"
)
```

### 3. Include Context for Debugging

```python
# ✅ GOOD - Context helps with debugging
task_manager.create_task(
    process_order(order_id),
    name="process_order",
    context={
        "order_id": order_id,
        "user_id": user_id,
        "thread_id": config["thread_id"]
    }
)
```

### 4. Don't Block on Background Tasks

```python
# ✅ GOOD - Fire and forget
task_manager.create_task(analytics_track(event))
return state

# ❌ BAD - Defeats the purpose of background tasks
task = task_manager.create_task(analytics_track(event))
await task  # Don't do this!
```

### 5. Handle Errors in the Coroutine

```python
# ✅ GOOD - Handle errors gracefully
async def robust_background_work():
    try:
        await do_something_risky()
    except Exception as e:
        logger.error("Background work failed: %s", e)
        # Optionally send to error tracking service
        await report_error(e)

task_manager.create_task(robust_background_work())
```

## Common Patterns

### Pattern 1: Non-Blocking Notifications

```python
async def my_node(
    state: AgentState,
    config: dict,
    task_manager: BackgroundTaskManager = Inject[BackgroundTaskManager],
):
    """Process data and send notification without blocking."""
    result = await process_data(state.data)
    
    # Send notification in background
    task_manager.create_task(
        send_notification(result),
        name="send_notification",
        timeout=5.0
    )
    
    # Return immediately
    state.data["result"] = result
    return state
```

### Pattern 2: Background Metrics Collection

```python
async def track_metrics(node_name: str, duration: float, config: dict):
    """Send metrics to external service."""
    try:
        await metrics_service.record({
            "node": node_name,
            "duration": duration,
            "thread_id": config.get("thread_id"),
            "timestamp": time.time()
        })
    except Exception as e:
        logger.warning("Failed to track metrics: %s", e)


async def my_node(
    state: AgentState,
    config: dict,
    task_manager: BackgroundTaskManager = Inject[BackgroundTaskManager],
):
    """Node that tracks its execution metrics."""
    start = time.time()
    
    # Do the actual work
    result = await process(state)
    
    # Track metrics in background
    duration = time.time() - start
    task_manager.create_task(
        track_metrics("my_node", duration, config),
        name="track_metrics",
        timeout=3.0
    )
    
    return result
```

### Pattern 3: Parallel Data Fetching

```python
async def fetch_all_data(task_manager: BackgroundTaskManager):
    """Fetch multiple data sources in parallel."""
    results = {}
    
    async def fetch_and_store(key: str, url: str):
        data = await fetch(url)
        results[key] = data
    
    # Create multiple background tasks
    task_manager.create_task(
        fetch_and_store("users", "https://api/users"),
        name="fetch_users",
        timeout=5.0
    )
    task_manager.create_task(
        fetch_and_store("products", "https://api/products"),
        name="fetch_products",
        timeout=5.0
    )
    
    # Wait a bit for results
    await asyncio.sleep(1)
    return results
```

## Troubleshooting

### Issue: Tasks Not Completing

**Symptom**: `shutdown()` times out with remaining tasks

**Solutions**:
1. Check for blocking operations (use async versions)
2. Increase shutdown timeout
3. Add timeouts to individual tasks
4. Check task info to see what's stuck:
   ```python
   info = task_manager.get_task_info()
   for task in info:
       if not task['done']:
           print(f"Stuck task: {task['name']}, age: {task['age_seconds']:.1f}s")
   ```

### Issue: Too Many Background Tasks

**Symptom**: High memory usage, slow shutdown

**Solutions**:
1. Check task count periodically:
   ```python
   count = task_manager.get_task_count()
   if count > 100:
       logger.warning("Too many background tasks: %d", count)
   ```
2. Use shorter timeouts
3. Consider if tasks should really be background (maybe they should be awaited)

### Issue: Missing Error Logs

**Symptom**: Background tasks failing silently

**Solution**: Tasks are logged at ERROR level. Ensure logging is configured:
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

## See Also

- [Graceful Shutdown](./graceful-shutdown.md) - Learn how BackgroundTaskManager integrates with shutdown
- [Publisher](./publisher.md) - Event publishing uses BackgroundTaskManager
- [Dependency Injection](./dependency-injection.md) - How to inject BackgroundTaskManager
- [Async Patterns](./async-patterns.md) - Best practices for async code
