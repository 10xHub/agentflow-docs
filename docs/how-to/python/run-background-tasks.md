---
title: Run work in the background
description: How to fire-and-forget async tasks from inside a node without blocking the graph using BackgroundTaskManager.
---

# Run work in the background

Some operations — sending notifications, writing to a slow store, triggering webhooks — should not block the agent's response. Use `BackgroundTaskManager` to launch these tasks asynchronously from inside any node function.

## Prerequisites

You have a working graph. `BackgroundTaskManager` is automatically available in every node via dependency injection.

## Quick start

Declare `task_manager: BackgroundTaskManager` as a parameter in your node function. The framework injects it automatically at runtime.

```python
import asyncio
from agentflow.core import StateGraph
from agentflow.core.state import AgentState, Message
from agentflow.utils import END
from agentflow.utils.background_task_manager import BackgroundTaskManager


async def send_notification(user_id: str, text: str) -> None:
    """Simulate sending a push notification (slow I/O)."""
    await asyncio.sleep(0.5)
    print(f"Notification sent to {user_id}: {text}")


async def my_node(
    state: AgentState,
    config: dict,
    task_manager: BackgroundTaskManager,   # auto-injected
) -> AgentState:
    # Do main work and return immediately
    reply = Message.text_message("Your report is being processed in the background.")
    state.context.append(reply)

    # Fire-and-forget: doesn't block the response
    task_manager.create_task(
        send_notification(config.get("user_id", "anon"), "Report ready soon"),
        name="send_notification",
        timeout=10.0,
    )

    return state


graph = StateGraph()
graph.add_node("MAIN", my_node)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

app = graph.compile()
```

The graph returns the response to the caller immediately. `send_notification` continues running in the background and completes up to 10 seconds later.

## Set a timeout

Always set a `timeout` for tasks that do I/O. Without one, a hanging task could leak until process shutdown.

```python
task_manager.create_task(
    upload_to_s3(data),
    name="s3_upload",
    timeout=30.0,          # cancel after 30 s
    context={"run_id": config.get("run_id")},   # logged on errors
)
```

If the task exceeds `timeout`, it is cancelled and a warning is logged.

## Track task status

```python
# How many tasks are still running?
count = task_manager.get_task_count()

# Detailed information for all active tasks
for info in task_manager.get_task_info():
    print(info["name"], info["age_seconds"], info["done"])
```

## Wait for all tasks before shutdown

If you need to drain the queue before the process exits:

```python
await task_manager.wait_for_all(timeout=30.0)
```

Or cancel everything immediately:

```python
await task_manager.cancel_all()
```

## Graceful shutdown integration

The `StateGraph` automatically shuts down `BackgroundTaskManager` when you call `app.aclose()` or `app.stop()`. The `shutdown_timeout` parameter on `compile()` controls how long to wait for background tasks to drain:

```python
app = graph.compile(shutdown_timeout=30.0)

# Later, during process teardown:
await app.aclose()   # waits up to 30 s for background tasks
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `task_manager` parameter is `None` | The graph wasn't compiled yet when the node ran. | Ensure the node is inside a compiled graph. |
| Task silently never runs | Coroutine was passed but never awaited inside (double-nesting). | Pass a coroutine object, not a coroutine function: `create_task(send(...))` not `create_task(send)`. |
| Background tasks outlive the graph | `aclose()` / `stop()` not called on shutdown. | Always call `await app.aclose()` when your process exits. |
| Timeout warnings in logs | `timeout` not set, task takes too long. | Add `timeout=` to `create_task()`. |
