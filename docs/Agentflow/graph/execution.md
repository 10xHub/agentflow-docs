# Execution & Streaming Runtime

Once a `StateGraph` is compiled into a `CompiledGraph`, you gain a uniform API for synchronous, asynchronous, and
streaming execution plus lifecycle management (stop, resume, background tasks, persistence, publishing).

---

## Entry Points

| Method | Mode | Use Case |
|--------|------|----------|
| `invoke(input, config, granularity)` | Sync blocking | CLI scripts, tests, small batch tasks |
| `ainvoke(input, config, granularity)` | Async | Web handlers, async services |
| `stream(input, config, granularity)` | Sync generator | Progressive output in non-async contexts |
| `astream(input, config, granularity)` | Async generator | Live UIs, websockets, server-sent events |

All methods accept `input_data` containing an initial `messages` list for new runs and optional additional payload keys.

---

## Response Granularity

`ResponseGranularity` controls output detail:

| Level | Contents |
|-------|----------|
| LOW | Final messages only |
| PARTIAL | Messages + context summary + core metadata |
| FULL | Entire final state (all fields), messages |

Choose LOW for chat responses, FULL for debugging or persistence workflows.

---

## Streaming Semantics

When a node returns a `ModelResponseConverter` (e.g. LiteLLM wrapper) in streaming mode:

1. Interim partial messages with `delta=True` emitted
2. Tool call deltas surface early so UI can reflect pending tool execution
3. Final aggregated message (same logical turn) emitted with `delta=False`

Applications should accumulate content from deltas keyed by `message_id` or display incrementally.

---

## Background Tasks

The `BackgroundTaskManager` (in DI) can schedule async functions that should not block the main reasoning loop—e.g.
telemetry flush, vector store indexing, summarisation.

Pattern:

```python
from injectq import Inject
from agentflow.utils.background_task_manager import BackgroundTaskManager


async def summarizer(state): ...


async def node(state, config, tasks: BackgroundTaskManager = Inject[BackgroundTaskManager]):
    tasks.create_task(summarizer(state))
    return state
```

Ensure background tasks are idempotent or reference stable state snapshots to avoid race conditions.

---

## Stop & Interrupt Control

Agentflow provides flexible execution control for human-in-the-loop workflows:

| Mechanism | When Applied | Purpose | Response Time |
|-----------|--------------|---------|---------------|
| `stop(config)` / `astop(config)` | Runtime | Politely request current thread halt | Next node boundary |
| `interrupt_before=[..]` | Compile time | Force pause before specific nodes | Immediate (before node execution) |
| `interrupt_after=[..]` | Compile time | Force pause after specific nodes | Immediate (after node completion) |

### Execution State During Interrupts

The `AgentState.execution_meta` tracks pause/resume state:

```python
from agentflow.state import ExecutionStatus

# Check interrupt status
if state.execution_meta.is_interrupted():
    print(f"Status: {state.execution_meta.status}")  # INTERRUPTED_BEFORE or INTERRUPTED_AFTER
    print(f"Node: {state.execution_meta.interrupted_node}")
    print(f"Reason: {state.execution_meta.interrupt_reason}")

# Resume execution
state.clear_interrupt()  # Usually handled automatically during invoke/ainvoke
```

### Resume Behavior

An interrupted run resumes with the same `thread_id`:

1. **Checkpointer** restores saved state and execution metadata
2. **Input data** merged with existing context (additive, not replacement)
3. **Execution continues** from the interruption point
4. **Interrupt flags** automatically cleared

### Integration with Streaming

Interrupts work seamlessly with streaming execution:

```python
# Streaming with interrupt handling
config = {"thread_id": "interactive-session"}

async for chunk in app.astream(input_data, config=config):
    if chunk.event_type == "interrupted":
        print(f"⏸️ Paused: {chunk.metadata.get('status')}")

        # Handle interrupt (e.g., get user approval)
        approval = await get_user_approval()

        if approval:
            # Resume streaming
            async for resume_chunk in app.astream({
                "messages": [Message.text_message("User approved")]
            }, config=config):
                print(f"▶️ {resume_chunk.content}")
        else:
            await app.astop(config)  # Cancel execution
            break
    else:
        print(f"📤 {chunk.content}")
```

**Key Implementation Notes:**
- Interrupts require a **checkpointer** for state persistence
- **Thread IDs** must be consistent between pause and resume
- **Stop requests** are checked at node boundaries (not mid-node)
- **Event publishers** emit `INTERRUPTED` event types for monitoring

For comprehensive interrupt strategies, approval workflows, and debugging patterns, see **[Human-in-the-Loop & Interrupts](human-in-the-loop.md)**.

---

## Checkpointing & Persistence

If a checkpointer is supplied during compile, each step can persist state (strategy depends on implementation: in-memory,
Postgres/Redis, etc.). This enables:

- Resumable conversations
- Auditing / replay
- External analytics enrichment

For high-frequency streaming, you may checkpoint only on node completion (implementation detail of specific checkpointer).

---

## Event Publishing

A `BasePublisher` implementation receives structured events (start, node_enter, node_exit, message_delta, error, complete).
Use publishers to drive:

- Live dashboards
- Audit logs
- Metrics pipelines

Chain with callbacks (DI: `CallbackManager`) for custom instrumentation or tracing.

---

## Execution Metadata

`AgentState.execution_meta` tracks:

| Field | Meaning |
|-------|---------|
| `current_node` | Node about to run or just completed (depending on phase) |
| `step` | Incrementing counter (used for recursion limit enforcement) |
| `status` | Running / Completed / Error / Interrupted |
| `error` | Error detail if failed |
| `interrupted` flags | Pause control for manual resume |

Nodes should not mutate internals directly; use helper methods (`advance_step()`, `set_current_node()`).

---

## Error Handling

Uncaught node exceptions propagate; publisher emits error event; state marked errored. Strategies:

- Wrap fragile IO in retries
- Convert recoverable faults to messages and continue
- Use `Command(goto=...)` for fallback branches

---

## Performance Considerations

| Concern | Guidance |
|---------|----------|
| Large context growth | Summarize into `context_summary` periodically |
| Tool latency | Parallelize independent tools (future enhancement) or cache by args |
| Excessive checkpoint writes | Batch or checkpoint every N steps/config flag |
| High token cost | Trim old messages or use memory store integration |

---

## Minimal Execution Example

```python
res = app.invoke({"messages": [Message.text_message("Hello")]}, config={"thread_id": "t1"})
for msg in res["messages"]:
    print(msg.text())
```

Streaming variant:

```python
for chunk in app.stream({"messages": [Message.text_message("Explain quantum dots")]}, config={"thread_id": "t2"}):
    if chunk.delta:
        print(chunk.text(), end="", flush=True)
```

---

Next: Advanced Patterns (`advanced.md`).
