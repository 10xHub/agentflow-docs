---
title: Lifecycle Callbacks
description: GraphLifecycleHook, GraphLifecycleContext — hook into graph-level events (start, end, error, interrupt, resume, checkpoint, state update).
sidebar_position: 15
---

# Lifecycle Callbacks

## When to use this

Use lifecycle callbacks to:
- **Observe** graph execution at critical structural points (start, end, error, interrupt, resume, checkpoint, state update).
- **Modify** state at each lifecycle event before persistence or returning to the caller.
- **Perform side effects** like logging, metrics collection, notifications, or external system integration.
- **Implement human-in-the-loop workflows** with proper interrupt/resume coordination.
- **Enforce compliance and audit** policies at state persistence time.
- **Monitor and trace** entire graph executions with observability tools (OpenTelemetry, Datadog, Sentry).

Lifecycle callbacks operate at the **graph orchestration level** — they fire once per graph run (or once per node transition for `on_state_update`), not once per LLM/tool invocation. For finer-grained invocation-level hooks, see [Callback Manager](./callback-manager.md).

Pass a `GraphLifecycleHook` to `graph.compile(lifecycle_hook=...)` or register it via `callback_manager.register_lifecycle_hook(...)`.

## Import paths

```python
from agentflow.utils.callbacks import (
    GraphLifecycleHook,
    GraphLifecycleContext,
)
from agentflow.state import AgentState
from agentflow.state.message import Message
```

---

## `GraphLifecycleContext`

Passed to every lifecycle hook with metadata about the current execution.

| Field | Type | Description |
|---|---|---|
| `config` | `dict[str, Any]` | Full config dict passed to `invoke()` / `stream()`. |
| `timestamp` | `str` | ISO8601 start time (from `config["timestamp"]`). |
| `metadata` | `dict[str, Any] \| None` | Optional extra context. |

### Properties

| Property | Type | Returns |
|---|---|---|
| `thread_id` | property | `config.get("thread_id")` — unique conversation ID or `None`. |
| `run_id` | property | `config.get("run_id")` — unique execution ID or `None`. |

---

## `GraphLifecycleHook`

Abstract base class for graph-level lifecycle hooks. Override only the methods you need; all others default to no-op.

### `on_graph_start`

Fires after state is loaded but before the first node executes. Use to inject observability, enrich initial state, or perform setup.

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
import uuid

class TraceStartHook(GraphLifecycleHook):
    async def on_graph_start(
        self,
        context: GraphLifecycleContext,
        state: AgentState,
    ) -> AgentState | None:
        """Initialize observability trace when graph starts."""
        trace_id = str(uuid.uuid4())
        state.execution_meta.internal_data["trace_id"] = trace_id
        print(f"[TRACE START] thread_id={context.thread_id} trace_id={trace_id}")
        return state  # Return modified state
```

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `context` | `GraphLifecycleContext` | Execution context with thread_id, run_id, config. |
| `state` | `AgentState` | Loaded or freshly created initial state. |

**Returns:** `AgentState | None`
- Return `None` → use original state unchanged.
- Return modified `AgentState` → replaces initial state before graph execution.

**Use cases:**
- Initialize trace spans (OpenTelemetry, Jaeger).
- Pre-populate state fields from external sources (user profile DB lookup).
- Set up rate-limiting counters or request budgets.
- Add audit metadata (who triggered run, from which service).
- Inject language preference or feature flags into state.

---

### `on_graph_end`

Fires after execution loop completes successfully, before final persistence. Use for cleanup, notifications, metrics, or finalization logic.

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
from agentflow.state.message import Message
import json

class MetricsEndHook(GraphLifecycleHook):
    async def on_graph_end(
        self,
        context: GraphLifecycleContext,
        final_state: AgentState,
        messages: list[Message],
        total_steps: int,
    ) -> AgentState | None:
        """Record execution metrics and send completion notification."""
        metrics = {
            "thread_id": context.thread_id,
            "run_id": context.run_id,
            "total_steps": total_steps,
            "message_count": len(messages),
            "completed_at": context.timestamp,
        }
        print(f"[METRICS] {json.dumps(metrics)}")
        
        # Optionally notify external systems
        await self._send_webhook_notification(context, final_state)
        
        # Close OpenTelemetry span
        trace_id = final_state.execution_meta.internal_data.get("trace_id")
        if trace_id:
            print(f"[TRACE END] trace_id={trace_id} status=success")
        
        return None  # Keep state unchanged
```

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `context` | `GraphLifecycleContext` | Execution context. |
| `final_state` | `AgentState` | State after `state.complete()`, before persistence. |
| `messages` | `list[Message]` | All messages produced during the run. |
| `total_steps` | `int` | Final step count. |

