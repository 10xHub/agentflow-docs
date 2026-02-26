# Quickstart

Get started evaluating your Agentflow agent in under 5 minutes. This guide uses `QuickEval` — a simplified interface that reduces evaluation setup from ~50 lines to ~5 lines.

---

## Prerequisites

- An Agentflow `StateGraph` built with the `Agent` class (see [Building a Graph](../index.md#building-a-graph-with-the-agent-class))
- A compiled app + collector, created via `create_eval_app()`

```python
from agentflow.evaluation import create_eval_app

# Compile once — reuse `compiled` and `collector` for all evaluations
compiled, collector = create_eval_app(my_graph)
```



> **Important:** The graph must be compiled **once** and reused across all evaluation calls in the same process. The `CallbackManager` is bound globally on first compile — compiling a second graph will result in empty trajectory data. See [Manual Setup — Step 2](manual_setup.md#step-2-wire-the-trajectory-collector) for details.

<details>
<summary>Manual setup (without <code>create_eval_app</code>)</summary>

```python
from agentflow.evaluation import TrajectoryCollector, make_trajectory_callback

collector = TrajectoryCollector()
_, callback_mgr = make_trajectory_callback(collector)
compiled = my_graph.compile(callback_manager=callback_mgr)
```

</details>

---

## 1. Quick Single Check

Test a single query against your agent:

```python
from agentflow.evaluation import QuickEval

report = await QuickEval.check(
    graph=compiled,
    collector=collector,
    query="What is the weather in London?",
    expected_response_contains="London",
)
print(f"Passed: {report.summary.passed_cases}/{report.summary.total_cases}")
```

`QuickEval.check()` automatically:
- Creates an `EvalCase` from your query
- Picks sensible criteria (response matching, optionally tool matching)
- Runs the graph, collects results, and prints a console report

### With Expected Tools

```python
report = await QuickEval.check(
    graph=compiled,
    collector=collector,
    query="What is the weather in London?",
    expected_response_contains="London",
    expected_tools=["get_weather"],
    threshold=0.7,
)
```

When `expected_tools` is provided, `QuickEval` adds `tool_name_match_score` criteria automatically.

---

## 2. Batch Evaluation

Test multiple query-response pairs at once:

```python
report = await QuickEval.batch(
    graph=compiled,
    collector=collector,
    test_pairs=[
        ("What is the weather in London?", "sunny"),
        ("What is the weather in Tokyo?", "cloudy"),
        ("Hello!", "Hi"),
    ],
    threshold=0.7,
)
```

Each tuple is `(user_query, expected_response)`. All cases run sequentially and produce a single `EvalReport`.

---

## 3. Tool Usage Testing

Validate that your agent calls the right tools with correct arguments:

```python
report = await QuickEval.tool_usage(
    graph=compiled,
    collector=collector,
    test_cases=[
        ("Weather in NYC?", "sunny in NYC", ["get_weather"]),
        ("Forecast for London?", "rain expected", ["get_forecast"]),
    ],
    strict=True,  # EXACT match mode
)
```

Each tuple is `(query, expected_response, expected_tool_names)`.

---

## 4. Conversation Flow

Test multi-turn conversations:

```python
report = await QuickEval.conversation_flow(
    graph=compiled,
    collector=collector,
    conversation=[
        ("Hello", "Hi there!"),
        ("What is the weather?", "It is sunny."),
        ("Thanks!", "You're welcome!"),
    ],
    threshold=0.8,
)
```

---

## 5. Using Presets

Apply pre-configured evaluation profiles:

```python
from agentflow.evaluation import EvalPresets, EvalSet

# Load test cases from a JSON file
eval_set = EvalSet.from_file("tests/fixtures/my_tests.json")

# Use a preset configuration
report = await QuickEval.preset(
    graph=compiled,
    collector=collector,
    preset=EvalPresets.comprehensive(threshold=0.8),
    eval_set=eval_set,
)
```

Available presets:

| Preset | Criteria Included |
|---|---|
| `EvalPresets.quick_check()` | Response match (relaxed threshold 0.5) |
| `EvalPresets.response_quality()` | Response match + optional LLM judge |
| `EvalPresets.tool_usage()` | Tool name match + trajectory match |
| `EvalPresets.conversation_flow()` | Response match + trajectory (IN_ORDER) |
| `EvalPresets.comprehensive()` | All criteria: tool, response, LLM judge, safety, hallucination, factual |
| `EvalPresets.safety_check()` | Hallucination + safety only |

---

## 6. Using EvalSetBuilder

Build test cases programmatically with the fluent builder:

```python
from agentflow.evaluation import EvalSetBuilder

eval_set = (
    EvalSetBuilder("weather_tests")
    .add_case(
        query="Weather in London?",
        expected="It is sunny in London",
        expected_tools=["get_weather"],
    )
    .add_case(
        query="Forecast for Tokyo?",
        expected="Rain expected in Tokyo",
        expected_tools=["get_forecast"],
    )
    .add_tool_test(
        query="Weather in NYC?",
        tool_name="get_weather",
        tool_args={"city": "new york"},
    )
    .build()
)
```

Or create an eval set in one line:

```python
eval_set = EvalSetBuilder.quick(
    ("Hello", "Hi there!"),
    ("Weather?", "It is sunny."),
)
```

### Evaluate Directly from Builder

Skip the `build()` step entirely with `QuickEval.from_builder()`:

```python
builder = (
    EvalSetBuilder("weather_tests")
    .add_case(query="Weather in London?", expected="Sunny in London", expected_tools=["get_weather"])
    .add_case(query="Forecast for Tokyo?", expected="Rain expected", expected_tools=["get_forecast"])
)

report = await QuickEval.from_builder(
    graph=compiled,
    collector=collector,
    builder=builder,
    config=EvalPresets.tool_usage(),  # optional
    verbose=True,
    print_results=True,
)
```

---

## Synchronous Usage

If you're not in an async context:

```python
report = QuickEval.run_sync(
    graph=compiled,
    collector=collector,
    eval_set=eval_set,
    config=EvalPresets.quick_check(),
)
```

---

## Next Steps

- [Manual Setup](manual_setup.md) — Full control over the evaluation pipeline
- [Single-Turn Evaluation](../tutorial/single_turn_evaluation.md) — Detailed walkthrough
- [Criteria Reference](../reference/criteria.md) — All available criteria
