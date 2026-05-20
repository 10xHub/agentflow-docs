---
title: Run Evaluations — AgentFlow Python AI Agent Framework
sidebar_label: Run Evaluations
description: How to run agent evaluations using agentflow eval. Covers parallel execution, user simulation, EvalPresets, report generation, thresholds, and agentflow.json configuration.
keywords:
  - agentflow eval
  - agentflow cli
  - agent evaluation
  - parallel evaluation
  - user simulator
  - agentflow
  - python ai agent framework
  - eval report html json
---

# Run evaluations

The `agentflow eval` command discovers evaluation files in your project, runs all cases under a single async event loop, and always generates an HTML and JSON report. No flags required — reports are on by default.

## Prerequisites

Your project must have been initialised with `agentflow init`. Eval files live in the `evals/` directory created by `agentflow init --prod`.

## Quick start

From the folder that contains `agentflow.json`:

```bash
agentflow eval
```

This scans `evals/` for files matching `*_eval.py` or `eval_*.py`, collects every case from every file into a flat pool, runs them, and writes reports to `eval_reports/`:

```
eval_reports/
  weather-agent-regression_20260513_142301.html
  weather-agent-regression_20260513_142301.json
```

## Run a specific file or directory

```bash
# One file
agentflow eval evals/weather_agents_eval.py

# A subdirectory
agentflow eval evals/regression/
```

When a file is given, only that file runs. When a directory is given, all matching files are discovered. Results from all files are merged into a single combined report.

## Run in parallel

By default all cases run sequentially. Pass `--parallel` to run them concurrently:

```bash
agentflow eval --parallel
agentflow eval --parallel --max-concurrency 8
```

**How it works:** all cases from all files are collected first into a single flat pool. One asyncio event loop runs the entire pool under a single semaphore capped at `--max-concurrency`. Cases complete out of order — that is expected.

```
[  1/50] weather_agents_eval.py::weather_london      PASSED   1.23s
[  3/50] booking_eval.py::book_flight_london         PASSED   2.10s
[  2/50] weather_agents_eval.py::weather_new_york    PASSED   0.98s
...
[ 50/50] ...

Results: 47/50 passed (94.0%)
```

