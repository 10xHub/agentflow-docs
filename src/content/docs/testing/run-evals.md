---
title: Run Evaluations
seoTitle: "Run agent evaluations from the CLI"
description: "Run agent evaluations with 10xgraph eval: covers parallel execution, eval file protocols, EvalPresets, and CI integration."
section: "Testing and evaluation"
group: "Evaluation"
order: 100
label: Run Evaluations
updated: "2026-10-08"
---

## What is evaluation and why it matters

Evaluation is the measurement of your agent's behavior against criteria that matter to your application. The `10xgraph eval` command discovers evaluation files in your project, runs all test cases in a single async event loop, and produces machine-readable reports so you can track agent quality over time, gate merges on minimum pass rates, and identify regressions before they reach production.

Unlike unit tests (which verify isolated functions), evaluations score your entire agent graph end-to-end against realistic scenarios, criteria like correct tool usage or response accuracy, and can include LLM-based judges to assess semantic quality. The framework runs multiple cases in parallel by default, generates both HTML dashboards and JSON results for CI tooling, and supports everything from quick local checks to comprehensive test suites with custom scoring rules.

## Prerequisites

Your project must have been initialized with `10xgraph init`. The standard project layout includes an `evals/` directory where evaluation files live. When you choose the **Production** setup during initialization, the directory structure and a sample evaluation file are generated for you.

If you created a project without the Production setup, create an `evals/` directory manually at the project root, next to `10xgraph.json`.

## Quick start

From the folder that contains `10xgraph.json`:

```bash
10xgraph eval
```

The CLI scans `evals/` for files matching `*_eval.py` or `eval_*.py`, collects every case from every file into a single pool, runs them all, and writes timestamped reports to `eval_reports/`:

```
eval_reports/
  weather-agent_20260513_142301.html
  weather-agent_20260513_142301.json
```

The HTML report shows a visual dashboard: summary pass rate, criterion scores, and per-case results. The JSON report is machine-readable for CI systems or custom analysis. Console output streams as cases complete.

## Running evaluations

### Run a specific file or directory

To evaluate only certain cases, pass a path:

```bash
# One file
10xgraph eval evals/weather_eval.py

# All files in a subdirectory
10xgraph eval evals/regression/
```

When a file is given, only that file runs. When a directory is given, all matching `*_eval.py` and `eval_*.py` files are discovered recursively. Results from all selected files are merged into one combined report.

### Run in parallel

By default all cases run sequentially. For faster feedback on large suites, use `--parallel`:

```bash
10xgraph eval --parallel
10xgraph eval --parallel --max-concurrency 8
```

**How it works:** All cases from all files are collected into a flat pool before execution starts. A single asyncio event loop runs the entire pool under a concurrency semaphore capped at `--max-concurrency` (default 4). Cases complete out of order as they finish; this is expected and intentional.

Example output:

```
[  1/50] weather_eval.py::london_forecast      PASSED   1.23s
[  3/50] booking_eval.py::london_to_paris      PASSED   2.10s
[  2/50] weather_eval.py::tokyo_forecast       PASSED   0.98s
...
[ 50/50] ...

Results: 47/50 passed (94.0%)
```

