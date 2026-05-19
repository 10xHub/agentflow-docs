---
title: User Simulation — AgentFlow Evaluation
sidebar_label: User Simulation
description: How to use AgentFlow's AI-powered user simulator to test agents with dynamic, goal-driven conversations using UserSimulator, ConversationScenario, BatchSimulator, and SimulationGoalsCriterion.
keywords:
  - UserSimulator
  - ConversationScenario
  - BatchSimulator
  - SimulationGoalsCriterion
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
SimulationResult + optional criterion scoring
```

1. `UserSimulator` starts with `starting_prompt` from the scenario.
2. It sends the message to the agent graph and collects the response.
3. It checks (using an LLM) which goals from the scenario have been achieved.
4. If all goals are achieved, the simulation ends with `completed=True`.
5. If not, it generates the next user message based on remaining goals.
6. This repeats until all goals are achieved or `max_turns` is reached.
7. After the loop, any configured `criteria` (e.g. `SimulationGoalsCriterion`) are run against the full conversation transcript.

---

## ConversationScenario

A scenario defines everything the simulator needs to drive a conversation.

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

---

## UserSimulator

```python
from agentflow.qa.evaluation import UserSimulator

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
| `config` | `None` | Pass a `UserSimulatorConfig` instead of individual parameters |
| `criteria` | `[]` | List of `BaseCriterion` to run against the completed conversation |

### Model support

The simulator calls Google GenAI or OpenAI depending on the model prefix:

| Model string | Provider |
|---|---|
| `gemini/gemini-2.5-flash` | Google GenAI |
| `gemini-2.5-flash` | Google GenAI |
| `gpt-4o` | OpenAI |
| `gpt-4o-mini` | OpenAI |

If the primary provider call fails, it falls back to the other. If both fail, the simulator emits a neutral message (`"I have a follow-up question."`) and continues.

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

---

## SimulationGoalsCriterion

`SimulationGoalsCriterion` is an LLM-judge criterion designed specifically for use with `UserSimulator`. It receives the **full conversation transcript** and checks whether each goal was addressed at any point — not just in the final message.

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

> **Important:** `SimulationGoalsCriterion` is designed **exclusively for `UserSimulator`**. Do not add it to a regular `EvalConfig` — in the standard `AgentEvaluator` flow, `actual_response` contains only the final response, not the full transcript, so the goal check would not see prior turns.

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

scenarios = [
    ConversationScenario(
        scenario_id="weather_query",
        description="User wants to know the weather",
        starting_prompt="What's the weather like in London?",
        goals=["Get weather information for London"],
        max_turns=4,
    ),
    ConversationScenario(
        scenario_id="flight_search",
        description="User wants to find flights",
        starting_prompt="I need a flight to Paris next Friday",
        goals=["Receive flight options", "Get price information"],
        max_turns=6,
    ),
]

results = await batch.run_batch(graph, scenarios)
```

### Batch summary

```python
summary = batch.summary(results)

print(summary["total_scenarios"])     # 2
print(summary["completed"])           # 1 (scenarios where all goals achieved)
print(summary["completion_rate"])     # 0.5
print(summary["total_goals_achieved"])# 2
print(summary["average_turns"])       # 4.5
print(summary["errors"])              # 0
```

### BatchSimulator parameters

| Parameter | Default | Description |
|---|---|---|
| `simulator` | auto-created | Pre-configured `UserSimulator`; pass your own to include criteria |
| `max_concurrency` | `5` | Maximum scenarios running in parallel |
| `**kwargs` | — | Forwarded to `UserSimulator` if no `simulator` is given |

---

## Complete example

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

    for result in results:
        status = "PASS" if result.completed else "FAIL"
        goals_pct = len(result.goals_achieved) / len(scenarios[0].goals) * 100
        print(f"{result.scenario_id}: {status} | {result.turns} turns | {goals_pct:.0f}% goals")

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

## Combining simulation with standard evaluation

User simulation and standard `AgentEvaluator` evaluation are complementary:

| Approach | Best for |
|---|---|
| `AgentEvaluator` + `EvalSet` | Regression testing known inputs and expected outputs |
| `UserSimulator` + `ConversationScenario` | Testing open-ended multi-turn behaviour and goal achievement |

Run both in CI to get full coverage:

```bash
# Standard eval (regression)
agentflow eval evals/regression/

# Simulation (in a separate script, run via pytest)
pytest tests/simulation/test_user_sim.py
```

---

## Next steps

- [Criteria reference](./criteria.md) — understand `SimulationGoalsCriterion` alongside the other criteria
- [Eval sets](./eval-set.md) — fixed test cases for regression testing
- [Reports](./reports.md) — how to read and interpret eval results
