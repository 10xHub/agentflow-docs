# Pytest Integration

Integrate agent evaluations into your pytest test suites for automated testing.

## Overview

The evaluation framework provides pytest utilities that let you:

- Run evaluations as pytest tests
- Use familiar pytest patterns (fixtures, parametrize, markers)
- Get assertion helpers for evaluation results
- Integrate with CI/CD pipelines

## Quick Start

### Using the `@eval_test` Decorator

```python
import pytest
from agentflow.evaluation.testing import eval_test

@eval_test("tests/fixtures/weather_agent.evalset.json")
async def test_weather_agent(compiled_graph):
    """Test weather agent with eval set."""
    return compiled_graph  # Return the graph to evaluate
```

The decorator will:
1. Load the eval set file
2. Run all cases against the returned graph
3. Assert the pass rate meets the threshold

### Explicit Evaluation in Tests

```python
import pytest
from agentflow.evaluation import AgentEvaluator, EvalConfig
from agentflow.evaluation.testing import assert_eval_passed

@pytest.mark.asyncio
async def test_weather_agent_explicit():
    """Explicit evaluation test."""
    # Setup
    graph = await create_weather_agent_graph()
    evaluator = AgentEvaluator(graph, EvalConfig.default())
    
    # Evaluate
    report = await evaluator.evaluate("tests/fixtures/weather.evalset.json")
    
    # Assert
    assert_eval_passed(report)  # Raises AssertionError if failed
```

---

## Assertion Helpers

### assert_eval_passed

Asserts that all evaluation cases passed.

```python
from agentflow.evaluation.testing import assert_eval_passed

# Basic usage
assert_eval_passed(report)

# With minimum pass rate
assert_eval_passed(report, min_pass_rate=0.9)  # Allow 10% failures

# Custom error message
assert_eval_passed(
    report,
    msg="Weather agent failed quality checks",
)
```

**Failure Output:**

```
AssertionError: Evaluation failed: 2/10 cases failed
  - test_edge_case: trajectory_match (0.50 < 0.80)
  - test_complex: response_match (0.62 < 0.70)
```

### assert_criterion_passed

Asserts a specific criterion passed across all cases.

```python
from agentflow.evaluation.testing import assert_criterion_passed

# Check specific criterion
assert_criterion_passed(report, "trajectory_match")

# With minimum score
assert_criterion_passed(
    report,
    "response_match",
    min_score=0.75,  # Stricter than threshold
)
```

---

## Parametrized Tests

### Using parametrize_eval_cases

Run each eval case as a separate pytest test:

```python
import pytest
from agentflow.evaluation import EvalSet
from agentflow.evaluation.testing import parametrize_eval_cases

# Load eval set
eval_set = EvalSet.load("tests/fixtures/weather.evalset.json")

@pytest.mark.asyncio
@parametrize_eval_cases(eval_set)
async def test_individual_case(graph, eval_case):
    """Test each case individually."""
    from agentflow.evaluation import AgentEvaluator, EvalConfig
    
    evaluator = AgentEvaluator(graph, EvalConfig.default())
    
    # Create single-case eval set
    single_case_set = EvalSet(
        eval_set_id=eval_set.eval_set_id,
        name=eval_case.name,
        eval_cases=[eval_case],
    )
    
    report = await evaluator.evaluate(single_case_set)
    assert report.summary.passed_cases == 1
```

**pytest output:**

```
test_weather.py::test_individual_case[basic_weather] PASSED
test_weather.py::test_individual_case[multi_city] PASSED
test_weather.py::test_individual_case[edge_case] FAILED
test_weather.py::test_individual_case[forecast] PASSED
```

### Manual Parametrization

```python
import pytest
from agentflow.evaluation import EvalSet

eval_set = EvalSet.load("tests/fixtures/weather.evalset.json")

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "case",
    eval_set.eval_cases,
    ids=[c.name or c.eval_id for c in eval_set.eval_cases],
)
async def test_case(graph_fixture, case):
    """Manually parametrized test."""
    # ... test logic
```

---

## Fixtures

### Graph Fixture

Create a reusable graph fixture:

