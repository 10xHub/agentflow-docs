---
title: Evaluation — AgentFlow Python AI Agent Framework
sidebar_label: Overview
description: An introduction to AgentFlow's evaluation framework — EvalSet, EvalConfig, criteria, presets, reports, and the agentflow eval CLI command.
keywords:
  - agentflow evaluation
  - agent eval
  - agentflow eval
  - EvalSet
  - EvalConfig
  - LLM judge
  - evaluation criteria
  - python ai agent framework
---

# Evaluation

Evaluation runs your actual agent against a set of test cases and produces a scored report. Unlike unit tests, evaluations measure **quality** — whether the agent called the right tools, gave a semantically correct response, avoided hallucinations, and stayed safe.

The evaluation stack has four layers:

```
EvalSet  →  AgentEvaluator  →  Criteria  →  EvalReport
   ↑               ↑               ↑              ↓
Test cases    Runs the graph   Scores results  HTML / JSON / JUnit
```

---

## Quick start

### 1. Define test cases

```python
from agentflow.qa.evaluation import EvalSetBuilder

eval_set = (
    EvalSetBuilder("weather-agent")
    .add_case(
        query="What is the weather in London?",
        expected="sunny",
        expected_tools=["get_weather"],
    )
    .add_case(
        query="Weather in Tokyo?",
        expected="Tokyo",
        expected_tools=["get_weather"],
    )
    .build()
)
```

### 2. Run with the CLI

Put the file in `evals/` and run:

```bash
agentflow eval
```

Reports are written to `eval_reports/` automatically.

### 3. Or run programmatically

```python
from agentflow.qa.evaluation import AgentEvaluator, EvalPresets
from agentflow.qa.evaluation.collectors.trajectory_collector import TrajectoryCollector

collector = TrajectoryCollector(capture_all_events=True)
config = EvalPresets.tool_usage()

evaluator = AgentEvaluator(app, collector, config=config)
report = await evaluator.evaluate(eval_set)

print(f"Pass rate: {report.summary.pass_rate:.0%}")
```

### 4. One-liner with QuickEval

```python
from agentflow.qa.evaluation import QuickEval

report = await QuickEval.check(
    graph=app,
    collector=collector,
    query="Weather in London?",
    expected_response_contains="sunny",
    expected_tools=["get_weather"],
)
```

---

## Core concepts

### EvalSet and EvalCase

An `EvalSet` is a named collection of `EvalCase` objects. Each case defines a user query (or a multi-turn conversation), the expected response, and optionally the expected tool calls and node visit order.

[Full EvalSet documentation](./eval-set.md)

### Criteria

Each evaluation case is scored against one or more criteria. A criterion takes the agent's execution trajectory and final response and produces a score between 0 and 1. AgentFlow ships eight built-in criteria:

| Criterion key | Type | What it checks |
|---|---|---|
| `tool_name_match_score` | No-LLM | Tool names called match expected |
| `tool_trajectory_avg_score` | No-LLM | Tool sequence matches (EXACT / IN_ORDER / ANY_ORDER) |
| `node_order_match_score` | No-LLM | Graph nodes visited in expected order |
| `rouge_match` | No-LLM | ROUGE-1 token overlap between actual and expected response |
| `response_match_score` | LLM judge | Semantic equivalence of actual and expected response |
| `llm_judge` | LLM judge | Overall response quality score |
| `factual_accuracy_v1` | LLM judge | Factual correctness of stated facts |
| `hallucinations_v1` | LLM judge | Groundedness — is the response based on actual tool results? |
| `safety_v1` | LLM judge | Safety across harmful content, hate speech, privacy, misinformation, manipulation |

[Full criteria documentation](./criteria.md)

### EvalConfig and presets

`EvalConfig` selects which criteria to run and sets thresholds. `EvalPresets` provides ready-made configs for the most common scenarios.

[Full config and presets documentation](./presets.md)

### User simulation

`UserSimulator` uses an LLM to play the role of a user and drive real conversations with your agent. You define a `ConversationScenario` with goals and a conversation plan; the simulator generates messages, checks goal completion after each turn, and stops when all goals are met. `BatchSimulator` runs multiple scenarios concurrently. `SimulationGoalsCriterion` scores the full transcript against the stated goals.

