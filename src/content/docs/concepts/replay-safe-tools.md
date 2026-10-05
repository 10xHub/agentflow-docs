---
title: Replay-safe tools
seoTitle: "Replay-safe tools: no double tool calls"
description: Replay-safe tools let a resumed 10xGraph run skip tool calls that already finished, so a crash does not charge a card or send an email twice.
section: Concepts
order: 155
updated: 2026-10-06
faq:
  - q: Does 10xGraph guarantee a tool runs exactly once?
    a: No. It guarantees that a tool call recorded in the checkpointer's ledger is not executed again. A crash in the short window after a tool finishes but before its record is written can still run it again, and a tool that crashes or times out before returning is not recorded. Pass your own idempotency key to the external service for those cases.
  - q: Which checkpointers support replay-safe tools?
    a: PgCheckpointer stores the ledger durably in PostgreSQL. InMemoryCheckpointer keeps it in process memory, so it only protects replays inside the same process. SqliteCheckpointer does not implement the ledger, and a checkpointer that does not implement it falls back to at-least-once behavior.
  - q: Do I need to change my tool code to make it replay-safe?
    a: No. The check happens around the tool call, not inside it. Write the tool as a normal function. Add an idempotency key to calls to payment or email providers as a second layer of protection.
  - q: What happens when a replayed tool call is skipped?
    a: 10xGraph returns the result that was recorded when the tool first ran, so the model still sees a normal tool result and the run continues from where it was interrupted.
---

Replay-safe tools are tool calls that 10xGraph will not execute a second time when a run is resumed after a crash. Each finished call is recorded in the checkpointer as soon as it returns. On replay, the recorded result is used instead of calling the tool again.

## What failure does it prevent?

Agents call tools with side effects: refunds, emails, tickets, database writes. Consider a support agent that calls `refund_order`.

1. The model asks for `refund_order("1042", 59.0)`.
2. The tool runs and the refund goes through.
3. The process is killed (an out-of-memory kill, a deploy, a node failure) before the node finishes.
4. The run resumes. The run loop saved the current node before it started, so it runs that node again from the top.
5. Without protection, `refund_order` runs again and the customer is refunded twice.

The same shape applies to a charge, a sent email or a created ticket. The [blog post on this failure](/blog/your-agent-charged-the-card-twice) covers it in more depth.

## How does it work?

The logic lives in `agentflow/core/graph/utils/invoke_node_handler.py`.

1. **The node is persisted first.** The run loop records the current node before it runs and advances only after the node completes. A killed process therefore re-runs the interrupted node on resume.
2. **Each call gets an identity.** The ledger key is the id of the assistant message that issued the call plus the `tool_call_id`. Models often reuse ids such as `call_1` on every turn, so the call id alone would make a later turn collide with an earlier one and skip a tool that never ran. The assistant message is persisted, so it carries the same id on replay and the key stays stable.
3. **The ledger is checked before the call.** If the checkpointer holds a result for that key, 10xGraph returns it and does not invoke the tool.
4. **The result is recorded right after the call.** The record is written as soon as the tool returns, not at the end of the node, so a crash later in the same node cannot re-fire it. Parallel tool calls in one node are tracked per call, so siblings that finished are skipped on replay.

## What does it not guarantee?

This is at-most-once protection for recorded calls, not a global exactly-once guarantee. The limits, all visible in the source:

- **A crash before the tool returns.** If the process dies while the tool is running, nothing has been recorded, so the tool runs again on resume. The external side effect may already have happened.
- **The gap after return.** Between the tool returning and the record being written there is a short window. A crash inside it can run the tool again.
- **A failed record write.** If the checkpointer cannot store the record, 10xGraph logs an error that the call completed but was not recorded, and a replay may execute it a second time. The write failure does not stop the run.
- **A failed ledger read.** If the ledger cannot be read, the tool runs again, and a log warning says so. 10xGraph treats an unreadable entry as "no record" because skipping a tool that never ran is worse.
- **Timeouts.** A tool that exceeds its timeout is cancelled and raises an error, and nothing is recorded for it. If the provider had already acted, the call may run again.
- **Missing ids.** If the call has no `tool_call_id` or the issuing message has no id, no key can be built and the tool is not protected.

For these cases, keep sending an idempotency key to the payment or email provider. Derive it from stable inputs such as the order id, not from a random value generated inside the tool.

## How do I enable it?

Replay safety needs a checkpointer that implements the ledger, and a `thread_id` on every call. Without a checkpointer, tools run as they would in any framework.

| Checkpointer | Ledger | Survives a process restart |
|---|---|---|
| `PgCheckpointer` | Yes, in a PostgreSQL `tool_executions` table | Yes |
| `InMemoryCheckpointer` | Yes, in process memory | No |
| `SqliteCheckpointer` | Not implemented | Not applicable |

For production, install the extra and compile the graph with `PgCheckpointer`:

```bash
pip install "10xgraph[pg_checkpoint]"
```

```python
from agentflow.prebuilt.agent import ReactAgent
from agentflow.storage.checkpointer import PgCheckpointer


def lookup_order(order_id: str) -> dict:
    """Look up an order by id and return its status and total."""
    return {"order_id": order_id, "status": "delivered", "total": 59.0}


def refund_order(order_id: str, amount: float) -> str:
    """Refund an order. Moves money, so it must not run twice for one request."""
    # Also pass an idempotency key to your payment provider, derived from
    # stable inputs, to cover the cases listed above.
    return f"Refunded {amount:.2f} for order {order_id}"


checkpointer = PgCheckpointer(
    postgres_dsn="postgresql://user:password@db/agentflow",
    redis_url="redis://redis:6379/0",
)

app = ReactAgent(
    model="google/gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "You are a support agent for an online shop."}],
    tools=[lookup_order, refund_order],
).compile(checkpointer=checkpointer)
```

The API server uses the checkpointer carried by the compiled graph. See [Checkpointing](/docs/how-to/production/checkpointing) for setup details. After a crash, call the same thread again with the same `thread_id` and the run continues from the saved node.

## How does it relate to versioned writes and timeouts?

Two other protections cover neighboring failures.

- **Versioned state writes.** `PgCheckpointer` keeps a per-thread version counter with a unique `(thread_id, version)` constraint and uses an optimistic compare-and-swap for durable writes, so two runs on the same thread cannot overwrite each other. The Redis cache write is guarded by the same version, so a stale run cannot move the cache backwards. This protects state, while the ledger protects side effects.
- **Timeouts.** `node_timeout` (default 900 seconds) and `tool_timeout` (default 300 seconds) stop a hung call from holding a worker forever. Set them per run in the config, for example `config={"thread_id": "t1", "tool_timeout": 60}`. A value of `None` or `0` disables the timeout. Defaults are in `agentflow/utils/constants.py`.

## Related pages

- [Your agent charged the card twice](/blog/your-agent-charged-the-card-twice), the engineering write-up.
- [What is durable execution for AI agents?](/docs/glossary/what-is-durable-execution)
- [What is an idempotent tool call?](/docs/glossary/what-is-an-idempotent-tool-call)
- [Checkpointing](/docs/how-to/production/checkpointing) and [Memory: hot and cold](/docs/concepts/memory)
- [Checkpointing and threads](/docs/concepts/checkpointing-and-threads)