**Returns:** `AgentState | None`
- Return `None` → persist unchanged.
- Return modified `AgentState` → persist and return modified state.

**Use cases:**
- Record execution duration, step count, token count to metrics (Prometheus, Datadog, CloudWatch).
- Send Slack/email notification: "Research complete, results are ready".
- Archive conversation transcript to cold storage.
- Trigger downstream workflows (SQS, webhooks).
- Close OpenTelemetry spans with success status.
- Apply final state normalization or compaction.
- Update task queue with "COMPLETED" status.

---

### `on_graph_error`

Fires when an unhandled exception escapes the execution loop. Use to alert, log diagnostics, or mask sensitive data before persistence.

**⚠️ Important:** This hook **cannot suppress** the error. The exception is always re-raised after the hook completes. To recover from errors at the node level, use the invocation-level `on_error` callback in [Callback Manager](./callback-manager.md).

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
from agentflow.state.message import Message
import logging

logger = logging.getLogger(__name__)

class ErrorAlertHook(GraphLifecycleHook):
    async def on_graph_error(
        self,
        context: GraphLifecycleContext,
        error: Exception,
        partial_state: AgentState,
        messages: list[Message],
        step: int,
        node_name: str,
    ) -> tuple[AgentState, str] | None:
        """Alert PagerDuty on production errors and mask sensitive state."""
        logger.error(
            f"Graph failed at node={node_name} step={step}: {error}",
            extra={
                "thread_id": context.thread_id,
                "run_id": context.run_id,
            }
        )
        
        # Alert on-call engineer
        trace_id = partial_state.execution_meta.internal_data.get("trace_id")
        await self._page_duty_alert(
            title=f"Agent graph failed: {node_name}",
            description=f"Trace: {trace_id}\nError: {str(error)[:200]}",
            severity="error" if "critical" in str(error).lower() else "warning",
        )
        
        # Mask sensitive state before persistence
        partial_state.execution_meta.internal_data["masked"] = True
        masked_msg = f"Graph failed: {type(error).__name__} (details logged)"
        
        return partial_state, masked_msg
