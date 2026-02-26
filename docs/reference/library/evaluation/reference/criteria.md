# Criteria Reference

This page documents all evaluation criteria available in the Agentflow evaluation module. Criteria are scoring functions that compare actual execution results against expectations, returning a score from 0.0 to 1.0.

---

## Overview

| Criterion | Class | Config Key(s) | Requires LLM? |
|---|---|---|---|
| Tool Name Match | `ToolNameMatchCriterion` | `tool_name_match_score` | No |
| Trajectory Match | `TrajectoryMatchCriterion` | `tool_trajectory_avg_score`, `trajectory_match` | No |
| Node Order Match | `NodeOrderMatchCriterion` | `node_order_score`, `node_order` | No |
| Exact Match | `ExactMatchCriterion` | `exact_match` | No |
| Contains Keywords | `ContainsKeywordsCriterion` | `contains_keywords` | No |
| ROUGE Match | `RougeMatchCriterion` | `rouge_match` | No |
| Response Match | `ResponseMatchCriterion` | `response_match_score`, `response_match` | Yes |
| LLM Judge | `LLMJudgeCriterion` | `final_response_match_v2`, `llm_judge` | Yes |
| Rubric-Based | `RubricBasedCriterion` | `rubric_based_final_response_quality_v1`, `rubric_based` | Yes |
| Hallucination | `HallucinationCriterion` | `hallucinations_v1`, `hallucination` | Yes |
| Safety | `SafetyCriterion` | `safety_v1`, `safety` | Yes |
| Factual Accuracy | `FactualAccuracyCriterion` | `factual_accuracy_v1`, `factual_accuracy` | Yes |
| Simulation Goals | `SimulationGoalsCriterion` | `simulation_goals`, `conversation_goals` | Yes |
| Composite | `CompositeCriterion` | — | Depends |
| Weighted | `WeightedCriterion` | — | Depends |

---

## Base Classes

### `BaseCriterion`

Abstract base class for all criteria.

```python
from agentflow.evaluation import BaseCriterion

class BaseCriterion(ABC):
    name: str = "base_criterion"
    description: str = "Base evaluation criterion"

    def __init__(self, config: CriterionConfig | None = None): ...

    async def evaluate(self, actual: ExecutionResult, expected: EvalCase) -> CriterionResult: ...
    async def evaluate_invocation(self, actual: ExecutionResult, expected: Invocation) -> CriterionResult: ...
    def validate_config(self) -> list[str]: ...

    @property
    def threshold(self) -> float: ...
    @property
    def is_enabled(self) -> bool: ...
```

### `SyncCriterion`

Base for criteria that don't need async. Implement `evaluate_sync()` instead of `evaluate()`.

```python
class SyncCriterion(BaseCriterion):
    def evaluate_sync(self, actual: ExecutionResult, expected: EvalCase) -> CriterionResult: ...
```

---

## No-LLM Criteria

These criteria run locally without any LLM API calls. Fast and free.

### `ToolNameMatchCriterion`

Checks that the correct tools were called, regardless of order or arguments.

- **Config key:** `tool_name_match_score`
- **Scoring:** `matched_names / total_expected_names`
- **Edge case:** If no tools expected and no tools called → 1.0; if no tools expected but tools called → 0.5

```python
from agentflow.evaluation import CriterionConfig

config = CriterionConfig.tool_name_match(threshold=1.0)
```

**Result details:**
```python
{
    "expected_names": ["get_weather", "get_forecast"],
    "actual_names": ["get_weather", "get_forecast"],
}
```

---

### `TrajectoryMatchCriterion`

Compares actual tool call sequences against expected trajectories with configurable matching modes.

- **Config key:** `tool_trajectory_avg_score` or `trajectory_match`
- **Supports:** `MatchType.EXACT`, `MatchType.IN_ORDER`, `MatchType.ANY_ORDER`
- **Argument checking:** Configurable via `check_args`

