---
title: How to pause a graph for human input with interrupt()
description: Use interrupt() inside a node or tool to stop a graph for an approval, a correction, or a choice, then resume it with the answer.
section: How-to guides
group: Python library
order: 560
label: Pause for human input
updated: "2026-09-29"
---

`interrupt()` stops a running graph from inside a node or a tool and waits for outside input: an approval, a correction, a choice. The graph saves its state and ends the run. Running the same thread again with a `resume` value continues it, and `interrupt()` returns that value.

Use it when the decision belongs in the middle of a node or tool. To pause at fixed points in the graph instead, use `interrupt_before` / `interrupt_after` on `compile()` (see [StateGraph interrupts](/docs/concepts/state-graph#interrupts)).

The graph needs a checkpointer, because the pause is saved in the thread's state. `compile()` uses an in-memory one when you do not pass one.

---

## Step 1: Ask inside a tool

```python
from agentflow.utils import interrupt

async def refund(amount: int) -> str:
    """Refund an order, after a human approves it."""
    decision = interrupt(
        {"amount": amount},
        message=f"Approve a refund of ${amount}?",
        reason="tool_approval",
        response_schema={
            "type": "object",
            "properties": {"approved": {"type": "boolean"}},
        },
    )
    if not decision or not decision.get("approved"):
        return "refund declined"
    return issue_refund(amount)
```

| Argument | Meaning |
| --- | --- |
| `value` | Data for whoever answers: what to approve, what to choose from. |
| `message` | A human-readable prompt. UIs such as CopilotKit show it. |
| `reason` | A short machine-readable reason, for example `"tool_approval"`. Defaults to `"input_required"`. |
| `response_schema` | JSON Schema describing the answer you expect. |

`interrupt()` works the same way in a plain function node.

---

## Step 2: Run until the pause

```python
from agentflow.utils import pending_interrupt
from agentflow.utils.constants import ResponseGranularity

config = {"thread_id": "order-42"}
result = await app.ainvoke(
    {"messages": [Message.text_message("Refund my order, it was $25")]},
    config=config,
    response_granularity=ResponseGranularity.FULL,
)

request = pending_interrupt(result["state"])
if request:
    print(request.message)       # "Approve a refund of $25?"
    print(request.value)         # {"amount": 25}
    print(request.tool_call_id)  # set when interrupt() ran inside a tool
```

When streaming at `ResponseGranularity.FULL` (the only granularity that includes `UPDATES`
chunks), the pause arrives as one:

```python
async for chunk in app.astream(
    {"messages": [...]}, config=config, response_granularity=ResponseGranularity.FULL
):
    if chunk.event == StreamEvent.UPDATES and chunk.data.get("status") == "interrupted":
        request = chunk.data["interrupt"]  # the same fields, as a dict
```

---

## Step 3: Resume with the answer

```python
result = await app.ainvoke({"resume": {"approved": True}}, config=config)
```

The paused node runs again from the start, and this time `interrupt()` returns `{"approved": True}`. Resuming with `None` is how a client says "cancelled".

A paused thread only accepts a resume. Sending new messages instead raises `ValueError`, and sending `resume` to a thread that is not paused at `interrupt()` does too.

---

## How it behaves

- **The node runs twice.** Code before `interrupt()` runs on the first attempt and again on resume, so keep side effects (writes, payments) after the call.
- **Several calls in one node** are answered in order, one resume each: the first resume answers the first call, the node pauses at the second, and so on.
- **Parallel tool calls.** When the model calls several tools at once and one of them interrupts, the tools that already finished are not run again on resume under `invoke`/`ainvoke` (their results come from the tool-result ledger). Under `stream`/`astream`, finished siblings run again, so make those tools idempotent.
- **Do not catch it.** `interrupt()` stops the graph by raising `GraphInterrupt`. It derives from `BaseException`, so `except Exception` blocks (including tool error handling) let it through. Do not catch `BaseException` around the call.
- `interrupt()` outside a running node or tool raises `RuntimeError`.

---

## Over the API and AG-UI

- **REST:** `POST /v1/graph/invoke` and `/v1/graph/stream` accept `"resume": <value>` in place of `messages` to resume a paused thread.
- **AG-UI / CopilotKit:** a pause ends the run with an `interrupt` outcome, and CopilotKit's `useInterrupt` answers it. See [10xGraph with CopilotKit](/docs/integrations/agentflow-with-copilotkit#approvals-with-interrupt).