```

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `context` | `GraphLifecycleContext` | Execution context. |
| `error` | `Exception` | The unhandled exception. |
| `partial_state` | `AgentState` | State at error point (after `state.error()`). |
| `messages` | `list[Message]` | Messages collected before error. |
| `step` | `int` | Step number where error occurred. |
| `node_name` | `str` | The node that failed. |

**Returns:** `tuple[AgentState, str] | None`
- Return `None` → persist unchanged; re-raise original error message.
- Return `(AgentState, str)` → persist modified state and error message, then re-raise.
- **Cannot return a recovery value** — use node-level `on_error` callbacks instead.

**Use cases:**
- Alert PagerDuty, Sentry, Datadog on production failures.
- Attach structured failure diagnostics to `state.execution_meta.internal_data`.
- Mask or redact sensitive partial state before persisting failed checkpoint.
- Close OpenTelemetry spans with error status and exception attributes.
- Record failure metrics by node (identify hot spots).
- Send failure webhook to client system with sanitized error details.
- Log full context for post-mortem debugging.

---

### `on_interrupt`

Fires when graph execution pauses waiting for user input or manual approval. Use to notify frontends, start timeout timers, or update external task queues.

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState

class InterruptNotificationHook(GraphLifecycleHook):
    async def on_interrupt(
        self,
        context: GraphLifecycleContext,
        interrupted_node: str,
        interrupt_type: str,  # "before" | "after" | "stop" | "remote_tool"
        state: AgentState,
    ) -> AgentState | None:
        """Notify frontend and start timeout timer when paused."""
        print(f"[INTERRUPT] node={interrupted_node} type={interrupt_type}")
        
        # Mark in state for frontend to pick up
        state.execution_meta.internal_data["paused_at"] = context.timestamp
        state.execution_meta.internal_data["interrupt_type"] = interrupt_type
        
        # Notify frontend via WebSocket or server-sent events
        await self._notify_frontend(
            thread_id=context.thread_id,
            status="waiting_input",
            node=interrupted_node,
        )
        
        # Start a timeout timer: auto-cancel if not resumed in 1 hour
        await self._start_timeout_timer(
            thread_id=context.thread_id,
            timeout_seconds=3600,
        )
        
        return state
```

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `context` | `GraphLifecycleContext` | Execution context. |
| `interrupted_node` | `str` | The node where execution paused. |
| `interrupt_type` | `str` | `"before"`, `"after"`, `"stop"`, or `"remote_tool"`. |
| `state` | `AgentState` | State at interrupt point. |

**Returns:** `AgentState | None`
- Return `None` → persist unchanged.
- Return modified `AgentState` → persist modified state.

**Interrupt types:**
- `"before"` — interrupted before a node ran (e.g., user approval).
- `"after"` — interrupted after a node ran, before routing (e.g., review output).
- `"stop"` — external stop request (e.g., user clicked "Cancel").
- `"remote_tool"` — awaiting tool invocation response from external system (A2A).

**Use cases:**
- Update frontend UI from "thinking..." to "waiting for approval".
- Send push notification: "Agent needs your input".
- Store interrupt event in event log for auditability.
- Start a timeout timer (auto-cancel if not resumed).
- Update task queue entry status to "PAUSED".
- Sanitize state before exposing to frontend.
- Add approval metadata or SLA deadlines to state.

---

### `on_resume`

Fires when a previously interrupted graph is resumed. Use to validate resume data, log the resume event, or update observability spans.

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
from typing import Any

class ResumeValidationHook(GraphLifecycleHook):
    async def on_resume(
        self,
        context: GraphLifecycleContext,
        resumed_node: str,
        state: AgentState,
        resume_data: dict[str, Any],
    ) -> AgentState | None:
        """Validate resume data and record who approved."""
        print(f"[RESUME] node={resumed_node} approved_by={resume_data.get('approved_by')}")
        
        # Validate resume payload
        if "approval_code" in resume_data:
            is_valid = await self._validate_approval_code(resume_data["approval_code"])
            if not is_valid:
                raise ValueError("Invalid approval code")
        
        # Record approval in audit log
        state.execution_meta.internal_data["resumed_at"] = context.timestamp
        state.execution_meta.internal_data["resumed_by"] = resume_data.get("approved_by", "unknown")
        
        # Cancel the timeout timer from on_interrupt
        await self._cancel_timeout_timer(context.thread_id)
        
        # Update frontend status back to "thinking..."
        await self._notify_frontend(
            thread_id=context.thread_id,
            status="resuming",
        )
        
        return state
