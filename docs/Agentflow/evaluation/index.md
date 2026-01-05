# Agent Evaluation Framework

The Agentflow evaluation framework provides comprehensive tools for testing and validating agent behavior. Unlike traditional unit testing, this framework addresses the probabilistic nature of LLM-based agents by focusing on trajectory analysis, response quality assessment, and LLM-as-judge evaluation patterns.

## Why Evaluate Agents Differently?

Traditional software testing relies on deterministic assertions—given the same input, you expect the exact same output. But LLM-based agents are inherently probabilistic:

- The same prompt may produce different responses
- Tool call sequences may vary while achieving the same goal
- Response quality is subjective and hard to measure with exact matching

The evaluation framework solves this with:

1. **Trajectory Analysis** - Validate the sequence of tools called, not just the final output
2. **Semantic Matching** - Use LLM-as-judge to evaluate response quality
3. **Flexible Matching** - Support exact, in-order, and any-order trajectory matching
4. **Automated Grading** - Define rubrics for consistent quality assessment

## Core Concepts

### EvalSet & EvalCase

An **EvalSet** is a collection of test cases. Each **EvalCase** represents a single test scenario with:

- Input messages (user prompts)
- Expected tool trajectories
- Expected responses
- Metadata for filtering and organization

```python
from agentflow.evaluation import EvalSet, EvalCase, Invocation, MessageContent

eval_set = EvalSet(
    eval_set_id="weather_agent_tests",
    name="Weather Agent Tests",
    description="Test cases for the weather agent",
    eval_cases=[
        EvalCase(
            eval_id="test_weather_lookup",
            name="Basic Weather Lookup",
            conversation=[
                Invocation(
                    invocation_id="turn_1",
                    user_content=MessageContent.user("What's the weather in Tokyo?"),
                    expected_tool_trajectory=[
                        ToolCall(name="get_weather", args={"city": "Tokyo"})
                    ],
                )
            ],
        )
    ],
)
```

### Criteria

**Criteria** are the rules for evaluating agent behavior. Agentflow provides:

| Category | Criteria | Description |
|----------|----------|-------------|
| **Trajectory** | `TrajectoryMatchCriterion` | Validates tool call sequences |
| **Response** | `ResponseMatchCriterion` | ROUGE-based text similarity |
| **LLM Judge** | `LLMJudgeCriterion` | Semantic matching via LLM |
| **Rubric** | `RubricBasedCriterion` | Custom rubric grading |
| **Advanced** | `HallucinationCriterion` | Groundedness checking |
| **Advanced** | `SafetyCriterion` | Safety/harmlessness validation |
| **Advanced** | `FactualAccuracyCriterion` | Factual correctness |

### Reporters

**Reporters** generate output from evaluation results:

- `ConsoleReporter` - Pretty-printed terminal output
- `JSONReporter` - Machine-readable JSON
- `JUnitXMLReporter` - CI/CD compatible XML (JUnit format)
- `HTMLReporter` - Interactive HTML reports

## Quick Start

```python
import asyncio
from agentflow.evaluation import AgentEvaluator, EvalConfig, ConsoleReporter

async def main():
    # 1. Create your compiled graph
    graph = create_my_agent_graph()  # Your graph creation function
    
    # 2. Create evaluator with default config
    evaluator = AgentEvaluator(graph, config=EvalConfig.default())
    
    # 3. Run evaluation
    report = await evaluator.evaluate("tests/fixtures/my_agent.evalset.json")
    
    # 4. Print results
    reporter = ConsoleReporter(verbose=True)
    reporter.report(report)
    
    # 5. Check results
    print(f"Pass rate: {report.summary.pass_rate * 100:.1f}%")
    print(f"Passed: {report.summary.passed_cases}/{report.summary.total_cases}")

asyncio.run(main())
```

## Module Structure

```
agentflow/evaluation/
├── evaluator.py           # AgentEvaluator, EvaluationRunner
├── eval_set.py            # EvalSet, EvalCase, Invocation, ToolCall
├── eval_config.py         # EvalConfig, CriterionConfig
├── eval_result.py         # EvalReport, EvalCaseResult, CriterionResult
├── testing.py             # Pytest integration utilities
├── collectors/
│   └── trajectory_collector.py  # TrajectoryCollector, EventCollector
├── criteria/
│   ├── base.py            # BaseCriterion, SyncCriterion
│   ├── trajectory.py      # TrajectoryMatchCriterion
│   ├── response.py        # ResponseMatchCriterion
│   ├── llm_judge.py       # LLMJudgeCriterion, RubricBasedCriterion
│   └── advanced.py        # HallucinationCriterion, SafetyCriterion
├── reporters/
│   ├── console.py         # ConsoleReporter
│   ├── json.py            # JSONReporter, JUnitXMLReporter
│   └── html.py            # HTMLReporter
└── simulators/
    └── user_simulator.py  # UserSimulator, BatchSimulator
```

## Documentation Guide

| Topic | Description |
|-------|-------------|
| [Getting Started](getting-started.md) | Basic setup and first evaluation |
| [Data Models](data-models.md) | EvalSet, EvalCase, and related structures |
| [Criteria](criteria.md) | All available evaluation criteria |
| [Reporters](reporters.md) | Outputting and formatting results |
| [Pytest Integration](pytest-integration.md) | Using evaluations in test suites |
| [User Simulation](user-simulation.md) | AI-powered dynamic testing |
| [Advanced Topics](advanced.md) | Custom criteria, best practices |

## Installation

The evaluation module is included in the core Agentflow package:

```bash
pip install 10xscale-agentflow
```

For LLM-as-judge features (required for semantic matching and advanced criteria):

```bash
pip install 10xscale-agentflow[litellm]
```
