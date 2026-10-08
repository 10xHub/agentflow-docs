# Running Evaluations in pytest

> Integrate agent evaluations into pytest to measure quality alongside unit tests. Use decorators and assertion helpers to verify agents meet quality thresholds.

Source: https://10xgraph.com/docs/testing/evals-in-pytest
Last updated: 2026-10-08

Embed agent evaluations into your pytest test suite to measure quality alongside your unit tests. Unlike unit tests, evaluations run real LLM calls and score your agent's responses and tool usage against expected outcomes. This guide covers how to integrate the evaluation framework into pytest using decorators, standalone functions, and custom assertions.

## Prerequisites

You have already installed 10xGraph and pytest:

```bash
pip install pytest pytest-asyncio 10xgraph
```

`tenxgraph.qa.evaluation` is built into 10xgraph, no extra package needed.

You have eval cases defined in an evalset file (`.evalset.json`) or as Python code. See [Building eval sets](/docs/testing/eval-sets) for how to structure cases and [Criteria reference](/docs/testing/criteria) for scoring rules. You also have a compiled graph ready for evaluation (see [Quick start](/docs/testing/evaluation) for setup examples).

## Quick start

The simplest way is to use the `@eval_test` decorator on an async test function that returns a `(graph, collector)` tuple:

```python
import pytest
from tenxgraph.qa.evaluation.testing import eval_test, create_eval_app

# Fixture that builds your graph once
@pytest.fixture(scope="session")
def eval_graph():
    from my_agents import build_weather_agent
    graph = build_weather_agent()
    app, collector = create_eval_app(graph)
    return app, collector

# Evaluation test
@eval_test("tests/fixtures/weather_agent.evalset.json")
async def test_weather_agent_quality(eval_graph):
    return eval_graph
```

Run it with pytest:

```bash
pytest test_evals.py::test_weather_agent_quality -v
```

The test passes if all eval cases meet their criteria thresholds. It fails with details of which cases failed and why.

---

## Set up evaluation fixtures

Create a shared fixture that compiles your graph with evaluation instrumentation. This fixture wires in a `TrajectoryCollector` to capture the agent's execution trace, which the evaluator then scores.

```python
# conftest.py
import pytest
from tenxgraph.qa.evaluation.testing import create_eval_app

@pytest.fixture(scope="session")
def weather_agent_app():
    """Compile the weather agent for evaluation.
    
    The create_eval_app helper does the plumbing: it creates a
    TrajectoryCollector, wires in the callback manager, and compiles
    the graph. You only provide the uncompiled StateGraph.
    """
    from my_agents import build_weather_agent
    
    graph = build_weather_agent()  # Uncompiled StateGraph
    app, collector = create_eval_app(
        graph,
        capture_all_events=True,  # Capture all runtime events for detailed scoring
    )
    return app, collector
```

The fixture returns `(compiled_app, collector)`. The app is the compiled graph; the collector records every node execution and tool call. Pass both to your evaluation tests.

## Run evals with the @eval_test decorator

The `@eval_test` decorator wraps a test function, runs an entire eval set, and asserts that the overall pass rate meets a threshold. Point it at an evalset file:

```python
from tenxgraph.qa.evaluation.testing import eval_test

@eval_test(
    eval_file="tests/fixtures/weather_agent.evalset.json",
    threshold=0.9,  # Require 90% of cases to pass
)
async def test_weather_agent_regression(weather_agent_app):
    """Evaluate the weather agent against a regression suite."""
    return weather_agent_app
```

The test function receives the fixture and returns `(graph, collector)`. The decorator:

1. Runs every case in the eval file against your graph.
2. Scores each case using the criteria in the eval file.
3. Asserts that the pass rate is >= `threshold`.
4. On failure, prints which cases failed and why.

If the test fails:

```
AssertionError: Evaluation failed: 80.0% pass rate (threshold: 90.0%)
Failed cases:
  - weather_london: tool_name_match
  - booking_flight: rouge_match
```

