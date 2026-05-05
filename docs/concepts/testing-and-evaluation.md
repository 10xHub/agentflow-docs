---
title: Testing and Evaluation
description: Model-free tests, mock tools, trajectory checks, eval datasets, and reporting.
sidebar_position: 17
---

# Testing and evaluation

AgentFlow has two complementary quality layers:

- **Testing** verifies graph mechanics, state updates, tool calls, and error handling without live models.
- **Evaluation** measures behavior quality, trajectory matching, safety, and regression cases.

## Testing helpers

Use `agentflow.qa.testing` for fast, deterministic tests.

| Helper | Purpose |
|---|---|
| `TestAgent` | Model-free agent double that returns predefined responses or tool calls. |
| `QuickTest` | Quick single-turn, multi-turn, tool, and graph tests. |
| `TestResult` | Fluent assertions for text, tool calls, messages, and errors. |
| `TestContext` | Context manager for creating graphs, agents, stores, and mocks. |
| `MockToolRegistry` | Register sync or async mock tools and assert calls. |
| `MockMCPClient` | Mock MCP tool listing and calls. |
| `InMemoryStore` | Deterministic memory store for tests. |

Prefer these helpers over live provider calls in unit tests.

## Evaluation framework

Use `agentflow.qa.evaluation` for datasets, criteria, and reports.

Core pieces include:

| Area | Examples |
|---|---|
| Datasets | `EvalCase`, `EvalSet`, `EvalSetBuilder` |
| Runners | `AgentEvaluator`, `QuickEval`, `run_eval` |
| Criteria | Response, trajectory, tool, safety, factual accuracy, hallucination, rubric, LLM judge |
| Reports | Console, JSON, HTML, JUnit XML |

Evaluation is the better fit for behavior quality, safety policy, and workflow regressions that are hard to express as ordinary unit assertions.

## Trajectory checks

Trajectory evaluation records node and tool execution, then compares it with expected paths. Use this when the answer text is less important than whether the graph used the right route, tool, or handoff.

## Rules

| Rule | Why it matters |
|---|---|
| Keep unit tests model-free | Fast tests should be deterministic. |
| Isolate live provider tests | They are slower, cost money, and can be flaky. |
| Use evals for behavior quality | Evals can compare outputs, paths, safety, and rubrics. |
| Compile once when collecting trajectories | Callback state should not be lost between cases. |

## Related docs

- [Testing reference](/docs/reference/python/testing)
- [Evaluation reference](/docs/reference/python/evaluation)
- [Testing tutorial](/docs/tutorials/from-examples/testing)
- [Evaluation tutorial](/docs/tutorials/from-examples/evaluation)
