# Single-Turn Evaluation Tutorial

This tutorial walks through end-to-end single-turn evaluation — testing your agent's response to individual queries. You'll learn how to define test cases, configure criteria, run evaluations, and read results.

---

## What Is Single-Turn Evaluation?

A single-turn test sends **one user message** to the agent and checks:

- Did the agent call the **expected tools** (with correct arguments)?
- Does the **final response** match the expected answer?
- Is the response **safe**, **factually accurate**, and **free of hallucinations**?

---

## 1. Define Your Test Cases

### Using `EvalCase.single_turn()`

```python
from agentflow.evaluation.dataset import EvalCase, ToolCall

# Minimal case — response only
simple_case = EvalCase.single_turn(
    eval_id="greeting",
    user_query="Hello!",
    expected_response="Hi there! How can I help you?",
)

# With expected tool calls
weather_case = EvalCase.single_turn(
    eval_id="weather_london",
    user_query="What is the weather in London?",
    expected_response="The weather in London is sunny and 22°C",
    expected_tools=[
        ToolCall(name="get_weather", args={"city": "london"}),
    ],
    name="London Weather",
    description="Agent should call get_weather tool for London",
)

# Multiple expected tools
multi_tool_case = EvalCase.single_turn(
    eval_id="weather_and_forecast",
    user_query="Weather and forecast for NYC?",
    expected_response="Currently sunny, rain expected tomorrow",
    expected_tools=[
        ToolCall(name="get_weather", args={"city": "new york"}),
        ToolCall(name="get_forecast", args={"city": "new york"}),
    ],
)
```

### Using `EvalSetBuilder`

```python
from agentflow.evaluation import EvalSetBuilder

eval_set = (
    EvalSetBuilder("weather_tests")
    .add_case(
        query="Weather in London?",
        expected="Sunny in London",
        expected_tools=["get_weather"],
        case_id="london",
    )
    .add_case(
        query="Weather in Tokyo?",
        expected="Cloudy in Tokyo",
        expected_tools=["get_weather"],
        case_id="tokyo",
    )
    .add_tool_test(
        query="Forecast for NYC?",
        tool_name="get_forecast",
        tool_args={"city": "new york"},
        expected_response="Rain expected",
        case_id="nyc_forecast",
    )
    .build()
)
```

### Loading from JSON

```python
from agentflow.evaluation.dataset import EvalSet

eval_set = EvalSet.from_file("tests/fixtures/weather_tests.json")
```

**JSON format:**

```json
{
  "eval_set_id": "weather_tests",
  "name": "Weather Agent Tests",
  "eval_cases": [
    {
      "eval_id": "london",
      "name": "London Weather",
      "conversation": [
        {
          "user_content": {"role": "user", "content": "What is the weather in London?"},
          "expected_final_response": {"role": "assistant", "content": "The weather in London is sunny"},
          "expected_tool_trajectory": [
            {"name": "get_weather", "args": {"city": "london"}}
          ]
        }
      ]
    }
  ]
}
```

---

## 2. Set Up the Collector

The easiest way is `create_eval_app()`, which wires the `TrajectoryCollector`, callback manager, and checkpointer in one call:

```python
from agentflow.evaluation import create_eval_app

# Compile once — reuse for all evaluations
compiled, collector = create_eval_app(my_graph)
```

