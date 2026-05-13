---
title: Run Evaluations — AgentFlow Python AI Agent Framework
sidebar_label: Run Evaluations
description: How to run agent evaluations using agentflow eval. Covers auto-discovery, report generation, thresholds, and agentflow.json configuration.
keywords:
  - agentflow eval
  - agentflow cli
  - agent evaluation
  - agentflow
  - python ai agent framework
  - eval report html json
---


# Run evaluations

The `agentflow eval` command discovers evaluation files in your project, runs them against your agent, and always generates an HTML and JSON report. No flags required — reports are on by default.

## Prerequisites

Your project must have been initialised with `agentflow init`. Eval files live in the `evals/` directory created by `agentflow init --prod`.

## Quick start

From the folder that contains `agentflow.json`:

```bash
agentflow eval
```

This scans `evals/` for files matching `*_eval.py` or `eval_*.py`, runs each one, and writes reports to `eval_reports/`:

```
eval_reports/
  weather-agent-regression_20260513_142301.html
  weather-agent-regression_20260513_142301.json
```

## Run a specific file or directory

Pass a path to target a single eval file or a subdirectory:

```bash
# One file
agentflow eval evals/weather_agents_eval.py

# A subdirectory
agentflow eval evals/regression/
```

When a file is given, only that file runs. When a directory is given, all matching eval files inside it are discovered and run. If multiple files run, their results are merged into a single combined report.

## Reports

Every run produces two files in `eval_reports/` (or the directory set by `--output`):

| File | Contents |
| --- | --- |
| `<eval-id>_<timestamp>.html` | Visual dashboard: summary cards, criterion bars, per-case details |
| `<eval-id>_<timestamp>.json` | Machine-readable results for CI tooling or custom analysis |

Console output is always printed as eval files run. The HTML/JSON files are written after all files complete.

### Open the report automatically

```bash
agentflow eval --open
```

After the run, the HTML report opens in your default browser.

### Skip file output

```bash
agentflow eval --no-report
```

Only console output is produced. Useful for fast local feedback without accumulating report files.

## Set a pass-rate threshold

```bash
agentflow eval --threshold 0.8
```

The command exits with a non-zero code if the overall pass rate across all eval files is below the threshold. Useful in CI to gate merges on eval quality.

## Write reports to a custom directory

```bash
agentflow eval --output ci/reports
```

The directory is created if it does not exist.

## Configure defaults in agentflow.json

Add an `evaluation` section to `agentflow.json` to set project-level defaults. CLI flags always take precedence.

```json
{
  "agent": "graph.react:app",
  "evaluation": {
    "directory": "evals",
    "output_dir": "eval_reports",
    "threshold": 0.75,
    "timestamp_files": true
  }
}
```

| Field | Description |
| --- | --- |
| `directory` | Directory scanned when no `TARGET` argument is given |
| `output_dir` | Directory where report files are written |
| `threshold` | Minimum pass rate required for a zero exit code |
| `timestamp_files` | Append timestamp to filenames so runs do not overwrite each other |

With this config, a bare `agentflow eval` is equivalent to:

```bash
agentflow eval evals/ --output eval_reports --threshold 0.75
```

### Enforce threshold in CI

```yaml
# .github/workflows/ci.yml (example)
- name: Run evaluations
  run: agentflow eval
```

Set `threshold` in `agentflow.json`. If the pass rate drops below it, the step fails without any extra flags in the workflow.

## Eval file protocol

An eval file only needs to expose `get_eval_set()`. Everything else is optional or handled internally.

### `get_eval_set()` — minimum required

The CLI loads the agent from `agentflow.json`, applies default criteria, runs the evaluation, and writes reports. You just define the cases.

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
        .build()
    )
```

### `get_eval_config()` — optional per-file criteria override

Add this function when you need different thresholds or match types for a specific eval file.

```python
from agentflow.qa.evaluation import CriterionConfig, EvalConfig, MatchType


def get_eval_config() -> EvalConfig:
    return EvalConfig(
        criteria={
            "response": CriterionConfig(threshold=0.8, match_type=MatchType.ANY_ORDER),
        },
        mock_mode=True,
    )
```

### `EVAL_CONFIG` — same as above but as a module-level constant

```python
from agentflow.qa.evaluation import CriterionConfig, EvalConfig, MatchType

EVAL_CONFIG = EvalConfig(
    criteria={"response": CriterionConfig(threshold=0.8, match_type=MatchType.ANY_ORDER)},
    mock_mode=True,
)
```

### `run()` — full control

A function (sync or async) that returns an `EvalReport`. Use this when you need custom agent loading, custom collectors, or multiple eval sets in one file.

```python
from agentflow.qa.evaluation import QuickEval
from agentflow.qa.evaluation.collectors.trajectory_collector import TrajectoryCollector
from graph.agent import app


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

Files that expose none of the above are skipped with a warning and do not affect the exit code.

## Common scenarios

**Fast local check against one eval file:**

```bash
agentflow eval evals/weather_agents_eval.py --open
```

**Strict CI gate at 80 % pass rate:**

```json
{
  "evaluation": {
    "threshold": 0.8
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

## Common issues

**"Eval directory 'evals/' not found"**
- Create an `evals/` directory or pass a path: `agentflow eval path/to/evals`
- Run `agentflow init --prod` to scaffold the standard project layout with an `evals/` directory

**"No eval files found"**
- Eval files must match `*_eval.py` or `eval_*.py`. Rename the file or pass it explicitly.

**File skipped with warning**
- The file does not expose `run()`, `get_eval_set()+get_eval_config()`, or `EVAL_CONFIG+get_eval_set()`. Add one of these entry points.

**Exit code 1 even when all cases pass**
- Check if a `threshold` is set in `agentflow.json` or passed via `--threshold`. The exit code is 1 when pass rate is below threshold or when any case fails.
