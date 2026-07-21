---
title: User Simulation — Testing and evaluation
sidebar_label: User Simulation
description: How to use AgentFlow's AI-powered user simulator to test agents with dynamic, goal-driven conversations. Covers the CLI get_scenarios() protocol, UserSimulator, ConversationScenario, BatchSimulator, and SimulationGoalsCriterion.
keywords:
  - UserSimulator
  - ConversationScenario
  - BatchSimulator
  - SimulationGoalsCriterion
  - get_scenarios
  - agentflow evaluation
  - dynamic testing
  - goal-driven eval
  - python ai agent framework
---

# User Simulation

Standard evaluation uses fixed test cases: you define the query and the expected response. User simulation flips this — an LLM **plays the role of a user** and drives a real conversation with your agent, checking whether the agent achieves a set of stated goals.

This is the right tool when:

- You want to test how the agent handles unpredictable conversation paths
- The "correct" answer cannot be stated as a fixed string
- You need to verify multi-turn behaviour at scale
- You want to test edge cases without writing each one by hand

---

## How it works

```
ConversationScenario
       ↓
UserSimulator (LLM as user)
       ↓  ←→  CompiledGraph (your agent)
  Turn loop
       ↓
Goal checking per turn (LLM)
       ↓
SimulationResult + SimulationGoalsCriterion scoring
       ↓
EvalCaseResult → HTML / JSON report
```

1. `UserSimulator` starts with `starting_prompt` from the scenario.
2. It sends the message to the agent graph and collects the response.
3. It checks (using an LLM) which goals from the scenario have been achieved.
4. If all goals are achieved, the simulation ends with `completed=True`.
5. If not, it generates the next user message based on remaining goals.
6. This repeats until all goals are achieved or `max_turns` is reached.
7. `SimulationGoalsCriterion` scores the full conversation transcript against the stated goals.

---

## CLI protocol — recommended

The simplest way to run user simulations is via the `agentflow eval` CLI. You only write the scenarios. The CLI handles running the simulator, scoring, and producing the report — identical to regular eval cases.

**Create an eval file with `get_scenarios()`:**

```python
# evals/user_simulator_eval.py
from agentflow.qa.evaluation import ConversationScenario, UserSimulatorConfig


# Optional: override the simulator model for this file.
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
            description="User wants help finding a flight from London to New York",
            starting_prompt="I need to fly from London to New York next Friday.",
            goals=[
                "User receives flight options",
                "User gets pricing information",
            ],
            max_turns=10,
        ),
    ]
```

**Run it:**

```bash
agentflow eval evals/user_simulator_eval.py

# Or together with all other eval files in parallel
agentflow eval --parallel --max-concurrency 4
```

The CLI detects `get_scenarios()` (or a `SCENARIOS` module-level constant), runs each scenario, and produces the same HTML + JSON report as regular eval cases. Regular eval cases and simulation scenarios are mixed in the same flat pool and the same report.

**What the CLI does internally:**
1. Detects `get_scenarios()` or `SCENARIOS` in the file
2. Reads `SIMULATOR_CONFIG` if present, otherwise uses `UserSimulatorConfig()` defaults
3. Builds one shared `UserSimulator` per file with a `SimulationGoalsCriterion` (threshold 0.7, single sample) attached automatically
4. Queues each scenario as a pending case and runs it with `simulator.run(graph, scenario)` in the same pool as regular eval cases, so `--parallel` applies to both
5. Converts each `SimulationResult` to an `EvalCaseResult` — pass/fail based on goal score vs threshold
6. Writes the report alongside all other eval cases

`BatchSimulator` is for programmatic use; the CLI does not go through it.

---

## ConversationScenario

```python
from agentflow.qa.evaluation import ConversationScenario

scenario = ConversationScenario(
    scenario_id="travel_planning",
    description="User wants to plan a weekend trip and needs weather and flight info.",
    starting_prompt="I'm thinking of going somewhere warm this weekend.",
    conversation_plan=(
        "1. Ask about weather in potential destinations\n"
        "2. Narrow down to one destination\n"
        "3. Ask about flight options\n"
        "4. Confirm the plan"
    ),
    goals=[
        "Get weather info for at least one destination",
        "Receive flight or travel suggestions",
        "Have a concrete travel plan by end of conversation",
    ],
    max_turns=8,
)
```

| Field | Type | Description |
|---|---|---|
| `scenario_id` | `str` | Unique identifier used in results and reports |
| `description` | `str` | What the user is trying to accomplish |
| `starting_prompt` | `str` | First message sent to the agent; if empty, the LLM generates one |
| `conversation_plan` | `str` | High-level flow description fed to the simulator LLM |
| `goals` | `list[str]` | What must be achieved for the simulation to count as complete |
| `max_turns` | `int` | Hard cap on conversation turns (default: 10) |
| `metadata` | `dict` | Arbitrary metadata passed through to results |

**Writing good goals:**
- Be specific: `"User gets the weather temperature for London"` not `"User learns about weather"`
- One idea per goal — the LLM judge checks each independently
- Goals must be verifiable from the conversation transcript alone

---

## UserSimulator

