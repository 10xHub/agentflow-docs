# Run work in the background

> Launch fire-and-forget async tasks from a node without blocking the response using BackgroundTaskManager.

Source: https://10xgraph.com/docs/guides/run-background-tasks
Last updated: 2026-10-08

Some operations should not block the agent's response. Sending notifications, writing to a slow store, triggering webhooks, or updating a database are good candidates to run in the background. `BackgroundTaskManager` launches these tasks asynchronously from inside any node function, returning control to the caller immediately.

## When to use background tasks

Background tasks are ideal for fire-and-forget operations that do not affect the current response:

- Sending notifications (email, SMS, push notifications) after a successful action
- Logging to external systems or audit trails
- Triggering webhooks for downstream subscribers
- Uploading large files to storage (S3, GCS, etc.)
- Writing to a slow or non-critical database
- Cleanup or maintenance tasks (clearing old files, archiving data)
- Metrics and analytics reporting

The key characteristic: the user or the next graph step does not need to wait for the task to finish.

## When NOT to use background tasks

Do not use background tasks when:

- The result is needed by the current response or later steps in the graph
- The operation affects data the agent depends on (e.g., updating a vector store the agent queries)
- You need to know if the task succeeded before proceeding
- The operation is critical and failure should block the entire flow

In these cases, process the work synchronously in your node before returning state.

## Prerequisites

You have a working graph. The `tenxgraph` package is installed. `BackgroundTaskManager` is automatically available in every node via dependency injection; no extra configuration is needed.

## Quick start

Declare `task_manager: BackgroundTaskManager` as a parameter in your node function, annotated with `Inject` to signal dependency injection. The framework injects it automatically at runtime.

```python
import asyncio
from tenxgraph.core import StateGraph
from tenxgraph.core.state import AgentState, Message
from tenxgraph.utils import END
from tenxgraph.utils.background_task_manager import BackgroundTaskManager
from injectq import Inject

async def send_notification(user_id: str, text: str) -> None:
    """Simulate sending a push notification (slow I/O)."""
    await asyncio.sleep(0.5)
    print(f"Notification sent to {user_id}: {text}")

async def my_node(
    state: AgentState,
    config: dict,
    task_manager: Inject[BackgroundTaskManager],
) -> AgentState:
    # Do main work and return immediately
    reply = Message.text_message("Your report is being processed in the background.")
    state.messages.append(reply)

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

The graph returns the response to the caller immediately. The `send_notification` coroutine continues running in the background and completes up to 10 seconds later.

## Verify it worked

Run the graph and observe the output:

```bash
python -m asyncio << 'EOF'
import asyncio
from my_agent import app  # import your compiled graph

result = await app.ainvoke({"messages": []}, config={"user_id": "alice"})
# Output appears immediately:
# Your report is being processed in the background.

# Background task may still print after the response:
# Notification sent to alice: Report ready soon
EOF
```

The key indicator: the graph returns and delivers the response *before* the background task prints its output.

## Set a timeout

Always set a `timeout` for tasks that do I/O. Without one, a hanging task could leak resources until process shutdown. Timeouts protect against slow or unresponsive external services.

```python
task_manager.create_task(
    upload_to_s3(data),
    name="s3_upload",
    timeout=30.0,          # cancel after 30 seconds
    context={"run_id": config.get("run_id")},  # context for error logs
)
```

If the task exceeds `timeout`, it is cancelled and a warning is logged. The cancellation does not affect the graph or the response; it is handled gracefully.

## Track task status

Query the task manager to monitor running tasks:

```python
# How many tasks are still running?
count = task_manager.get_task_count()

# Detailed information for all active tasks
for info in task_manager.get_task_info():
    print(f"Task: {info['name']}")
    print(f"  Age: {info['age_seconds']:.1f}s")
    print(f"  Timeout: {info['timeout']}s")
    print(f"  Done: {info['done']}")
    print(f"  Cancelled: {info['cancelled']}")
```

This is useful for monitoring, debugging, and understanding load on background task execution.

## Wait for all tasks before shutdown

If you need to drain the queue before the process exits, call `wait_for_all`:

```python
await task_manager.wait_for_all(timeout=30.0)
```

This waits up to 30 seconds for all outstanding tasks to complete. If they do not complete in time, a warning is logged but no exception is raised.

To cancel everything immediately without waiting:

```python
await task_manager.cancel_all()
```

Use `cancel_all` when shutting down urgently, or `wait_for_all` when graceful draining is preferred.

## Graceful shutdown integration

The `StateGraph` automatically manages background task shutdown when the compiled graph is closed. The `shutdown_timeout` parameter on `compile()` controls how long to wait:

```python
app = graph.compile(shutdown_timeout=30.0)

# Later, during process teardown:
await app.aclose()   # waits up to 30 seconds for background tasks to complete
```

When `aclose()` is called, the framework initiates graceful shutdown: it cancels remaining tasks and waits for them to finish within the timeout window. Any unfinished tasks are force-cancelled, and their errors are logged.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `task_manager` is `None` | Not injected or node outside compiled graph. | Ensure the parameter is typed `Inject[BackgroundTaskManager]` and the node is inside a compiled graph. |
| Task silently never runs | Coroutine function passed instead of coroutine object. | Pass the result of calling the function: `create_task(send_notification(...))` not `create_task(send_notification)`. |
| Background tasks outlive the graph | Process exited without calling `aclose()`. | Always call `await app.aclose()` in your shutdown handler. |
| Timeout warnings in logs | Task takes longer than the `timeout`. | Increase the timeout value if the external service is expected to be slow, or investigate why the service is slow. |
| Task dropped, queue full | More than 1000 tasks queued (backpressure). | Reduce the rate at which you create background tasks, or handle backpressure upstream. |

## Related pages

- [Stream a graph](/docs/guides/stream-graph) to understand real-time streaming, an alternative when you need incremental updates.
- [Graceful shutdown](/docs/guides/graceful-shutdown) for production-grade shutdown patterns.
- [Dependency injection](/docs/guides/use-dependency-injection) to learn about other injectable parameters available in nodes.
- [Production checklist](/docs/server/production-checklist) for shutdown timeout settings in production.

## Frequently asked questions

### When should I use background tasks instead of just returning from my node?

Use background tasks when the operation is not critical to the current response (e.g., notifications, webhooks, logging). If the operation's result is needed by the user or later in the graph, process it synchronously instead.

### How long will a background task run if I don't set a timeout?

Without a timeout, the task runs until completion or the process shuts down. Always set a timeout for I/O operations to prevent hanging tasks from leaking resources.

### What happens to background tasks when the graph shuts down?

The framework automatically drains background tasks during shutdown, waiting up to the `shutdown_timeout` (default 30 seconds). Unfinished tasks are cancelled, and their errors are logged.
