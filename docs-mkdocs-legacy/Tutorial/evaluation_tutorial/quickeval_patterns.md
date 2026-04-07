# QuickEval Patterns

This tutorial covers all `QuickEval` methods and common usage patterns. `QuickEval` is the fastest way to evaluate your Agentflow agents — most methods need only 3–5 lines.

---

## Prerequisites

```python
from agentflow.evaluation import QuickEval, create_eval_app

# Compile once — reuse for all QuickEval calls
compiled, collector = create_eval_app(my_graph)
```

> **Important:** Always compile `once` and reuse the same `compiled` and `collector` objects. See [Manual Setup — Step 2](../getting_started/manual_setup.md#step-2-wire-the-trajectory-collector) for why this matters.

---

## QuickEval Methods

### `QuickEval.check()` — Single Query

Test a single query against your agent:

```python
report = await QuickEval.check(
    graph=compiled,
    collector=collector,
    query="What is the weather in London?",
    expected_response_contains="London",
    threshold=0.7,
)
```

With expected tools:

```python
report = await QuickEval.check(
    graph=compiled,
    collector=collector,
    query="What is the weather in London?",
    expected_response_contains="London",
    expected_tools=["get_weather"],  # Auto-adds tool criteria
    threshold=0.7,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `graph` | `CompiledGraph` | — | Compiled agent graph |
| `collector` | `TrajectoryCollector` | — | Wired trajectory collector |
| `query` | `str` | — | User query to test |
| `expected_response_contains` | `str \| None` | `None` | Text the response should contain |
| `expected_response_equals` | `str \| None` | `None` | Exact expected response |
| `expected_tools` | `list[str] \| None` | `None` | Expected tool names |
| `threshold` | `float` | `0.7` | Pass threshold |
| `verbose` | `bool` | `True` | Log progress |
| `print_results` | `bool` | `True` | Print console report |

---

### `QuickEval.batch()` — Multiple Pairs

Test multiple query-response pairs:

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

### `QuickEval.tool_usage()` — Tool Validation

Validate tool calls with optional strict matching:

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

### `QuickEval.conversation_flow()` — Multi-Turn

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

### `QuickEval.preset()` — Use Presets

Apply a pre-configured evaluation profile to an existing eval set:

```python
from agentflow.evaluation import EvalPresets, EvalSet

eval_set = EvalSet.from_file("tests/fixtures/my_tests.json")

report = await QuickEval.preset(
    graph=compiled,
    collector=collector,
    preset=EvalPresets.comprehensive(threshold=0.8),
    eval_set=eval_set,
)
```

---

### `QuickEval.from_builder()` — Builder Integration

Skip the `build()` step and evaluate directly from a builder:

```python
from agentflow.evaluation import EvalSetBuilder, EvalPresets

builder = (
    EvalSetBuilder("weather_tests")
    .add_case(query="Weather in London?", expected="Sunny", expected_tools=["get_weather"])
    .add_case(query="Forecast?", expected="Rain", expected_tools=["get_forecast"])
    .add_tool_test(query="NYC weather?", tool_name="get_weather", tool_args={"city": "nyc"})
)

report = await QuickEval.from_builder(
    graph=compiled,
    collector=collector,
    builder=builder,
    config=EvalPresets.tool_usage(),
)
```

---

### `QuickEval.run_sync()` — Synchronous Wrapper

When you're not in an async context:

```python
report = QuickEval.run_sync(
    graph=compiled,
    collector=collector,
    eval_set=eval_set,
    config=EvalPresets.quick_check(),
)
```

---

## Common Patterns

### Pattern 1: Smoke Test Suite

```python
report = await QuickEval.batch(
    graph=compiled,
    collector=collector,
    test_pairs=[
        ("Hello", "Hi"),
        ("What can you do?", "help"),
        ("Goodbye", "bye"),
    ],
    threshold=0.5,  # Relaxed for smoke tests
)
assert report.summary.pass_rate >= 0.8
```

### Pattern 2: Tool Regression Guard

```python
report = await QuickEval.tool_usage(
    graph=compiled,
    collector=collector,
    test_cases=[
        ("Weather in London?", "sunny", ["get_weather"]),
        ("Set alarm for 9am", "alarm set", ["set_alarm"]),
        ("Search for restaurants", "found restaurants", ["search_places"]),
    ],
    strict=True,
)
# Ensure all tools are called correctly
assert report.summary.pass_rate == 1.0, f"Tool regression: {report.format_summary()}"
```

### Pattern 3: Iterative Development

```python
# Start with quick check during development
report = await QuickEval.check(
    graph=compiled,
    collector=collector,
    query="Complex question about weather and travel",
    expected_response_contains="weather",
)

# Graduate to comprehensive when ready
report = await QuickEval.preset(
    graph=compiled,
    collector=collector,
    preset=EvalPresets.comprehensive(threshold=0.8),
    eval_set=EvalSet.from_file("tests/full_suite.json"),
)
```

### Pattern 4: Capture Results Without Printing

```python
report = await QuickEval.check(
    graph=compiled,
    collector=collector,
    query="Hello",
    expected_response_contains="Hi",
    print_results=False,  # Suppress console output
    verbose=False,
)

# Process results programmatically
for result in report.results:
    if not result.passed:
        print(f"FAILED: {result.eval_id}")
        for cr in result.failed_criteria:
            print(f"  {cr.criterion}: {cr.score:.2f} < {cr.threshold}")
```

### Pattern 5: pytest Integration

```python
import pytest
from agentflow.evaluation import QuickEval, EvalPresets

@pytest.mark.asyncio
async def test_agent_quick(compiled_graph, collector):
    report = await QuickEval.batch(
        graph=compiled_graph,
        collector=collector,
        test_pairs=[
            ("Hello", "Hi there"),
            ("Weather?", "Sunny"),
        ],
        print_results=False,
    )
    assert report.summary.pass_rate >= 0.8

@pytest.mark.asyncio
async def test_agent_comprehensive(compiled_graph, collector):
    report = await QuickEval.preset(
        graph=compiled_graph,
        collector=collector,
        preset=EvalPresets.comprehensive(),
        eval_set="tests/fixtures/full_suite.json",
        print_results=False,
    )
    assert report.passed, report.format_summary()
```

---

## QuickEval vs AgentEvaluator

| Feature | QuickEval | AgentEvaluator |
|---|---|---|
| Setup lines | 3–5 | 10–20 |
| Config control | Presets only | Full CriterionConfig |
| Single case test | `check()` | `evaluate_case()` |
| Batch test | `batch()` | `evaluate()` |
| Custom criteria | Via presets | Direct criterion objects |
| Sync support | `run_sync()` | `evaluate_sync()` |
| Best for | Prototyping, smoke tests, CI | Production, custom criteria, advanced |

---

## Next Steps

- [Manual Setup](../getting_started/manual_setup.md) — Full control with AgentEvaluator
- [Criteria Reference](../reference/criteria.md) — All criterion classes
- [Configuration Reference](../reference/configuration.md) — EvalConfig, ReporterConfig details