```

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `context` | `GraphLifecycleContext` | Execution context. |
| `resumed_node` | `str` | The node being resumed (from `state.execution_meta.interrupted_node`). |
| `state` | `AgentState` | The loaded interrupted state (before `clear_interrupt()`). |
| `resume_data` | `dict[str, Any]` | Mutable dict with data passed to `ainvoke()` on resume. |

**Returns:** `AgentState | None`
- Return `None` → continue with loaded state.
- Return modified `AgentState` → continue with modified state.
- `resume_data` dict is mutable in-place; modifications are copied into `config["resume_data"]`.

**Use cases:**
- Validate resume payload before execution continues.
- Log "execution resumed" with who approved and what data they sent.
- Record approval timestamp and actor to audit trail.
- Cancel the timeout timer started in `on_interrupt`.
- Update frontend status from "waiting" back to "thinking...".
- Enrich resume data with contextual information.
- Enforce approval workflows (check approval signatures, codes, etc.).

---

### `on_checkpoint`

Fires immediately before state/messages are persisted to the checkpointer. Use to redact sensitive data, replicate state, invalidate caches, or enforce compliance logging.

**Note:** `on_checkpoint` fires every time state is persisted, including during interrupts, stops, and errors — not just at graph end. This is intentional; it's the central hook for state persistence policy.

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
from agentflow.state.message import Message
from typing import Sequence

class RedactionCheckpointHook(GraphLifecycleHook):
    async def on_checkpoint(
        self,
        context: GraphLifecycleContext,
        state: AgentState,
        messages: list[Message],
        is_context_trimmed: bool,
    ) -> tuple[AgentState, list[Message]] | AgentState | None:
        """Redact PII before persistence and log for compliance."""
        # Redact sensitive fields
        for msg in messages:
            if hasattr(msg.content, "__dict__"):
                if "email" in msg.content:
                    msg.content["email"] = "***@***.com"
                if "phone" in msg.content:
                    msg.content["phone"] = "***-****"
        
        # Drop transient messages (e.g., debug logs) before checkpoint
        filtered_messages = [
            m for m in messages
            if not m.metadata.get("transient", False)
        ]
        
        # Write to compliance audit log (HIPAA, SOC2, etc.)
        audit_entry = {
            "timestamp": context.timestamp,
            "thread_id": context.thread_id,
            "run_id": context.run_id,
            "context_trimmed": is_context_trimmed,
        }
        await self._write_compliance_log(audit_entry)
        
        # Replicate to secondary cache (Redis, CDN edge)
        await self._replicate_to_cache(
            thread_id=context.thread_id,
            state=state,
            ttl=3600,
        )
        
        return state, filtered_messages
```

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `context` | `GraphLifecycleContext` | Execution context. |
| `state` | `AgentState` | State about to be persisted (may be context-trimmed). |
| `messages` | `list[Message]` | Messages about to be persisted. |
| `is_context_trimmed` | `bool` | Whether context compression was applied. |

**Returns:** `tuple[AgentState, list[Message]] | AgentState | None`
- Return `None` → persist unchanged.
- Return `AgentState` → persist returned state with current messages.
- Return `(AgentState, list[Message])` → persist both returned values.

**Use cases:**
- Redact or compact state immediately before durable persistence.
- Drop transient messages that should not be checkpointed.
- Write to compliance audit log (HIPAA, SOC2, PCI-DSS).
- Replicate state to secondary checkpointer or cache.
- Invalidate frontend cache keyed by thread_id.
- Mirror state to a different backend (e.g., also write to Redis).
- Trigger webhooks to notify downstream systems of state change.
- Record checkpoint frequency metrics (identify hot paths).

---

### `on_state_update`

Fires after each node transition — after a node executes and state is merged. This is the most granular graph-level hook. Use to observe node-level patterns or apply per-node policies.

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
import copy

