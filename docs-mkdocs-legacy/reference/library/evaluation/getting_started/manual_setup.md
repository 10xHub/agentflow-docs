# Manual Setup

This guide walks through the full 4-step evaluation pipeline without `QuickEval`. Use this approach when you need fine-grained control over every stage.

---

## Overview

The manual evaluation flow has four steps:

1. **Define** — Create `EvalCase` instances with expected outcomes
2. **Collect** — Wire a `TrajectoryCollector` into your graph
3. **Evaluate** — Run `AgentEvaluator` with your `EvalConfig`
4. **Report** — View results via reporters

---

## Step 1: Define Test Cases

### Single-Turn Case

```python
from agentflow.evaluation.dataset import EvalCase, ToolCall

case = EvalCase.single_turn(
    eval_id="weather_london",
    user_query="What is the weather in London?",
    expected_response="The weather in London is sunny",
    expected_tools=[ToolCall(name="get_weather", args={"city": "london"})],
    name="London Weather Check",
    description="Verify the agent queries weather for London",
)
```

### Multi-Turn Case

```python
case = EvalCase.multi_turn(
    eval_id="conversation_test",
    conversation=[
        ("Hello", "Hi there!"),
        ("What is the weather?", "It is sunny."),
        ("Thanks!", "You're welcome!"),
    ],
    expected_tools=[ToolCall(name="get_weather")],
    name="Weather Conversation",
)
```

> **Note:** In `multi_turn()`, `expected_tools` is attached to the first invocation only.

### Building an Invocation Manually

For full control over each conversation turn:

```python
from agentflow.evaluation.dataset import EvalCase, Invocation, MessageContent, ToolCall

case = EvalCase(
    eval_id="custom_case",
    name="Custom Multi-Turn",
    conversation=[
        Invocation(
            user_content=MessageContent.user("What is the weather in NYC?"),
            expected_final_response=MessageContent.assistant("It is sunny in NYC"),
            expected_tool_trajectory=[
                ToolCall(name="get_weather", args={"city": "new york"}),
            ],
        ),
        Invocation.simple(
            user_query="And in London?",
            expected_response="It is rainy in London",
            expected_tools=[ToolCall(name="get_weather", args={"city": "london"})],
        ),
    ],
)
```

### Grouping into an EvalSet

```python
from agentflow.evaluation.dataset import EvalSet

eval_set = EvalSet(
    eval_set_id="weather_tests",
    name="Weather Agent Tests",
    description="End-to-end weather agent evaluation",
    eval_cases=[case_1, case_2, case_3],
)
```

### Loading from JSON

```python
eval_set = EvalSet.from_file("tests/fixtures/weather_tests.json")
```

### Saving to JSON

```python
eval_set.to_file("tests/fixtures/weather_tests.json")
```

---

## Step 2: Wire the Trajectory Collector

The `TrajectoryCollector` hooks into graph execution via callback managers. It captures tool calls, node visits, and LLM responses automatically.

### Recommended: `create_eval_app()`

The easiest way to wire everything up is `create_eval_app()`. It creates the collector, callback manager, and compiles the graph in one call:

```python
from agentflow.evaluation import create_eval_app

# Pass your *uncompiled* StateGraph
compiled, collector = create_eval_app(my_state_graph)
```

> **Important — compile once, reuse everywhere.**
> The `CallbackManager` is bound to a global dependency-injection container when `compile()` is called. You must compile the graph **once** and reuse the same `compiled` app and `collector` across all evaluation calls. Compiling a second graph will create a new `CallbackManager` that may not be bound correctly, causing empty trajectory data (missing `final_response`, `node_visits`, etc.).
>
> ```python
> # ✅ Correct — compile once, reuse for all evaluations
> compiled, collector = create_eval_app(my_graph)
> evaluator = AgentEvaluator(compiled, collector, config=config)
> report1 = await evaluator.evaluate(eval_set_1)
> report2 = await evaluator.evaluate(eval_set_2)
>
> # ❌ Wrong — compiling a new graph per test will break collection
> compiled1, collector1 = create_eval_app(graph1)
> compiled2, collector2 = create_eval_app(graph2)  # collector2 won't capture data
> ```

### Manual Setup

If you need full control over the compilation step (e.g., custom checkpointer):

```python
from agentflow.evaluation import TrajectoryCollector, make_trajectory_callback

# Create collector
collector = TrajectoryCollector(capture_all_events=True)

# Create callback manager wired to the collector
_, callback_mgr = make_trajectory_callback(
    collector,
    config={"thread_id": "eval-run-1"},
)

# Compile your graph with the callback manager
compiled = my_state_graph.compile(
    callback_manager=callback_mgr,
    checkpointer=my_checkpointer,  # optional
)
```

The same compile-once rule applies here — do **not** call `compile()` again with a different `CallbackManager` in the same process.

**What gets captured:**
- Tool calls with arguments and results
- Node visits in execution order
- LLM input/output at each AI node (as `NodeResponse` objects)
- Timestamps for duration tracking

The collector is **reset automatically** before each `evaluate_case()` call.

---

## Step 3: Configure and Run Evaluation

### Configure Criteria

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType

config = EvalConfig(
    criteria={
        # No-LLM criteria
        "tool_name_match_score": CriterionConfig(threshold=1.0),
        "tool_trajectory_avg_score": CriterionConfig(
            threshold=1.0,
            match_type=MatchType.EXACT,
            check_args=True,
        ),
        "response_match_score": CriterionConfig(threshold=0.7),

        # LLM-as-judge criteria (requires API key)
        "llm_judge": CriterionConfig(
            threshold=0.8,
            judge_model="gemini/gemini-2.5-flash",
            num_samples=3,
        ),
    }
)
```

### Using Factory Methods

`CriterionConfig` provides factory methods for common configurations:

```python
config = EvalConfig(
    criteria={
        "tool_name_match_score": CriterionConfig.tool_name_match(threshold=1.0),
        "tool_trajectory_avg_score": CriterionConfig.trajectory(
            threshold=1.0,
            match_type=MatchType.IN_ORDER,
            check_args=False,
        ),
        "response_match_score": CriterionConfig.response_match(threshold=0.7),
        "llm_judge": CriterionConfig.llm_judge(threshold=0.8),
        "hallucinations_v1": CriterionConfig.hallucination(threshold=0.8),
        "safety_v1": CriterionConfig.safety(threshold=0.8),
    }
)
```

### Run Evaluation

```python
from agentflow.evaluation import AgentEvaluator

evaluator = AgentEvaluator(compiled, collector, config=config)

# Evaluate a full EvalSet
report = await evaluator.evaluate(eval_set, verbose=True)

# Or evaluate a single case
result = await evaluator.evaluate_case(case)
assert result.passed, f"Failed criteria: {result.failed_criteria}"
```

### Synchronous & File-Based Shortcuts

```python
# Synchronous wrapper (no async context needed)
report = AgentEvaluator.evaluate_sync(
    graph=compiled,
    collector=collector,
    eval_set=eval_set,          # EvalSet object or path to JSON file
    config=config,
    verbose=True,
)

# Evaluate directly from file paths
report = await AgentEvaluator.evaluate_file(
    agent_module="examples.react.react_weather_agent",  # module with 'graph' variable
    eval_file="tests/fixtures/weather_agent.evalset.json",
    config_file="eval_config.json",                      # optional
)
```

### Understanding EvalReport

```python
# Summary statistics
print(f"Pass rate: {report.summary.pass_rate:.1%}")
print(f"Passed: {report.summary.passed_cases}/{report.summary.total_cases}")
print(f"Failed: {report.summary.failed_cases}")
print(f"Errors: {report.summary.error_cases}")

# Per-case results
for case_result in report.results:
    print(f"\n{case_result.eval_id}: {'PASS' if case_result.passed else 'FAIL'}")
    for cr in case_result.criterion_results:
        status = "✓" if cr.passed else "✗"
        print(f"  {status} {cr.criterion}: {cr.score:.2f} (threshold: {cr.threshold})")

# Criterion-level stats
for name, stats in report.summary.criterion_stats.items():
    print(f"{name}: avg={stats['avg_score']:.2f}, pass_rate={stats['pass_rate']:.1%}")
```

---

## Step 4: Generate Reports

### Console Report

```python
from agentflow.evaluation import ConsoleReporter, print_report

# Quick one-liner
print_report(report)

# Or with options
reporter = ConsoleReporter(
    verbose=True,
    use_color=True,
    include_trajectory=True,
    include_actual_response=True,
)
reporter.report(report)
```

### JSON Report

```python
from agentflow.evaluation import JSONReporter

reporter = JSONReporter(indent=2, include_details=True)
reporter.save(report, "eval_reports/results.json")

# Or get as string
json_str = reporter.to_json(report)
```

### HTML Report

```python
from agentflow.evaluation import HTMLReporter

reporter = HTMLReporter(include_details=True, include_trajectory=True)
reporter.save(report, "eval_reports/results.html")
```

### JUnit XML Report (CI/CD)

```python
from agentflow.evaluation import JUnitXMLReporter

reporter = JUnitXMLReporter()
reporter.save(report, "eval_reports/results.xml")
```

### All Reporters at Once

```python
from agentflow.evaluation import ReporterManager, ReporterConfig

config = ReporterConfig(
    console=True,
    json_report=True,
    html=True,
    junit_xml=True,
)

manager = ReporterManager(config)
output = manager.run_all(report, output_dir="eval_reports/")

print(f"Generated files: {output.generated_files}")
if output.has_errors:
    print(f"Errors: {output.errors}")
```

---

## Complete Example

```python
import asyncio
from agentflow.evaluation import (
    AgentEvaluator,
    EvalConfig,
    CriterionConfig,
    ConsoleReporter,
    HTMLReporter,
    create_eval_app,
)
from agentflow.evaluation.dataset import EvalCase, EvalSet, ToolCall

# 2. Collect — compile once at module level
compiled, collector = create_eval_app(my_graph)

async def run_evaluation():
    # 1. Define
    eval_set = EvalSet(
        name="Weather Agent Tests",
        eval_cases=[
            EvalCase.single_turn(
                eval_id="london",
                user_query="Weather in London?",
                expected_response="sunny in London",
                expected_tools=[ToolCall(name="get_weather")],
            ),
            EvalCase.single_turn(
                eval_id="tokyo",
                user_query="Weather in Tokyo?",
                expected_response="cloudy in Tokyo",
                expected_tools=[ToolCall(name="get_weather")],
            ),
        ],
    )

    # 3. Evaluate (reuse compiled + collector from above)
    config = EvalConfig(criteria={
        "tool_name_match_score": CriterionConfig(threshold=1.0),
        "response_match_score": CriterionConfig(threshold=0.7),
    })
    evaluator = AgentEvaluator(compiled, collector, config=config)
    report = await evaluator.evaluate(eval_set)

    # 4. Report
    ConsoleReporter(verbose=True).report(report)
    HTMLReporter().save(report, "eval_reports/weather.html")

    assert report.summary.pass_rate == 1.0

asyncio.run(run_evaluation())
```

---

## Next Steps

- [Single-Turn Evaluation Tutorial](../tutorial/single_turn_evaluation.md)
- [Multi-Turn Evaluation Tutorial](../tutorial/multi_turn_evaluation.md)
- [Data Models Reference](../reference/data_models.md)
- [Criteria Reference](../reference/criteria.md)
