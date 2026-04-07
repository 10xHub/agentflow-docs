# Pytest Integration Reference

This page documents the testing utilities for integrating agent evaluation into pytest test suites.

---

## Overview

The evaluation module provides several pytest helpers:

| Export | Type | Description |
|---|---|---|
| `eval_test` | Decorator | Wrap a test function for automated evaluation |
| `assert_eval_passed` | Function | Assert a report meets a pass rate threshold |
| `assert_criterion_passed` | Function | Assert a specific criterion's average score |
| `parametrize_eval_cases` | Decorator | Parametrize tests from an eval set file |
| `EvalFixtures` | Class | Collection of reusable pytest fixtures |
| `EvalPlugin` | Class | Pytest plugin for evaluation hooks |
| `EvalTestCase` | Class | Wrapper for eval cases in pytest |
| `run_eval` | Function | One-shot evaluation runner |
| `create_simple_eval_set` | Function | Quick eval set creation for tests |

---

## `eval_test` Decorator

Wraps a test function that returns a `(CompiledGraph, TrajectoryCollector)` tuple and runs evaluation automatically.

```python
from agentflow.evaluation import eval_test

@eval_test(
    eval_file="tests/fixtures/weather_agent.evalset.json",
    threshold=0.9,  # Required pass rate
)
async def test_weather_agent(graph, collector):
    return graph, collector  # Return (graph, collector) tuple
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `eval_file` | `str \| None` | `None` | Path to eval set JSON file. Auto-detected if None. |
| `config` | `EvalConfig \| None` | `None` | Evaluation config. Uses defaults if None. |
| `threshold` | `float` | `1.0` | Required pass rate (0.0–1.0) |

**Auto-detection:** If `eval_file` is None, the decorator searches for files matching the test function name:
- `tests/fixtures/{name}.evalset.json`
- `tests/eval/{name}.evalset.json`
- `eval/{name}.evalset.json`

---

## Assertion Helpers

### `assert_eval_passed`

Assert that an `EvalReport` meets a minimum pass rate.

```python
from agentflow.evaluation import assert_eval_passed

report = await evaluator.evaluate(eval_set)
assert_eval_passed(report, min_pass_rate=0.9)
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `report` | `EvalReport` | — | The evaluation report to check |
| `min_pass_rate` | `float` | `1.0` | Minimum required pass rate |

**Raises:** `AssertionError` with details about failed cases.

### `assert_criterion_passed`

Assert that a specific criterion meets an average score threshold across all cases.

```python
from agentflow.evaluation import assert_criterion_passed

report = await evaluator.evaluate(eval_set)
assert_criterion_passed(report, "tool_name_match_score", min_score=0.9)
assert_criterion_passed(report, "response_match_score", min_score=0.7)
```

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `report` | `EvalReport` | — | The evaluation report to check |
| `criterion` | `str` | — | Name of the criterion to check |
| `min_score` | `float` | `0.0` | Minimum required average score |

**Raises:** `AssertionError` if criterion not found or average score below minimum.

---

## `parametrize_eval_cases`

Parametrize a test with cases from an eval set file.

```python
from agentflow.evaluation import parametrize_eval_cases

@parametrize_eval_cases("tests/fixtures/weather_agent.evalset.json")
async def test_single_case(graph, eval_case):
    evaluator = AgentEvaluator(graph, collector)
    result = await evaluator.evaluate_case(eval_case)
    assert result.passed
```

This creates one test per `EvalCase` in the file, using `eval_id` as the test ID.

---

## `EvalFixtures`

Reusable pytest fixture factory.

```python
from agentflow.evaluation import EvalFixtures, EvalConfig

# In conftest.py
fixtures = EvalFixtures(default_config=EvalConfig.default())

# Get an evaluator factory
factory = fixtures.evaluator_factory()
evaluator = factory(compiled_graph, collector)
```

**Constructor:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default_config` | `EvalConfig \| None` | `None` | Default evaluation config for all evaluators |

---

## `EvalTestCase`

Pytest-friendly wrapper for evaluation cases.

```python
from agentflow.evaluation import EvalTestCase

test_case = EvalTestCase(
    eval_id="weather_london",
    name="London Weather",
    description="Verify weather query for London",
)
```

---

## Common Patterns

### Pattern 1: Session-Scoped Fixtures

> **Important:** The graph must be compiled **once** per process. Use `session`-scoped fixtures so the `CallbackManager` is bound only once. See [Manual Setup — Step 2](../getting_started/manual_setup.md#step-2-wire-the-trajectory-collector) for why this matters.

```python
# conftest.py
import pytest
from agentflow.evaluation import (
    AgentEvaluator,
    EvalConfig,
    CriterionConfig,
    create_eval_app,
)

