---
title: Background Task Manager — AgentFlow Python AI Agents
sidebar_label: Background Task Manager
description: BackgroundTaskManager — launch and track asyncio tasks from node functions without blocking the graph response.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - background task manager
sidebar_position: 15
---


# Background Task Manager

## When to use this

Use `BackgroundTaskManager` when a node needs to do slow I/O (send a webhook, update a CRM, flush telemetry) without delaying the response to the caller. The graph returns immediately; the background task runs concurrently and is cleaned up on shutdown.

## Import path

```python
from agentflow.utils.background_task_manager import BackgroundTaskManager, TaskMetadata
# also available from the top-level package:
from agentflow.utils import BackgroundTaskManager
```

---

## Getting the instance in a node

`BackgroundTaskManager` is registered in the dependency container automatically by `StateGraph`. Declare it as a parameter and the framework injects it:

```python
from agentflow.utils.background_task_manager import BackgroundTaskManager

async def my_node(
    state,
    config: dict,
    task_manager: BackgroundTaskManager,  # auto-injected
) -> ...:
    task_manager.create_task(
        send_webhook(config.get("user_id")),
        name="send_webhook",
        timeout=15.0,
    )
    return state
```

---

## `BackgroundTaskManager`

### Constructor

```python
manager = BackgroundTaskManager(default_shutdown_timeout=30.0)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default_shutdown_timeout` | `float` | `30.0` | Seconds to wait when draining tasks during `shutdown()`. |

### `create_task`

```python
task = manager.create_task(
    coro,
    name="my_task",
    timeout=None,
    context=None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `coro` | `Coroutine` | required | The coroutine to execute in the background. |
| `name` | `str` | `"background_task"` | Human-readable label. Appears in logs and `get_task_info()`. |
| `timeout` | `float \| None` | `None` | Cancel the task after this many seconds. Logs a warning on timeout. |
| `context` | `dict \| None` | `None` | Extra key/value pairs attached to log entries and task info for debugging. |

Returns `asyncio.Task`.

### `get_task_count`

```python
n = manager.get_task_count()  # → int
```

Number of tasks that are still running.

### `get_task_info`

```python
infos = manager.get_task_info()  # → list[dict]
```

Each dict contains:

| Key | Type | Description |
|---|---|---|
| `name` | `str` | Task name. |
| `age_seconds` | `float` | Seconds since the task was created. |
| `timeout` | `float \| None` | Configured timeout. |
| `context` | `dict` | Context passed at creation. |
| `done` | `bool` | Whether the task has finished. |
| `cancelled` | `bool` | Whether the task was cancelled (only meaningful when `done=True`). |

### `wait_for_all`

```python
await manager.wait_for_all(timeout=30.0, return_exceptions=False)
```

Wait for all tracked tasks to complete. Logs a warning if `timeout` is exceeded.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `timeout` | `float \| None` | `None` | Max seconds to wait. `None` means wait forever. |
| `return_exceptions` | `bool` | `False` | If `True`, exceptions are returned as results rather than raised. |

### `cancel_all`

```python
await manager.cancel_all()
```

Cancel every tracked task immediately. Does not wait for cancellation to propagate.

### `shutdown`

```python
stats = await manager.shutdown(timeout=30.0)
```

Graceful shutdown: cancels all tasks, waits up to `timeout` seconds, then force-cancels any remaining. Returns a stats dict:

| Key | Type | Description |
|---|---|---|
| `status` | `str` | `"completed"` or `"timed_out"`. |
| `initial_tasks` | `int` | Number of tasks at shutdown start. |
| `completed_tasks` | `int` | Tasks that finished cleanly. |
| `remaining_tasks` | `int` | Tasks still alive after timeout. |
| `duration_seconds` | `float` | Total shutdown duration. |

---

## `TaskMetadata`

Dataclass holding per-task tracking info. Available via `get_task_info()`.

| Field | Type | Description |
|---|---|---|
| `name` | `str` | Task name. |
| `created_at` | `float` | Unix timestamp of creation. |
| `timeout` | `float \| None` | Configured timeout. |
| `context` | `dict \| None` | Extra context. |

---

## Lifecycle and shutdown

`BackgroundTaskManager` is created once per `StateGraph` during `__init__`. It is passed to `CompiledGraph` at `compile()`. When you call `app.aclose()`, the graph calls `task_manager.shutdown(timeout=shutdown_timeout)`, which drains or cancels any running background tasks before the process exits.

```python
app = graph.compile(shutdown_timeout=30.0)  # shutdown_timeout flows to BackgroundTaskManager

# In your process teardown:
await app.aclose()   # or await app.astop()
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Background task never starts | Coroutine function passed instead of coroutine object. | `create_task(send(x))` not `create_task(send)`. |
| `task_manager` is `None` in node | Node is not inside a compiled graph. | Ensure the node function runs inside a graph that was compiled. |
| Task silently fails, no log | Exception swallowed. | Check for `background_task_manager.tasks_failed` metric; errors are logged at `ERROR` level. |
| Tasks run after graph has conceptually "finished" | `aclose()` not called. | Always call `await app.aclose()` on process exit. |
