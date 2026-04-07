# Human-in-the-Loop (HITL) & Interrupts

Agentflow provides robust human-in-the-loop capabilities through its interrupt and stop mechanisms. These features enable agents to pause execution for human approval, debugging, external intervention, and dynamic control flow management.

---

## Overview

Human-in-the-loop patterns are essential for:

- **Approval workflows** – Pause before executing sensitive operations
- **Debug and inspection** – Examine state at specific points during development
- **External control** – Allow frontends/UIs to stop or redirect agent execution
- **Safety gates** – Require human confirmation for high-risk actions
- **Progressive automation** – Start manual, gradually automate as confidence grows

Agentflow supports HITL through two complementary mechanisms:

| Mechanism | When Defined | Trigger | Use Case |
|-----------|--------------|---------|----------|
| **Interrupts** (`interrupt_before`/`interrupt_after`) | Compile time | Automatic at specified nodes | Predetermined pause points, approval workflows |
| **Stop Requests** (`stop()`/`astop()`) | Runtime | External API call | Dynamic cancellation, frontend control |

---

## Interrupt Mechanisms

### Compile-Time Interrupts

Define pause points when compiling your graph:

```python
from agentflow.graph import StateGraph
from agentflow.checkpointer import InMemoryCheckpointer

# Build your graph
graph = StateGraph()
graph.add_node("ANALYZE", analyze_data)
graph.add_node("EXECUTE_TOOL", execute_sensitive_tool)
graph.add_node("CLEANUP", cleanup_resources)

# Compile with interrupt points
app = graph.compile(
    checkpointer=InMemoryCheckpointer(),  # Required for resuming
    interrupt_before=["EXECUTE_TOOL"],  # Pause before tool execution
    interrupt_after=["ANALYZE"]  # Pause after analysis for review
)
```

**Interrupt Types:**

- `interrupt_before`: Execution pauses **before** the specified node runs
- `interrupt_after`: Execution pauses **after** the specified node completes

### Runtime Stop Requests

Request immediate halt from external code:

```python
import threading
import time

# Start streaming execution
def run_agent():
    for chunk in app.stream(input_data, config={"thread_id": "my-session"}):
        print(f"Agent output: {chunk}")

# Run in background thread
agent_thread = threading.Thread(target=run_agent)
agent_thread.start()

# Stop from main thread after delay
time.sleep(2.0)
status = app.stop({"thread_id": "my-session"})
print(f"Stop status: {status}")
```

---

## State Management During Interrupts

### Execution State Tracking

`AgentState.execution_meta` tracks interrupt status:

```python
from agentflow.state import ExecutionStatus

# Check if execution is interrupted
if state.execution_meta.is_interrupted():
    print(f"Paused at: {state.execution_meta.interrupted_node}")
    print(f"Reason: {state.execution_meta.interrupt_reason}")
    print(f"Status: {state.execution_meta.status}")
```

**Interrupt Statuses:**
- `ExecutionStatus.INTERRUPTED_BEFORE` – Paused before node execution
- `ExecutionStatus.INTERRUPTED_AFTER` – Paused after node completion
- `ExecutionStatus.RUNNING` – Normal execution
- `ExecutionStatus.COMPLETED` – Successfully finished
- `ExecutionStatus.ERROR` – Failed with exception

### Manual Interrupt Control

You can also set interrupts programmatically from within nodes:

```python
from agentflow.state import ExecutionStatus


async def approval_node(state: AgentState, config: dict) -> AgentState:
    # Check some condition
    if requires_human_approval(state):
        state.set_interrupt(
            node="approval_node",
            reason="Requires human approval for high-value transaction",
            status=ExecutionStatus.INTERRUPTED_BEFORE,
            data={"transaction_amount": 10000, "requires_approval": True}
        )
    return state
```

---

## Resuming Execution

### Basic Resume Pattern

```python
# Initial execution (will pause at interrupt point)
result = app.invoke(
    {"messages": [Message.text_message("Process the transaction")]},
    config={"thread_id": "session-123"}
)

# Check if interrupted
if result.get("interrupted"):
    print(f"Execution paused: {result['interrupt_reason']}")

    # Human reviews and approves...
    human_decision = input("Approve transaction? (y/n): ")

    if human_decision.lower() == 'y':
        # Resume with approval
        result = app.invoke(
            {"messages": [Message.text_message("Approved by human")]},
            config={"thread_id": "session-123"}  # Same thread_id
        )
```