@pytest.fixture(scope="session")
def trajectory_app():
    \"\"\"Compile once per test session — shared across all tests.\"\"\"
    from my_app import build_graph
    return create_eval_app(build_graph())

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
```

### Pattern 2: Per-Case Tests

```python
# test_weather.py
import pytest
from agentflow.evaluation.dataset import EvalCase, ToolCall

CASES = [
    EvalCase.single_turn(
        eval_id="london",
        user_query="Weather in London?",
        expected_response="sunny",
        expected_tools=[ToolCall(name="get_weather")],
    ),
    EvalCase.single_turn(
        eval_id="tokyo",
        user_query="Weather in Tokyo?",
        expected_response="cloudy",
        expected_tools=[ToolCall(name="get_weather")],
    ),
]

@pytest.mark.asyncio
@pytest.mark.parametrize("case", CASES, ids=lambda c: c.eval_id)
async def test_weather_case(evaluator, case):
    result = await evaluator.evaluate_case(case)
    assert result.passed, f"Failed criteria: {[c.criterion for c in result.failed_criteria]}"
```

### Pattern 3: Score Tracker

Track pass rates across test sessions:

```python
# conftest.py
import pytest

class ScoreTracker:
    def __init__(self):
        self.results = []

    def record(self, eval_id: str, passed: bool, score: float):
        self.results.append({"eval_id": eval_id, "passed": passed, "score": score})

    @property
    def pass_rate(self):
        if not self.results:
            return 0.0
        return sum(1 for r in self.results if r["passed"]) / len(self.results)

    def summary(self):
        return {
            "total": len(self.results),
            "passed": sum(1 for r in self.results if r["passed"]),
            "pass_rate": self.pass_rate,
        }

@pytest.fixture(scope="session")
def score_tracker():
    tracker = ScoreTracker()
    yield tracker
    # Print summary at end of session
    s = tracker.summary()
    print(f"\n{'='*50}")
    print(f"Evaluation Summary: {s['passed']}/{s['total']} passed ({s['pass_rate']:.1%})")
    print(f"{'='*50}")
```

### Pattern 4: Full EvalSet Test

```python
import pytest
from agentflow.evaluation import assert_eval_passed, assert_criterion_passed
from agentflow.evaluation.dataset import EvalSet

@pytest.mark.asyncio
async def test_full_eval_set(evaluator):
    eval_set = EvalSet.from_file("tests/fixtures/weather_tests.json")
    report = await evaluator.evaluate(eval_set, verbose=True)

    # Overall pass rate
    assert_eval_passed(report, min_pass_rate=0.9)

    # Per-criterion assertions
    assert_criterion_passed(report, "tool_name_match_score", min_score=1.0)
    assert_criterion_passed(report, "response_match_score", min_score=0.7)
```

### Pattern 5: With Reporters

```python
import pytest
from agentflow.evaluation import HTMLReporter, JSONReporter

@pytest.mark.asyncio
async def test_with_reports(evaluator, tmp_path):
    eval_set = EvalSet.from_file("tests/fixtures/tests.json")
    report = await evaluator.evaluate(eval_set)

    # Generate reports
    JSONReporter().save(report, str(tmp_path / "results.json"))
    HTMLReporter().save(report, str(tmp_path / "results.html"))

    assert report.summary.pass_rate >= 0.9
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Agent Evaluation
on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install -e ".[eval]"

      - name: Run evaluation tests
        run: pytest tests/evaluation/ -v --junitxml=eval_reports/results.xml

      - name: Upload eval reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-reports
          path: eval_reports/

      - name: Publish test results
        if: always()
        uses: dorny/test-reporter@v1
        with:
          name: Evaluation Results
          path: eval_reports/results.xml
          reporter: java-junit
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Evaluate') {
            steps {
                sh 'pytest tests/evaluation/ --junitxml=eval_reports/results.xml'
            }
            post {
                always {
                    junit 'eval_reports/results.xml'
                    archiveArtifacts artifacts: 'eval_reports/**', allowEmptyArchive: true
                }
            }
        }
    }
}
```

### pytest Configuration

Add to `pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
markers = [
    "eval: agent evaluation tests",
    "slow: long-running evaluation tests",
]
```

Run only evaluation tests:

```bash
pytest tests/evaluation/ -m eval -v
```

---

## Next Steps

- [Reporters Reference](reporters.md) — Output format details
- [Advanced](advanced.md) — Custom criteria, presets, regression testing
- [Criteria Reference](criteria.md) — All criterion classes