[Full user simulation documentation](./user-simulation.md)

### Reports

Every run produces an HTML visual dashboard and a JSON file. JUnit XML output is also available for CI integrations.

[Full reports documentation](./reports.md)

---

## Eval file format

The `agentflow eval` CLI discovers files matching `*_eval.py` or `eval_*.py` inside the `evals/` directory. Each file must expose one of three entry points:

### Minimum: `get_eval_set()`

```python
# evals/weather_eval.py
from agentflow.qa.evaluation import EvalSet, EvalSetBuilder


def get_eval_set() -> EvalSet:
    return (
        EvalSetBuilder("weather-regression")
        .add_tool_test(
            query="Weather in London?",
            tool_name="get_weather",
            tool_args={"location": "London"},
            expected_response="London",
        )
        .build()
    )
```

The CLI loads the agent from `agentflow.json`, applies default criteria (`tool_trajectory_avg_score` + `response_match_score`), runs the eval, and writes reports.

### Optional: `get_eval_config()`

Override the default criteria for a specific eval file:

```python
from agentflow.qa.evaluation import CriterionConfig, EvalConfig, MatchType


def get_eval_config() -> EvalConfig:
    return EvalConfig(
        criteria={
            "tool_trajectory_avg_score": CriterionConfig.trajectory(
                threshold=0.9,
                match_type=MatchType.IN_ORDER,
            ),
            "rouge_match": CriterionConfig.rouge_match(threshold=0.6),
        }
    )
```

You can also use the module-level constant `EVAL_CONFIG` instead:

```python
EVAL_CONFIG = EvalConfig(
    criteria={"rouge_match": CriterionConfig.rouge_match(threshold=0.6)}
)
```

### Full control: `run()`

Use `run()` when you need to load the agent yourself or run multiple eval sets:

```python
from agentflow.qa.evaluation import QuickEval
from agentflow.qa.evaluation.collectors.trajectory_collector import TrajectoryCollector
from graph.agent import app  # your agent


def run():
    collector = TrajectoryCollector(capture_all_events=True)
    return QuickEval.run_sync(
        graph=app,
        collector=collector,
        eval_set=build_eval_set(),
        config=build_eval_config(),
        print_results=True,
    )
```

A `run()` function can be sync or async. It must return an `EvalReport`.

---

## agentflow eval CLI

```bash
# Run all eval files in evals/
agentflow eval

# Target a single file
agentflow eval evals/weather_eval.py

# Target a subdirectory
agentflow eval evals/regression/

# Open the HTML report after running
agentflow eval --open

# Set a pass-rate threshold (exits non-zero if below)
agentflow eval --threshold 0.8

# Write reports to a custom directory
agentflow eval --output ci/reports

# Disable file reports (console output only)
agentflow eval --no-report
```

### agentflow.json configuration

```json
{
  "agent": "graph.react:app",
  "evaluation": {
    "directory": "evals",
    "output_dir": "eval_reports",
    "threshold": 0.8,
    "timestamp_files": true
  }
}
```

| Field | Description |
|---|---|
| `directory` | Directory scanned when no target is given |
| `output_dir` | Directory where report files are written |
| `threshold` | Minimum pass rate for a zero exit code |
| `timestamp_files` | Append timestamp to filenames so runs do not overwrite each other |

CLI flags always take precedence over `agentflow.json` values.

### CI integration

```yaml
# .github/workflows/ci.yml
- name: Run evaluations
  run: agentflow eval
  env:
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}  # needed for LLM-judge criteria
```

Set `threshold` in `agentflow.json`. If the pass rate drops below it, the step fails.

See also: [How to run evaluations](../../how-to/api-cli/run-evals.md)

---

## Next steps

- [Building eval sets](./eval-set.md) — define test cases with `EvalSetBuilder`
- [Criteria reference](./criteria.md) — all eight criteria explained
- [Presets and configuration](./presets.md) — ready-made configs and how to build your own
- [Reports](./reports.md) — HTML, JSON, JUnit XML output and CI integration
- [User simulation](./user-simulation.md) — AI-driven dynamic conversation testing with `UserSimulator` and `BatchSimulator`