```python
# conftest.py
import pytest
from my_agent import create_weather_agent

@pytest.fixture
async def weather_graph():
    """Create and compile weather agent graph."""
    graph = await create_weather_agent()
    compiled = graph.compile()
    yield compiled
    await compiled.aclose()

@pytest.fixture
async def evaluator(weather_graph):
    """Create evaluator with default config."""
    from agentflow.evaluation import AgentEvaluator, EvalConfig
    return AgentEvaluator(weather_graph, EvalConfig.default())
```

### Eval Set Fixture

```python
# conftest.py
import pytest
from agentflow.evaluation import EvalSet

@pytest.fixture
def weather_eval_set():
    """Load weather agent eval set."""
    return EvalSet.load("tests/fixtures/weather.evalset.json")

@pytest.fixture
def booking_eval_set():
    """Load booking agent eval set."""
    return EvalSet.load("tests/fixtures/booking.evalset.json")
```

### Using Fixtures

```python
@pytest.mark.asyncio
async def test_weather_agent(evaluator, weather_eval_set):
    """Test using fixtures."""
    report = await evaluator.evaluate(weather_eval_set)
    assert_eval_passed(report)
```

---

## Test Organization

### Recommended Structure

```
tests/
├── conftest.py              # Shared fixtures
├── fixtures/
│   ├── weather.evalset.json
│   ├── booking.evalset.json
│   └── complex.evalset.json
├── unit/
│   ├── test_tools.py
│   └── test_nodes.py
└── eval/
    ├── test_weather_agent.py
    ├── test_booking_agent.py
    └── test_integration.py
```

### conftest.py Example

```python
# tests/conftest.py
import pytest
from agentflow.evaluation import AgentEvaluator, EvalConfig, EvalSet

# Markers
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "eval: mark test as evaluation test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow (uses LLM judge)"
    )

# Fixtures
@pytest.fixture(scope="session")
def eval_config():
    """Default evaluation config."""
    return EvalConfig.default()

@pytest.fixture(scope="session")
def fast_eval_config():
    """Fast config without LLM judge."""
    return EvalConfig(
        criteria={
            "trajectory_match": CriterionConfig(enabled=True),
            "response_match": CriterionConfig(enabled=True),
        }
    )

@pytest.fixture
def all_eval_sets():
    """Load all eval sets."""
    from pathlib import Path
    
    sets = {}
    for f in Path("tests/fixtures").glob("*.evalset.json"):
        eval_set = EvalSet.load(str(f))
        sets[eval_set.eval_set_id] = eval_set
    return sets
```

---

## Markers and Filtering

### Custom Markers

```python
# tests/eval/test_weather.py
import pytest

@pytest.mark.eval
@pytest.mark.asyncio
async def test_weather_basic(evaluator, weather_eval_set):
    """Basic weather tests."""
    report = await evaluator.evaluate(weather_eval_set)
    assert_eval_passed(report)

@pytest.mark.eval
@pytest.mark.slow
@pytest.mark.asyncio
async def test_weather_quality(evaluator, weather_eval_set):
    """Quality tests with LLM judge (slow)."""
    config = EvalConfig(
        criteria={
            "llm_judge": CriterionConfig(enabled=True),
        }
    )
    evaluator = AgentEvaluator(evaluator.graph, config)
    report = await evaluator.evaluate(weather_eval_set)
    assert_eval_passed(report)
```

### Run Specific Tests

```bash
# Run all eval tests
pytest -m eval

# Run fast tests only
pytest -m "eval and not slow"

# Run specific agent tests
pytest tests/eval/test_weather.py

# Run with verbose output
pytest -m eval -v
```

---

## Reporting in pytest

### Generate Reports

```python
# tests/eval/test_with_report.py
import pytest
from agentflow.evaluation import (
    ConsoleReporter,
    JSONReporter,
    JUnitXMLReporter,
)

@pytest.mark.asyncio
async def test_with_reports(evaluator, weather_eval_set, tmp_path):
    """Generate multiple report formats."""
    report = await evaluator.evaluate(weather_eval_set)
    
    # Save reports
    JSONReporter().save(report, tmp_path / "report.json")
    JUnitXMLReporter().save(report, tmp_path / "junit.xml")
    
    # Print to console
    ConsoleReporter(verbose=True).report(report)
    
    assert_eval_passed(report)
```

