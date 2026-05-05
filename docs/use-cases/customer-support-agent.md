---
title: Build a Customer Support AI Agent in Python
description: Reference architecture for a production customer support AI agent in Python. Intent routing, ticket lookup, refund tools, and human handoff with AgentFlow.
keywords:
  - customer support ai agent
  - support automation python
  - ai customer service
  - support agent framework
  - chat agent python
sidebar_position: 2
---

# Build a customer support AI agent in Python

A customer support agent is the highest-leverage AI system for most SaaS teams. Done well, it deflects 30–50% of tickets without lowering CSAT. Done poorly, it generates angrier customers.

Here is the production architecture we recommend with AgentFlow.

## Architecture at a glance

```
[ User message ]
       │
       ▼
[ Intent classifier (LLM) ]   ← deterministic routing
       │
       ├─→ [ Order lookup ]
       ├─→ [ Refund agent ] ── tools: get_order, refund_order, escalate
       ├─→ [ Shipping agent ] ── tools: get_tracking, reship, escalate
       └─→ [ General agent ] ── tools: search_docs, escalate
                │
                ▼
       [ If escalate: Human handoff (interrupt + checkpoint) ]
```

This is a **hybrid workflow + agent** shape: a deterministic router up front, agents in each branch, human-in-the-loop on escalation. See [agents vs workflows](/blog/ai-agents-vs-workflows) for why.

## Why this shape

- **Cheap routing.** A small classifier model picks the lane. The expensive specialist only runs when needed.
- **Branch isolation.** Refund agent has no shipping tools. Fewer ways for it to confuse itself.
- **Audit trail.** Each branch is a graph node with explicit tool calls; every decision is loggable.
- **Safe escalation.** Human handoff is a graph interrupt, durable across restarts.

## The router

```python
from agentflow.core.graph import Agent, StateGraph
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

router = Agent(
    model="google/gemini-2.5-flash",  # small + fast
    system_prompt=[{"role": "system", "content": (
        "Classify the user's request into exactly one of: REFUND, SHIPPING, GENERAL. "
        "Return only the label."
    )}],
)
```

For higher reliability, you can replace the LLM router with a deterministic Python classifier (regex, intent model, or a small fine-tuned head). See [multi-agent patterns](/blog/multi-agent-orchestration-python-7-patterns).

## The refund specialist

```python
from agentflow.core.graph import ToolNode

def get_order(order_id: str) -> str:
    """Look up an order by ID. Returns status, items, and total."""
    order = orders_db.fetch(order_id)
    return order.summary() if order else f"No order found with ID {order_id}."

def issue_refund(order_id: str, reason: str) -> str:
    """Issue a refund for an order. Use only after confirming with the user."""
    key = f"refund-{order_id}"  # idempotency
    return payments.refund(order_id, reason=reason, idempotency_key=key)

def escalate_to_human(reason: str) -> str:
    """Hand off to a human agent. Use when the user is upset or the case is unusual."""
    queue.enqueue({"reason": reason, "escalated_at": datetime.now()})
    return "Escalated to a human agent. They will respond shortly."

refund_tools = ToolNode([get_order, issue_refund, escalate_to_human])

refund_agent = Agent(
    model="anthropic/claude-3-5-sonnet",  # bigger model for nuanced cases
    system_prompt=[{"role": "system", "content": (
        "You handle refund requests. Always look up the order before refunding. "
        "Confirm details with the user before issuing a refund. "
        "Escalate if the customer is upset, the amount is over $500, or the case is unusual."
    )}],
    tool_node="REFUND_TOOLS",
)
```

Notes:

- **Idempotency keys** on every refund call. See [the production post](/blog/production-ai-agents-observability-retries).
- **Mixed model sizes**. Small for routing, big for specialist work.
- **Explicit escalation rules** in the system prompt. Models follow rules better than they decide on their own.

## The graph

```python
graph = StateGraph(AgentState)
graph.add_node("ROUTE", router)
graph.add_node("REFUND", refund_agent)
graph.add_node("REFUND_TOOLS", refund_tools)
graph.add_node("SHIPPING", shipping_agent)
graph.add_node("SHIPPING_TOOLS", shipping_tools)
graph.add_node("GENERAL", general_agent)
graph.add_node("GENERAL_TOOLS", general_tools)

def pick_lane(state):
    label = state.context[-1].text().strip().upper()
    return label if label in {"REFUND", "SHIPPING", "GENERAL"} else "GENERAL"

graph.set_entry_point("ROUTE")
graph.add_conditional_edges(
    "ROUTE", pick_lane,
    {"REFUND": "REFUND", "SHIPPING": "SHIPPING", "GENERAL": "GENERAL"},
)
# Each specialist loops with its tool node
graph.add_conditional_edges("REFUND", route_to_tools, {"REFUND_TOOLS": "REFUND_TOOLS", END: END})
graph.add_edge("REFUND_TOOLS", "REFUND")
# ... same shape for SHIPPING and GENERAL ...

app = graph.compile(checkpointer=PgCheckpointer(...))
```

## Operational notes

- **Persist threads from day one.** Support conversations span hours; `thread_id` makes them durable.
- **Stream responses.** Users wait. See [SSE streaming](/blog/streaming-agent-responses-fastapi-sse).
- **Human handoff is a checkpoint.** When the agent calls `escalate_to_human`, the graph pauses; a human picks up the same thread.
- **Per-user rate limits.** A buggy frontend or abusive user can rack up token costs fast.

## Metrics that matter

| Metric | Target |
|---|---|
| Deflection rate | 30–50% |
| First-response time (TTFB) | < 1.5 s p95 |
| Escalation rate | 10–25% |
| CSAT (compared to human-only baseline) | within 5% |
| Cost per resolved ticket | < $0.50 |

## Further reading

- [Multi-agent handoff patterns](/docs/how-to/python/handoff-between-agents)
- [Multi-agent orchestration in Python](/blog/multi-agent-orchestration-python-7-patterns)
- [ReAct agent with real APIs](/blog/react-agent-tools-real-apis)
- [Get started](/docs/get-started)