You can enable parallel by default in `10xgraph.json` (see [Configure evaluation defaults](#configure-evaluation-defaults-in-10xgraphjson)).

### Reports and output

Every run produces two files in `eval_reports/` (or a custom directory via `--output`):

| File | Format | Purpose |
| --- | --- | --- |
| `<eval-id>_<timestamp>.html` | HTML + interactive | Visual dashboard with summary, criterion bars, and per-case details for humans to review |
| `<eval-id>_<timestamp>.json` | JSON | Machine-readable results for CI tooling, dashboards, or programmatic analysis |

Console output always prints as cases complete, showing the test name, status, and duration. Both report files are written after all cases finish. To skip writing files and see only console output:

```bash
10xgraph eval --no-report
```

To open the HTML report automatically in your browser:

```bash
10xgraph eval --open
```

### Exit codes and thresholds

By default the command exits with code 0 when cases pass and 1 when they fail. For CI workflows, you can enforce a minimum pass rate:

```bash
10xgraph eval --threshold 0.8
```

The command exits with code 1 if the overall pass rate falls below the threshold (here, 80%). This is useful for gating merges or blocking deployments when agent quality degrades. The threshold can also be set in `10xgraph.json` (see below).

### Custom output directory

```bash
10xgraph eval --output ci/reports
```

Reports are written to `ci/reports/` instead of the default `eval_reports/`.

## Configure evaluation defaults in 10xgraph.json

Add an `evaluation` block to `10xgraph.json` to set project-level defaults. CLI flags always take precedence over these settings.

```json
{
  "agent": "graph.agent:app",
  "evaluation": {
    "directory": "evals",
    "output_dir": "eval_reports",
    "threshold": 0.75,
    "parallel": false,
    "max_concurrency": 4
  }
}
```

| Field | Default | Description |
| --- | --- | --- |
| `directory` | `"evals"` | Directory scanned when no `TARGET` argument is given |
| `output_dir` | `"eval_reports"` | Directory where HTML and JSON reports are written |
| `threshold` | (none) | Minimum pass rate required for exit code 0; if unset, any case failure exits 1 |
| `parallel` | `false` | Run all cases concurrently instead of sequentially |
| `max_concurrency` | `4` | Maximum cases running simultaneously when `parallel` is true |

Report filenames always include a timestamp; there is no configuration setting for it.

### Enforce minimum quality in CI

```yaml
# .github/workflows/ci.yml
- name: Run evaluations
  run: 10xgraph eval --parallel
```

Set `threshold` in `10xgraph.json`. If the pass rate drops below the threshold, the step fails without extra flags, gating the merge.

## How criteria work and what the defaults are

Every evaluation case is scored against one or more criteria. A criterion is a rule that produces a pass/fail or a numeric score. The CLI applies default criteria when none are specified; you can override them per-file, globally, or use preset configurations.

### Default criteria (applied when no config is specified)

When an eval file has no `get_eval_config()` or `EVAL_CONFIG`, and no global `confeval.py` is present, these built-in defaults apply:

| Criterion | Threshold | Purpose |
| --- | --- | --- |
| `tool_name_match` | 1.0 | Agent must call the correct tool (exact match required) |
| `rouge_match` | 0.5 | Agent response must have at least 50% token overlap with expected response (fast, no LLM) |
| `node_order` | 0.8 | Agent must traverse nodes in the correct order (with up to 20% tolerance) |

These defaults are intentionally strict on tool correctness (1.0) but lenient on response content (0.5 ROUGE), because the order of tool calls often matters more than exact text matching. For applications where response wording must match precisely, you would override with stricter criteria.

## Eval file protocols

An eval file is any module matching `*_eval.py` or `eval_*.py`. The CLI auto-detects which protocol you are using. Each protocol suits different evaluation needs.

### `get_eval_set()`, standard fixed cases

The simplest protocol: define your test cases once, the CLI runs them repeatedly. You only provide the cases; the CLI loads the agent from `10xgraph.json`, applies criteria, and produces results.

```python
# evals/weather_eval.py
from tenxgraph.qa.evaluation import EvalSet, EvalSetBuilder

def get_eval_set() -> EvalSet:
    return (
        EvalSetBuilder(name="weather-regression")
        .add_tool_test(
            query="What is the weather in London?",
            tool_name="get_weather",
            tool_args={"location": "London"},
            expected_response="London",
            case_id="london_forecast",
        )
        .add_tool_test(
            query="What is the weather in Tokyo?",
            tool_name="get_weather",
            tool_args={"location": "Tokyo"},
            expected_response="Tokyo",
            case_id="tokyo_forecast",
        )
        .build()
    )
```

**When to use:** Regression suites with fixed inputs and known good outputs. Best for deterministic behavior like tool selection, API behavior, or structured data extraction.

### `get_eval_config()` or `EVAL_CONFIG`, per-file criteria

Override the criteria and thresholds for a specific file. The recommended approach is to use one of the preset configurations, which cover common patterns:

```python
from tenxgraph.qa.evaluation import EvalConfig, EvalSet, EvalSetBuilder
from tenxgraph.qa.evaluation.config.presets import EvalPresets

def get_eval_config() -> EvalConfig:
    return EvalPresets.tool_usage(threshold=0.6)

def get_eval_set() -> EvalSet:
    return (
        EvalSetBuilder(name="weather-regression")
        .add_tool_test(...)
        .build()
    )
```

Or as a constant instead of a function:

```python
from tenxgraph.qa.evaluation.config.presets import EvalPresets

EVAL_CONFIG = EvalPresets.tool_usage(threshold=0.6)
```

### Available EvalPresets

| Preset | Default threshold | What it checks |
| --- | --- | --- |
| `response_quality(threshold)` | 0.7 | LLM judge on response accuracy and relevance |
| `tool_usage(threshold)` | 1.0 | Tool calls correct (exact names and args) + response quality |
| `conversation_flow(threshold)` | 0.8 | Multi-turn conversation: response quality and tool trajectory |
| `quick_check()` | (fixed) | Fast ROUGE-based keyword overlap, no LLM cost, instant feedback |
| `comprehensive(threshold)` | 0.8 | All criteria combined: tool matching, response quality, safety, hallucination, factual accuracy |
| `safety_check(threshold)` | 0.8 | Hallucination detection and safety assessment via LLM judge |

Presets that use an LLM judge accept an optional `judge_model` parameter (defaults to `"gemini-2.5-flash"`):

```python
config = EvalPresets.response_quality(threshold=0.7, judge_model="gpt-4o")
```

You can combine multiple presets:

```python
from tenxgraph.qa.evaluation.config.presets import EvalPresets

def get_eval_config():
    return EvalPresets.combine(
        EvalPresets.tool_usage(threshold=0.7),
        EvalPresets.response_quality(threshold=0.6),
    )
```

### `confeval.py`, global evaluation config

Place a file named exactly `confeval.py` in your project root (next to `10xgraph.json`) to set a global default `EvalConfig` that applies to every eval file that does not define its own `get_eval_config()` or `EVAL_CONFIG`. If a file does provide its own config, that takes precedence.

The file must expose either a module-level `EVAL_CONFIG` variable or a callable `get_eval_config()` that returns an `EvalConfig`:

```python
# confeval.py  (project root, next to 10xgraph.json)
from tenxgraph.qa.evaluation import CriteriaConfig, CriterionConfig, EvalConfig

EVAL_CONFIG = EvalConfig(
    criteria=CriteriaConfig(
        tool_name_match=CriterionConfig.tool_name_match(threshold=1.0),
        rouge_match=CriterionConfig.rouge_match(threshold=0.5),
        node_order=CriterionConfig.node_order(threshold=0.8),
    )
)
```

Or as a function:

```python
# confeval.py
from tenxgraph.qa.evaluation import CriteriaConfig, CriterionConfig, EvalConfig

def get_eval_config() -> EvalConfig:
    return EvalConfig(
        criteria=CriteriaConfig(
            tool_name_match=CriterionConfig.tool_name_match(threshold=1.0),
            rouge_match=CriterionConfig.rouge_match(threshold=0.5),
        )
    )
```

This is useful for enforcing consistent evaluation standards across many eval files without repeating the config in each one.

### Annotated functions `-> EvalSet`, multiple eval sets per file

Any module-level function with return type annotation `-> EvalSet` is auto-discovered as an eval set. This lets you organize multiple related eval sets in one file:

```python
from tenxgraph.qa.evaluation import EvalSet, EvalSetBuilder
from tenxgraph.qa.evaluation.config.presets import EvalPresets

def get_eval_config():
    return EvalPresets.tool_usage(threshold=0.6)

def weather_cases() -> EvalSet:
    return EvalSetBuilder(name="weather").add_tool_test(...).build()

def booking_cases() -> EvalSet:
    return EvalSetBuilder(name="booking").add_tool_test(...).build()
```

Both `weather_cases` and `booking_cases` are discovered and run. Their results appear as separate eval sets in the report, grouped by their names.

### `get_scenarios()` or `SCENARIOS`, user simulator (dynamic conversations)

Use this protocol when you want the LLM to drive a multi-turn conversation against your agent, rather than using fixed prompt/response pairs. The simulator generates contextual follow-up messages after each agent response, letting you test realistic conversation flows.

You define the scenarios; the CLI handles running the simulator, scoring goal achievement, and writing results:

```python
# evals/simulator_eval.py
from tenxgraph.qa.evaluation import ConversationScenario, UserSimulatorConfig

# Optional: configure simulator model and settings for this file.
# If omitted, defaults are used (gemini-2.5-flash, max 10 turns, temperature 0.7).
SIMULATOR_CONFIG = UserSimulatorConfig(
    model="gemini/gemini-2.5-flash",
    max_invocations=8,
    temperature=0.7,
)

def get_scenarios() -> list[ConversationScenario]:
    return [
        ConversationScenario(
            scenario_id="weather_travel",
            description="User planning a trip wants weather and packing advice",
            starting_prompt="Hi! I'm planning a trip to Paris this weekend.",
            conversation_plan=(
                "1. Ask about current weather in Paris\n"
                "2. Ask whether to bring a jacket\n"
                "3. Ask about outdoor activity timing"
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

1. The CLI detects `get_scenarios()` or a `SCENARIOS` constant and switches to simulator mode.
2. Each `ConversationScenario` becomes one eval case.
3. The simulator drives up to `max_turns` turns, generating contextual user messages after each agent response.
4. An LLM judge scores how many of the stated `goals` were achieved across the conversation.
5. Pass/fail and results appear in the report like regular eval cases.

**`ConversationScenario` fields:**

| Field | Required | Description |
| --- | --- | --- |
| `scenario_id` | Yes | Unique ID for the scenario (appears in reports) |
| `description` | No | Human-readable name shown in the report |
| `starting_prompt` | Yes | First user message to start the conversation |
| `conversation_plan` | No | Hints to the simulator about how to progress |
| `goals` | Yes | List of outcomes the user wants to achieve (scored by LLM judge) |
| `max_turns` | No | Maximum conversation turns (default: 10) |

**`SIMULATOR_CONFIG` fields:**

| Field | Default | Description |
| --- | --- | --- |
| `model` | `"gemini/gemini-2.5-flash"` | LLM used to generate user messages |
| `max_invocations` | `10` | Maximum turns per scenario |
| `temperature` | `0.7` | Temperature for user message generation |

**When to use:** Multi-turn conversations where the exact dialogue matters. Useful for customer support agents, question-answering over sessions, or any scenario where realistic back-and-forth is important.

## Config priority and precedence

When the same setting is configured in multiple places, this precedence applies (highest first):

```
1. CLI flags          (--parallel, --max-concurrency, --threshold, --output)
2. 10xgraph.json     "evaluation" section
3. Per-file config    get_eval_config() / EVAL_CONFIG  (inside each eval file)
4. confeval.py        get_eval_config() / EVAL_CONFIG  (project-root global fallback)
5. Built-in defaults  (tool_name_match 1.0, rouge_match 0.5, node_order 0.8)
```

A CLI flag overrides everything. If no CLI flag is given, `10xgraph.json` is checked. If neither the JSON nor the file provide a setting, `confeval.py` is checked. If none of those exist, built-in defaults apply.

## Common scenarios and recipes

**Fast local check on a single file, open the report:**

```bash
10xgraph eval evals/weather_eval.py --open
```

Run one file sequentially, write the report, and open it in your browser for inspection.

**Parallel run with 8 concurrent cases:**

```bash
10xgraph eval --parallel --max-concurrency 8
```

All cases run concurrently (up to 8 at a time) for faster feedback on large suites.

**Strict CI gate at 80% pass rate:**

In `10xgraph.json`:

```json
{
  "evaluation": {
    "threshold": 0.8,
    "parallel": true,
    "max_concurrency": 8
  }
}
```

Then in your CI:

```bash
10xgraph eval
```

If the pass rate drops below 80%, the command exits with code 1, blocking the merge.

**Run only a regression suite in a subdirectory:**

```bash
10xgraph eval evals/regression/ --output reports/regression
```

All eval files under `evals/regression/` run, reports go to `reports/regression/`.

**Mix regular eval cases and user simulator in one run:**

```
evals/
  weather_eval.py        ← get_eval_set() protocol
  user_simulator_eval.py ← get_scenarios() protocol
```

```bash
10xgraph eval --parallel
```

Both files are discovered. Cases and scenarios are collected into the same flat pool and run concurrently. Results appear in a single merged report.

## Troubleshooting

**"Eval directory 'evals/' not found"**

The CLI cannot find your evaluation directory. Either:
- Create an `evals/` directory at the project root
- Pass the correct path: `10xgraph eval path/to/evals`
- Run `10xgraph init` and choose the Production setup to scaffold the standard layout

**"No eval cases found"**

Eval files were discovered but contained no test cases. Ensure:
- At least one file exposes `get_eval_set()`, `get_scenarios()`, `SCENARIOS`, or a function annotated `-> EvalSet`
- Files match `*_eval.py` or `eval_*.py` (rename if needed, or pass the file explicitly)

**"File skipped with warning"**

A file was found but does not expose any recognized entry point. Add `get_eval_set()` or `get_scenarios()` to the file.

**Exit code 1 even when all cases pass**

Check if a `threshold` is set:
- In `10xgraph.json` under `"evaluation": {"threshold": ...}`
- On the CLI with `--threshold`

The exit code is 1 when the overall pass rate is below the threshold or when any individual case fails. Verify your threshold matches your expectation.

**Simulator scenarios always fail**

Ensure:
- The agent is reachable (either `app` is exported in the eval file, or `"agent"` is set in `10xgraph.json`)
- Goals are specific enough for the LLM judge to verify. Vague goals like "have a conversation" will not score well
- `max_turns` is large enough for the agent to satisfy all goals (increase if needed)

**Different results on different runs**

Simulator scenarios and LLM-based criteria include randomness (temperature > 0). Exact reproducibility is not guaranteed. For deterministic evaluation, use `quick_check()` or fixed `get_eval_set()` cases only.
