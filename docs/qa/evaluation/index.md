---
title: Evaluation — AgentFlow Python AI Agent Framework
sidebar_label: Overview
description: An introduction to AgentFlow's evaluation framework — EvalSet, EvalConfig, EvalPresets, user simulation, parallel execution, criteria, and the agentflow eval CLI command.
keywords:
  - agentflow evaluation
  - agent eval
  - agentflow eval
  - EvalSet
  - EvalConfig
  - EvalPresets
  - user simulator
  - parallel evaluation
  - LLM judge
  - evaluation criteria
  - python ai agent framework
---

# Evaluation

Evaluation runs your actual agent against a set of test cases and produces a scored report. Unlike unit tests, evaluations measure **quality** — whether the agent called the right tools, gave a semantically correct response, avoided hallucinations, and stayed safe.

The evaluation stack has four layers:

```
EvalSet / Scenarios  →  AgentEvaluator / UserSimulator  →  Criteria  →  EvalReport
       ↑                           ↑                            ↑              ↓
  Test cases               Runs the graph               Scores results   HTML / JSON
```

---

## Quick start

### 1. Define test cases

```python
from agentflow.qa.evaluation import EvalSetBuilder

eval_set = (
    EvalSetBuilder("weather-agent")
    .add_tool_test(
        query="What is the weather in London?",
        tool_name="get_weather",
        tool_args={"location": "London"},
        expected_response="London",
        case_id="weather_london",
    )
    .add_tool_test(
        query="Weather in Tokyo?",
        tool_name="get_weather",
        tool_args={"location": "Tokyo"},
        expected_response="Tokyo",
        case_id="weather_tokyo",
    )
    .build()
)
```

### 2. Run with the CLI

Put the file in `evals/` and run:

```bash
agentflow eval
```

Reports are written to `eval_reports/` automatically. Run in parallel across all cases from all files:

```bash
agentflow eval --parallel --max-concurrency 8
```

### 3. Or run programmatically

```python
from agentflow.qa.evaluation import AgentEvaluator
from agentflow.qa.evaluation.config.presets import EvalPresets
from agentflow.qa.evaluation.collectors.trajectory_collector import TrajectoryCollector

collector = TrajectoryCollector(capture_all_events=True)
config = EvalPresets.tool_usage(threshold=0.6)

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

Each evaluation case is scored against one or more criteria. A criterion takes the agent's execution trajectory and final response and produces a score between 0 and 1.

| Criterion key | Type | What it checks |
|---|---|---|
| `tool_name_match_score` | No-LLM | Tool names called match expected |
| `tool_trajectory_avg_score` | No-LLM | Tool sequence matches (EXACT / IN_ORDER / ANY_ORDER) |
| `node_order` | No-LLM | Graph nodes visited in expected order |
| `rouge_match` | No-LLM | ROUGE-1 token overlap between actual and expected response |
| `response_match` | LLM judge | Semantic equivalence of actual and expected response |
| `llm_judge` | LLM judge | Overall response quality score |
| `factual_accuracy` | LLM judge | Factual correctness of stated facts |
| `hallucination` | LLM judge | Groundedness — is the response based on actual tool results? |
| `safety` | LLM judge | Safety across harmful content, hate speech, privacy, misinformation, manipulation |
| `simulation_goals` | LLM judge | Goal achievement across a full multi-turn simulation transcript |

**Default criteria** (applied when no criteria are configured):

| Criterion | Threshold | Match type |
|---|---|---|
| `response_match` | 0.6 | ANY_ORDER |
| `tool_name_match_score` | 0.6 | ANY_ORDER |
| `node_order` | 0.6 | IN_ORDER |

[Full criteria documentation](./criteria.md)

### EvalConfig and EvalPresets

`EvalConfig` selects which criteria to run and sets thresholds. `EvalPresets` provides ready-made configs — one line instead of writing criteria from scratch.

```python
from agentflow.qa.evaluation.config.presets import EvalPresets

config = EvalPresets.tool_usage(threshold=0.6)      # tool calls + response quality
config = EvalPresets.response_quality(threshold=0.7) # LLM judge on response accuracy
config = EvalPresets.quick_check()                   # fast ROUGE check, no LLM cost
config = EvalPresets.comprehensive(threshold=0.8)    # all criteria combined
```

[Full config and presets documentation](./presets.md)

### User simulation

`UserSimulator` uses an LLM to play the role of a user and drive real conversations with your agent. You define a `ConversationScenario` with goals; the simulator generates messages turn by turn and scores goal achievement across the full transcript with `SimulationGoalsCriterion`.

[Full user simulation documentation](./user-simulation.md)

### Reports

Every run produces an HTML visual dashboard and a JSON file. JUnit XML output is also available for CI integrations.

[Full reports documentation](./reports.md)

---

## Eval file protocols

The `agentflow eval` CLI discovers files matching `*_eval.py` or `eval_*.py` inside the `evals/` directory. It auto-detects which protocol each file uses.

### Protocol summary

| Protocol | Entry point | When to use |
|---|---|---|
| Fixed test cases | `get_eval_set()` | Regression: known inputs and expected outputs |
| Per-file config | `get_eval_config()` or `EVAL_CONFIG` | Override criteria or thresholds for one file |
| Presets shortcut | `EvalPresets` inside `get_eval_config()` | Recommended — one-line ready-made configs |
| Multiple sets | Functions annotated `-> EvalSet` | Pytest-style: several named sets in one file |
| User simulator | `get_scenarios()` or `SCENARIOS` | Dynamic multi-turn conversations with an LLM user |

---

### `get_eval_set()` — minimum required

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

The CLI loads the agent from `agentflow.json`, applies default criteria (all at 0.6 threshold), runs the eval, and writes reports.

---

### `get_eval_config()` — per-file criteria with EvalPresets

```python
from agentflow.qa.evaluation import EvalConfig, EvalSet, EvalSetBuilder
from agentflow.qa.evaluation.config.presets import EvalPresets