You can also enable parallel by default in `agentflow.json` (see [Configure defaults](#configure-defaults-in-agentflowjson)).

## Reports

Every run produces two files in `eval_reports/` (or the directory set by `--output`):

| File | Contents |
| --- | --- |
| `<eval-id>_<timestamp>.html` | Visual dashboard: summary cards, criterion bars, per-case details |
| `<eval-id>_<timestamp>.json` | Machine-readable results for CI tooling or custom analysis |

Console output is always printed as cases complete. The HTML/JSON files are written after all cases finish.

### Open the report automatically

```bash
agentflow eval --open
```

### Skip file output

```bash
agentflow eval --no-report
```

Only console output is produced. Useful for fast local feedback.

## Set a pass-rate threshold

```bash
agentflow eval --threshold 0.8
```

The command exits with a non-zero code if the overall pass rate is below the threshold. Useful in CI to gate merges on eval quality.

## Write reports to a custom directory

```bash
agentflow eval --output ci/reports
```

## Configure defaults in agentflow.json

Add an `evaluation` section to `agentflow.json` to set project-level defaults. CLI flags always take precedence.

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
| --- | --- |
| `directory` | Directory scanned when no `TARGET` argument is given |
| `output_dir` | Directory where report files are written |
| `threshold` | Minimum pass rate required for a zero exit code |
| `parallel` | Run all cases from all files in a flat parallel pool |
| `max_concurrency` | Maximum cases running at once when `parallel` is true |
| `timestamp_files` | Append timestamp to filenames so runs do not overwrite each other |

### Enforce threshold in CI

```yaml
# .github/workflows/ci.yml
- name: Run evaluations
  run: agentflow eval --parallel
```

Set `threshold` in `agentflow.json`. If the pass rate drops below it, the step fails without extra flags.

---

## Eval file protocols

An eval file is any `*_eval.py` or `eval_*.py` file. The CLI auto-detects which protocol you are using. Pick the one that fits your use case.

### Summary

| Protocol | When to use |
| --- | --- |
| `get_eval_set()` | Standard: fixed prompt/response pairs |
| `get_eval_config()` / `EVAL_CONFIG` | Override criteria per file |
| `EvalPresets` | Recommended: one-line preset configs |
| Annotated functions `-> EvalSet` | Pytest-style discovery, multiple sets per file |
| `get_scenarios()` / `SCENARIOS` | User simulator: dynamic multi-turn conversations |

---

### `get_eval_set()` — minimum required

The CLI loads the agent from `agentflow.json`, applies default criteria (60% threshold on all), runs the evaluation, and writes reports. You only define the cases.

```python
# evals/weather_agents_eval.py
from agentflow.qa.evaluation import EvalSet, EvalSetBuilder


def get_eval_set() -> EvalSet:
    return (
        EvalSetBuilder(name="weather-agent-regression")
        .add_tool_test(
            query="What is the weather in London?",
            tool_name="get_weather",
            tool_args={"location": "London"},
            expected_response="London",
            case_id="weather_london",
        )
        .add_tool_test(
            query="What is the weather in Tokyo?",
            tool_name="get_weather",
            tool_args={"location": "Tokyo"},
            expected_response="Tokyo",
            case_id="weather_tokyo",
        )
        .build()
    )
```

**Default criteria** (applied automatically when no criteria are configured anywhere):

| Criterion | Threshold | Match type |
| --- | --- | --- |
| `response_match` | 0.6 | ANY_ORDER |
| `tool_name_match_score` | 0.6 | ANY_ORDER |
| `node_order` | 0.6 | IN_ORDER |

---

### `get_eval_config()` — per-file criteria with EvalPresets

Add this function when you want to specify which criteria to run and what thresholds to use. The recommended approach is `EvalPresets` — one-line preset configs covering the most common patterns.

```python
from agentflow.qa.evaluation import EvalConfig, EvalSet, EvalSetBuilder
from agentflow.qa.evaluation.config.presets import EvalPresets


def get_eval_config() -> EvalConfig:
    return EvalPresets.tool_usage(threshold=0.6)


def get_eval_set() -> EvalSet:
    return (
        EvalSetBuilder(name="weather-agent-regression")
        .add_tool_test(
            query="What is the weather in London?",
            tool_name="get_weather",
            tool_args={"location": "London"},
            expected_response="London",
            case_id="weather_london",
        )
        .build()
    )
```

**Available presets:**

| Preset | What it checks |
| --- | --- |
| `EvalPresets.response_quality(threshold)` | LLM judge on response accuracy |
| `EvalPresets.tool_usage(threshold)` | Tool calls correct + response quality |
| `EvalPresets.conversation_flow(threshold)` | Multi-turn conversation evaluation |
| `EvalPresets.comprehensive(threshold)` | All of the above combined |
| `EvalPresets.quick_check(threshold)` | Fast ROUGE-based check, no LLM cost |

You can also combine presets:

```python
from agentflow.qa.evaluation.config.presets import EvalPresets


def get_eval_config():
    return EvalPresets.combine(
        EvalPresets.tool_usage(threshold=0.7),
        EvalPresets.response_quality(threshold=0.6),
    )
```

---

### `EVAL_CONFIG` — constant instead of function

Same effect as `get_eval_config()` but as a module-level constant. Useful when the config is static.

```python
from agentflow.qa.evaluation.config.presets import EvalPresets

EVAL_CONFIG = EvalPresets.tool_usage(threshold=0.6)
```

---

### Annotated functions `-> EvalSet` — pytest-style discovery

Any module-level function with return type `-> EvalSet` is auto-discovered as an eval set. Useful when you want multiple named eval sets in one file.

```python
from agentflow.qa.evaluation import EvalSet, EvalSetBuilder
from agentflow.qa.evaluation.config.presets import EvalPresets


def get_eval_config():
    return EvalPresets.tool_usage(threshold=0.6)


def weather_cases() -> EvalSet:
    return EvalSetBuilder(name="weather").add_tool_test(...).build()


def booking_cases() -> EvalSet:
    return EvalSetBuilder(name="booking").add_tool_test(...).build()
```

Both `weather_cases` and `booking_cases` are discovered and run. Their results appear as separate eval sets in the report.

---

### `get_scenarios()` — user simulator

Use this protocol when you want the LLM to drive a dynamic multi-turn conversation against your agent rather than using fixed prompt/response pairs.

You only define the scenarios. The CLI handles running the simulator, scoring goal achievement, and writing the report — identical to regular eval cases.

```python
# evals/user_simulator_eval.py
from agentflow.qa.evaluation import ConversationScenario, UserSimulatorConfig


# Optional: override simulator model and settings for this file.
# If omitted, the CLI uses UserSimulatorConfig defaults (gemini-2.5-flash).
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
            conversation_plan=(
                "1. Ask about current weather in Paris\n"
                "2. Ask whether to bring a jacket\n"
                "3. Ask about outdoor sightseeing timing"
            ),
            goals=[
                "User receives weather information for Paris",
                "User gets clothing or packing advice",
                "User learns about outdoor activity timing",
            ],
            max_turns=8,
        ),
        ConversationScenario(
            scenario_id="flight_booking",
            description="User wants help finding a flight",
            starting_prompt="I need to fly from London to New York next Friday.",
            goals=[
                "User receives flight options",
                "User gets pricing information",
            ],
            max_turns=10,
        ),
    ]
```

**How it works:**

1. The CLI detects `get_scenarios()` (or a `SCENARIOS` constant) and switches to simulator mode for that file.
2. Each `ConversationScenario` becomes one eval case.
3. The simulator drives up to `max_turns` turns, generating contextual user messages after each agent response.
4. `SimulationGoalsCriterion` uses an LLM judge to score how many goals were achieved across the full conversation.
5. Pass/fail and the report are produced the same way as regular eval cases.

**`ConversationScenario` fields:**

| Field | Required | Description |
| --- | --- | --- |
| `scenario_id` | Yes | Unique ID for the scenario (appears in the report) |
| `description` | No | Human-readable name shown in the report |
| `starting_prompt` | Yes | First user message to kick off the conversation |
| `conversation_plan` | No | Hints to the simulator about how to progress |
| `goals` | Yes | List of outcomes the user wants to achieve |
| `max_turns` | No | Maximum conversation turns (default: 10) |

**`SIMULATOR_CONFIG` fields:**

| Field | Default | Description |
| --- | --- | --- |
| `model` | `gemini/gemini-2.5-flash` | LLM used to generate user messages |
| `max_invocations` | `10` | Maximum turns per scenario |
| `temperature` | `0.7` | Temperature for user message generation |

---

## Config priority

When multiple sources configure the same setting, this priority applies (highest first):

```
1. CLI flags          (--parallel, --max-concurrency, --threshold, --output)
2. agentflow.json     "evaluation" section
3. Per-file config    get_eval_config() / EVAL_CONFIG
4. Built-in defaults  (all criteria at 0.6 threshold)
```

---

## Common scenarios

**Fast local check, single file, open report:**

```bash
agentflow eval evals/weather_agents_eval.py --open
```

**Parallel run with 8 concurrent cases:**

```bash
agentflow eval --parallel --max-concurrency 8
```

**Strict CI gate at 80% pass rate:**

```json
{
  "evaluation": {
    "threshold": 0.8,
    "parallel": true,
    "max_concurrency": 8
  }
}
```

```bash
agentflow eval
```

**Run only a regression suite in a subdirectory:**

```bash
agentflow eval evals/regression/ --output reports/regression
```

**Mix regular evals and user simulator in the same run:**

```
evals/
  weather_agents_eval.py     ← get_eval_set() protocol
  user_simulator_eval.py     ← get_scenarios() protocol
```

```bash
agentflow eval --parallel
```

Both files are discovered, cases and scenarios are collected into the same flat pool, and results appear in a single merged report.

---

## Common issues

**"Eval directory 'evals/' not found"**
- Create an `evals/` directory or pass a path explicitly: `agentflow eval path/to/evals`
- Run `agentflow init --prod` to scaffold the standard project layout.

**"No eval cases found"**
- Eval files must expose `get_eval_set()`, `get_scenarios()`, `SCENARIOS`, or functions annotated `-> EvalSet`.
- File must match `*_eval.py` or `eval_*.py`. Rename it or pass it explicitly.

**File skipped with warning**
- The file does not expose any recognised entry point. Add `get_eval_set()` or `get_scenarios()`.

**Exit code 1 even when all cases pass**
- Check if a `threshold` is set in `agentflow.json` or passed via `--threshold`. The exit code is 1 when the pass rate is below threshold or when any case fails.

**Simulator scenarios always fail**
- Ensure the agent is reachable: either expose `app` in the eval file or set `"agent"` in `agentflow.json`.
- Check that `goals` are specific enough for the LLM judge to verify. Vague goals like "have a conversation" will not score well.
- Increase `max_turns` if the agent needs more exchanges to satisfy all goals.
