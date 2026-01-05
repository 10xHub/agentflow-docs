# Getting Started with Agent Evaluation

This guide walks you through setting up and running your first agent evaluation.

## Prerequisites

- A compiled Agentflow graph to test
- Python 3.12+
- Basic understanding of Agentflow graphs

## Step 1: Create an Evaluation Set

Evaluation sets can be created programmatically or loaded from JSON files.

### Programmatic Creation

```python
from agentflow.evaluation import (
    EvalSet,
    EvalCase,
    Invocation,
    MessageContent,
    ToolCall,
)

# Create a simple eval set
eval_set = EvalSet(
    eval_set_id="weather_tests",
    name="Weather Agent Tests",
    description="Integration tests for weather agent functionality",
    eval_cases=[
        EvalCase(
            eval_id="test_1",
            name="Basic weather lookup",
            conversation=[
                Invocation(
                    invocation_id="turn_1",
                    user_content=MessageContent.user("What's the weather in Paris?"),
                    expected_tool_trajectory=[
                        ToolCall(name="get_weather", args={"city": "Paris"})
                    ],
                    expected_final_response=MessageContent.assistant(
                        "The weather in Paris is currently 18°C and sunny."
                    ),
                )
            ],
            tags=["weather", "basic"],
        ),
        EvalCase(
            eval_id="test_2",
            name="Multi-city comparison",
            conversation=[
                Invocation(
                    invocation_id="turn_1",
                    user_content=MessageContent.user(
                        "Compare the weather in Tokyo and New York"
                    ),
                    expected_tool_trajectory=[
                        ToolCall(name="get_weather", args={"city": "Tokyo"}),
                        ToolCall(name="get_weather", args={"city": "New York"}),
                    ],
                )
            ],
            tags=["weather", "comparison"],
        ),
    ],
)
```

### JSON File Format

Save evaluation sets as JSON files for reusability:

```json
{
  "eval_set_id": "weather_tests",
  "name": "Weather Agent Tests",
  "description": "Integration tests for weather agent",
  "eval_cases": [
    {
      "eval_id": "test_1",
      "name": "Basic weather lookup",
      "conversation": [
        {
          "invocation_id": "turn_1",
          "user_content": {
            "role": "user",
            "content": "What's the weather in Paris?"
          },
          "expected_tool_trajectory": [
            {"name": "get_weather", "args": {"city": "Paris"}}
          ],
          "expected_final_response": {
            "role": "assistant",
            "content": "The weather in Paris is currently 18°C and sunny."
          }
        }
      ],
      "tags": ["weather", "basic"]
    }
  ]
}
```

## Step 2: Configure Evaluation Criteria

The `EvalConfig` class defines which criteria to use and their thresholds:

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType

# Use default configuration
config = EvalConfig.default()

# Or customize criteria
config = EvalConfig(
    criteria={
        "trajectory_match": CriterionConfig(
            enabled=True,
            threshold=0.8,
            match_type=MatchType.IN_ORDER,
        ),
        "response_match": CriterionConfig(
            enabled=True,
            threshold=0.6,
        ),
        "llm_judge": CriterionConfig(
            enabled=True,
            threshold=0.7,
            judge_model="gpt-4o-mini",
        ),
    }
)
```

### Available Criteria Types

| Criterion Name | Description | Default Threshold |
|----------------|-------------|-------------------|
| `trajectory_match` | Tool call sequence matching | 0.8 |
| `response_match` | ROUGE-based response similarity | 0.7 |
| `llm_judge` | LLM-judged semantic matching | 0.7 |
| `rubric_based` | Custom rubric evaluation | 0.8 |

## Step 3: Create and Run the Evaluator

```python
import asyncio
from agentflow.evaluation import AgentEvaluator, EvalConfig

