---
title: Context, IDs, and Background Tasks
description: How AgentFlow trims model context, generates IDs, and manages background work.
sidebar_position: 14
---

# Context, IDs, and background tasks

This concept covers three runtime utilities that support larger graph systems:

- Context managers shape what history is sent to the model.
- ID generators control generated identifiers.
- Background task and shutdown utilities keep async side work under control.

## Context managers

`MessageContextManager` controls the message history sent to the model without deleting persisted checkpointer history.

Use it for token budget control, trimming old messages, preserving important system or tool messages, and custom context policies.

```python
from agentflow.core import StateGraph
from agentflow.core.state import MessageContextManager

graph = StateGraph(
    context_manager=MessageContextManager(max_messages=20),
)
```

Context management changes model input, not the durable thread state stored by a checkpointer.

## ID generators

ID generators are passed to `StateGraph` when you need a specific ID style.

Common generators include:

| Generator | Use case |
|---|---|
| `DefaultIDGenerator` | Framework default. |
| `UUIDGenerator` | Globally unique string IDs. |
| `BigIntIDGenerator` | Large integer IDs. |
| `TimestampIDGenerator` | Time-based IDs. |
| `ShortIDGenerator` | Compact generated IDs. |

```python
from agentflow.core import StateGraph
from agentflow.utils import UUIDGenerator

graph = StateGraph(id_generator=UUIDGenerator())
```

Changing ID format can affect API and client assumptions, so verify serialized types when changing this in a public app.

## Background tasks

`BackgroundTaskManager` manages async side work such as non-blocking memory writes, cleanup, or telemetry.

Important operations include:

| Method | Purpose |
|---|---|
| `create_task` | Start and track a task. |
| `get_task_count` | Inspect active tasks. |
| `wait_for_all` | Wait for tracked tasks to finish. |
| `cancel_all` | Cancel tracked tasks. |
| `shutdown` | Stop the manager cleanly. |

Pair background tasks with graceful shutdown so streams, publishers, storage clients, and background writes can finish or cancel cleanly.

## Related docs

- [Context manager reference](/docs/reference/python/context-manager)
- [ID generator reference](/docs/reference/python/id-generator)
- [Background tasks reference](/docs/reference/python/background-tasks)
- [Graceful shutdown tutorial](/docs/tutorials/from-examples/graceful-shutdown)
