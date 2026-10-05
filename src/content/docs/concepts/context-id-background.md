---
title: Context, IDs, and Background Tasks
description: How 10xGraph trims model context with MessageContextManager, generates thread and run IDs, and tracks background tasks with BackgroundTaskManager.
section: Concepts
group: In depth
order: 330
updated: "2026-07-21"
---

Three small runtime pieces sit under every graph: a context manager that trims the history sent to the model, an ID generator that names threads and runs, and a `BackgroundTaskManager` that tracks fire-and-forget async work. None of them changes your graph logic, but each one decides how a long-running production service behaves under load.

## Context managers

`MessageContextManager` trims the message list sent to the model. It does not delete anything from the checkpointer, so the full thread stays durable while the model sees a window.

- `max_messages` (default 10) counts **user** messages, not all messages.
- The first message, usually the system prompt, is always kept.
- `remove_tool_msgs=True` also drops assistant tool-call messages and tool results from the window.

```python
from agentflow.core import StateGraph
from agentflow.core.state import MessageContextManager

graph = StateGraph(
    context_manager=MessageContextManager(max_messages=20, remove_tool_msgs=True),
)
```

Why it matters in production: an unbounded history grows token cost and latency on every turn until the model's window overflows. Trimming keeps cost per turn bounded. The trade-off is that the model forgets what fell out of the window, so put durable facts in state or the memory store, not only in old messages.

## ID generators

When a caller does not supply `thread_id` or `run_id`, the compiled graph takes one from the bound `generated_id` factory, falling back to a UUID4. You choose the factory with the `id_generator` argument of `StateGraph(...)`.

| Generator | Output |
|---|---|
| `DefaultIDGenerator` | Empty string, so the framework substitutes a UUID. |
| `UUIDGenerator` | UUID4 strings. |
| `IntIDGenerator` | 32-bit random integers. |
| `BigIntIDGenerator` | Large integers. |
| `HexIDGenerator` | Hex strings. |
| `TimestampIDGenerator` | Time-based IDs. |
| `ShortIDGenerator` | Compact strings. |

Custom generators subclass `BaseIDGenerator` and implement `id_type` and `generate`.

```python
from agentflow.core import StateGraph
from agentflow.utils import UUIDGenerator

graph = StateGraph(id_generator=UUIDGenerator())
```

## Background tasks

`BackgroundTaskManager` runs coroutines that must not block a response, such as a receipt email after `refund_order`. The graph binds one instance into the container, so a node can receive it with `Inject`.

```python
from agentflow.core.state import AgentState
from agentflow.utils import BackgroundTaskManager
from injectq import Inject

async def send_refund_receipt(order_id: str) -> None:
    ...  # slow I/O, for example an email API call

async def notify_node(
    state: AgentState,
    config: dict,
    task_manager: BackgroundTaskManager = Inject[BackgroundTaskManager],
) -> AgentState:
    task_manager.create_task(
        send_refund_receipt("ord_1042"),
        name="refund_receipt",
        timeout=10.0,
        context={"thread_id": config.get("thread_id")},
    )
    return state
```

`create_task` returns the `asyncio.Task`, or `None` if it was dropped. Other members: `get_task_count()`, `get_task_info()`, `pending_count`, `dropped_count`, `wait_for_all(timeout=...)`, `cancel_all()` and `shutdown(timeout=...)`.

## Pitfalls

- **Backpressure drops tasks.** The manager caps in-flight tasks at 1000 by default (`max_pending_tasks`). Beyond that, new tasks are dropped, counted in `dropped_count`, and a warning is logged at most every 5 seconds. Do not use it for work you cannot lose.
- **Shutdown cancels first.** `shutdown()` cancels all tasks, then waits up to the timeout. `app.aclose()` calls it with the `shutdown_timeout` given to `compile()` (default 30 seconds). To let tasks finish, `await task_manager.wait_for_all(timeout=...)` before closing.
- **Always set `timeout`.** A task without one can hang until shutdown.
- **Pass a coroutine object.** Write `create_task(send(...))`, not `create_task(send)`.
- **Changing the ID format affects clients.** Integer IDs serialize differently from strings, so check your API consumers before switching.

## Related docs

- [Run work in the background](/docs/how-to/python/run-background-tasks)
- [Background tasks reference](/docs/reference/python/background-tasks)
- [Use a context manager](/docs/how-to/python/use-context-manager)
- [Configure an ID generator](/docs/how-to/python/configure-id-generator)
- [Context manager reference](/docs/reference/python/context-manager)
- [ID generator reference](/docs/reference/python/id-generator)
- [Graceful shutdown tutorial](/docs/tutorials/from-examples/graceful-shutdown)
