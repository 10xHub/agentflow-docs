---
title: Build a Data Extraction AI Agent in Python
description: How to build a structured data extraction AI agent in Python — pull entities, fields, and relationships from unstructured text with AgentFlow + Pydantic.
keywords:
  - data extraction ai agent
  - structured output llm
  - python data extraction
  - llm entity extraction
  - extraction agent framework
sidebar_position: 3
---

# Build a data extraction AI agent in Python

Pulling structured data out of unstructured text — invoices, contracts, support tickets, scraped pages — is one of the highest-ROI uses of LLMs. The trick is making the output reliable enough to ship to a database.

Here is the production architecture.

## Architecture at a glance

```
[ Document text ]
       │
       ▼
[ Schema-aware LLM call ] ── enforces JSON shape
       │
       ▼
[ Validator ] ── pydantic / jsonschema
       │
       ├─→ valid? → write to DB
       └─→ invalid? → retry with error feedback (max 3)
```

This is mostly a **workflow** with a single agent loop for retries. See [agents vs workflows](/blog/ai-agents-vs-workflows).

## Why this shape

- **Structured output is non-negotiable.** A field that should be a date but came back as "soon" breaks downstream code.
- **Validation feedback loops produce 95%+ first-try success.** Way better than parsing free text.
- **No tool calls needed in most cases.** The LLM is just a structured-output engine.

## The schema

```python
from pydantic import BaseModel, Field
from datetime import date
from decimal import Decimal

class InvoiceLineItem(BaseModel):
    description: str
    quantity: int
    unit_price: Decimal
    total: Decimal

class Invoice(BaseModel):
    invoice_number: str = Field(description="The invoice ID printed on the document")
    issue_date: date
    due_date: date
    vendor_name: str
    total_amount: Decimal
    line_items: list[InvoiceLineItem]
```

Pydantic models double as the schema for the model and the validator for the result.

## The extraction agent

```python
from agentflow.core.graph import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

def submit_invoice(invoice: dict) -> str:
    """Submit the extracted invoice. Call this once with the full structured data."""
    try:
        validated = Invoice.model_validate(invoice)
        invoices_db.write(validated.model_dump())
        return f"Saved invoice {validated.invoice_number}."
    except Exception as e:
        return f"Validation error: {e}. Fix the issues and resubmit."

extractor = Agent(
    model="anthropic/claude-3-5-sonnet",  # extraction benefits from larger models
    system_prompt=[{"role": "system", "content": (
        "Extract invoice data from the document. "
        f"Use the submit_invoice tool with this schema: {Invoice.model_json_schema()}. "
        "If submit_invoice returns a validation error, fix the issue and call submit_invoice again. "
        "Do not summarize. Do not chat. Just extract and submit."
    )}],
    tool_node="TOOL",
)

tool_node = ToolNode([submit_invoice])

graph = StateGraph(AgentState)
graph.add_node("MAIN", extractor)
graph.add_node("TOOL", tool_node)

def route(state):
    last = state.context[-1] if state.context else None
    if last and getattr(last, "tools_calls", None) and last.role == "assistant":
        return "TOOL"
    if last and last.role == "tool":
        # If submission succeeded, end. If it failed, loop back to MAIN.
        if "Validation error" in last.text():
            return "MAIN"
        return END
    return END

graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", "MAIN": "MAIN", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")
app = graph.compile()
```

The agent submits, gets validated, fixes errors, resubmits — usually in 1 or 2 iterations. Cap iterations with `recursion_limit=5`.

## Running it

```python
result = app.invoke(
    {"messages": [Message.text_message(invoice_text)]},
    config={"thread_id": f"extract-{invoice_id}", "recursion_limit": 5},
)
```

## Operational notes

- **Use a model that supports structured output.** Claude 3.5 Sonnet, GPT-4o, Gemini 1.5+ all do well. Smaller models miss nested structure.
- **Pre-process the document.** Strip headers, footers, and page numbers before extraction. The model wastes attention on them otherwise.
- **Validate strictly.** Pydantic + custom validators catch the long tail.
- **Log failures with the input.** When extraction fails, you need the input to debug. Redact PII first.
- **Idempotency.** Use `thread_id = invoice_hash` so duplicate documents do not create duplicate rows.

## Variants of this pattern

- **Form filling** — extract user data from chat into a typed form
- **Email triage** — extract sender, intent, urgency, action items
- **Contract review** — extract terms, dates, parties from legal docs
- **Web scraping cleanup** — turn scraped HTML into typed records

The graph shape is the same. Only the schema changes.

## Metrics that matter

| Metric | Target |
|---|---|
| First-try validation success | > 90% |
| Total success after retries | > 99% |
| Cost per document | depends on length, but plan < $0.05 for short docs |
| p95 latency | < 8 s for typical documents |

## Further reading

- [ReAct agent validation tutorial](/docs/tutorials/from-examples/react-agent-validation)
- [Custom state in AgentFlow](/docs/tutorials/from-examples/custom-state)
- [Production observability](/blog/production-ai-agents-observability-retries)
- [Get started](/docs/get-started)
