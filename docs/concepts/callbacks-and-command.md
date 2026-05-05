---
title: Callbacks and Command
description: Hook into invocations, validate inputs, recover from errors, and route from inside nodes.
sidebar_position: 12
---

# Callbacks and Command

Callbacks and `Command` are two advanced control surfaces:

- **Callbacks** observe, validate, transform, or recover around model, tool, MCP, validation, and skill invocations.
- **Command** lets a node return both a state update and a runtime routing decision.

## CallbackManager

Pass a `CallbackManager` when compiling the graph:

```python
from agentflow.utils import CallbackManager, InvocationType

callback_manager = CallbackManager()
app = graph.compile(callback_manager=callback_manager)
```

Hook families:

| Hook | Purpose |
|---|---|
| `register_before_invoke` | Validate or transform input before an invocation. |
| `register_after_invoke` | Inspect, log, or transform output after an invocation. |
| `register_on_error` | Recover from an error or let it re-raise. |
| `register_input_validator` | Add a structured message validator. |

Invocation types include `AI`, `TOOL`, `MCP`, `INPUT_VALIDATION`, and `SKILL`.

## Validators

Validators are useful for input policy, prompt-injection protection, and business rules.

```python
from agentflow.utils import CallbackManager
from agentflow.utils.validators import PromptInjectionValidator

callback_manager = CallbackManager()
callback_manager.register_input_validator(PromptInjectionValidator(strict_mode=True))

app = graph.compile(callback_manager=callback_manager)
```

## Command

Use `Command` when a node needs to update state and choose the next node at runtime.

```python
from agentflow.utils import Command, END

def router_node(state, config):
    last = state.context[-1].text() if state.context else ""

    if "billing" in last.lower():
        return Command(update={"route": "billing"}, goto="BILLING")

    return Command(goto=END)
```

Prefer conditional edges for normal graph routing because they are easier to visualize and test. Use `Command` for dynamic jumps, recovery branches, handoffs, or routing that depends on side effects inside the node.

## Graph Lifecycle Hooks

While `CallbackManager` observes invocation-level events (before/after each LLM, tool, or MCP call), **graph lifecycle hooks** observe graph-level orchestration events that fire once per graph run (or once per node transition).

Register a `GraphLifecycleHook` to react to structural events:

```python
from agentflow.utils.callbacks import GraphLifecycleHook, GraphLifecycleContext
from agentflow.state import AgentState
from agentflow.state.message import Message

class MyLifecycleHook(GraphLifecycleHook):
    async def on_graph_start(self, context: GraphLifecycleContext, state: AgentState) -> AgentState | None:
        """Initialize trace, observability, or state enrichment."""
        print(f"Graph starting: thread_id={context.thread_id}")
        return None

    async def on_graph_end(self, context: GraphLifecycleContext, final_state: AgentState, 
                          messages: list[Message], total_steps: int) -> AgentState | None:
        """Record metrics, send notifications, or perform cleanup."""
        print(f"Graph completed in {total_steps} steps")
        return None

    async def on_graph_error(self, context: GraphLifecycleContext, error: Exception,
                            partial_state: AgentState, messages: list[Message],
                            step: int, node_name: str) -> tuple[AgentState, str] | None:
        """Alert on failures and mask sensitive data before persistence."""
        print(f"Graph failed at {node_name}: {error}")
        return None

    async def on_interrupt(self, context: GraphLifecycleContext, interrupted_node: str,
                          interrupt_type: str, state: AgentState) -> AgentState | None:
        """React when execution pauses waiting for user input."""
        print(f"Graph paused at {interrupted_node}")
        return None

    async def on_resume(self, context: GraphLifecycleContext, resumed_node: str,
                       state: AgentState, resume_data: dict) -> AgentState | None:
        """Validate and log when paused execution resumes."""
        print(f"Graph resuming from {resumed_node}")
        return None

    async def on_checkpoint(self, context: GraphLifecycleContext, state: AgentState,
                           messages: list[Message], is_context_trimmed: bool) -> tuple[AgentState, list[Message]] | AgentState | None:
        """React before state is persisted—redact PII, replicate to cache, etc."""
        print(f"Checkpoint: {len(messages)} messages")
        return None

    async def on_state_update(self, context: GraphLifecycleContext, node_name: str,
                             old_state: AgentState, new_state: AgentState, step: int) -> AgentState | None:
        """Observe each node transition—most granular graph-level hook."""
        print(f"Step {step}: {node_name}")
        return None

app = graph.compile(lifecycle_hook=MyLifecycleHook())
```

Lifecycle hooks are useful for:
- **Observability**: Start/stop OpenTelemetry spans, send metrics to Datadog or Prometheus
- **Human-in-the-loop**: Coordinate interrupts, approvals, and resume workflows
- **Compliance**: Redact PII before persistence, write audit logs at checkpoint time
- **Notifications**: Send Slack/email when graph completes, fails, or needs approval
- **Debugging**: Observe state mutations per node, detect infinite loops

**Key difference from `CallbackManager`:**

| Aspect | CallbackManager | GraphLifecycleHook |
|---|---|---|
| **Fires** | Once per LLM/tool/MCP invocation | Once per graph run (or once per node) |
| **Context** | Which function was called, function name | Thread ID, run ID, graph state |
| **Use case** | Validate/transform invocations | Monitor/coordinate entire execution |

## Rules

| Rule | Why it matters |
|---|---|
| Keep callbacks bounded | They run inside graph execution paths. |
| Avoid global mutable request state | Use context metadata and config instead. |
| Return the expected shape from transforming callbacks | Downstream invocations expect specific data. |
| Test `Command` routes | Missing destinations and recursion loops are runtime issues. |
| Don't suppress errors in lifecycle hooks | `on_graph_error` alerts but cannot recover; use node-level `on_error` for recovery. |

## Related docs

- [Security and validators](./security-and-validators.md)
- [Command and handoff reference](/docs/reference/python/command-handoff)
- [Callback manager reference](/docs/reference/python/callback-manager)
- [Lifecycle callbacks reference](/docs/reference/python/lifecycle-callbacks)
