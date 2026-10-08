---
title: Testing & QA
seoTitle: "Testing and evaluating 10xGraph agents"
description: "How to test and evaluate 10xGraph agents: mocked unit tests with TestAgent and QuickTest, and scored evaluation sets and simulated users with the eval command."
section: "Testing and evaluation"
order: 10
label: Overview
updated: "2026-10-06"
---

Testing and QA in 10xGraph means two separate layers in one package, `tenxgraph.qa`. Unit tests check graph logic and tool routing with mocked models, so they run in milliseconds and cost nothing. Evaluations run the real agent against test cases or a simulated user and score the results. This section is for engineers who need to know an agent change did not break behavior, and who want that check to gate a CI pipeline.

## Start here

Start with the [unit-testing guide](/docs/testing/unit-tests). It shows `TestAgent`, `QuickTest` and `MockToolRegistry`, which let you assert that the right tool was called with the right arguments without any LLM call. Write these first: they are fast and catch most routing mistakes.

Then read the [evaluation guide](/docs/testing/evaluation) for scored runs. [Eval sets](/docs/testing/eval-sets) define the cases and expected tool sequences, [criteria](/docs/testing/criteria) lists what can be scored, [presets](/docs/testing/presets) gives ready-made configurations, and [reports](/docs/testing/reports) covers the HTML, JSON and JUnit output. For multi-turn behavior, [user simulation](/docs/testing/user-simulation) lets a model play the user.

Testing pairs with the runtime guarantees in [Replay-safe tools](/docs/concepts/replay-safe-tools): mocked tool registries are a good way to check that a tool with side effects, such as a refund, is only invoked when intended. For wiring into CI, see [How to run tests](/docs/testing/run-tests) and [How to run evaluations](/docs/testing/run-evals).

## The two layers compared

| | Unit testing | Evaluation |
|---|---|---|
| Goal | Verify graph logic and tool routing | Measure response quality and agent behaviour |
| LLM calls | None, fully mocked | Optional (LLM-as-judge criteria) |
| Speed | Fast (milliseconds per case) | Slower (real inference per case) |
| Entry point | `10xgraph test` CLI or pytest directly | `10xgraph eval` CLI or `AgentEvaluator` |
| Output | pytest pass/fail + coverage | HTML + JSON report with per-criterion scores |

Both layers are independent, you can use one without the other, or run them together in CI.

## Unit testing

The unit-testing layer lets you test the graph logic of your agent without making any LLM API calls:

- **`TestAgent`**, drops into any node, returns predefined responses, records every call.
- **`QuickTest`**, one-liner helpers for single-turn, multi-turn, and tool-call scenarios.
- **`MockToolRegistry`**, registers mock tool functions and tracks all invocations.
- **`TestResult`**, fluent assertion helpers on top of the raw graph output.
- **`10xgraph test`**, CLI wrapper around pytest that reads defaults from `10xgraph.json`.

[Read the unit-testing guide](/docs/testing/unit-tests)

## Evaluation

The evaluation layer runs your real (or staging) agent against test cases and scores results across multiple criteria. It supports two modes of testing:

**Fixed test cases**, you define the query and expected output:

- **`EvalSetBuilder`**, fluent API for defining test cases with expected responses and tool sequences.
- **`EvalConfig` / `EvalPresets`**, configure which criteria to use and at what thresholds. `EvalPresets` provides one-line ready-made configs.
- **Criteria**, ten built-in criteria covering tool accuracy, response quality, hallucination, factual accuracy, safety, and custom rubrics.
- **`AgentEvaluator`**, orchestrates execution and scoring. Supports sequential and parallel case runs.
- **Reports**, HTML dashboard, JSON, and JUnit XML output.

**User simulation**, an LLM plays the user and drives real conversations:

- **`ConversationScenario`**, define goals and a conversation plan. The simulator generates realistic user messages turn by turn.
- **`UserSimulator`**, LLM-powered user agent. Stops when all goals are achieved or `max_turns` is reached.
- **`BatchSimulator`**, runs multiple scenarios concurrently.
- **`SimulationGoalsCriterion`**, scores the full conversation transcript against stated goals.

**`10xgraph eval`**, CLI that auto-discovers eval files, runs all cases from all files in a flat parallel pool, and always writes reports.

[Read the evaluation guide](/docs/testing/evaluation)

## CLI commands at a glance

```bash
# Run the test suite
10xgraph test

# Run with coverage
10xgraph test --coverage --html

# Run evaluations (sequential)
10xgraph eval

# Run evaluations in parallel across all cases and files
10xgraph eval --parallel --max-concurrency 8

# Evaluate a specific file and open the report
10xgraph eval evals/my_agent_eval.py --open

# Enforce a pass-rate threshold (useful in CI)
10xgraph eval --threshold 0.8
```

See also:
- [How to run tests](/docs/testing/run-tests)
- [How to run evaluations](/docs/testing/run-evals)