class ObserveNodeTransitionHook(GraphLifecycleHook):
    async def on_state_update(
        self,
        context: GraphLifecycleContext,
        node_name: str,
        old_state: AgentState,
        new_state: AgentState,
        step: int,
    ) -> AgentState | None:
        """Log each node transition and detect infinite loops."""
        # Detect infinite loop: same node executed 5+ times in a row
        if hasattr(self, "_last_node"):
            if self._last_node == node_name:
                self._repeat_count = getattr(self, "_repeat_count", 1) + 1
                if self._repeat_count > 5:
                    print(f"[WARNING] Possible infinite loop: node {node_name} repeated {self._repeat_count} times")
                    # Could raise exception or set interrupt flag
            else:
                self._repeat_count = 1
        
        self._last_node = node_name
        
        # Log state transition for observability
        print(f"[STEP {step}] {node_name}")
        print(f"  Messages before: {len(old_state.messages)}")
        print(f"  Messages after: {len(new_state.messages)}")
        
        # Example: apply node-specific policies
        if node_name == "approval_node":
            # Verify approval was recorded
            if not new_state.execution_meta.internal_data.get("approved"):
                print(f"[WARNING] Approval node completed but no approval recorded")
        
        return None  # Keep state unchanged
```

**Parameters:**
| Param | Type | Description |
|---|---|---|
| `context` | `GraphLifecycleContext` | Execution context. |
| `node_name` | `str` | The node that just executed. |
| `old_state` | `AgentState` | Deep copy of state **before** node ran. |
| `new_state` | `AgentState` | State after node result merged. |
| `step` | `int` | Current step number. |

**Returns:** `AgentState | None`
- Return `None` → use `new_state` unchanged.
- Return modified `AgentState` → replaces `new_state` for rest of graph.

**Use cases:**
- Observe every node transition (most granular hook).
- Detect infinite loops (same node repeating too many times).
- Apply node-specific validation or policies.
- Record per-node metrics (execution time, message count change).
- Track state mutations per node (for debugging).
- Implement circuit breakers on specific nodes.
- Feed node transitions to external monitoring (Jaeger, Datadog).

---

## Common patterns

### 1. Full observability trace

Combine `on_graph_start` and `on_graph_end` to bookend a trace span:

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
from agentflow.state.message import Message
from opentelemetry import trace

class OpenTelemetryHook(GraphLifecycleHook):
    def __init__(self):
        self._tracer = trace.get_tracer(__name__)
        self._spans = {}

    async def on_graph_start(
        self, context: GraphLifecycleContext, state: AgentState
    ) -> AgentState | None:
        span = self._tracer.start_span(
            name=f"graph_{context.thread_id}",
            attributes={
                "thread_id": context.thread_id,
                "run_id": context.run_id,
            }
        )
        self._spans[context.run_id] = span
        return None

    async def on_graph_end(
        self, context: GraphLifecycleContext, final_state: AgentState,
        messages: list[Message], total_steps: int
    ) -> AgentState | None:
        span = self._spans.pop(context.run_id, None)
        if span:
            span.set_attribute("total_steps", total_steps)
            span.set_attribute("message_count", len(messages))
            span.end()
        return None

    async def on_graph_error(
        self, context: GraphLifecycleContext, error: Exception,
        partial_state: AgentState, messages: list[Message],
        step: int, node_name: str
    ) -> tuple[AgentState, str] | None:
        span = self._spans.get(context.run_id)
        if span:
            span.record_exception(error)
            span.set_attribute("error", True)
        return None
```

### 2. Human-in-the-loop approval workflow

Combine `on_interrupt`, `on_resume`, and `on_checkpoint`:

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState

class ApprovalWorkflowHook(GraphLifecycleHook):
    async def on_interrupt(
        self, context: GraphLifecycleContext, interrupted_node: str,
        interrupt_type: str, state: AgentState
    ) -> AgentState | None:
        # Store approval request in external system
        approval_id = await self._create_approval_request(
            thread_id=context.thread_id,
            node=interrupted_node,
        )
        state.execution_meta.internal_data["approval_id"] = approval_id
        return state

    async def on_resume(
        self, context: GraphLifecycleContext, resumed_node: str,
        state: AgentState, resume_data: dict
    ) -> AgentState | None:
        # Record approval decision in audit trail
        approval_id = state.execution_meta.internal_data.get("approval_id")
        await self._record_approval(
            approval_id=approval_id,
            decision=resume_data.get("decision"),
            approved_by=resume_data.get("approved_by"),
            timestamp=context.timestamp,
        )
        return None

    async def on_checkpoint(
        self, context: GraphLifecycleContext, state: AgentState,
        messages: list, is_context_trimmed: bool
    ) -> tuple[AgentState, list] | None:
        # Ensure approval is durable before returning to caller
        approval_id = state.execution_meta.internal_data.get("approval_id")
        if approval_id:
            await self._persist_approval_to_audit_log(approval_id, state)
        return None