async def run_evaluation():
    # Create your graph (this is your existing agent graph)
    graph = await create_weather_agent_graph()
    
    # Create evaluator
    evaluator = AgentEvaluator(
        graph=graph,
        config=EvalConfig.default(),
    )
    
    # Run evaluation from file
    report = await evaluator.evaluate(
        "tests/fixtures/weather_tests.evalset.json",
        parallel=True,      # Run cases in parallel
        max_concurrency=4,  # Maximum concurrent cases
        verbose=True,       # Log progress
    )
    
    return report

report = asyncio.run(run_evaluation())
```

### Evaluate from EvalSet Object

```python
# Or pass an EvalSet directly
report = await evaluator.evaluate(eval_set)
```

## Step 4: View Results

### Console Output

```python
from agentflow.evaluation import ConsoleReporter

reporter = ConsoleReporter(verbose=True)
reporter.report(report)
```

Output:
```
═══════════════════════════════════════════════════════════════════════
                     EVALUATION REPORT: weather_tests
═══════════════════════════════════════════════════════════════════════

Summary
───────────────────────────────────────────────────────────────────────
  Total Cases:    2
  Passed:         2 ✓
  Failed:         0 ✗
  Pass Rate:      100.0%

Criterion Statistics
───────────────────────────────────────────────────────────────────────
  trajectory_match    2/2 passed    avg: 1.00
  response_match      2/2 passed    avg: 0.85
```

### Programmatic Access

```python
# Access summary
print(f"Pass rate: {report.summary.pass_rate * 100:.1f}%")
print(f"Total cases: {report.summary.total_cases}")
print(f"Passed: {report.summary.passed_cases}")
print(f"Failed: {report.summary.failed_cases}")

# Iterate over results
for result in report.results:
    print(f"\n{result.name or result.eval_id}")
    print(f"  Passed: {result.passed}")
    
    for cr in result.criterion_results:
        print(f"  {cr.criterion}: {cr.score:.2f} (threshold: {cr.threshold})")
```

## Step 5: Export Results

### JSON Export

```python
from agentflow.evaluation import JSONReporter

# Export to JSON file
reporter = JSONReporter()
reporter.save(report, "results/evaluation_report.json")

# Get as dict
data = reporter.to_dict(report)
```

### JUnit XML (for CI/CD)

```python
from agentflow.evaluation import JUnitXMLReporter

reporter = JUnitXMLReporter()
reporter.save(report, "results/junit.xml")
```

### HTML Report

```python
from agentflow.evaluation import HTMLReporter

reporter = HTMLReporter()
reporter.save(report, "results/report.html")
```

## Quick Utility Functions

For simple cases, use the `create_simple_eval_set` helper:

```python
from agentflow.evaluation.testing import create_simple_eval_set

# Quick eval set creation from tuples (input, expected_output, name)
eval_set = create_simple_eval_set(
    "my_tests",
    [
        ("Hello!", "Hi there! How can I help?", "greeting"),
        ("What is 2+2?", "4", "math_simple"),
        ("Tell me a joke", "Why did the chicken...", "humor"),
    ]
)
```

## Common Patterns

### Retry on Flaky Tests

For tests that may occasionally fail due to LLM variance:

```python
config = EvalConfig(
    criteria={
        "response_match": CriterionConfig(
            threshold=0.6,  # Lower threshold
        ),
        "llm_judge": CriterionConfig(
            enabled=True,
            threshold=0.65,  # Allow some variance
        ),
    }
)
```

### Tool-Only Evaluation

When you only care about which tools are called:

```python
config = EvalConfig(
    criteria={
        "trajectory_match": CriterionConfig(
            enabled=True,
            threshold=1.0,
            match_type=MatchType.ANY_ORDER,  # Order doesn't matter
        ),
    }
)
```

### Strict Response Matching

For deterministic responses:

```python
from agentflow.evaluation.criteria import ExactMatchCriterion

# Use exact match criterion
criterion = ExactMatchCriterion()
```

## Next Steps

- Learn about [Data Models](data-models.md) in detail
- Explore all [Criteria](criteria.md) options
- Set up [Pytest Integration](pytest-integration.md)
- Use [User Simulation](user-simulation.md) for dynamic testing
