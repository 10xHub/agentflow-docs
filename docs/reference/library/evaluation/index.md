# Agentflow Evaluation Module

The **Evaluation Module** provides a comprehensive framework for testing and evaluating AI agent graphs built with Agentflow. It covers everything from simple response checks to multi-turn conversation testing, trajectory validation, and LLM-as-judge scoring.



---

## Core Concepts

| Concept | Description |
|---|---|
| **EvalCase** | A single test scenario — one or more conversation turns with expected responses and tool calls. |
| **EvalSet** | A collection of `EvalCase` instances, loadable from JSON or built programmatically. |
| **Criterion** | A scoring function that compares actual execution results against expectations. Returns a 0.0–1.0 score. |
| **EvalConfig** | Declares which criteria to run and their thresholds. |
| **AgentEvaluator** | Orchestrates the full evaluation loop: run → collect → score → report. |
| **TrajectoryCollector** | Captures tool calls, node visits, and LLM outputs during graph execution. |
| **ExecutionResult** | Container holding the captured trajectory, tool calls, and final response. |
| **Reporter** | Formats evaluation results as console output, JSON, HTML, or JUnit XML. |

---

## Module Structure

```
agentflow/evaluation/
├── __init__.py                  # Public API (48 exports)
├── evaluator.py                 # AgentEvaluator
├── quick_eval.py                # QuickEval (simplified interface)
├── eval_result.py               # CriterionResult, EvalCaseResult, EvalReport, EvalSummary
├── testing.py                   # Pytest helpers (eval_test, assert_eval_passed, ...)
├── collectors/
│   └── trajectory_collector.py  # TrajectoryCollector, make_trajectory_callback
├── config/
│   ├── eval_config.py           # EvalConfig, CriterionConfig, MatchType, Rubric
│   └── presets.py               # EvalPresets (quick_check, tool_usage, comprehensive, ...)
├── criteria/
│   ├── base.py                  # BaseCriterion, SyncCriterion, CompositeCriterion, WeightedCriterion
│   ├── trajectory.py            # TrajectoryMatchCriterion, ToolNameMatchCriterion, NodeOrderMatchCriterion
│   ├── response.py              # ResponseMatchCriterion, RougeMatchCriterion, ExactMatchCriterion, ContainsKeywordsCriterion
│   ├── llm_judge.py             # LLMJudgeCriterion
│   ├── rubric.py                # RubricBasedCriterion
│   ├── hallucination.py         # HallucinationCriterion
│   ├── safety.py                # SafetyCriterion
│   ├── factual_accuracy.py      # FactualAccuracyCriterion
│   ├── simulation_goals.py      # SimulationGoalsCriterion
│   └── llm_utils.py             # LLMCallerMixin (shared LLM helpers)
├── dataset/
│   ├── eval_set.py              # EvalSet, EvalCase, Invocation, ToolCall, TrajectoryStep, ...
│   └── builder.py               # EvalSetBuilder (fluent builder)
├── reporters/
│   ├── base.py                  # BaseReporter (ABC)
│   ├── console.py               # ConsoleReporter, print_report
│   ├── json.py                  # JSONReporter, JUnitXMLReporter
│   ├── html.py                  # HTMLReporter
│   └── manager.py               # ReporterManager, ReporterOutput
└── simulators/
    └── user_simulator.py        # UserSimulator, BatchSimulator, ConversationScenario, SimulationResult
```

---

## Building a Graph with the Agent Class

All evaluation tests use the `Agent` class to define LLM nodes. Here is a typical graph setup:

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.utils.constants import END
from agentflow.state.agent_state import AgentState

# 1. Define tools
def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny"

# 2. Build the graph using Agent class
graph = StateGraph()
agent = Agent(
    model="gemini-2.5-flash",          # or "gpt-4o" for OpenAI
    provider="google",                  # or "openai" (auto-detected if omitted)
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node_name="TOOL",
)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", ToolNode([get_weather]))

def router(state: AgentState) -> str:
    if state.context and state.context[-1].role == "assistant":
        last = state.context[-1]
        if hasattr(last, "tools_calls") and last.tools_calls:
            return "TOOL"
    if state.context and state.context[-1].role == "tool":
        return "MAIN"
    return END

