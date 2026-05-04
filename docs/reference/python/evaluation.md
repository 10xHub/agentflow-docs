---
title: Evaluation — AgentFlow Python AI Agent Framework
description: AgentEvaluator, EvalConfig, CriterionConfig, EvalSet, EvalCase, TrajectoryCollector — run repeatable, scored evaluations of your agents.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - evaluation
sidebar_position: 12
---


# Evaluation

## When to use this

Use the evaluation framework when you need to:
- Score agent accuracy on a labelled dataset (golden answers).
- Assert that the agent follows the correct tool-call sequence (trajectory matching).
- Run LLM-as-judge scoring against a rubric.
- Run automated red-teaming / adversarial simulation against the agent.

The evaluation runner is separate from unit tests. It is designed to run as a CI step or a recurring offline report.

## Import paths

```python
from agentflow.qa.evaluation import (
    AgentEvaluator,
    EvalConfig,
    CriterionConfig,
    MatchType,
    Rubric,
    EvalSet,
    EvalCase,
    ToolCall,
    TrajectoryStep,
    StepType,
    EvalReport,
    EvalCaseResult,
    CriterionResult,
    TrajectoryCollector,
    make_trajectory_callback,
)
```

---

## `EvalCase`

A single labelled test case.

### `EvalCase.single_turn`

```python
case = EvalCase.single_turn(
    eval_id="weather-paris-001",
    user_query="What is the weather in Paris today?",
    expected_response="sunny",      # substring or full string match
    expected_tools=["get_weather"], # tool names that must be called
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `eval_id` | `str` | required | Unique ID for this case. |
| `user_query` | `str` | required | Input message from the user. |
| `expected_response` | `str \| None` | `None` | Expected substring or full text response. |
| `expected_tools` | `list[str] \| None` | `None` | Tool names that must appear in the trajectory. |
| `expected_trajectory` | `list[TrajectoryStep] \| None` | `None` | Ordered node/tool execution steps. |
| `config` | `dict \| None` | `None` | Runtime config merged into `ainvoke()` config. |

### Multi-turn case

Multi-turn cases pass a list of `(user_message, expected_response)` tuples:

```python
case = EvalCase(
    eval_id="multi-turn-001",
    turns=[
        ("Hello", "Hi"),
        ("What can you do?", "I can answer questions"),
        ("Tell me about Python", "Python is a programming language"),
    ],
    expected_tools=["search_docs"],
)
```

---

## `ToolCall`

Represents an expected tool invocation for trajectory assertions.

```python
from agentflow.qa.evaluation import ToolCall

tc = ToolCall(
    name="get_weather",
    args={"location": "Paris", "units": "celsius"},
    call_id=None,   # optional
)
```

### `ToolCall.matches`

```python
tc.matches(actual_call_dict)  # → bool
```

Compares name and any args you specified. Missing keys in `args` are ignored (partial match by default).

---

## `TrajectoryStep`

A step in the expected execution trajectory (node entry or tool call).

### `TrajectoryStep.node`

```python
step = TrajectoryStep.node("RESEARCH_NODE")
```

### `TrajectoryStep.tool`

```python
step = TrajectoryStep.tool(
    ToolCall(name="search", args={"query": "AI trends"})
)
```

### `StepType`

| Value | Description |
|---|---|
| `StepType.NODE` | An agent node was entered. |
| `StepType.TOOL` | A tool was called. |

---

## `EvalSet`

A collection of `EvalCase` objects.

```python
eval_set = EvalSet(cases=[case1, case2, case3])
```

Load from a JSONL file:

```python
eval_set = EvalSet.from_jsonl("path/to/dataset.jsonl")
```

Each JSONL line is a JSON object matching the `EvalCase` schema.

---

## `CriterionConfig`

Defines a single evaluation criterion. Use the factory methods.

### `CriterionConfig.tool_name_match`

```python
criterion = CriterionConfig.tool_name_match(threshold=1.0)
```

Checks that the tools called match `expected_tools`. `threshold` is the fraction of expected tools that must match (1.0 = all).

### `CriterionConfig.trajectory`

```python
criterion = CriterionConfig.trajectory(
    threshold=1.0,
    match_type=MatchType.IN_ORDER,
    check_args=True,
)
```

Checks node + tool execution order against `expected_trajectory`.

### `CriterionConfig.node_order`

```python
criterion = CriterionConfig.node_order()
```

Checks only node execution order (no tool args).

### `CriterionConfig.llm_judge`

```python
criterion = CriterionConfig.llm_judge(
    prompt="Does the response correctly answer the user's query? Score 0-1.",
    model="gemini-2.5-flash",  # default: DEFAULT_JUDGE_MODEL
)
```

Uses a second LLM to score the response qualitatively.

### `CriterionConfig.rubric`

```python
criterion = CriterionConfig.rubric(
    rubrics=[
        Rubric(rubric_id="accuracy",   content="The answer is factually correct",   weight=0.5),
        Rubric(rubric_id="conciseness", content="The answer is concise",             weight=0.3),
        Rubric(rubric_id="tone",        content="The tone is friendly and helpful",  weight=0.2),
    ]
)
```

### `CriterionConfig.safety`

```python
criterion = CriterionConfig.safety()
```

Flags responses that contain harmful, toxic, or policy-violating content.

### `CriterionConfig.simulation`

```python
criterion = CriterionConfig.simulation(
    persona="an angry customer who asks about a delayed order",
    max_turns=5,
)
```

Runs an adversarial user simulation and scores the agent's handling.

---

## `MatchType`

| Value | Description |
|---|---|
| `MatchType.EXACT` | Steps must match exactly (same order, same count). |
| `MatchType.IN_ORDER` | Expected steps must appear in the actual trajectory in order, but other steps are allowed between them. |
| `MatchType.ANY_ORDER` | All expected steps must appear, in any order. |

---

## `Rubric`

```python
from agentflow.qa.evaluation import Rubric

