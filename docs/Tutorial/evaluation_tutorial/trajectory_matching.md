# Trajectory Matching Tutorial

This tutorial is a deep-dive into trajectory matching — how the evaluation module compares the **actual sequence of tool calls** your agent made against the **expected sequence** defined in your test cases. It covers the three matching modes and argument checking.

---

## What Is Trajectory Matching?

When your agent runs, it calls tools in a specific order. Trajectory matching verifies whether those tool calls match your expectations. There are two trajectory criteria:

| Criterion | What It Checks |
|---|---|
| `ToolNameMatchCriterion` | Tool names match (ignoring order and arguments) |
| `TrajectoryMatchCriterion` | Full tool sequence with configurable strictness |

---

## Match Types

`TrajectoryMatchCriterion` supports three matching modes via `MatchType`:

### `EXACT` — Strict Matching

Both the **order and count** must match exactly. No extra tools allowed.

```
Expected: [get_weather, get_forecast]
Actual:   [get_weather, get_forecast]  → score: 1.0  ✓
Actual:   [get_forecast, get_weather]  → score: 0.0  ✗ (wrong order)
Actual:   [get_weather]                → score: 0.5  ✗ (missing one)
Actual:   [get_weather, log, get_forecast]  → score: 0.0  ✗ (extra tool, wrong count)
```

**Use when:** You need to guarantee the exact execution path. Best for deterministic agents or critical workflows.

### `IN_ORDER` — Ordered Subsequence

Expected tools must appear **in order**, but extra tools between them are allowed.

```
Expected: [get_weather, get_forecast]
Actual:   [get_weather, log_query, get_forecast]           → score: 1.0  ✓
Actual:   [validate, get_weather, cache_check, get_forecast] → score: 1.0  ✓
Actual:   [get_forecast, get_weather]                       → score: 0.5  ✗ (wrong order)
Actual:   [get_weather]                                     → score: 0.5  ✗ (missing forecast)
```

**Use when:** Your agent may invoke helper or logging tools between the main ones. Good for multi-turn evaluation.

### `ANY_ORDER` — Unordered Set Match

Expected tools must all appear, but **order doesn't matter**. Extras are allowed.

```
Expected: [get_weather, get_forecast]
Actual:   [get_forecast, get_weather]       → score: 1.0  ✓
Actual:   [get_forecast, log, get_weather]  → score: 1.0  ✓
Actual:   [get_weather]                     → score: 0.5  ✗ (missing forecast)
Actual:   [get_weather, get_weather]        → score: 0.5  ✗ (no forecast)
```

**Use when:** You only care that specific tools were called, not in what order. Good for agents with parallel tool calls or non-deterministic routing.

---

## Configuration

### Basic Configuration

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType

config = EvalConfig(criteria={
    "tool_trajectory_avg_score": CriterionConfig(
        threshold=1.0,
        match_type=MatchType.EXACT,
        check_args=False,
    ),
})
```

### Using Factory Methods

```python
config = EvalConfig(criteria={
    "tool_trajectory_avg_score": CriterionConfig.trajectory(
        threshold=1.0,
        match_type=MatchType.IN_ORDER,
        check_args=True,
    ),
})
```

### Using Presets

```python
from agentflow.evaluation import EvalPresets

# Strict tool usage (EXACT, check_args=True)
config = EvalPresets.tool_usage(strict=True, check_args=True)

# Relaxed tool usage (IN_ORDER, check_args=True)
config = EvalPresets.tool_usage(strict=False, check_args=True)

# Conversation flow (IN_ORDER, check_args=False)
config = EvalPresets.conversation_flow(threshold=0.8)
```

---

## Argument Checking

When `check_args=True`, the criterion also compares tool **arguments**, not just names.

### Without Argument Checking (`check_args=False`)

```python
from agentflow.evaluation.dataset import ToolCall

expected = [ToolCall(name="get_weather", args={"city": "london"})]
actual   = [ToolCall(name="get_weather", args={"city": "tokyo"})]
# → score: 1.0 (names match, args ignored)
```

### With Argument Checking (`check_args=True`)

```python
expected = [ToolCall(name="get_weather", args={"city": "london"})]
actual   = [ToolCall(name="get_weather", args={"city": "tokyo"})]
# → score: 0.0 (names match but args differ)

actual   = [ToolCall(name="get_weather", args={"city": "london"})]
# → score: 1.0 (names and args match)
```

**How `ToolCall.matches()` works:**

```python
tc1 = ToolCall(name="get_weather", args={"city": "london"})
tc2 = ToolCall(name="get_weather", args={"city": "london"})

tc1.matches(tc2, check_args=True)   # True
tc1.matches(tc2, check_args=False)  # True