```python
from agentflow.evaluation import CriterionConfig, MatchType

config = CriterionConfig.trajectory(
    threshold=1.0,
    match_type=MatchType.EXACT,
    check_args=True,
)
```

**Match Modes:**

| Mode | Description | Score Formula |
|---|---|---|
| `EXACT` | Same tools, same order, same count | $\frac{\text{matching tools in position}}{\text{expected count}}$ |
| `IN_ORDER` | Expected tools in order, extras allowed | $\frac{\text{expected found in order}}{\text{expected count}}$ |
| `ANY_ORDER` | Expected tools in any order, extras allowed | $\frac{\text{expected found anywhere}}{\text{expected count}}$ |

**Result details:**
```python
{
    "reason": "Matched 100% of expected tools. Expected [...], got [...].",
    "actual_trajectory": [...],
    "expected_trajectory": [...],
    "match_type": "EXACT",
    "check_args": true,
}
```

See [Trajectory Matching Tutorial](../tutorial/trajectory_matching.md) for detailed examples.

---

### `NodeOrderMatchCriterion`

Checks that the graph visited nodes in the expected order. Compares `ExecutionResult.node_visits` against `EvalCase.conversation[i].expected_node_order`.

- **Config key:** `node_order_score` or `node_order`
- **Supports:** `MatchType.EXACT`, `MatchType.IN_ORDER`, `MatchType.ANY_ORDER`

```python
from agentflow.evaluation import CriterionConfig, MatchType

config = CriterionConfig.node_order(
    threshold=1.0,
    match_type=MatchType.EXACT,
)
```

**Match Modes:**

| Mode | Description | Score Formula |
|---|---|---|
| `EXACT` | Same nodes, same order, same count | $\frac{\text{matching nodes in position}}{\text{expected count}}$ |
| `IN_ORDER` | Expected nodes appear in order, extras allowed | $\frac{\text{expected found in order}}{\text{expected count}}$ |
| `ANY_ORDER` | Expected nodes present in any order | $\frac{\text{expected found anywhere}}{\text{expected count}}$ |

**Example:**

```python
from agentflow.evaluation.dataset import EvalCase

case = EvalCase.single_turn(
    eval_id="node_order_test",
    user_query="Weather in London?",
    expected_response="Sunny",
    expected_node_order=["MAIN", "TOOL", "MAIN"],
)
```

**Result details:**
```python
{
    "reason": "Matched 100% of expected node order. Expected ['MAIN', 'TOOL', 'MAIN'], got ['MAIN', 'TOOL', 'MAIN'].",
    "actual_node_order": ["MAIN", "TOOL", "MAIN"],
    "expected_node_order": ["MAIN", "TOOL", "MAIN"],
    "match_type": "EXACT",
}
```

---

### `ExactMatchCriterion`

Exact string comparison between actual and expected response.

- **Config key:** `exact_match`
- **Scoring:** 1.0 if strings match exactly, 0.0 otherwise

```python
config = {"exact_match": CriterionConfig(threshold=1.0)}
```

---

### `ContainsKeywordsCriterion`

Checks that the response contains required keywords extracted from the expected response.

- **Config key:** `contains_keywords`
- **Scoring:** `found_keywords / total_keywords`

```python
from agentflow.evaluation import ContainsKeywordsCriterion, CriterionConfig

# Configure with explicit keywords
config = {"contains_keywords": CriterionConfig.contains_keywords(
    keywords=["sunny", "london", "22°C"],
    threshold=1.0,
)}

# Or construct directly
criterion = ContainsKeywordsCriterion(
    keywords=["sunny", "london", "22°C"],
    config=CriterionConfig(threshold=1.0),
)
```

---

### `RougeMatchCriterion`

ROUGE-1 F1 score between actual and expected response. Fast alternative to LLM-based matching.

- **Config key:** `rouge_match`
- **Scoring:** ROUGE-1 F1 score (0.0–1.0)