### Auto-detect eval files

If you omit `eval_file`, the decorator searches for a file named after your test:

```python
@eval_test(threshold=0.95)
async def test_booking_agent(booking_agent_app):
    # Searches for: tests/fixtures/booking_agent.evalset.json
    #              tests/eval/booking_agent.evalset.json
    #              eval/booking_agent.evalset.json
    return booking_agent_app
```

## Run evals with the standalone `run_eval` function

For tests that need more control, use `run_eval` to run an evaluation and capture the full report:

```python
from tenxgraph.qa.evaluation.testing import run_eval
from tenxgraph.qa.evaluation.config.presets import EvalPresets

async def test_agent_with_custom_checks(weather_agent_app):
    """Run evals and make custom assertions on the report."""
    app, collector = weather_agent_app
    
    # Run evaluation with a specific config
    config = EvalPresets.tool_usage(threshold=0.8)
    report = await run_eval(
        graph=app,
        collector=collector,
        eval_set_path="tests/fixtures/weather_agent.evalset.json",
        config=config,
        verbose=True,
    )
    
    # Make custom assertions
    assert report.summary.pass_rate >= 0.8
    assert len(report.failed_cases) <= 2
    print(f"Passed {len(report.passed_cases)} cases")
```

This approach gives you the full `EvalReport` object, so you can inspect and assert on:

- `report.summary.pass_rate`: overall pass rate (0.0 to 1.0)
- `report.summary.total_cases`: how many cases ran
- `report.passed_cases`: list of cases that passed
- `report.failed_cases`: list of cases that failed with error details
- `report.summary.criterion_stats`: per-criterion score breakdowns

## Assert on specific criteria

Use `assert_criterion_passed` to verify that a single criterion (e.g., tool names or semantic accuracy) met a score threshold:

```python
from tenxgraph.qa.evaluation.testing import (
    run_eval,
    assert_criterion_passed,
    assert_eval_passed,
)

async def test_tool_selection_quality(weather_agent_app):
    """Ensure tool selection is accurate."""
    app, collector = weather_agent_app
    
    report = await run_eval(
        graph=app,
        collector=collector,
        eval_set_path="tests/fixtures/weather_agent.evalset.json",
    )
    
    # All cases must have passed overall
    assert_eval_passed(report, min_pass_rate=0.95)
    
    # Tool name accuracy must be high
    assert_criterion_passed(
        report,
        criterion="tool_name_match",
        min_score=0.98,  # Average score across all cases
    )
    
    # Response semantic accuracy must be good
    assert_criterion_passed(
        report,
        criterion="response_match",
        min_score=0.85,
    )
```

This pattern is useful when you care about specific aspects of agent quality and want to fail the test if a particular criterion degrades.

## Parametrize tests with individual eval cases

Use `parametrize_eval_cases` to run each eval case as a separate pytest test. This produces granular pass/fail reporting and lets pytest run cases in parallel:

```python
from tenxgraph.qa.evaluation.testing import parametrize_eval_cases

@parametrize_eval_cases("tests/fixtures/weather_agent.evalset.json")
async def test_weather_agent_case(weather_agent_app, eval_case):
    """Test a single eval case."""
    from tenxgraph.qa.evaluation import AgentEvaluator
    from tenxgraph.qa.evaluation.config.presets import EvalPresets
    
    app, collector = weather_agent_app
    
    config = EvalPresets.tool_usage()
    evaluator = AgentEvaluator(app, collector, config=config)
    result = await evaluator._evaluate_case(eval_case)
    
    assert result.passed, f"Case failed: {', '.join(c.criterion for c in result.failed_criteria)}"
```

Running this test:

```bash
pytest test_evals.py::test_weather_agent_case -v
```

produces:

```
test_evals.py::test_weather_agent_case[weather_london] PASSED
test_evals.py::test_weather_agent_case[weather_tokyo] PASSED
test_evals.py::test_weather_agent_case[weather_paris] FAILED
```