tc3 = ToolCall(name="get_weather", args={"city": "tokyo"})
tc1.matches(tc3, check_args=True)   # False
tc1.matches(tc3, check_args=False)  # True
```

---

## ToolNameMatchCriterion vs TrajectoryMatchCriterion

| Feature | `ToolNameMatchCriterion` | `TrajectoryMatchCriterion` |
|---|---|---|
| Config key | `tool_name_match_score` | `tool_trajectory_avg_score` |
| Order matters? | No (always ANY_ORDER) | Configurable (EXACT/IN_ORDER/ANY_ORDER) |
| Argument checking? | No (names only) | Configurable (`check_args`) |
| Duplicate handling | Counts duplicates | Depends on match type |
| Edge case: no expected tools | score=1.0 if no actual, 0.5 if actual has tools | score=1.0 if no actual, 0.0 if actual has tools |

**When to use which:**

- Use `ToolNameMatchCriterion` for a quick sanity check: "Did the agent use the right tools?"
- Use `TrajectoryMatchCriterion` when order or arguments matter: "Did the agent follow the correct workflow?"

---

## Scoring Details

### TrajectoryMatchCriterion Scoring

The score formula depends on the match type:

**EXACT:**
$$\text{score} = \frac{\text{matching tools in order}}{\text{total expected tools}}$$

If lengths differ, only the overlapping prefix is compared.

**IN_ORDER:**
$$\text{score} = \frac{\text{expected tools found in order}}{\text{total expected tools}}$$

Scans actual tools left-to-right, advancing the expected pointer when a match is found.

**ANY_ORDER:**
$$\text{score} = \frac{\text{expected tools found (any position)}}{\text{total expected tools}}$$

Each matched actual tool is consumed (removed from the remaining pool) to handle duplicates correctly.

### ToolNameMatchCriterion Scoring

$$\text{score} = \frac{\text{matched names}}{\text{total expected names}}$$

Matched names are consumed from the actual list to handle duplicates.

---

## Complete Examples

### Example 1: Exact Tool Sequence

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType
from agentflow.evaluation.dataset import EvalCase, ToolCall

case = EvalCase.single_turn(
    eval_id="exact_sequence",
    user_query="Weather and forecast for London",
    expected_response="Sunny today, rain tomorrow",
    expected_tools=[
        ToolCall(name="get_weather", args={"city": "london"}),
        ToolCall(name="get_forecast", args={"city": "london"}),
    ],
)

config = EvalConfig(criteria={
    "tool_trajectory_avg_score": CriterionConfig.trajectory(
        threshold=1.0,
        match_type=MatchType.EXACT,
        check_args=True,
    ),
})
```

### Example 2: Flexible Order in Multi-Turn

```python
from agentflow.evaluation.dataset import EvalCase, Invocation, ToolCall

case = EvalCase(
    eval_id="flexible_multi_turn",
    conversation=[
        Invocation.simple(
            user_query="Compare weather in London and Tokyo",
            expected_response="London is warmer",
            expected_tools=[
                ToolCall(name="get_weather", args={"city": "london"}),
                ToolCall(name="get_weather", args={"city": "tokyo"}),
            ],
        ),
    ],
)

# Use ANY_ORDER since the agent might query cities in either order
config = EvalConfig(criteria={
    "tool_trajectory_avg_score": CriterionConfig.trajectory(
        threshold=1.0,
        match_type=MatchType.ANY_ORDER,
        check_args=True,
    ),
})
```

### Example 3: Combining Both Criteria

```python
config = EvalConfig(criteria={
    # Quick name check (always passes if tools are called)
    "tool_name_match_score": CriterionConfig.tool_name_match(threshold=1.0),
    # Strict sequence check
    "tool_trajectory_avg_score": CriterionConfig.trajectory(
        threshold=1.0,
        match_type=MatchType.EXACT,
        check_args=True,
    ),
})
```

---

## Inspecting Results

```python
result = await evaluator.evaluate_case(case)

# Get trajectory criterion result
traj_result = result.get_criterion_result("tool_trajectory_avg_score")
if traj_result:
    print(f"Score: {traj_result.score:.2f}")
    print(f"Match type: {traj_result.details['match_type']}")
    print(f"Check args: {traj_result.details['check_args']}")
    print(f"Expected: {traj_result.details['expected_trajectory']}")
    print(f"Actual: {traj_result.details['actual_trajectory']}")
    print(f"Reason: {traj_result.reason}")

# Get tool name criterion result
name_result = result.get_criterion_result("tool_name_match_score")
if name_result:
    print(f"Expected names: {name_result.details['expected_names']}")
    print(f"Actual names: {name_result.details['actual_names']}")
```

---

## Decision Guide

```
Do you care about tool call ORDER?
├── Yes → Do you allow EXTRA tools between expected ones?
│   ├── Yes → IN_ORDER
│   └── No  → EXACT
└── No  → ANY_ORDER

Do you care about tool ARGUMENTS?
├── Yes → check_args=True
└── No  → check_args=False
```

---

## Next Steps

- [Single-Turn Evaluation](single_turn_evaluation.md) — Basic evaluation walkthrough
- [Multi-Turn Evaluation](multi_turn_evaluation.md) — Conversation testing
- [Criteria Reference](../reference/criteria.md) — Full criterion API