def get_eval_config() -> EvalConfig:
    return EvalPresets.tool_usage(threshold=0.6)


def get_eval_set() -> EvalSet:
    return EvalSetBuilder("weather-regression").add_tool_test(...).build()
```

Use `EVAL_CONFIG` instead of a function when the config is static:

```python
from agentflow.qa.evaluation.config.presets import EvalPresets

EVAL_CONFIG = EvalPresets.tool_usage(threshold=0.6)
```

---

### Annotated functions `-> EvalSet` — multiple sets per file

Any function annotated with `-> EvalSet` is auto-discovered. Useful when you want several named eval sets in one file.

```python
from agentflow.qa.evaluation import EvalSet, EvalSetBuilder
from agentflow.qa.evaluation.config.presets import EvalPresets


def get_eval_config():
    return EvalPresets.tool_usage(threshold=0.6)


def weather_cases() -> EvalSet:
    return EvalSetBuilder("weather").add_tool_test(...).build()


def booking_cases() -> EvalSet:
    return EvalSetBuilder("booking").add_tool_test(...).build()
```

Both `weather_cases` and `booking_cases` are discovered and run as separate eval sets.

---

### `get_scenarios()` — user simulator

Use this when you want an LLM to drive dynamic multi-turn conversations instead of fixed prompts.

```python
# evals/user_simulator_eval.py
from agentflow.qa.evaluation import ConversationScenario, UserSimulatorConfig


SIMULATOR_CONFIG = UserSimulatorConfig(
    model="gemini/gemini-2.5-flash",
    max_invocations=8,
    temperature=0.7,
)


def get_scenarios() -> list[ConversationScenario]:
    return [
        ConversationScenario(
            scenario_id="weather_travel_planning",
            description="User planning a trip wants weather info and packing advice",
            starting_prompt="Hi! I'm planning a trip to Paris this weekend.",
            goals=[
                "User receives weather information for Paris",
                "User gets clothing or packing advice",
            ],
            max_turns=8,
        ),
    ]
```

The CLI detects `get_scenarios()` (or a `SCENARIOS` constant), runs each scenario through `UserSimulator`, scores goal achievement with `SimulationGoalsCriterion`, and produces the same report as regular eval cases. No extra code needed.

You can also use a module-level constant instead of a function:

```python
SCENARIOS = [
    ConversationScenario(...),
    ConversationScenario(...),
]
```

[Full user simulation documentation](./user-simulation.md)

---

## Parallel execution

By default all cases run sequentially. Pass `--parallel` to run all cases from all files in a single flat pool under one asyncio event loop:

```bash
agentflow eval --parallel --max-concurrency 8
```

**How the flat pool works:** cases from all files (including simulation scenarios) are collected first, then all run concurrently throttled by a single semaphore. Cases complete out of order — that is expected and shown in the progress output:

```
[  1/50] weather_eval.py::weather_london          PASSED   1.23s
[  3/50] booking_eval.py::book_flight             PASSED   2.10s
[  2/50] weather_eval.py::weather_tokyo           PASSED   0.98s
...
[ 50/50] ...

Results: 47/50 passed (94.0%)
```

Regular eval cases and simulation scenarios are mixed in the same pool and appear in the same report.

---

## agentflow eval CLI

```bash
# Run all eval files in evals/
agentflow eval

# Target a single file
agentflow eval evals/weather_eval.py

# Target a subdirectory
agentflow eval evals/regression/

# Run in parallel with up to 8 concurrent cases
agentflow eval --parallel --max-concurrency 8

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
  "agent": "graph.agent:app",
  "evaluation": {
    "directory": "evals",
    "output_dir": "eval_reports",
    "threshold": 0.75,
    "parallel": false,
    "max_concurrency": 4,
    "timestamp_files": true
  }
}
```

| Field | Description |
|---|---|
| `directory` | Directory scanned when no target is given |
| `output_dir` | Directory where report files are written |
| `threshold` | Minimum pass rate for a zero exit code |
| `parallel` | Run all cases from all files in a flat parallel pool |
| `max_concurrency` | Maximum cases running at once when `parallel` is true |
| `timestamp_files` | Append timestamp to filenames so runs do not overwrite each other |

**Config priority (highest first):** CLI flags → `agentflow.json` → per-file `get_eval_config()` → built-in defaults (0.6 threshold)

CLI flags always take precedence over `agentflow.json` values.

### CI integration

```yaml
# .github/workflows/ci.yml
- name: Run evaluations
  run: agentflow eval --parallel
  env:
    GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}  # needed for LLM-judge criteria
```

Set `threshold` in `agentflow.json`. If the pass rate drops below it, the step fails.

See also: [How to run evaluations](../../how-to/api-cli/run-evals.md)

---

## Next steps

- [Building eval sets](./eval-set.md) — define test cases with `EvalSetBuilder`
- [Criteria reference](./criteria.md) — all criteria explained
- [Presets and configuration](./presets.md) — ready-made configs and how to build your own
- [User simulation](./user-simulation.md) — AI-driven dynamic conversation testing
- [Reports](./reports.md) — HTML, JSON, JUnit XML output and CI integration
