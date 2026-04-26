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

## Rules

| Rule | Why it matters |
|---|---|
| Keep callbacks bounded | They run inside graph execution paths. |
| Avoid global mutable request state | Use context metadata and config instead. |
| Return the expected shape from transforming callbacks | Downstream invocations expect specific data. |
| Test `Command` routes | Missing destinations and recursion loops are runtime issues. |

## Related docs

- [Security and validators](./security-and-validators.md)
- [Command and handoff reference](/docs/reference/python/command-handoff)
- [Callback manager reference](/docs/reference/python/callback-manager)
