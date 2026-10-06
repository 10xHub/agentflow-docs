---
title: Testing & QA — Testing and evaluation
sidebar_label: Overview
description: An overview of AgentFlow's QA layer — unit testing with TestAgent and QuickTest, and LLM evaluation with the agentflow eval command.
keywords:
  - agentflow testing
  - agent evaluation
  - unit test
  - pytest agent
  - agentflow qa
  - user simulator
  - parallel evaluation
  - python ai agent framework
---

# Testing & QA

AgentFlow ships a dedicated `agentflow.qa` package that covers two distinct concerns: **unit testing** and **evaluation**.

| | Unit testing | Evaluation |
|---|---|---|
| Goal | Verify graph logic and tool routing | Measure response quality and agent behaviour |
| LLM calls | None — fully mocked | Optional (LLM-as-judge criteria) |
| Speed | Fast (milliseconds per case) | Slower (real inference per case) |
| Entry point | `agentflow test` CLI or pytest directly | `agentflow eval` CLI or `AgentEvaluator` |
| Output | pytest pass/fail + coverage | HTML + JSON report with per-criterion scores |

Both layers are independent — you can use one without the other, or run them together in CI.

## Unit testing

The unit-testing layer lets you test the graph logic of your agent without making any LLM API calls:

- **`TestAgent`** — drops into any node, returns predefined responses, records every call.
- **`QuickTest`** — one-liner helpers for single-turn, multi-turn, and tool-call scenarios.
- **`MockToolRegistry`** — registers mock tool functions and tracks all invocations.
- **`TestResult`** — fluent assertion helpers on top of the raw graph output.
- **`agentflow test`** — CLI wrapper around pytest that reads defaults from `agentflow.json`.

[Read the unit-testing guide](unit-test/index.md)

## Evaluation

The evaluation layer runs your real (or staging) agent against test cases and scores results across multiple criteria. It supports two modes of testing:

**Fixed test cases** — you define the query and expected output:

- **`EvalSetBuilder`** — fluent API for defining test cases with expected responses and tool sequences.
- **`EvalConfig` / `EvalPresets`** — configure which criteria to use and at what thresholds. `EvalPresets` provides one-line ready-made configs.
- **Criteria** — ten built-in criteria covering tool accuracy, response quality, hallucination, factual accuracy, safety, and custom rubrics.
- **`AgentEvaluator`** — orchestrates execution and scoring. Supports sequential and parallel case runs.
- **Reports** — HTML dashboard, JSON, and JUnit XML output.

**User simulation** — an LLM plays the user and drives real conversations:

- **`ConversationScenario`** — define goals and a conversation plan. The simulator generates realistic user messages turn by turn.
- **`UserSimulator`** — LLM-powered user agent. Stops when all goals are achieved or `max_turns` is reached.
- **`BatchSimulator`** — runs multiple scenarios concurrently.
- **`SimulationGoalsCriterion`** — scores the full conversation transcript against stated goals.

**`agentflow eval`** — CLI that auto-discovers eval files, runs all cases from all files in a flat parallel pool, and always writes reports.

[Read the evaluation guide](evaluation/index.md)

## CLI commands at a glance

```bash
# Run the test suite
agentflow test

# Run with coverage
agentflow test --coverage --html

# Run evaluations (sequential)
agentflow eval

# Run evaluations in parallel across all cases and files
agentflow eval --parallel --max-concurrency 8

# Evaluate a specific file and open the report
agentflow eval evals/my_agent_eval.py --open

# Enforce a pass-rate threshold (useful in CI)
agentflow eval --threshold 0.8
```

See also:
- [How to run tests](../how-to/api-cli/run-tests.md)
- [How to run evaluations](../how-to/api-cli/run-evals.md)