```python
config = {"rouge_match": CriterionConfig(threshold=0.7)}
```

---

## LLM-Based Criteria

These criteria use an LLM (configured via `judge_model`) to evaluate responses. They support majority voting via `num_samples`.

### `ResponseMatchCriterion`

LLM-based semantic response matching. **Recommended default** for response evaluation.

- **Config key:** `response_match_score` or `response_match`
- **Inherits from:** `LLMJudgeCriterion`
- **Scoring:** LLM rates semantic equivalence between actual and expected responses

```python
config = CriterionConfig.response_match(threshold=0.7)
```

---

### `LLMJudgeCriterion`

General-purpose LLM judge for semantic evaluation with majority voting.

- **Config key:** `final_response_match_v2` or `llm_judge`
- **Scoring:** Average score across `num_samples` LLM calls
- **Uses:** `SEMANTIC_MATCH_PROMPT` template

```python
config = CriterionConfig.llm_judge(
    threshold=0.8,
    judge_model="gemini/gemini-2.5-flash",
    num_samples=3,  # Majority voting
)
```

The LLM receives the user question, expected response, and actual response, then rates the match on a 0.0–1.0 scale.

---

### `RubricBasedCriterion`

Evaluate responses against user-defined rubrics.

- **Config key:** `rubric_based_final_response_quality_v1` or `rubric_based`
- **Scoring:** Average score across all provided rubrics

```python
from agentflow.evaluation import CriterionConfig, Rubric

config = CriterionConfig.rubric_based(
    rubrics=[
        Rubric(rubric_id="completeness", content="Response addresses all parts of the question", weight=1.0),
        Rubric(rubric_id="clarity", content="Response is clear and easy to understand", weight=0.8),
        Rubric(rubric_id="accuracy", content="Response contains accurate information", weight=1.0),
    ],
    threshold=0.8,
    judge_model="gemini/gemini-2.5-flash",
)
```

**`Rubric` model:**

```python
class Rubric(BaseModel):
    rubric_id: str      # Unique identifier
    content: str        # The rubric description/criteria text
    weight: float = 1.0 # Weight in overall scoring

    @classmethod
    def create(cls, rubric_id: str, content: str, weight: float = 1.0) -> Rubric: ...
```

---

### `HallucinationCriterion`

Detects hallucinations and evaluates whether the response is grounded in actual context.

- **Config key:** `hallucinations_v1` or `hallucination`
- **Scoring:** 1.0 = fully grounded, 0.0 = mostly hallucinated

```python
config = CriterionConfig.hallucination(
    threshold=0.8,
    judge_model="gemini/gemini-2.5-flash",
    num_samples=3,
)
```

The LLM checks whether claims in the response are supported by the context the agent actually had (tool results, provided facts).

---

### `SafetyCriterion`

Evaluates response safety across five categories.

- **Config key:** `safety_v1` or `safety`
- **Categories:** harmful content, hate speech, privacy, misinformation, manipulation
- **Scoring:** Average score across all categories (majority voting across samples)
- **Scale:** 1.0 = completely safe, 0.0 = dangerous content

```python
config = CriterionConfig.safety(
    threshold=0.8,
    judge_model="gemini/gemini-2.5-flash",
    num_samples=3,
)
```

---

### `FactualAccuracyCriterion`

Evaluates factual correctness of the response.

- **Config key:** `factual_accuracy_v1` or `factual_accuracy`
- **Scoring:** 1.0 = all facts correct, 0.0 = mostly incorrect

```python
config = CriterionConfig.factual_accuracy(
    threshold=0.8,
    judge_model="gemini/gemini-2.5-flash",
    num_samples=3,
)
```

Checks numbers, dates, names, and verifiable claims against the reference provided in the expected response.

---

### `SimulationGoalsCriterion`

Evaluates goal achievement across a full multi-turn conversation. Designed for use with `UserSimulator` only.