rubric = Rubric(
    rubric_id="accuracy",
    content="The response must contain the correct capital city.",
    weight=1.0,
)
```

| Field | Type | Description |
|---|---|---|
| `rubric_id` | `str` | Unique ID for this rubric. |
| `content` | `str` | The grading criterion text passed to the LLM judge. |
| `weight` | `float` | Weight in the aggregate score (0.0–1.0). Weights across all rubrics should sum to 1. |

---

## `EvalConfig`

Holds the criteria to apply during evaluation.

```python
from agentflow.qa.evaluation import EvalConfig, CriterionConfig, MatchType

config = EvalConfig(
    criteria={
        "tool_match": CriterionConfig.tool_name_match(threshold=1.0),
        "trajectory": CriterionConfig.trajectory(match_type=MatchType.IN_ORDER),
        "quality": CriterionConfig.llm_judge(),
    }
)
```

### `EvalConfig.default`

```python
config = EvalConfig.default()
```

Returns a default config with `tool_match` and `trajectory` criteria.

---

## `TrajectoryCollector`

Records node entries and tool calls during a graph run. Wire it in via `make_trajectory_callback()`.

```python
from agentflow.qa.evaluation import TrajectoryCollector, make_trajectory_callback

collector = TrajectoryCollector()
callback = make_trajectory_callback(collector)

app = graph.compile(callback_manager=callback)

await app.ainvoke({"messages": [...]})

# Inspect recorded trajectory:
for step in collector.trajectory:
    print(step.type, step.name)
```

### `make_trajectory_callback`

```python
callback = make_trajectory_callback(collector: TrajectoryCollector) -> CallbackManager
```

Returns a `CallbackManager` that feeds events into the `TrajectoryCollector`.

---

## `AgentEvaluator`

Main evaluation runner.

```python
from agentflow.qa.evaluation import AgentEvaluator, EvalConfig, EvalSet

evaluator = AgentEvaluator(
    graph=app,
    collector=collector,
    config=EvalConfig.default(),
)