### Resume with Modified Input

Add context or instructions when resuming:

```python
# Resume with additional context
resumed_result = app.invoke({
    "messages": [
        Message.text_message("Transaction approved"),
        Message.text_message("Use enhanced security protocols")
    ]
}, config={"thread_id": "session-123"})
```

The checkpointer automatically:
1. Detects existing interrupted state for the thread
2. Merges new input data with saved state
3. Continues from the interruption point
4. Clears interrupt flags to resume normal execution

---

## Practical HITL Patterns

### 1. Approval Workflow

```python
def build_approval_agent():
    graph = StateGraph()

    # Analysis node
    graph.add_node("ANALYZE_REQUEST", analyze_user_request)

    # Decision point - will pause here for approval
    graph.add_node("EXECUTE_ACTION", execute_user_action)

    # Cleanup
    graph.add_node("FINALIZE", finalize_action)

    # Routing
    graph.add_edge(START, "ANALYZE_REQUEST")
    graph.add_edge("ANALYZE_REQUEST", "EXECUTE_ACTION")
    graph.add_edge("EXECUTE_ACTION", "FINALIZE")
    graph.add_edge("FINALIZE", END)

    return graph.compile(
        checkpointer=InMemoryCheckpointer(),
        interrupt_before=["EXECUTE_ACTION"]  # Require approval before executing
    )

async def approval_workflow():
    app = build_approval_agent()

    # Step 1: Initial request
    result = app.invoke({
        "messages": [Message.text_message("Delete all production data")]
    }, config={"thread_id": "dangerous-operation"})

    # Step 2: Human review (execution paused at EXECUTE_ACTION)
    print(f"Request analysis: {result['messages'][-1].content}")
    approval = input("This is dangerous. Approve? (yes/no): ")

    # Step 3: Resume with decision
    if approval == "yes":
        final_result = app.invoke({
            "messages": [Message.text_message("APPROVED: Proceed with deletion")]
        }, config={"thread_id": "dangerous-operation"})
    else:
        final_result = app.invoke({
            "messages": [Message.text_message("DENIED: Operation cancelled")]
        }, config={"thread_id": "dangerous-operation"})
```

### 2. Debug Inspection Points

```python
def build_debug_agent():
    graph = StateGraph()
    graph.add_node("PREPROCESS", preprocess_data)
    graph.add_node("MODEL_INFERENCE", run_ml_model)
    graph.add_node("POSTPROCESS", postprocess_results)

    return graph.compile(
        interrupt_after=["PREPROCESS", "MODEL_INFERENCE"]  # Inspect after each major step
    )

def debug_session():
    app = build_debug_agent()
    config = {"thread_id": "debug-session"}

    # Run until first interrupt
    result = app.invoke({"input_data": raw_data}, config=config)

    while result.get("interrupted"):
        # Inspect current state
        print(f"Paused after: {result['current_node']}")
        print(f"Current state: {result['state']}")

        # Interactive debugging
        import pdb; pdb.set_trace()  # Or any debugging tool

        # Continue execution
        result = app.invoke({}, config=config)  # Empty input to just resume
```

### 3. Frontend Stop Control

```python
# Backend API endpoint
from flask import Flask, request, jsonify
import asyncio

app_flask = Flask(__name__)
agent_app = build_streaming_agent()

@app_flask.route('/agent/start', methods=['POST'])
def start_agent():
    thread_id = request.json['thread_id']
    messages = request.json['messages']

    # Start agent in background task
    def run_agent():
        for chunk in agent_app.stream({
            "messages": [Message.text_message(msg) for msg in messages]
        }, config={"thread_id": thread_id}):
            # Stream to frontend via WebSocket/SSE
            send_to_frontend(chunk)

    threading.Thread(target=run_agent, daemon=True).start()
    return jsonify({"status": "started", "thread_id": thread_id})

@app_flask.route('/agent/stop', methods=['POST'])
def stop_agent():
    thread_id = request.json['thread_id']

    # Request stop
    status = agent_app.stop({"thread_id": thread_id})
    return jsonify({"status": "stopped", "details": status})
```

### 4. Conditional Human Escalation