Each case is a separate test item, so you can run a subset:

```bash
pytest test_evals.py::test_weather_agent_case[weather_london] -v
```

## Build eval sets programmatically

Instead of loading from a `.evalset.json` file, create eval sets in code using `create_simple_eval_set`:

```python
from tenxgraph.qa.evaluation.testing import create_simple_eval_set, run_eval

async def test_agent_with_inline_cases(weather_agent_app):
    """Run evals with cases defined inline."""
    app, collector = weather_agent_app
    
    # Create a simple eval set
    eval_set = create_simple_eval_set(
        eval_set_id="weather-quick-check",
        cases=[
            ("What is the weather in London?", "London", "weather_london"),
            ("Weather in Tokyo?", "Tokyo", "weather_tokyo"),
            ("Tell me about Paris weather.", "Paris", "weather_paris"),
        ],
    )
    
    # EvalSet is in memory; serialize to run with evaluator
    report = await run_eval(
        graph=app,
        collector=collector,
        eval_set_path=eval_set,
    )
    
    assert report.summary.pass_rate == 1.0
```

Each tuple is `(user_query, expected_response, case_name)`. The evaluator scores using default criteria (tool name match, ROUGE overlap). For more control, build an `EvalSet` directly using the eval-sets API (see [Building eval sets](/docs/testing/eval-sets)).

## Common errors and fixes

### "Eval file not found: auto-detected"

**Cause:** You used `@eval_test` without `eval_file`, and the decorator could not find a matching file.

**Fix:** Either provide the full path:

```python
@eval_test("tests/fixtures/my_agent.evalset.json")
async def test_my_agent(app_fixture):
    ...
```

Or place the eval file in one of the auto-detected locations:

```
tests/fixtures/{test_name}.evalset.json
tests/eval/{test_name}.evalset.json
eval/{test_name}.evalset.json
```

### "eval_test decorated function must return (graph, collector) tuple"

**Cause:** Your test function returned something other than a tuple of two items.

**Fix:** Ensure you return exactly `(compiled_graph, collector)`:

```python
@eval_test("tests/fixtures/my_eval.evalset.json")
async def test_my_agent(my_fixture):
    # my_fixture should be (graph, collector)
    return my_fixture  # ✓ Correct

# ✗ Wrong:
async def test_my_agent(my_fixture):
    return my_fixture.graph  # Missing collector
```

### "pass_rate is below threshold"

**Cause:** One or more eval cases failed to meet the criteria thresholds.

**Fix:** Inspect the failure details in the error message. It lists which cases failed and which criteria they missed. Then either:

- Improve the agent to pass those cases.
- Adjust the eval set expectations if they are wrong.
- Lower the `threshold` parameter temporarily for debugging.

Use `verbose=True` in `run_eval` to see detailed scoring for each case:

```python
report = await run_eval(
    ...,
    verbose=True,
)
```

---

## Next steps

- [Building eval sets](/docs/testing/eval-sets): structure eval cases, multi-turn scenarios, and custom expectations
- [Criteria reference](/docs/testing/criteria): scoring rules and thresholds for each criterion
- [How to run evaluations](/docs/testing/run-evals): CLI commands, parallel runs, and CI integration
- [Reports](/docs/testing/reports): HTML dashboards and JSON export for evals

## Frequently asked questions

### How are evaluation tests different from unit tests?

Unit tests mock the LLM and tools, running fast and deterministically. Evaluation tests run your agent against real LLM calls and measure quality (correct tool usage, accurate responses, safety). They run at a different speed and cost.

### Can I run evals without pytest?

Yes. Use AgentEvaluator, QuickEval, or the CLI directly. pytest integration is optional, for teams that want evals to run as part of their test suite.

### Do evaluations run in parallel in pytest?

No. pytest runs each test sequentially. For parallel evaluation runs, use the --parallel flag from the CLI instead.