graph.add_conditional_edges("MAIN", router, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")
```


---

## Quick Example

```python
from agentflow.evaluation import (
    AgentEvaluator,
    EvalConfig,
    CriterionConfig,
    TrajectoryCollector,
    make_trajectory_callback,
    create_eval_app,
)
from agentflow.evaluation.dataset import EvalCase, ToolCall

# 1. Wire collector into your graph
compiled, collector = create_eval_app(graph)  # graph from the example above

# 2. Define a test case
case = EvalCase.single_turn(
    eval_id="weather_london",
    user_query="What is the weather in London?",
    expected_response="The weather in London is sunny",
    expected_tools=[ToolCall(name="get_weather")],
)

# 3. Configure and run
config = EvalConfig(criteria={
    "tool_name_match_score": CriterionConfig(threshold=1.0),
    "response_match_score": CriterionConfig(threshold=0.7),
})
evaluator = AgentEvaluator(compiled, collector, config=config)
result = await evaluator.evaluate_case(case)
assert result.passed
```

---

## Documentation Sections

### Getting Started

- [Quickstart](getting_started/quickstart.md) — 5-line evaluation with `QuickEval`
- [Manual Setup](getting_started/manual_setup.md) — Full 4-step manual approach

### Tutorials

- [Single-Turn Evaluation](tutorial/single_turn_evaluation.md) — End-to-end walkthrough for single-turn tests
- [Multi-Turn Evaluation](tutorial/multi_turn_evaluation.md) — Conversation-based testing
- [Trajectory Matching](tutorial/trajectory_matching.md) — Deep-dive into EXACT, IN_ORDER, ANY_ORDER modes
- [User Simulation](tutorial/user_simulation.md) — Dynamic testing with `UserSimulator` and `BatchSimulator`
- [QuickEval Patterns](tutorial/quickeval_patterns.md) — All `QuickEval` methods and common usage patterns

### API Reference

- [Data Models](reference/data_models.md) — EvalSet, EvalCase, Invocation, ToolCall, TrajectoryStep
- [Criteria](reference/criteria.md) — All 15 criterion classes
- [Reporters](reference/reporters.md) — Console, JSON, HTML, JUnit XML
- [Pytest Integration](reference/pytest_integration.md) — Testing utilities and CI/CD
- [Advanced](reference/advanced.md) — Custom criteria, presets, multi-agent, regression testing
- [Configuration](reference/configuration.md) — EvalConfig, ReporterConfig, UserSimulatorConfig reference

---

## Evaluation Flow

```
┌─────────────┐     ┌────────────────────┐     ┌──────────────┐
│  EvalCase    │────▶│  AgentEvaluator     │────▶│  EvalReport  │
│  (expected)  │     │                    │     │  (results)   │
└─────────────┘     │  1. Run graph      │     └──────────────┘
                    │  2. Collect data    │            │
┌─────────────┐     │  3. Score criteria  │     ┌──────────────┐
│  EvalConfig  │────▶│  4. Build report   │────▶│  Reporters   │
│  (criteria)  │     └────────────────────┘     │  (output)    │
└─────────────┘            │                    └──────────────┘
                    ┌──────────────┐
                    │  Trajectory  │
                    │  Collector   │
                    └──────────────┘
```

---

## Criteria at a Glance

| Criterion | Requires LLM? | What It Checks |
|---|---|---|
| `ToolNameMatchCriterion` | No | Tool names match expected list |
| `TrajectoryMatchCriterion` | No | Tool sequence matches (EXACT / IN_ORDER / ANY_ORDER) |
| `NodeOrderMatchCriterion` | No | Node visit order matches (EXACT / IN_ORDER / ANY_ORDER) |
| `ExactMatchCriterion` | No | Response is an exact string match |
| `ContainsKeywordsCriterion` | No | Response contains required keywords |
| `RougeMatchCriterion` | No | ROUGE-1 F1 similarity score |
| `ResponseMatchCriterion` | Yes | LLM-based semantic response matching |
| `LLMJudgeCriterion` | Yes | General-purpose LLM judge with majority voting |
| `RubricBasedCriterion` | Yes | Evaluate against custom rubrics |
| `HallucinationCriterion` | Yes | Detect hallucinated / ungrounded claims |
| `SafetyCriterion` | Yes | Check for harmful content across 5 categories |
| `FactualAccuracyCriterion` | Yes | Verify factual correctness of claims |
| `SimulationGoalsCriterion` | Yes | Evaluate goal achievement in multi-turn conversations (UserSimulator only) |
| `CompositeCriterion` | Depends | Combine sub-criteria with AND/OR logic |
| `WeightedCriterion` | Depends | Weighted average of sub-criteria |