```python
async def smart_escalation_node(state: AgentState, config: dict) -> AgentState:
    """Automatically escalate complex cases to humans."""

    # Check complexity/confidence metrics
    confidence = calculate_confidence(state.context)
    complexity = assess_complexity(state.context)

    if confidence < 0.7 or complexity > 0.8:
        # Escalate to human
        state.set_interrupt(
            node="smart_escalation_node",
            reason=f"Low confidence ({confidence:.2f}) or high complexity ({complexity:.2f})",
            status=ExecutionStatus.INTERRUPTED_BEFORE,
            data={
                "confidence": confidence,
                "complexity": complexity,
                "escalation_reason": "Requires human expertise"
            }
        )

    return state
```

---

## Event Integration

### Monitoring Interrupt Events

```python
from agentflow.publisher import ConsolePublisher
from agentflow.publisher.events import EventType


class InterruptMonitor(ConsolePublisher):
    def publish(self, event):
        if event.event_type == EventType.INTERRUPTED:
            print(f"🛑 Execution paused at {event.node_name}")
            print(f"   Reason: {event.metadata.get('status', 'Unknown')}")
            print(f"   Interrupt type: {event.data.get('interrupted', 'Unknown')}")

        super().publish(event)


# Use custom publisher
app = graph.compile(
    publisher=InterruptMonitor(),
    interrupt_before=["SENSITIVE_ACTION"]
)
```

---

## Integration with Streaming

### Streaming with Interrupts

```python
async def streaming_with_interrupts():
    app = build_approval_agent()
    config = {"thread_id": "stream-interrupt-demo"}

    # Start streaming
    async for chunk in app.astream({
        "messages": [Message.text_message("Process sensitive request")]
    }, config=config):

        if chunk.event_type == "interrupted":
            print(f"⏸️  Execution paused: {chunk.content}")

            # Get human input
            approval = input("Approve? (y/n): ")

            if approval.lower() == 'y':
                # Resume streaming
                async for resume_chunk in app.astream({
                    "messages": [Message.text_message("Human approved")]
                }, config=config):
                    print(f"📤 {resume_chunk.content}")
            else:
                # Cancel
                await app.astop(config)
                print("❌ Operation cancelled")
                break
        else:
            print(f"📤 {chunk.content}")
```

---

## Best Practices

### When to Use Which Mechanism

| Scenario | Recommended Approach |
|----------|----------------------|
| **Known approval points** | `interrupt_before`/`interrupt_after` at compile time |
| **Dynamic user cancellation** | `stop()`/`astop()` with UI integration |
| **Debug/development** | `interrupt_after` at key nodes during development |
| **Conditional escalation** | Manual `state.set_interrupt()` based on runtime conditions |
| **Safety gates** | `interrupt_before` critical operations + approval workflow |

### Performance Considerations

1. **Checkpointer Choice**: Use `PgCheckpointer` for production, `InMemoryCheckpointer` for development
2. **Interrupt Frequency**: Minimize interrupt points in high-throughput scenarios
3. **State Size**: Large states slow interrupt persistence; consider state pruning
4. **Resume Overhead**: Factor in checkpointer read/write latency for resume operations

### Error Handling

```python
async def robust_interrupt_handling():
    try:
        result = app.invoke(input_data, config=config)

        if result.get("interrupted"):
            # Handle interrupt gracefully
            return handle_interrupt(result)

    except Exception as e:
        # Clean up any interrupt state on errors
        if hasattr(e, 'thread_id'):
            await app.astop({"thread_id": e.thread_id})
        raise
```

### Testing Interrupts

```python
import pytest

def test_interrupt_approval_workflow():
    app = build_approval_agent()
    config = {"thread_id": "test-interrupt"}

    # First execution should interrupt
    result = app.invoke({
        "messages": [Message.text_message("Execute sensitive action")]
    }, config=config)

    assert result["interrupted"] == True
    assert "EXECUTE_ACTION" in result["interrupt_reason"]

    # Resume with approval
    final_result = app.invoke({
        "messages": [Message.text_message("APPROVED")]
    }, config=config)

    assert final_result["interrupted"] == False
    assert len(final_result["messages"]) > 0
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| **Resume doesn't work** | Missing or misconfigured checkpointer | Ensure checkpointer is set during compile |
| **Interrupts ignored** | Node names don't match | Verify exact node names in interrupt lists |
| **State not persisted** | Checkpointer not saving | Check checkpointer implementation and permissions |
| **Multiple interrupts** | Interrupt loops | Add logic to prevent re-interrupting same node |
| **Stop not working** | Wrong thread_id or timing | Ensure correct thread_id and agent is actively running |

---

Next: Advanced Patterns (`advanced.md`) for complex multi-agent HITL scenarios and nested graph interrupts.
