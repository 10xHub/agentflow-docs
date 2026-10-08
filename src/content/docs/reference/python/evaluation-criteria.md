---
title: Evaluation criteria
description: "Signatures, parameters, and behaviour of every evaluation criterion class"
section: Reference
group: "Python library"
order: 280
label: Evaluation criteria
updated: "2026-10-08"
---

Every criterion is a class that scores one agent run between 0.0 and 1.0 and compares it to a threshold. This page lists each class with its report name, constructor parameters, defaults, scoring rule and `details` keys, from deterministic checks to LLM-judged and custom criteria.

Two related pages cover the layers above:

- [Evaluation](/docs/reference/python/evaluation): `AgentEvaluator`, `EvalSet`, `EvalCase`, and reporters.
- [Criteria (concepts)](/docs/testing/criteria): choosing thresholds and configuring criteria through `CriterionConfig` factory methods.

You only need the classes directly when you are writing a custom criterion,
composing criteria by hand, or calling one outside `AgentEvaluator`. In the examples below, `execution` and `case` stand for the `ExecutionResult` and `EvalCase` that `AgentEvaluator` builds for each case.

## Import paths

All criteria, configuration types and `LLMCallerMixin` import from `tenxgraph.qa.evaluation`. `TemplatedLLMCriterion` and `CRITERIA_REGISTRY` import only from the `criteria` submodule.

```python title="imports.py"
from tenxgraph.qa.evaluation import (
    BaseCriterion,
    SyncCriterion,
    CompositeCriterion,
    WeightedCriterion,
    ExactMatchCriterion,
    ContainsKeywordsCriterion,
    ResponseMatchCriterion,
    RougeMatchCriterion,
    LLMJudgeCriterion,
    RubricBasedCriterion,
    FactualAccuracyCriterion,
    HallucinationCriterion,
    SafetyCriterion,
    SimulationGoalsCriterion,
    TrajectoryMatchCriterion,
    NodeOrderMatchCriterion,
    ToolNameMatchCriterion,
    CriterionConfig,
    MatchType,
    Rubric,
    LLMCallerMixin,
)

# Only in the criteria submodule
from tenxgraph.qa.evaluation.criteria import CRITERIA_REGISTRY, TemplatedLLMCriterion
```

The criterion classes also live under `tenxgraph.qa.evaluation.criteria`. `CRITERIA_REGISTRY` is a dict mapping every criterion name (friendly and legacy) to its class; `AgentEvaluator` uses it to instantiate criteria by name. `TemplatedLLMCriterion` and `LLMCallerMixin` are the building blocks for custom LLM-based criteria.

---

## Which criterion do I want?

| If you want to check |  Use | Calls an LLM |
|---|---|---|
| The response is byte-for-byte the expected string | `ExactMatchCriterion` | no |
| Specific words appear in the response | `ContainsKeywordsCriterion` | no |
| Word overlap with the expected answer | `RougeMatchCriterion` | no |
| The answer means the same thing, however it is worded | `ResponseMatchCriterion` | yes |
| Overall answer quality against the expected answer | `LLMJudgeCriterion` | yes |
| Your own written grading rules | `RubricBasedCriterion` | yes |
| Facts, numbers, dates and names are correct | `FactualAccuracyCriterion` | yes |
| Claims are grounded in tool results / provided context | `HallucinationCriterion` | yes |
| The response is harmless and policy-safe | `SafetyCriterion` | yes |
| The right tools were called, in the right order | `TrajectoryMatchCriterion` | no |
| The right tools were called, ignoring arguments | `ToolNameMatchCriterion` | no |
| The graph routed through the right nodes | `NodeOrderMatchCriterion` | no |
| Several criteria as one AND / OR gate | `CompositeCriterion` | depends |
| Several criteria averaged by importance | `WeightedCriterion` | depends |
| A custom rule of your own | subclass `BaseCriterion` / `SyncCriterion` | your choice |

---

## Common interface

Every criterion derives from `BaseCriterion`.

```python
from tenxgraph.qa.evaluation import BaseCriterion, CriterionConfig

criterion = SomeCriterion(config=CriterionConfig(threshold=0.9))
result = await criterion.evaluate(execution_result, eval_case)  # CriterionResult
```

### `BaseCriterion.__init__`

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `CriterionConfig \| None` | `None` | Threshold, judge model, match type and friends. `None` builds a default `CriterionConfig()`. |

### Members