> **Important:** Compile the graph **once** and reuse `compiled` + `collector` across all evaluation calls. The `CallbackManager` is bound globally on first compile — a second `compile()` call in the same process will break trajectory collection. See [Manual Setup — Step 2](../getting_started/manual_setup.md#step-2-wire-the-trajectory-collector) for details.

<details>
<summary>Manual setup (without <code>create_eval_app</code>)</summary>

```python
from agentflow.evaluation import TrajectoryCollector, make_trajectory_callback

collector = TrajectoryCollector(capture_all_events=True)
_, callback_mgr = make_trajectory_callback(collector)
compiled = my_graph.compile(callback_manager=callback_mgr)
```

</details>

---

## 3. Choose Your Criteria

### No-LLM Criteria (Fast, Free)

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType

config = EvalConfig(criteria={
    # Check tool names match
    "tool_name_match_score": CriterionConfig.tool_name_match(threshold=1.0),

    # Check tool sequence (EXACT order, with argument checking)
    "tool_trajectory_avg_score": CriterionConfig.trajectory(
        threshold=1.0,
        match_type=MatchType.EXACT,
        check_args=True,
    ),

    # Check keywords in response
    "contains_keywords": CriterionConfig.contains_keywords(
        keywords=["expected", "keyword"],
        threshold=1.0,
    ),
})
```

### LLM-Based Criteria (More Accurate, Requires API Key)

```python
config = EvalConfig(criteria={
    # Semantic response matching (recommended default)
    "response_match_score": CriterionConfig.response_match(threshold=0.7),

    # General-purpose LLM judge with majority voting
    "llm_judge": CriterionConfig.llm_judge(
        threshold=0.8,
        judge_model="gemini/gemini-2.5-flash",
        num_samples=3,
    ),

    # Safety + factual accuracy
    "safety_v1": CriterionConfig.safety(threshold=0.8),
    "factual_accuracy_v1": CriterionConfig.factual_accuracy(threshold=0.8),
})
```

### Using Presets

```python
from agentflow.evaluation import EvalPresets

# Just response quality
config = EvalPresets.response_quality(threshold=0.7)

# Tool usage validation
config = EvalPresets.tool_usage(strict=True, check_args=True)

# Everything
config = EvalPresets.comprehensive(threshold=0.8, use_llm_judge=True)
```

---

## 4. Run the Evaluation

### Full EvalSet

```python
from agentflow.evaluation import AgentEvaluator

evaluator = AgentEvaluator(compiled, collector, config=config)
report = await evaluator.evaluate(eval_set, verbose=True)
```

### Single Case

```python
result = await evaluator.evaluate_case(weather_case)

if result.passed:
    print("✓ All criteria passed")
else:
    for cr in result.failed_criteria:
        print(f"✗ {cr.criterion}: {cr.score:.2f} < {cr.threshold}")
        if cr.reason:
            print(f"  Reason: {cr.reason}")
```

---

## 5. Inspect Results

### EvalCaseResult

Each case produces an `EvalCaseResult`:

```python
result = await evaluator.evaluate_case(case)

# Overall pass/fail
print(result.passed)           # True/False
print(result.eval_id)          # "weather_london"

# What actually happened
print(result.actual_response)  # "The weather in London is sunny."
print(result.actual_tool_calls)  # [ToolCall(name="get_weather", args={...})]
print(result.actual_trajectory)  # [TrajectoryStep(...), ...]
print(result.node_visits)        # ["MAIN", "get_weather", "MAIN"]

# Criterion scores
for cr in result.criterion_results:
    print(f"{cr.criterion}: {cr.score:.2f} ({'PASS' if cr.passed else 'FAIL'})")
    print(f"  Details: {cr.details}")

# Convenience accessors
print(result.passed_criteria)  # list of passed CriterionResult
print(result.failed_criteria)  # list of failed CriterionResult
print(result.duration_seconds) # 1.23
```

### EvalReport (from `evaluate()`)

```python
report = await evaluator.evaluate(eval_set)

# Summary
s = report.summary
print(f"Total: {s.total_cases}")
print(f"Passed: {s.passed_cases}")
print(f"Failed: {s.failed_cases}")
print(f"Errors: {s.error_cases}")
print(f"Pass rate: {s.pass_rate:.1%}")

# Formatted output
print(report.format_summary())

# Per-case iteration
for case_result in report.results:
    print(f"{case_result.eval_id}: {'PASS' if case_result.passed else 'FAIL'}")
```

---

## 6. Generate Reports

```python
from agentflow.evaluation import ConsoleReporter, JSONReporter, HTMLReporter

# Console
ConsoleReporter(verbose=True, include_trajectory=True).report(report)

# JSON
JSONReporter().save(report, "eval_reports/single_turn.json")

# HTML (interactive, self-contained)
HTMLReporter(include_trajectory=True).save(report, "eval_reports/single_turn.html")
```

---

## Pytest Integration

Use the evaluation framework in your test suite:

```python
import pytest
from agentflow.evaluation import (
    AgentEvaluator,
    EvalConfig,
    CriterionConfig,
    create_eval_app,
    assert_eval_passed,
)
from agentflow.evaluation.dataset import EvalCase, EvalSet, ToolCall

@pytest.fixture(scope="session")
def trajectory_app():
    """Compile once per test session — shared across all tests."""
    return create_eval_app(build_my_graph())

@pytest.fixture(scope="session")
def compiled_graph(trajectory_app):
    return trajectory_app[0]

@pytest.fixture(scope="session")
def collector(trajectory_app):
    return trajectory_app[1]

@pytest.fixture(scope="session")
def evaluator(compiled_graph, collector):
    config = EvalConfig(criteria={
        "tool_name_match_score": CriterionConfig(threshold=1.0),
        "response_match_score": CriterionConfig(threshold=0.7),
    })
    return AgentEvaluator(compiled_graph, collector, config=config)

@pytest.mark.asyncio
async def test_london_weather(evaluator):
    case = EvalCase.single_turn(
        eval_id="london",
        user_query="What is the weather in London?",
        expected_response="sunny",
        expected_tools=[ToolCall(name="get_weather")],
    )
    result = await evaluator.evaluate_case(case)
    assert result.passed, f"Failed: {result.failed_criteria}"

@pytest.mark.asyncio
async def test_full_eval_set(evaluator):
    eval_set = EvalSet.from_file("tests/fixtures/weather.json")
    report = await evaluator.evaluate(eval_set)
    assert_eval_passed(report, min_pass_rate=0.9)
```

---

## Next Steps

- [Multi-Turn Evaluation](multi_turn_evaluation.md) — Testing conversations
- [Trajectory Matching](trajectory_matching.md) — EXACT, IN_ORDER, ANY_ORDER modes
- [Criteria Reference](../reference/criteria.md) — All criterion classes