report = await evaluator.evaluate(eval_set)
print(report.format_summary())
```

### Constructor parameters

| Parameter | Type | Description |
|---|---|---|
| `graph` | `CompiledGraph` | The compiled graph to evaluate. |
| `collector` | `TrajectoryCollector` | Trajectory collector wired into the graph. |
| `config` | `EvalConfig` | Criteria configuration. |
| `concurrency` | `int` | Number of cases to run in parallel (default: 1). |

### Methods

| Method | Signature | Description |
|---|---|---|
| `evaluate` | `async (eval_set: EvalSet) → EvalReport` | Run all cases and return the full report. |
| `evaluate_case` | `async (case: EvalCase) → EvalCaseResult` | Run a single case and return its result. |

---

## Result types

### `EvalReport`

Returned by `evaluator.evaluate()`.

| Attribute | Type | Description |
|---|---|---|
| `cases` | `list[EvalCaseResult]` | Individual case results. |
| `overall_score` | `float` | Weighted average score across all cases and criteria. |
| `pass_rate` | `float` | Fraction of cases that passed all criteria. |
| `total_cases` | `int` | Total number of cases evaluated. |
| `passed_cases` | `int` | Number of cases that passed. |

```python
report.format_summary()   # → str  — human-readable summary
```

### `EvalCaseResult`

| Attribute | Type | Description |
|---|---|---|
| `eval_id` | `str` | The case ID. |
| `passed` | `bool` | True if all criteria passed. |
| `score` | `float` | Aggregate score for this case. |
| `criteria_results` | `dict[str, CriterionResult]` | Per-criterion results keyed by criterion name. |
| `actual_response` | `str` | The agent's actual response. |
| `actual_trajectory` | `list[TrajectoryStep]` | Recorded trajectory for this case. |
| `error` | `str \| None` | Error message if the run itself failed. |

### `CriterionResult`

| Attribute | Type | Description |
|---|---|---|
| `criterion_name` | `str` | The criterion's key from `EvalConfig.criteria`. |
| `passed` | `bool` | True if the criterion passed. |
| `score` | `float` | Score 0.0–1.0. |
| `reason` | `str \| None` | Explanation from LLM judge or matcher. |

---

## Reporters

Print the report to the console, export as JSON, or generate an HTML dashboard.

```python
from agentflow.qa.evaluation import ConsoleReporter, JSONReporter, HTMLReporter

# Console
ConsoleReporter().print(report)

# JSON file
JSONReporter(output_path="eval-report.json").write(report)

# HTML dashboard
HTMLReporter(output_path="eval-report.html").write(report)
```

---

## `DEFAULT_JUDGE_MODEL`

```python
from agentflow.qa.evaluation import DEFAULT_JUDGE_MODEL
# "gemini-2.5-flash"
```

The default LLM used for `llm_judge` and `rubric` criteria. Override by passing `model=` to the criterion config.

---

## Full end-to-end example

```python
import asyncio
from agentflow.core.graph import StateGraph
from agentflow.core.state import Message
from agentflow.utils import END
from agentflow.qa.testing import TestAgent
from agentflow.qa.evaluation import (
    AgentEvaluator,
    EvalConfig,
    EvalSet,
    EvalCase,
    CriterionConfig,
    MatchType,
    TrajectoryCollector,
    make_trajectory_callback,
)


async def main():
    # 1. Build a test-mode graph
    collector = TrajectoryCollector()
    callback = make_trajectory_callback(collector)

    agent = TestAgent(
        responses=[
            "The capital of France is Paris.",
            "Berlin is the capital of Germany.",
        ]
    )
    graph = StateGraph()
    graph.add_node("MAIN", agent)
    graph.set_entry_point("MAIN")
    graph.add_edge("MAIN", END)

    app = graph.compile(callback_manager=callback)

    # 2. Build the eval set
    eval_set = EvalSet(cases=[
        EvalCase.single_turn(
            eval_id="capitals-001",
            user_query="What is the capital of France?",
            expected_response="Paris",
        ),
        EvalCase.single_turn(
            eval_id="capitals-002",
            user_query="What is the capital of Germany?",
            expected_response="Berlin",
        ),
    ])

    # 3. Configure criteria
    config = EvalConfig(
        criteria={
            "response_quality": CriterionConfig.llm_judge(
                prompt="Does the response correctly identify the capital city? Score 0 or 1."
            ),
        }
    )

    # 4. Run evaluation
    evaluator = AgentEvaluator(graph=app, collector=collector, config=config)
    report = await evaluator.evaluate(eval_set)

    # 5. Print results
    print(report.format_summary())
    print(f"Pass rate: {report.pass_rate:.0%}")
    print(f"Overall score: {report.overall_score:.2f}")


asyncio.run(main())
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ImportError: No module named 'google.generativeai'` | LLM judge requires Google GenAI SDK. | `pip install google-generativeai` |
| `CriterionResult.score == 0.0` for `tool_name_match` | Agent didn't call any tools. | Check that `expected_tools` are reachable from the entry point. |
| `EvalCase` with `expected_trajectory` never passes | `TrajectoryCollector` not wired into graph. | Use `make_trajectory_callback()` when calling `graph.compile()`. |
| `MatchType.EXACT` failures when `IN_ORDER` expected | Too strict — actual trajectory has extra internal nodes. | Switch to `MatchType.IN_ORDER`. |
| `report.pass_rate == 0.0` and all `error` fields are set | Graph raises exception on every case. | Run a single `evaluate_case()` to see the error detail. |
