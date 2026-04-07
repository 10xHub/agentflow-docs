# Control Flow & Edges

Control flow in Agentflow is explicit: you wire deterministic edges when constructing the graph or emit a `Command` at
runtime to jump. This page explains edges, conditional routing, recursion limits, interrupts, and stop requests.

---

## Edge Types

| Mechanism | When Defined | Purpose |
|-----------|--------------|---------|
| `add_edge(from, to)` | Build time | Linear / deterministic progression |
| `add_conditional_edges(node, condition, map)` | Build time | Declarative branching based on state-derived label |
| `Command(goto=...)` | Runtime | Imperative jump chosen inside node logic |

Even when using `Command`, having a fallback static edge can provide safety if the command returns `None`.

---

## Basic Edges

```python
graph.add_node("A", step_a)
graph.add_node("B", step_b)
graph.add_edge("A", "B")
graph.add_edge("B", END)
```

The runtime tracks current node name in `execution_meta.current_node` inside `AgentState`.

---

## Conditional Edges

```python
from agentflow.utils import END


def classify(state: AgentState) -> str:
    last = state.context[-1].text() if state.context else ""
    if "tool" in last:
        return "TOOLS"
    if "bye" in last:
        return END
    return "RESPOND"


graph.add_node("CLASSIFY", classify)
graph.add_node("RESPOND", respond)
graph.add_node("TOOLS", tool_node)

graph.add_conditional_edges(
    "CLASSIFY",
    classify,
    {
        "RESPOND": "RESPOND",
        "TOOLS": "TOOLS",
        END: END,
    },
)
```

Rules:

- Function must return a string label
- Every possible label must exist in the mapping (including `END` if used)
- Missing labels raise at runtime when encountered

Prefer conditional edges over `Command` for predictable branching: they’re easier to test and visualize.

---

## Runtime Jumps with Command

If decision logic depends on external services or side effects performed inside the node, a `Command` can encode the next
step:

```python
def after_tool(state, config):
    if expensive_validation(state):
        return Command(goto="REPAIR")
    return Command(goto="SUMMARIZE")
```

Combine with conditional edges for hybrid strategies (e.g. coarse routing via conditional, fine branching via command).

---

## Recursion / Step Limit

Each invoke has a recursion (step) limit (default 25 unless overridden in `config["recursion_limit"]`). After each
node execution the counter increments; exceeding the limit raises a `GraphRecursionError`.

Best practices:

- Ensure tool loops have terminal conditions
- Use explicit `END` returns in classification nodes when conversation is done
- Log step counts for long-running sessions

---

## Interrupts & Stop Requests

Agentflow supports robust human-in-the-loop (HITL) patterns through interrupt and stop mechanisms:

| Mechanism | Trigger | Effect | Use Case |
|-----------|---------|--------|----------|
| `interrupt_before` / `interrupt_after` lists (compile) | Node name match | Execution halts and state persisted before/after node | Approval workflows, debug points |
| `stop()` / `astop()` | External API call with `thread_id` | Sets stop flag; checked before executing next node | Dynamic cancellation from UI/frontend |

### Basic Interrupt Example

```python
from agentflow.checkpointer import InMemoryCheckpointer

# Compile with interrupt points
app = graph.compile(
    checkpointer=InMemoryCheckpointer(),  # Required for resuming
    interrupt_before=["EXECUTE_TOOL"],  # Pause before tool execution for approval
    interrupt_after=["ANALYZE"]  # Pause after analysis for inspection
)

# Initial execution (will pause at interrupt point)
result = app.invoke(input_data, config={"thread_id": "session-123"})

if result.get("interrupted"):
    print(f"Paused: {result['interrupt_reason']}")
    # Human review/approval logic here...

    # Resume with same thread_id
    final_result = app.invoke(
        {"messages": [Message.text_message("Approved")]},
        config={"thread_id": "session-123"}
    )
```

### Dynamic Stop Control

```python
import threading
import time

# Start agent in background
def run_agent():
    for chunk in app.stream(input_data, config={"thread_id": "my-session"}):
        print(chunk.content)

agent_thread = threading.Thread(target=run_agent)
agent_thread.start()

# Stop from external code (e.g., frontend button click)
time.sleep(2.0)
status = app.stop({"thread_id": "my-session"})
print(f"Stop requested: {status}")
```

**Key Requirements:**
- **Checkpointer**: Required for interrupt resume functionality
- **Thread ID**: Must be consistent between initial execution and resume
- **State Persistence**: Interrupted state is automatically saved and restored

For comprehensive HITL patterns, approval workflows, debug strategies, and advanced interrupt handling, see **[Human-in-the-Loop & Interrupts](human-in-the-loop.md)**.

---

## Handling Tool Routing

A typical pattern:

1. Reasoning node produces assistant message with `tool_calls`
2. Conditional edge or `Command` routes to `TOOL` node
3. `ToolNode` executes each tool (injection: `tool_call_id`, `state`, other DI)
4. Tool messages appended (role = `tool`)
5. Edge returns to reasoning node for final answer

Ensure your conditional edge logic treats a trailing `tool` role message as a signal to proceed to final response (see `examples/react/react_sync.py`).

---

## Error Paths

Unhandled exceptions in a node:

- Mark execution state as error
- Emit error event via publisher (if configured)
- Propagate unless caught; you can wrap risky sections and return a recovery `Command`

Use callback hooks (DI: `CallbackManager`) to add custom retry/backoff policies.

---

## Debug Checklist

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Stalls mid-run | Missing edge or wrong label | Verify `add_conditional_edges` mapping keys exactly match returns |
| Infinite loop | No terminal condition and step limit high | Add termination branch or reduce recursion limit |
| Unexpected END | Condition returned `END` prematurely | Inspect classifier logic with logging |
| Duplicate tool execution | Node re-emits same tool calls | Prune executed tool calls or gate by state flag |

---

Next: Tools & Integrations (`tools.md`).
