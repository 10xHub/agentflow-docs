---
title: "Graceful Shutdown"
sidebar_label: "Graceful Shutdown"
description: "Build a long-running AgentFlow service that handles SIGINT and SIGTERM cleanly, protects initialization and cleanup, and closes graph resources safely."
---

# Graceful Shutdown

**Source example:** `agentflow/examples/graceful_shutdown/graceful_shutdown_example.py`

## What you will build

A long-running asyncio service that:

- handles `SIGINT` and `SIGTERM`
- keeps initialization and cleanup protected from interruption
- processes work in a loop until shutdown is requested
- closes graph resources with `app.aclose()` and logs shutdown statistics

This pattern is important for real services, workers, and containerized deployments.

## Why graceful shutdown matters

Without a shutdown strategy, a process can stop in the middle of:

- tool execution
- background work
- state persistence
- resource cleanup

That can leave your system in a partially updated state.

The example shows how to avoid that.

## Shutdown architecture

```mermaid
flowchart TD
    A[Process start] --> B[Protected initialization]
    B --> C[Register SIGINT/SIGTERM handlers]
    C --> D[Main processing loop]
    D -->|signal received| E[shutdown_requested = True]
    E --> F[Exit loop]
    F --> G[Protected cleanup]
    G --> H[app.aclose()]
    H --> I[Log shutdown statistics]
```

## Step 1 - Create a realistic graph

The example uses a normal ReAct pattern rather than a fake no-op loop.

It defines three tools:

- `get_current_time`
- `get_system_status`
- `calculate`

Then it builds:

- a `ToolNode`
- a main `Agent`
- a conditional route back to the tool node when tool calls are present

That makes the example valuable because the shutdown logic is tested around a graph that really does work.

## Step 2 - Create a `GracefulShutdownManager`

Inside `long_running_service()` the example sets:

```python
SHUTDOWN_TIMEOUT = 30.0
shutdown_manager = GracefulShutdownManager(shutdown_timeout=SHUTDOWN_TIMEOUT)
```

Then it compiles the graph with the same timeout:

```python
graph = build_graph().compile(shutdown_timeout=SHUTDOWN_TIMEOUT)
```

This matters because the compiled graph can use that timeout when draining internal resources during shutdown.

## Step 3 - Register signal handlers

The service explicitly registers handlers for `SIGINT` and `SIGTERM`:

```python
shutdown_manager.register_signal_handlers()
```

Once that is in place:

- pressing `Ctrl+C` sends `SIGINT`
- container orchestrators usually send `SIGTERM`
- the manager flips `shutdown_requested` to `True`

That gives the main loop a clean signal to stop accepting new work.

## Signal handling flow

```mermaid
sequenceDiagram
    participant OS as OS / container runtime
    participant Manager as GracefulShutdownManager
    participant Loop as Main loop
    participant Graph as Compiled graph

    OS->>Manager: SIGINT or SIGTERM
    Manager->>Manager: shutdown_requested = True
    Loop->>Loop: stop starting new tasks
    Loop-->>Graph: exit service loop
    Graph->>Graph: aclose()
```

## Step 4 - Protect initialization and cleanup

One of the best parts of this example is the use of `protect_section()`:

```python
with shutdown_manager.protect_section():
    await asyncio.sleep(2)
    logger.info("Initialization complete")
```

The same pattern is used during cleanup:

```python
with shutdown_manager.protect_section():
    stats = await graph.aclose()
    shutdown_manager.unregister_signal_handlers()
```

This protection is built on delayed interrupt handling. In practice, it means:

- signals are noticed
- interruption is deferred briefly
- critical startup or teardown code gets a chance to finish safely

Use it sparingly, but definitely use it around the most sensitive phases.

## Step 5 - Stop the loop without dropping work abruptly

The main processing loop looks roughly like this:

```python
while not shutdown_manager.shutdown_requested:
    ...
    result = await graph.ainvoke(...)
    ...
```

That pattern is simple and dependable. The loop keeps running until a shutdown request is raised, then it stops taking on new work and falls into cleanup.

A few other practical touches in the example are worth copying:

- it catches exceptions per task so one bad task does not crash the process
- it logs task progress clearly
- it catches `KeyboardInterrupt` at the top level as a final safeguard

## Step 6 - Close the graph and inspect stats

The cleanup section calls:

```python
stats = await graph.aclose()
```

Then it logs areas such as:

- total duration
- background task information
- checkpointer stats
- publisher stats
- store stats

This is the key production lesson: shutdown is not just about stopping. It is also about learning whether the stop was clean.

## Cleanup lifecycle

```mermaid
flowchart LR
    A[Shutdown requested] --> B[Exit main loop]
    B --> C[Protected cleanup section]
    C --> D[app.aclose()]
    D --> E[drain background tasks]
    D --> F[close persistence resources]
    D --> G[return shutdown stats]
    G --> H[log results]
```

## Run the example

```bash
python agentflow/examples/graceful_shutdown/graceful_shutdown_example.py
```

Then press `Ctrl+C` while it is running.

What you should see:

- the process logs normal task execution
- `Ctrl+C` triggers graceful shutdown instead of an abrupt crash
- cleanup begins
- shutdown stats are logged
- the application exits cleanly

## Production takeaways

This example maps well to:

- API worker processes
- background job runners
- long-lived CLI daemons
- containerized services in Kubernetes or Docker

A healthy shutdown design usually includes all four of these ideas:

1. stop accepting new work
2. finish or cancel work intentionally
3. close resources explicitly
4. log enough detail to debug bad shutdowns later

## Common mistakes

- Relying on `KeyboardInterrupt` alone and ignoring `SIGTERM`.
- Doing cleanup in `finally` without protecting that section from interruption.
- Never calling `app.aclose()`, which can leave background tasks or stores hanging.
- Starting new work after a shutdown signal has already been received.

## Related docs

- [Background Task Manager](/docs/reference/python/background-tasks)
- [Production Runtime](/docs/concepts/production-runtime)
- [Run Background Tasks](/docs/how-to/python/run-background-tasks)

## What you learned

- How to use `GracefulShutdownManager` to coordinate process shutdown.
- Why protected initialization and protected cleanup matter.
- How `app.aclose()` fits into a safe shutdown lifecycle for long-running AgentFlow services.

## Next step

→ Pair this with the production and troubleshooting docs in later sprints when you document deployment-specific shutdown behavior.