### pytest-html Integration

```python
# conftest.py
import pytest

@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Add evaluation details to pytest-html report."""
    outcome = yield
    report = outcome.get_result()
    
    if hasattr(item, "eval_report"):
        extra = getattr(report, "extra", [])
        extra.append(pytest.html.extras.html(
            f"<pre>{item.eval_report.format_summary()}</pre>"
        ))
        report.extra = extra
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/eval.yml
name: Agent Evaluation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -e ".[litellm]"
          pip install pytest pytest-asyncio
      
      - name: Run evaluations
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          pytest tests/eval/ -v --tb=short \
            --junitxml=results/junit.xml
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evaluation-results
          path: results/
      
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: 'results/junit.xml'
          fail_on_failure: true
```

### Separate Fast and Slow Tests

```yaml
jobs:
  fast-eval:
    runs-on: ubuntu-latest
    steps:
      - name: Run fast evaluations
        run: pytest -m "eval and not slow" -v

  full-eval:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - name: Run all evaluations
        run: pytest -m eval -v
```

---

## Best Practices

### 1. Separate Unit and Eval Tests

```
tests/
├── unit/      # Fast, no LLM calls
└── eval/      # Slower, may use LLM
```

### 2. Use Fast Config for CI

```python
# Use deterministic criteria in CI
@pytest.fixture
def ci_config():
    return EvalConfig(
        criteria={
            "trajectory_match": CriterionConfig(enabled=True),
            "response_match": CriterionConfig(enabled=True),
            "llm_judge": CriterionConfig(enabled=False),
        }
    )
```

### 3. Test at Different Granularities

```python
# Smoke test: Run quickly, catch major issues
@pytest.mark.eval
@pytest.mark.smoke
async def test_agent_smoke(evaluator, smoke_eval_set):
    report = await evaluator.evaluate(smoke_eval_set)
    assert_eval_passed(report, min_pass_rate=0.8)

# Full test: Comprehensive coverage
@pytest.mark.eval
@pytest.mark.slow
async def test_agent_full(evaluator, full_eval_set):
    report = await evaluator.evaluate(full_eval_set)
    assert_eval_passed(report)
```

### 4. Handle Flaky Tests

```python
import pytest

@pytest.mark.flaky(reruns=2)
@pytest.mark.asyncio
async def test_llm_dependent(evaluator, eval_set):
    """Test may fail due to LLM variance."""
    report = await evaluator.evaluate(eval_set)
    assert_eval_passed(report, min_pass_rate=0.9)
```

### 5. Create Eval Set Factories

```python
# tests/factories.py
from agentflow.evaluation.testing import create_simple_eval_set

def make_weather_eval_set(cities: list[str]):
    """Factory for weather eval sets."""
    cases = [
        (
            f"What's the weather in {city}?",
            f"Weather in {city}",  # Expected contains
            f"weather_{city.lower()}",
        )
        for city in cities
    ]
    return create_simple_eval_set("weather_test", cases)
```

---

## Troubleshooting

### Test Timeout

```python
# Increase timeout for slow evaluations
@pytest.mark.timeout(120)  # 2 minutes
@pytest.mark.asyncio
async def test_slow_evaluation(evaluator, large_eval_set):
    report = await evaluator.evaluate(large_eval_set)
    assert_eval_passed(report)
```

### Async Issues

```python
# Ensure proper async fixture scope
@pytest.fixture(scope="function")
async def evaluator():
    # Fresh evaluator for each test
    ...
```

### Debugging Failures

```python
@pytest.mark.asyncio
async def test_with_debug(evaluator, eval_set):
    report = await evaluator.evaluate(eval_set, verbose=True)
    
    # Print details on failure
    if report.summary.pass_rate < 1.0:
        from agentflow.evaluation import ConsoleReporter
        ConsoleReporter(verbose=True).report(report)
    
    assert_eval_passed(report)
```
