---
title: Building Eval Sets — Testing and evaluation
sidebar_label: Eval Sets
description: How to build evaluation datasets with EvalSetBuilder — single-turn cases, multi-turn conversations, tool call assertions, and loading from files.
keywords:
  - EvalSetBuilder
  - EvalSet
  - EvalCase
  - ToolCall
  - agentflow evaluation
  - python ai agent framework
---

# Building Eval Sets

An `EvalSet` is a named collection of test cases (`EvalCase`). You build one using the fluent `EvalSetBuilder` API, load it from a JSON file, or create it inline.

## EvalSetBuilder

### Single-turn case

```python
from agentflow.qa.evaluation import EvalSetBuilder

eval_set = (
    EvalSetBuilder("customer-support")
    .add_case(
        query="How do I reset my password?",
        expected="visit the account settings page",
        case_id="reset_password",
    )
    .build()
)
```

`query` is the user's input. `expected` is the response the agent should produce (used by response-matching criteria). `case_id` is optional — auto-generated if omitted.

### Case with expected tools

Provide `expected_tools` as a list of tool names or `ToolCall` objects:

```python
from agentflow.qa.evaluation import EvalSetBuilder, ToolCall

eval_set = (
    EvalSetBuilder("weather-agent")
    .add_case(
        query="Weather in London?",
        expected="The weather in London is sunny.",
        expected_tools=["get_weather"],          # tool names only
    )
    .add_case(
        query="Weather in Tokyo?",
        expected="Raining in Tokyo.",
        expected_tools=[
            ToolCall(name="get_weather", args={"location": "Tokyo"}),
        ],                                        # with expected args
    )
    .build()
)
```

When `expected_tools` contains `ToolCall` objects with `args`, trajectory criteria can optionally verify the arguments too (controlled by `check_args` in `CriterionConfig`).

### Case with expected node order

Use `expected_node_order` to verify the graph visited nodes in a specific sequence:

```python
.add_case(
    query="Search and summarise the latest AI news",
    expected="Here is a summary...",
    expected_tools=["search_web"],
    expected_node_order=["MAIN", "TOOL", "MAIN"],
)
```

### Focused tool test

`add_tool_test` is a shortcut for cases where a single tool call is the primary concern:

```python
.add_tool_test(
    query="What is the weather in Berlin?",
    tool_name="get_weather",
    tool_args={"location": "Berlin"},
    expected_response="Berlin",  # optional; defaults to "Result from get_weather"
    case_id="berlin_weather",
)
```

### Multi-turn conversation

```python
.add_multi_turn(
    conversation=[
        ("Hello", "Hi! How can I help?"),
        ("What can you do?", "I can check weather, search the web, and more."),
        ("Check weather in Paris", "It is 18°C in Paris."),
    ],
    expected_tools=["get_weather"],
    case_id="multi_turn_weather",
)
```

The evaluator runs the agent for each turn and scores the final state.

### Quick builder from pairs

```python
from agentflow.qa.evaluation import EvalSetBuilder

eval_set = EvalSetBuilder.quick(
    ("Hello", "Hi!"),
    ("What is 2+2?", "4"),
    ("Capital of France?", "Paris"),
)
```

### From a list of conversations

```python
conversations = [
    {"user": "Hello", "assistant": "Hi!"},
    {"user": "Bye", "assistant": "Goodbye!"},
]
eval_set = EvalSetBuilder.from_conversations(conversations, name="smoke-tests")
```

---

## Save and load

### Save to JSON

```python
# Build and save in one step
eval_set = EvalSetBuilder("weather-tests").add_case(...).save("evals/weather.json")

# Or save an existing eval set
eval_set.to_file("evals/weather.json")
```

### Load from JSON

```python
from agentflow.qa.evaluation import EvalSet

eval_set = EvalSet.from_file("evals/weather.json")
```

### Load and modify

```python
builder = EvalSetBuilder.from_file("evals/weather.json")
builder.add_case(query="Weather in Seoul?", expected="Seoul")
eval_set = builder.build()
```

---

## EvalCase directly

You can construct `EvalCase` objects without the builder:

```python
from agentflow.qa.evaluation import EvalCase, ToolCall

case = EvalCase.single_turn(
    eval_id="london_weather",
    user_query="Weather in London?",
    expected_response="It is sunny in London.",
    expected_tools=[ToolCall(name="get_weather", args={"location": "London"})],
    expected_node_order=["MAIN", "TOOL", "MAIN"],
    name="London weather check",
    description="Verifies the weather tool is called for London queries",
)
```

Multi-turn:

```python
case = EvalCase.multi_turn(
    eval_id="multi_weather",
    conversation=[
        ("Weather in London?", "Sunny."),
        ("And in Tokyo?", "Rainy."),
    ],
    expected_tools=[ToolCall(name="get_weather")],
)
```

---

## ToolCall reference

```python
from agentflow.qa.evaluation import ToolCall

# Name only (args not checked)
ToolCall(name="get_weather")

# With args (args checked when check_args=True in CriterionConfig)
ToolCall(name="get_weather", args={"location": "London"})
```

`ToolCall.args` defaults to `{}`. Argument checking is off by default — enable it per criterion with `CriterionConfig.trajectory(check_args=True)`.

---

## EvalSet structure

| Attribute | Type | Description |
|---|---|---|
| `eval_set_id` | `str` | UUID auto-generated by the builder |
| `name` | `str` | Human-readable label shown in reports |
| `eval_cases` | `list[EvalCase]` | The test cases |

| EvalCase attribute | Type | Description |
|---|---|---|
| `eval_id` | `str` | Unique ID for this case |
| `name` | `str` | Optional label shown in reports |
| `description` | `str` | Optional details shown in reports |
| `expected_response` | `str` | What the final response should say |
| `expected_tools` | `list[ToolCall] \| None` | Tool calls expected during execution |
| `expected_node_order` | `list[str] \| None` | Node visit sequence expected |
| `invocations` | `list[Invocation]` | One per conversation turn |

---

## Next steps

- [Criteria reference](./criteria.md) — what gets scored and how
- [Presets](./presets.md) — ready-made `EvalConfig` objects
- [Running evaluations](./index.md) — the `agentflow eval` CLI
