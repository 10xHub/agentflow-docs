---
title: Calculator Tool — Prebuilt tools
sidebar_label: Calculator Tool
description: safe_calculator evaluates arithmetic expressions with Python's ast module, safely exposing math to an LLM without code execution.
keywords:
  - calculator tool
  - safe_calculator
  - agentflow arithmetic tool
  - safe expression evaluator
  - math tool for llm
---

# Calculator Tool

A safe arithmetic expression evaluator that lets an agent perform math without executing arbitrary code.

**Import path:** `agentflow.prebuilt.tools`

---

## `safe_calculator`

Evaluates a basic arithmetic expression string and returns the numeric result.

### What it does

The tool parses the expression using Python's `ast` module and evaluates only a known-safe subset of nodes — no function calls, no attribute access, no variables. This makes it safe to expose to an LLM without risk of code execution.

**Supported operators:** `+`, `-`, `*`, `/`, `//`, `%`, `**`

**Safety limits:**

| Limit | Value |
|---|---|
| Maximum expression length | 500 characters |
| Maximum absolute value (inputs and result) | 10¹² |
| Maximum power exponent | 12 |
| Infinity / NaN | rejected |

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `expression` | `str` | required | Arithmetic expression to evaluate, e.g. `"(3 + 4) * 2"` |
| `precision` | `int \| None` | `None` | Round float results to this many decimal places (0–12) |

### Return value

A JSON string:

```json
{"result": 14}
```

On error:

```json
{"error": "division by zero"}
```

### Usage

```python
from agentflow.prebuilt.tools import safe_calculator
from agentflow.core.graph import Agent, ToolNode

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([safe_calculator]),
    system_prompt=[{
        "role": "system",
        "content": "You are a math assistant. Use safe_calculator for all arithmetic.",
    }],
)
app = agent.compile()

result = await app.ainvoke(
    {"message": "What is (123 * 456) / 7?"},
    config={"thread_id": "t1"},
)
```

### Combining with other tools

```python
from agentflow.prebuilt.tools import safe_calculator, google_web_search
from agentflow.prebuilt.agent import ReactAgent

agent = ReactAgent(
    model="gemini-2.5-flash",
    tools=[safe_calculator, google_web_search],
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a research assistant that can do math. "
            "Search the web for facts, then use safe_calculator for any computations."
        ),
    }],
)
app = agent.compile()
```
