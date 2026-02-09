# Getting Started with Agent Evaluation

This guide walks you through setting up and running your first agent evaluation.

## Prerequisites

- A compiled Agentflow graph to test
- Python 3.12+
- Basic understanding of Agentflow graphs

## Quick Start (5 Lines!)

The fastest way to test your agent is with `QuickEval`:

```python
from agentflow.evaluation import QuickEval

# Test your agent with one line!
report = await QuickEval.check(
    graph=compiled_graph,
    query="What's the weather in Tokyo?",
    expected_response_contains="weather",
)

print(f"Pass rate: {report.summary.pass_rate * 100:.1f}%")
```

That's it! QuickEval handles:
- ✅ Creating eval sets automatically
- ✅ Configuring evaluation criteria
- ✅ Running the evaluation
- ✅ Generating reports

**85% less code** compared to the manual approach below.

---

## More QuickEval Examples

### Batch Testing

Test multiple scenarios at once:

```python
report = await QuickEval.batch(
    graph=compiled_graph,
    test_pairs=[
        ("Hello", "Hi"),
        ("Weather in NYC?", "sunny"),
        ("Thank you", "welcome"),
    ],
    threshold=0.7,
)
```

### Tool Usage Validation

Verify your agent calls the right tools:

```python
report = await QuickEval.tool_usage(
    graph=compiled_graph,
    test_cases=[
        ("Weather in NYC?", "It's sunny", ["get_weather"]),
        ("Temperature in Paris?", "18°C", ["get_weather"]),
    ],
    strict=True,  # Require exact tool matches
)
```

### Using Presets

```python
from agentflow.evaluation import EvalPresets

# Use preset configurations
report = await QuickEval.preset(
    graph=compiled_graph,
    preset=EvalPresets.response_quality(threshold=0.8),
    eval_set="tests/my_tests.json",
)
```

### Building Test Sets Fluently

Use `EvalSetBuilder` for complex test scenarios:

```python
from agentflow.evaluation import EvalSetBuilder, QuickEval, EvalPresets

eval_set = (
    EvalSetBuilder("weather_tests")
    .add_case(
        query="Weather in Tokyo?",
        expected="sunny",
        expected_tools=["get_weather"],
    )
    .add_case(
        query="Temperature in Paris?",
        expected="18°C",
        expected_tools=["get_weather"],
    )
    .add_multi_turn(
        conversation=[
            ("Hello", "Hi there!"),
            ("Weather?", "Which city?"),
            ("Tokyo", "It's sunny in Tokyo"),
        ],
    )
    .build()
)

# Run evaluation
report = await QuickEval.from_builder(
    graph=compiled_graph,
    builder=EvalSetBuilder("weather_tests"),
    config=EvalPresets.comprehensive(),
)
```

---

## Manual Approach (Advanced)

For full control over evaluation configuration, you can build everything manually.

### Step 1: Create an Evaluation Set

Evaluation sets can be created programmatically or loaded from JSON files.

#### Programmatic Creation

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
    ],
)
```

#### JSON File Format

Save evaluation sets as JSON files for reusability:

```json
{
  "eval_set_id": "weather_tests",
  "name": "Weather Agent Tests",
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
          ]
        }
      ]
    }
  ]
}
```

### Step 2: Configure Evaluation Criteria

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType

# Use presets (recommended)
config = EvalPresets.response_quality(threshold=0.8)

# Or customize criteria manually
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
    }
)
```

### Step 3: Create and Run the Evaluator

```python
from agentflow.evaluation import AgentEvaluator

# Create evaluator
evaluator = AgentEvaluator(graph=compiled_graph, config=config)

# Run evaluation
report = await evaluator.evaluate("tests/my_tests.json", verbose=True)

# Check results
print(f"Pass rate: {report.summary.pass_rate * 100:.1f}%")
```

### Step 4: View and Export Results

```python
from agentflow.evaluation import ConsoleReporter, JSONReporter

# Console output
ConsoleReporter(verbose=True).report(report)

# Export to JSON
JSONReporter().save(report, "results/evaluation_report.json")
```

---

## Next Steps

- Learn about [Data Models](data-models.md) in detail
- Explore all [Criteria](criteria.md) options
- Set up [Pytest Integration](pytest-integration.md)
- Use [User Simulation](user-simulation.md) for dynamic testing