```python
from agentflow.qa.evaluation import UserSimulator, UserSimulatorConfig

simulator = UserSimulator(
    model="gemini/gemini-2.5-flash",
    temperature=0.7,
    max_turns=10,
)

result = await simulator.run(graph, scenario)
```

### Constructor parameters

| Parameter | Default | Description |
|---|---|---|
| `model` | `gemini/gemini-2.5-flash` | LLM used to generate user messages and check goals |
| `temperature` | `0.7` | Generation temperature — higher values produce more varied user messages |
| `max_turns` | `10` | Default turn limit (overridden by `scenario.max_turns`) |
| `config` | `None` | Pass a `UserSimulatorConfig` instead of individual parameters. When given, it overrides `model`, `temperature`, `max_turns` (from `max_invocations`) and `api_style` |
| `criteria` | `[]` | List of `BaseCriterion` to run against the completed conversation |
| `api_style` | `"responses"` | OpenAI API style. Use `"chat"` for models that only support legacy Chat Completions |

### Model support

The provider is inferred from the model name.

| Model string | Provider |
|---|---|
| `gemini/gemini-2.5-flash` | Google GenAI |
| `gemini-2.5-flash` | Google GenAI |
| `gpt-4o` | OpenAI |
| `gpt-4o-mini` | OpenAI |

There is no cross-provider fallback — one model name means one provider. If the call fails or returns nothing, the simulator substitutes the neutral message `"I have a follow-up question."` and continues the conversation, so a misconfigured key shows up as a bland transcript rather than an exception.

### Via UserSimulatorConfig

```python
from agentflow.qa.evaluation import UserSimulatorConfig, UserSimulator

config = UserSimulatorConfig(
    model="gemini/gemini-2.5-flash",
    max_invocations=12,
    temperature=0.5,
    thinking_enabled=False,
)

simulator = UserSimulator(config=config)
```

| Field | Default | Description |
|---|---|---|
| `model` | `gemini-2.5-flash` | Simulator LLM |
| `max_invocations` | `10` | Maximum conversation turns |
| `temperature` | `0.7` | Generation temperature |
| `thinking_enabled` | `False` | Enable reasoning/thinking mode if supported |
| `thinking_budget` | `10240` | Token budget for thinking (when enabled) |
| `api_style` | `"responses"` | OpenAI API style; `"chat"` for legacy Chat Completions |

---

## SimulationResult

`simulator.run()` returns a `SimulationResult`:

```python
result = await simulator.run(graph, scenario)

print(result.completed)           # True if all goals achieved before max_turns
print(result.turns)               # Number of turns that ran
print(result.goals_achieved)      # List of goal strings that were met
print(result.error)               # None if no error, else error message

# Full conversation transcript
for turn in result.conversation:
    print(f"{turn['role'].upper()}: {turn['content']}")

# Criterion scores (if criteria were passed to UserSimulator)
print(result.criterion_scores)    # {"simulation_goals": 0.8}
print(result.criterion_details)   # {"simulation_goals": {"achieved_goals": [...], ...}}
```

| Attribute | Type | Description |
|---|---|---|
| `scenario_id` | `str` | From the scenario |
| `turns` | `int` | Number of turns that ran |
| `conversation` | `list[dict]` | Full history: `[{"role": "user"/"assistant", "content": "..."}]` |
| `goals_achieved` | `list[str]` | Goals confirmed by the LLM goal-checker |
| `completed` | `bool` | `True` when all goals achieved before `max_turns` |
| `error` | `str \| None` | Error message if simulation failed mid-way |
| `criterion_scores` | `dict[str, float]` | Score per criterion (0.0–1.0) |
| `criterion_details` | `dict[str, Any]` | Full criterion output including reasoning |
| `criterion_results` | `list[CriterionResult]` | Full result objects, including per-criterion token usage |
| `simulator_token_usage` | `TokenUsage` | Tokens spent generating the user turns |

---

## SimulationGoalsCriterion

`SimulationGoalsCriterion` is an LLM-judge criterion designed specifically for use with `UserSimulator`. It receives the **full conversation transcript** and checks whether each goal was addressed at any point — not just in the final message.

The CLI attaches this criterion automatically when it detects `get_scenarios()`. For programmatic use:

```python
from agentflow.qa.evaluation import (
    SimulationGoalsCriterion,
    CriterionConfig,
    UserSimulator,
)

judge = SimulationGoalsCriterion(
    config=CriterionConfig(
        threshold=0.7,
        judge_model="gemini-2.5-flash",
    )
)

simulator = UserSimulator(
    model="gemini/gemini-2.5-flash",
    criteria=[judge],
)

result = await simulator.run(graph, scenario)
# result.criterion_scores["simulation_goals"] → 0.67 (2 of 3 goals met)
```

**Score:** `achieved_goals / total_goals`

The criterion details include:
- `achieved_goals` — list of goals confirmed as addressed
- `unachieved_goals` — list of goals not addressed
- `reasoning` — the judge's explanation

> **Note:** `SimulationGoalsCriterion` is designed **exclusively for `UserSimulator`**. Do not add it to a regular `EvalConfig` — in the standard `AgentEvaluator` flow, `actual_response` contains only the final response, not the full transcript, so the goal check would not see prior turns.