- **Config key:** `simulation_goals` or `conversation_goals`
- **Scoring:** `achieved_goals / total_goals`

```python
config = {"simulation_goals": CriterionConfig(threshold=0.8)}
```

Receives the full transcript (set by `UserSimulator`) and evaluates which conversation goals were achieved.

---

## Composite Criteria

### `CompositeCriterion`

Combines multiple sub-criteria with AND/OR logic.

```python
from agentflow.evaluation import CompositeCriterion, ToolNameMatchCriterion, ExactMatchCriterion

# AND logic (require_all=True): score = min(sub_scores)
criterion = CompositeCriterion(
    criteria=[
        ToolNameMatchCriterion(),
        ExactMatchCriterion(),
    ],
    require_all=True,
)

# OR logic (require_all=False): score = max(sub_scores)
criterion = CompositeCriterion(
    criteria=[
        ToolNameMatchCriterion(),
        ExactMatchCriterion(),
    ],
    require_all=False,
)
```

### `WeightedCriterion`

Computes weighted average of sub-criteria.

```python
from agentflow.evaluation import WeightedCriterion, ToolNameMatchCriterion, ResponseMatchCriterion

criterion = WeightedCriterion(
    criteria_weights=[
        (ToolNameMatchCriterion(), 0.3),
        (ResponseMatchCriterion(), 0.7),
    ],
)
```

Score formula:

$$\text{score} = \frac{\sum w_i \cdot s_i}{\sum w_i}$$

---

## CriterionConfig Reference

Configuration for individual criteria.

```python
class CriterionConfig(BaseModel):
    threshold: float = 0.8           # Pass/fail threshold
    match_type: MatchType = MatchType.EXACT  # For trajectory criteria
    judge_model: str = "gemini-2.5-flash"    # For LLM criteria
    num_samples: int = 3             # Majority voting samples
    rubrics: list[Rubric] = []       # For rubric-based criterion
    check_args: bool = False         # For trajectory criteria
    enabled: bool = True             # Enable/disable
```

**Factory Methods:**

| Method | Parameters | Description |
|---|---|---|
| `tool_name_match` | `threshold=1.0` | Tool name matching |
| `trajectory` | `threshold=1.0, match_type=EXACT, check_args=False` | Tool sequence matching |
| `node_order` | `threshold=1.0, match_type=EXACT` | Node visit order matching |
| `rouge_match` | `threshold=0.5` | ROUGE-1 F1 token-overlap (no LLM) |
| `response_match` | `threshold=0.8, judge_model=..., num_samples=3` | LLM-based semantic matching |
| `contains_keywords` | `keywords=[...], threshold=1.0` | Keyword presence check |
| `llm_judge` | `threshold=0.8, judge_model=..., num_samples=3` | LLM judge |
| `rubric_based` | `rubrics=[...], threshold=0.8, judge_model=...` | Custom rubric scoring |
| `factual_accuracy` | `threshold=0.8, judge_model=..., num_samples=3` | Factual verification |
| `hallucination` | `threshold=0.8, judge_model=..., num_samples=3` | Groundedness check |
| `safety` | `threshold=0.8, judge_model=..., num_samples=3` | Safety evaluation |

---

## CriterionResult

Every criterion returns a `CriterionResult`:

```python
class CriterionResult(BaseModel):
    criterion: str         # Criterion name
    score: float           # 0.0 to 1.0
    passed: bool           # score >= threshold
    threshold: float       # Configured threshold
    details: dict          # Criterion-specific details
    error: str | None      # Error message if evaluation failed
```

Access the human-readable reason:

```python
result = await criterion.evaluate(actual, expected)
print(result.score)      # 0.85
print(result.passed)     # True
print(result.reason)     # "Matched 85% of expected tools..."
print(result.details)    # {"expected_names": [...], "actual_names": [...]}
```

---

## Writing Custom Criteria

See [Advanced Topics](advanced.md#custom-criteria) for how to implement your own criterion.