```

### 3. Metrics and monitoring

Collect execution metrics across multiple hooks:

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
from agentflow.state.message import Message
import time

class MetricsHook(GraphLifecycleHook):
    def __init__(self):
        self._start_times = {}

    async def on_graph_start(
        self, context: GraphLifecycleContext, state: AgentState
    ) -> AgentState | None:
        self._start_times[context.run_id] = time.time()
        return None

    async def on_state_update(
        self, context: GraphLifecycleContext, node_name: str,
        old_state: AgentState, new_state: AgentState, step: int
    ) -> AgentState | None:
        # Record message count change per node
        msg_delta = len(new_state.messages) - len(old_state.messages)
        self._record_metric(
            f"node.message_delta.{node_name}",
            msg_delta,
        )
        return None

    async def on_graph_end(
        self, context: GraphLifecycleContext, final_state: AgentState,
        messages: list[Message], total_steps: int
    ) -> AgentState | None:
        # Record total execution time
        elapsed = time.time() - self._start_times.pop(context.run_id, 0)
        self._record_metric("graph.execution_time", elapsed)
        self._record_metric("graph.total_steps", total_steps)
        self._record_metric("graph.message_count", len(messages))
        return None

    async def on_graph_error(
        self, context: GraphLifecycleContext, error: Exception,
        partial_state: AgentState, messages: list[Message],
        step: int, node_name: str
    ) -> tuple[AgentState, str] | None:
        # Record failure metrics
        self._record_metric("graph.errors", 1)
        self._record_metric(f"graph.error.{node_name}", 1)
        return None
```

---

## Usage

Register a lifecycle hook when compiling your graph:

```python
from agentflow.core.graph import StateGraph
from agentflow.utils.callbacks import GraphLifecycleHook

# Define your hook(s)
class MyLifecycleHook(GraphLifecycleHook):
    async def on_graph_start(self, context, state):
        print(f"Starting graph run: {context.run_id}")
        return None
    
    async def on_graph_end(self, context, final_state, messages, total_steps):
        print(f"Completed in {total_steps} steps with {len(messages)} messages")
        return None

# Build your graph
builder = StateGraph(MyState)
# ... define nodes ...

# Compile with lifecycle hook
graph = builder.compile(
    lifecycle_hook=MyLifecycleHook()
)

# Run the graph — hooks fire automatically
result = await graph.ainvoke({"messages": [...]})
```

Alternatively, register via `CallbackManager`:

```python
from agentflow.utils.callbacks import CallbackManager

cbm = CallbackManager()
cbm.register_lifecycle_hook(MyLifecycleHook())

graph = builder.compile(callback_manager=cbm)
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Lifecycle hook never fires | `lifecycle_hook` not passed to `compile()`. | Pass `lifecycle_hook=MyHook()` or use `CallbackManager`. |
| `on_state_update` sees `old_state == new_state` | Both reference same object (not deep copied). | Framework handles this; report as bug if issue persists. |
| `on_graph_error` doesn't suppress error | Hook designed to alert/log, not recover. | Use node-level `on_error` callbacks for error recovery. |
| `on_interrupt` not called | Interrupt not triggered (node completed successfully). | Add `.interrupt()` call in node or use external interrupt API. |
| `on_resume` receives `None` in `resume_data` | Resume called without input data. | Pass `input_data` dict to resume call: `ainvoke(input_data={...}, resume=True)`. |
