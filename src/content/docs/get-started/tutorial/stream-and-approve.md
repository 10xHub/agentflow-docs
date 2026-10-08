---
title: Stream and approve
description: "Stream an agent execution in Python and pause for human approval with interrupt(), then resume."
order: 100
group: "Tutorial"
section: "Get started"
label: Stream and approve
updated: "2026-10-08"
---

This step adds human-in-the-loop control to your agent: you will stream the agent's execution in Python, pause it to ask for approval, and resume it with a decision. This pattern is essential for agents that perform sensitive actions like transferring funds, deleting data, or making irreversible changes.

## What you build

A financial advisor agent that researches a transaction before executing it. When the agent is ready to transfer funds, the graph pauses and waits for your approval. You inspect the details, decide whether to allow it, then resume the agent with your decision. This step teaches you to stream executions and handle interrupts.

## Prerequisites

Install 10xGraph with Google GenAI support:

```bash
pip install "10xgraph[google-genai]"
```

Set your API key:

```bash
export GOOGLE_API_KEY=your-api-key
```

## Build the agent with approval

Create `approve_agent.py`. This example builds on the graph from step 2, adding an approval node that uses `interrupt()` to pause:

```python
from tenxgraph.core.graph import Agent, StateGraph, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.storage.checkpointer import InMemoryCheckpointer
from tenxgraph.utils import END, interrupt, ResponseGranularity
from tenxgraph.utils.interrupt import pending_interrupt
import asyncio

def check_balance() -> str:
    """Check the account balance."""
    return "Current balance: $50,000"

def transfer_funds(amount: float, recipient: str) -> str:
    """Transfer funds to a recipient (requires approval)."""
    decision = interrupt(
        {"amount": amount, "recipient": recipient},
        message=f"Approve transfer of ${amount} to {recipient}?",
        reason="transfer_approval",
    )
    if decision is None or not decision.get("approved"):
        return "Transfer cancelled by user"
    return f"Transferred ${amount} to {recipient}"

tool_node = ToolNode([check_balance, transfer_funds])

agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[
        {
            "role": "system",
            "content": "You are a helpful financial advisor. Help users check their balance and transfer funds when requested.",
        }
    ],
)

def should_use_tools(state: AgentState) -> str:
    if not state.context or len(state.context) == 0:
        return "TOOL"
    
    last_message = state.context[-1]
    
    if (
        hasattr(last_message, "tools_calls")
        and last_message.tools_calls
        and len(last_message.tools_calls) > 0
        and last_message.role == "assistant"
    ):
        return "TOOL"
    
    if last_message.role == "tool":
        return "MAIN"
    
    return END

graph = StateGraph(AgentState)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges(
    "MAIN",
    should_use_tools,
    {"TOOL": "TOOL", END: END},
)

graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

checkpointer = InMemoryCheckpointer()
app = graph.compile(checkpointer=checkpointer)
```

## Stream the agent and handle interrupts

Add this code to `approve_agent.py`. The `astream` method yields events as the graph executes. When the `transfer_funds` tool calls `interrupt()`, the stream ends and you can resume:

```python
async def main():
    thread_id = "approval-demo-1"
    
    # First run: stream until the agent pauses at interrupt()
    print("=== Streaming agent until approval needed ===\n")
    
    # Use FULL granularity to get state updates in the stream
    final_state = None
    async for chunk in app.astream(
        {"messages": [Message.text_message("Transfer $5,000 to Alice")]},
        config={"thread_id": thread_id},
        response_granularity=ResponseGranularity.FULL,
    ):
        # Print assistant messages as they arrive
        if chunk.event == "message" and chunk.message and chunk.message.role == "assistant":
            print(f"Assistant: {chunk.message.text()}\n")
        # Save the final state (last chunk will have it)
        if chunk.state:
            final_state = chunk.state
    
    # Check if the graph paused at an interrupt
    if final_state and pending_interrupt(final_state):
        print("Agent paused at interrupt. Resuming with approval...\n")
        
        # Resume by passing {"resume": decision}
        async for chunk in app.astream(
            {"resume": {"approved": True}},
            config={"thread_id": thread_id},
            response_granularity=ResponseGranularity.FULL,
        ):
            if chunk.event == "message" and chunk.message and chunk.message.role == "assistant":
                print(f"Assistant: {chunk.message.text()}\n")
    else:
        print("Agent completed without pausing.")

if __name__ == "__main__":
    asyncio.run(main())
```

## Run it

```bash
python approve_agent.py
```

Expected output:

```text
=== Streaming agent until approval needed ===

[Agent paused for approval]

Agent paused at interrupt. Resuming with approval...

=== Resuming agent with approval ===

Transferred $5,000 to Alice. The transaction is complete.
```

## How it works

The flow is: stream -> interrupt -> resume.

1. **Stream until paused:** `astream()` runs the graph, yielding `StreamChunk` events until a tool calls `interrupt()`. Use `ResponseGranularity.FULL` to get full state snapshots in each chunk.

2. **Detect the pause:** Save the final state from the stream chunks (the last chunk has the complete state). Call `pending_interrupt(state)` to check if the graph is paused. It returns the `Interrupt` object or `None`.

3. **Resume with decision:** Call `astream()` again on the same `thread_id` with `{"resume": {"approved": True}}`. The paused tool resumes and `interrupt()` returns the decision value to it.

The `interrupt()` function pauses the graph without raising an error. The tool can then decide based on the returned value—approve, deny, or handle the response as needed. The thread state persists across pause and resume, so the graph continues from where it paused.

## Key API details

**`interrupt(value, message=None, reason=None, response_schema=None)`** — Pause the graph from inside a tool or node. Returns the resume value on the next run (or `None` if cancelled). Found in `tenxgraph.utils.interrupt`.

**`pending_interrupt(state)`** — Check if a paused thread has a pending interrupt. Returns an `Interrupt` object or `None`. Use it to detect when a graph is paused.

**`app.astream(input, config, response_granularity=ResponseGranularity.LOW)`** — Stream execution yielding `StreamChunk` objects. Each chunk has `event` (message, state, updates), `message`, `state`, and metadata. Use `ResponseGranularity.FULL` to include full state snapshots and interrupt updates.

**`{"resume": value}`** — Resume a paused thread by passing the decision as `resume` in the input. The value is returned to the waiting `interrupt()` call in the tool.

## What you learned

- Stream agent execution with `astream()` to see intermediate results and state updates.
- Use `interrupt()` inside tools to pause for human decisions without raising errors.
- Resume paused threads by passing `{"resume": decision}` to `astream()` on the same `thread_id`.
- Use `ResponseGranularity.FULL` to get state snapshots in stream chunks.
- Call `pending_interrupt(state)` to detect when a graph is paused and needs a decision.

## Next step

Learn how to unit test your agent — [Test and evaluate](/docs/get-started/tutorial/test-and-evaluate).