---

## BatchSimulator

Run multiple scenarios concurrently with `BatchSimulator`. Each scenario gets its own isolated thread ID so checkpointer state never bleeds between runs.

```python
from agentflow.qa.evaluation import (
    BatchSimulator,
    ConversationScenario,
    SimulationGoalsCriterion,
    CriterionConfig,
    UserSimulator,
)

judge = SimulationGoalsCriterion(config=CriterionConfig(threshold=0.7))
simulator = UserSimulator(model="gemini/gemini-2.5-flash", criteria=[judge])

batch = BatchSimulator(simulator=simulator, max_concurrency=5)

results = await batch.run_batch(graph, [scenario_a, scenario_b, scenario_c])

summary = batch.summary(results)
print(f"Completion rate: {summary['completion_rate']:.0%}")
print(f"Average turns: {summary['average_turns']:.1f}")
```

### BatchSimulator parameters

| Parameter | Default | Description |
|---|---|---|
| `simulator` | auto-created | Pre-configured `UserSimulator`; pass your own to include criteria |
| `max_concurrency` | `5` | Maximum scenarios running in parallel |
| `**kwargs` | — | Forwarded to `UserSimulator` if no `simulator` is given |

### Batch summary fields

| Field | Description |
|---|---|
| `total_scenarios` | Total number of scenarios run |
| `completed` | Scenarios where all goals were achieved |
| `completion_rate` | `completed / total_scenarios` |
| `total_goals_achieved` | Sum of goals achieved across all scenarios |
| `average_turns` | Mean turns per scenario |
| `errors` | Number of scenarios that errored |

---

## Complete programmatic example

```python
import asyncio
from agentflow.qa.evaluation import (
    BatchSimulator,
    ConversationScenario,
    CriterionConfig,
    SimulationGoalsCriterion,
    UserSimulator,
)
from graph.agent import app   # your compiled graph


async def run_simulation():
    judge = SimulationGoalsCriterion(
        config=CriterionConfig(threshold=0.7, judge_model="gemini-2.5-flash")
    )
    simulator = UserSimulator(
        model="gemini/gemini-2.5-flash",
        temperature=0.6,
        criteria=[judge],
    )
    batch = BatchSimulator(simulator=simulator, max_concurrency=3)

    scenarios = [
        ConversationScenario(
            scenario_id="customer_refund",
            description="Customer wants to initiate a refund for a damaged item.",
            starting_prompt="I received a damaged item and want a refund.",
            conversation_plan=(
                "1. Explain the damage\n"
                "2. Provide order details when asked\n"
                "3. Confirm refund is processed"
            ),
            goals=[
                "Agent acknowledges the damage",
                "Agent initiates or confirms a refund",
                "Customer has a clear resolution",
            ],
            max_turns=8,
        ),
        ConversationScenario(
            scenario_id="product_recommendation",
            description="Customer wants a laptop recommendation for video editing.",
            starting_prompt="I need a laptop for professional video editing.",
            goals=[
                "Agent asks about budget or requirements",
                "Agent recommends at least one specific product",
                "Recommendation includes RAM or GPU specs",
            ],
            max_turns=6,
        ),
    ]

    results = await batch.run_batch(app, scenarios)

    for result, scenario in zip(results, scenarios):
        status = "PASS" if result.completed else "FAIL"
        n_goals = len(scenario.goals)
        n_achieved = len(result.goals_achieved)
        print(f"{result.scenario_id}: {status} | {result.turns} turns | {n_achieved}/{n_goals} goals")

        sim_score = result.criterion_scores.get("simulation_goals")
        if sim_score is not None:
            print(f"  SimulationGoals score: {sim_score:.2f}")
            details = result.criterion_details.get("simulation_goals", {})
            print(f"  Achieved: {details.get('achieved_goals', [])}")
            print(f"  Missing:  {details.get('unachieved_goals', [])}")

    summary = batch.summary(results)
    print(f"\nCompletion rate: {summary['completion_rate']:.0%}")


asyncio.run(run_simulation())
```

---

## Simulation vs standard evaluation

| | Standard `EvalSet` | User simulation |
|---|---|---|
| Input | Fixed query string | LLM-generated messages |
| Expected output | Defined in the test case | Inferred from stated goals |
| Turn count | Single turn (or explicit multi-turn) | Dynamic, up to `max_turns` |
| Best for | Regression testing known inputs | Open-ended dialogue and goal achievement |
| CLI protocol | `get_eval_set()` | `get_scenarios()` |
| Scoring | Per-criterion scores | Goal achievement rate (0.0–1.0) |

Run both in CI to get full coverage:

```bash
# All evals and simulations in one run
agentflow eval --parallel --max-concurrency 8
```

---

## Next steps

- [Criteria reference](./criteria.md) — understand `SimulationGoalsCriterion` alongside the other criteria
- [Eval sets](./eval-set.md) — fixed test cases for regression testing
- [Reports](./reports.md) — how to read and interpret eval results
- [How to run evaluations](../../how-to/api-cli/run-evals.md) — full CLI reference