| Member | Kind | Description |
|---|---|---|
| `name` | class attr `str` | Criterion key written into `CriterionResult.criterion` and `EvalSummary.criterion_stats`. |
| `description` | class attr `str` | Human-readable description. |
| `config` | attr `CriterionConfig` | The active configuration. |
| `threshold` | property `float` | Shortcut for `config.threshold`. |
| `is_enabled` | property `bool` | Shortcut for `config.enabled`. |
| `evaluate` | **async** `(actual: ExecutionResult, expected: EvalCase) -> CriterionResult` | Abstract. Scores one case. |
| `validate_config` | `() -> list[str]` | Returns config error strings; empty list means valid. |

`evaluate()` is `async` on **every** criterion, including the deterministic ones.
`SyncCriterion` runs its own synchronous implementation inside it.

### Configuration

All criteria are configured with the same `CriterionConfig` model. Its fields and
factory methods are documented in
[Criteria (concepts)](/docs/testing/criteria#criterionconfig-reference).
Each criterion only reads the fields relevant to it, listed per class below.

---

## String and keyword criteria

### `ExactMatchCriterion`

```python
from tenxgraph.qa.evaluation import ExactMatchCriterion
```

`name = "exact_match"`. Compares `actual.actual_response.strip()` against the last
non-empty `expected_final_response` in the case. Score is `1.0` or `0.0`; there is
no partial credit.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `CriterionConfig \| None` | `None` | Only `threshold` and `enabled` are read. |

```python
from tenxgraph.qa.evaluation import ExactMatchCriterion

criterion = ExactMatchCriterion()
result = await criterion.evaluate(execution, case)
print(result.score, result.details["match"])
```

`CriteriaConfig` has no `exact_match` field, so this criterion cannot be turned on
through `EvalConfig.criteria`. Instantiate it directly, or look it up under the
`"exact_match"` key in `CRITERIA_REGISTRY`.

### `ContainsKeywordsCriterion`

```python
from tenxgraph.qa.evaluation import ContainsKeywordsCriterion
```

`name = "contains_keywords"`. Case-insensitive substring search over the final
response. Score is `len(found) / len(keywords)`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `keywords` | `list[str] \| None` | `None` | Keywords to look for. Ignored when `config.keywords` is non-empty. |
| `config` | `CriterionConfig \| None` | `None` | `config.keywords` takes precedence over the `keywords` argument. |

With no keywords from either source the criterion returns `1.0` and a
`{"note": "No keywords specified"}` detail.

```python
from tenxgraph.qa.evaluation import ContainsKeywordsCriterion, CriterionConfig

criterion = ContainsKeywordsCriterion(
    config=CriterionConfig.contains_keywords(
        keywords=["refund", "7 days"],
        threshold=1.0,
    ),
)
```

### `RougeMatchCriterion`

```python
from tenxgraph.qa.evaluation import RougeMatchCriterion
```

`name = "rouge_match"`. ROUGE-1 F1 over lowercased, punctuation-stripped unigram
**sets**. No LLM call. `details` carries `precision`, `recall` and `f1`, plus the
first 500 characters of each response.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `CriterionConfig \| None` | `None` | Only `threshold` and `enabled` are read. |

When the case defines no expected response, the score is `1.0` if the agent also
produced nothing, otherwise `0.5`.

---

## Base classes for custom criteria

### `TemplatedLLMCriterion`

```python
from tenxgraph.qa.evaluation.criteria import TemplatedLLMCriterion
```

`TemplatedLLMCriterion(LLMCallerMixin, BaseCriterion)` is the base class for all LLM-as-judge criteria. It builds a prompt, calls the judge LLM `config.num_samples` times, averages the scores, aggregates extras, and returns a result, handling the sampling loop and error recovery for you.

Subclasses must implement `_build_prompt(actual, expected)` to return a string prompt (the base version raises `NotImplementedError`). Override the hook methods below to customize behaviour:

| Hook | Purpose |
|---|---|
| `_get_skip_result(actual, expected)` | Return a ready result to skip evaluation, or None to proceed. Default: skip if actual response is empty. |
| `_build_prompt(actual, expected)` | Build the judge prompt. Required. |
| `_collect_extras(result_dict)` | Extract criterion-specific fields from one LLM response dict. Default: nothing. |
| `_aggregate_extras(per_sample)` | Merge per-sample extras into the final details dict. Default: nothing. |
| `_build_details(scores, reasonings, extras, final_score)` | Construct the final details dict. Default: samples count plus reasonings. |
| `_run_samples(prompt)` | Call the judge LLM `num_samples` times; returns `(scores, reasonings, per_sample_extras, token_usage)`. |

### `LLMCallerMixin`

```python
from tenxgraph.qa.evaluation import LLMCallerMixin
```

`LLMCallerMixin` provides the shared judge-calling logic for LLM-based criteria. It detects the provider from `self.config.judge_model` and routes to Google or OpenAI, with a fixed fallback otherwise. Both calls use temperature `0.3` and JSON mode.

| Method | Returns |
|---|---|
| `_call_google_json(prompt)` | Calls a Google model and returns `(parsed_json_dict, token_usage)` or None if unavailable. |
| `_call_openai_json(prompt)` | Calls an OpenAI model and returns `(parsed_json_dict, token_usage)` or None if unavailable. |
| `_call_llm_json(prompt)` | Dispatches to the provider-specific method. Falls back to `{"score": 0.5, "reasoning": "No LLM provider available"}` if the provider is unknown or unavailable. |
| `_call_llm_score(prompt)` | Wrapper that returns `(score, reasoning, token_usage)` from the parsed JSON; a missing `score` becomes `0.0`. |

---

## LLM-judged criteria

These six share a base class, `TemplatedLLMCriterion`, which calls the judge model
`config.num_samples` times (default `3`), averages the `score` field of each JSON
reply, and records the combined token usage on `CriterionResult.token_usage`.
Samples that raise are logged and dropped; if every sample fails the criterion
returns a failure result with `error="All LLM samples failed"`. A skipped case (no response to judge) scores `1.0`.

Shared constructor:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `CriterionConfig \| None` | `None` | Reads `threshold` (`0.8`), `judge_model` (`"gemini-2.5-flash"`), `num_samples` (`3`), `api_style` (`"responses"`), and `rubrics` for `RubricBasedCriterion`. |

The judge provider is picked from `judge_model`; set `GOOGLE_GENAI_USE_VERTEXAI=true`
to route Google models through Vertex AI. If no provider can be resolved, each
sample degrades to `score=0.5` with reasoning `"No LLM provider available"`.

### `ResponseMatchCriterion`

```python
from tenxgraph.qa.evaluation import ResponseMatchCriterion
```

`name = "response_match_score"`. Subclass of `LLMJudgeCriterion` with the same
prompt: semantic equivalence between actual and expected response. This is the
recommended default over `RougeMatchCriterion`.

```python
from tenxgraph.qa.evaluation import CriterionConfig, ResponseMatchCriterion

criterion = ResponseMatchCriterion(
    config=CriterionConfig.response_match(threshold=0.8, num_samples=3),
)
result = await criterion.evaluate(execution, case)
print(result.score, result.details["reason"])
```

### `LLMJudgeCriterion`

```python
from tenxgraph.qa.evaluation import LLMJudgeCriterion
```

`name = "final_response_match_v2"`. Asks the judge whether the actual response is
semantically equivalent to the expected one. Skips with score `1.0` when the case
defines no expected final response, or when the agent produced no response.

`details`: `samples`, `individual_scores`, `reasonings`, `judge_model`, `reason`.

### `RubricBasedCriterion`

```python
from tenxgraph.qa.evaluation import RubricBasedCriterion, Rubric
```

`name = "rubric_based_final_response_quality_v1"`. Renders every
`config.rubrics` entry into the judge prompt as `"- {rubric_id}: {content}"`.
Returns `1.0` immediately when `config.rubrics` is empty.

```python
criterion = RubricBasedCriterion(
    config=CriterionConfig.rubric_based(
        rubrics=[
            Rubric(rubric_id="concise", content="Under 100 words.", weight=1.0),
            Rubric(rubric_id="empathetic", content="Acknowledges the complaint.", weight=0.5),
        ],
        threshold=0.8,
    ),
)
```

`details`: `rubrics` (the ids), `scores`, `reasonings`. The `weight` field of `Rubric` is stored but not used in the prompt or the score.

### `FactualAccuracyCriterion`

```python
from tenxgraph.qa.evaluation import FactualAccuracyCriterion
```

`name = "factual_accuracy_v1"`. Reference material is the last expected final
response, falling back to `expected.metadata["reference_facts"]`.

`details`: `is_accurate` (`final_score >= threshold`), `samples`, `reasonings`,
`errors` (de-duplicated across samples).

### `HallucinationCriterion`

```python
from tenxgraph.qa.evaluation import HallucinationCriterion
```

`name = "hallucinations_v1"`. Builds the grounding context from every tool call
result in the execution plus `expected.metadata["context"]`, then asks whether the
response is supported by it. `1.0` is fully grounded.

`details`: `is_grounded`, `samples`, `reasonings`, `hallucinations`.

### `SafetyCriterion`

```python
from tenxgraph.qa.evaluation import SafetyCriterion
```

`name = "safety_v1"`. The judge returns one overall `score` plus per-category
sub-scores for `harmful_content`, `hate_speech`, `privacy`, `misinformation` and
`manipulation`. The criterion score is the average overall score across samples;
the category values are averaged and reported as `category_scores` for triage.

`details`: `is_safe`, `samples`, `reasonings`, `issues`, `category_scores`.

---

## Trajectory criteria

All three are `SyncCriterion` subclasses: deterministic, no API calls. Expected
values come from the `Invocation` entries of the case, concatenated across turns.

### `TrajectoryMatchCriterion`

```python
from tenxgraph.qa.evaluation import TrajectoryMatchCriterion
```

`name = "tool_trajectory_avg_score"`. Compares `actual.tool_calls` against every
`invocation.expected_tool_trajectory`, using `config.match_type` and
`config.check_args`.

| Config field | Default | Effect |
|---|---|---|
| `match_type` | `MatchType.EXACT` | `EXACT`: same tools in the same positions. `IN_ORDER`: expected tools in order, extras allowed. `ANY_ORDER`: expected tools anywhere. |
| `check_args` | `False` | When `True`, tool arguments must also match. An expected `ToolCall` with empty `args` accepts any arguments. |
| `threshold` | `0.8` | Score is the fraction of expected tools matched. |

```python
from tenxgraph.qa.evaluation import CriterionConfig, MatchType, TrajectoryMatchCriterion

criterion = TrajectoryMatchCriterion(
    config=CriterionConfig.trajectory(
        threshold=1.0,
        match_type=MatchType.IN_ORDER,
        check_args=True,
    ),
)
```

With no expected tools, `EXACT` scores `1.0` only if the agent called nothing;
`IN_ORDER` and `ANY_ORDER` score `1.0` unconditionally.

### `NodeOrderMatchCriterion`

```python
from tenxgraph.qa.evaluation import NodeOrderMatchCriterion
```

`name = "node_order_score"`. Same three match modes, applied to
`actual.node_visits` versus `invocation.expected_node_order`. Reads `match_type`
and `threshold`; `check_args` is not used.

```python
criterion = NodeOrderMatchCriterion(
    config=CriterionConfig.node_order(threshold=1.0, match_type=MatchType.IN_ORDER),
)
```

### `ToolNameMatchCriterion`

```python
from tenxgraph.qa.evaluation import ToolNameMatchCriterion
```

`name = "tool_name_match_score"`. Multiset comparison of tool **names** only, order
and arguments ignored. Score is matched names over expected names. When nothing is
expected, the score is `1.0` if the agent called no tools and `0.5` if it did.

---

## Composing criteria

### `CompositeCriterion`

```python
from tenxgraph.qa.evaluation import CompositeCriterion
```

`name = "composite_criterion"`. Runs every sub-criterion and combines the scores.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `criteria` | `list[BaseCriterion]` | required | Sub-criteria to run, in order. |
| `require_all` | `bool` | `True` | `True` (AND) takes the **minimum** score; `False` (OR) takes the **maximum**. |
| `config` | `CriterionConfig \| None` | `None` | Supplies the threshold applied to the combined score. |

```python
from tenxgraph.qa.evaluation import (
    CompositeCriterion,
    ContainsKeywordsCriterion,
    CriterionConfig,
    ToolNameMatchCriterion,
)

criterion = CompositeCriterion(
    criteria=[
        ToolNameMatchCriterion(),
        ContainsKeywordsCriterion(keywords=["refund"]),
    ],
    require_all=True,
    config=CriterionConfig(threshold=1.0),
)
```

`details` contains `sub_results` (each sub-result serialised) and `require_all`.

### `WeightedCriterion`

```python
from tenxgraph.qa.evaluation import WeightedCriterion
```

`name = "weighted_criterion"`. Weighted average of the sub-scores;
`sum(score * weight) / sum(weight)`. Weights need not sum to 1.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `criteria_weights` | `list[tuple[BaseCriterion, float]]` | required | `(criterion, weight)` pairs. |
| `config` | `CriterionConfig \| None` | `None` | Supplies the threshold applied to the weighted score. |

```python
criterion = WeightedCriterion(
    criteria_weights=[
        (ToolNameMatchCriterion(), 0.3),
        (ResponseMatchCriterion(), 0.7),
    ],
    config=CriterionConfig(threshold=0.8),
)
```

An empty `criteria_weights` (or total weight `0`) scores `0.0`.

---

## Writing your own criterion

### `SyncCriterion`

Subclass `SyncCriterion` when your rule is pure computation. Implement
`evaluate_sync()`; the inherited async `evaluate()` wraps it, so the criterion drops
straight into `AgentEvaluator`.

```python title="max_length.py"
from tenxgraph.qa.evaluation import SyncCriterion


class MaxLengthCriterion(SyncCriterion):
    name = "max_length"
    description = "Response must stay under 500 characters"

    def evaluate_sync(self, actual, expected):
        length = len(actual.actual_response)
        return self._result(
            1.0 if length <= 500 else 0.0,
            {"length": length},
        )
```

Subclass `BaseCriterion` instead when you need to await something inside the rule,
and implement the async `evaluate()` directly:

```python title="slow_check.py"
import asyncio

from tenxgraph.qa.evaluation import BaseCriterion


class PoliteCriterion(BaseCriterion):
    name = "polite"
    description = "Response must contain a courtesy word"

    async def evaluate(self, actual, expected):
        await asyncio.sleep(0)  # replace with a real async call
        ok = "please" in actual.actual_response.lower()
        return self._result(1.0 if ok else 0.0, {"polite": ok})
```

Two protected helpers from `BaseCriterion` build results for you:

| Helper | Returns |
|---|---|
| `self._result(score, details=None, token_usage=None)` | Passing/failing result judged against `self.threshold`. |
| `self._failure(error)` | Error result with `score=0.0`, `passed=False`. |

To make a custom criterion resolvable by name, add it to the registry:

```python
from tenxgraph.qa.evaluation.criteria import CRITERIA_REGISTRY

CRITERIA_REGISTRY["max_length"] = MaxLengthCriterion
```

`CriteriaConfig` forbids unknown fields, so `EvalConfig.criteria` cannot enable a registry-only criterion. Call `criterion.evaluate()` yourself or compose it with `CompositeCriterion` or `WeightedCriterion`.

---

## Simulation goals (UserSimulator only)

### `SimulationGoalsCriterion`

```python
from tenxgraph.qa.evaluation import SimulationGoalsCriterion
```

`name = "simulation_goals"`. It evaluates whether specific goals were achieved across a full multi-turn conversation. It is designed for use with `UserSimulator` and expects `actual.actual_response` to contain the full conversation transcript, not just the agent's final reply. The goals are read from the last non-empty expected final response of the case.

Score is the number of goals achieved divided by the total number of goals (0.0 to 1.0).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `config` | `CriterionConfig \| None` | `None` | Only `threshold`, `judge_model`, and `num_samples` are read. `num_samples` is ignored; only one call is made for goal evaluation. |

```python
from tenxgraph.qa.evaluation import SimulationGoalsCriterion, CriterionConfig

criterion = SimulationGoalsCriterion(
    config=CriterionConfig(
        judge_model="gemini-2.5-flash",
        threshold=0.8,
    ),
)
result = await criterion.evaluate(execution, case)
print(result.score, result.details["achieved_goals"], result.details["unachieved_goals"])
```

`details`: `achieved_goals` (list of strings), `unachieved_goals` (list of strings), `reasoning`, `reason` (same text), `judge_model`.

When the case defines no goals (empty expected final response), the criterion returns `1.0` with a `note` detail saying no goals were defined.

---

## Common errors

| Error / symptom | Cause | Fix |
|---|---|---|
| `TypeError: Can't instantiate abstract class ... evaluate` | Subclassed `BaseCriterion` without an async `evaluate()`, or `SyncCriterion` without `evaluate_sync()`. | Implement the abstract method. |
| `RuntimeWarning: coroutine 'evaluate' was never awaited` | `evaluate()` is async on every criterion, including the deterministic ones. | `await criterion.evaluate(...)`. |
| Score is exactly `0.5` with reasoning `"No LLM provider available"` | The judge model could not be resolved to a configured provider. | Install the provider extra and set its API key; set `GOOGLE_GENAI_USE_VERTEXAI=true` for Vertex-only projects. |
| `CriterionResult.error == "All LLM samples failed"` | Every judge call raised. | Check the `tenxgraph.evaluation` logger for the per-sample warnings. |
| `contains_keywords` always scores `1.0` | Neither `keywords=` nor `config.keywords` was set. | Pass `CriterionConfig.contains_keywords(keywords=[...])`. |
| `ValueError: Unknown criterion field: 'exact_match'` | `EvalConfig.enable_criterion()` only accepts `CriteriaConfig` field names, and there is none for it. | Instantiate `ExactMatchCriterion` directly. |
| `TrajectoryMatchCriterion` fails on correct-looking runs | `MatchType.EXACT` rejects extra tool calls. | Switch to `MatchType.IN_ORDER` or `ANY_ORDER`. |
| `check_args=True` never matches | Expected `ToolCall.args` must equal the actual args exactly. | Leave `args={}` to accept any arguments for that call. |
