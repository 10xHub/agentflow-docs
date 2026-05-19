---
title: Evaluation Criteria — AgentFlow Evaluation
sidebar_label: Criteria
description: Reference for all eight AgentFlow evaluation criteria — tool matching, trajectory, ROUGE, semantic response, LLM-as-judge, factual accuracy, hallucination, and safety.
keywords:
  - agentflow criteria
  - CriterionConfig
  - MatchType
  - LLM judge
  - hallucination detection
  - factual accuracy
  - trajectory matching
  - python ai agent framework
---

# Evaluation Criteria

Each `EvalCase` is scored against one or more criteria. A criterion receives the agent's execution trajectory and final response, then returns a score between `0.0` (fail) and `1.0` (pass). A case passes when every enabled criterion meets its threshold.

AgentFlow ships eight built-in criteria split into two groups: **no-LLM** (deterministic, free, instant) and **LLM-judge** (semantic, costs API calls).

---

## No-LLM criteria

These criteria do not call any LLM. They are deterministic, free, and run in milliseconds. Use them as a first line of defence.

### tool_name_match_score — Tool name matching

Checks that the set of tool names called by the agent matches the expected set. Order is not considered; only presence.

```python
from agentflow.qa.evaluation import CriterionConfig

CriterionConfig.tool_name_match(threshold=1.0)
```

- Score `1.0` — all expected tools were called, no unexpected tools
- Score `0.0` — none of the expected tools were called
- Partial scores — proportional to overlap

**Use when** you want a strict check that the right tools were selected but do not care about order or arguments.

---

### tool_trajectory_avg_score — Tool sequence matching

Checks that the sequence of tool calls matches the expected sequence. Supports three match modes controlled by `MatchType`.

```python
CriterionConfig.trajectory(
    threshold=1.0,
    match_type=MatchType.EXACT,   # or IN_ORDER, ANY_ORDER
    check_args=False,
)
```

#### MatchType

| Value | Meaning |
|---|---|
| `EXACT` | Same tools, same order, same count. Extra or missing tools fail the case. |
| `IN_ORDER` | Expected tools must appear in order; extra tools at any position are allowed. |
| `ANY_ORDER` | All expected tools must appear; order and extras do not matter. |

#### Argument checking

When `check_args=True`, the criterion also compares the arguments passed to each tool against the `args` defined in `ToolCall`. This is off by default because slight argument variation (different key ordering, extra optional keys) is common and often acceptable.

```python
CriterionConfig.trajectory(
    threshold=1.0,
    match_type=MatchType.EXACT,
    check_args=True,   # verify arguments as well
)
```

---

### node_order_match_score — Node visit order

Checks that the graph visited nodes in the expected sequence. Useful for verifying that routing logic is correct (e.g., `MAIN → TOOL → MAIN → END`).

```python
CriterionConfig.node_order(
    threshold=1.0,
    match_type=MatchType.EXACT,
)
```

The same `MatchType` values apply as for trajectory matching.

---

### rouge_match — ROUGE-1 token overlap

Measures textual similarity between the actual and expected response using ROUGE-1 F1 (token overlap). No API calls — instant and free.

```python
CriterionConfig.rouge_match(threshold=0.5)
```

ROUGE-1 counts shared unigrams. A score of `0.5` means roughly half the words overlap. This is a useful fast check during development. For paraphrase-aware matching, use `response_match_score` (LLM-based) instead.

**Typical thresholds:**

| Scenario | Threshold |
|---|---|
| Loose sanity check | 0.3 – 0.5 |
| Moderate similarity | 0.5 – 0.7 |
| Near-verbatim | 0.7+ |

---

### contains_keywords — Keyword presence

Checks that a list of required keywords appear in the actual response.

```python
CriterionConfig.contains_keywords(
    keywords=["refund", "7 days", "policy"],
    threshold=1.0,   # fraction of keywords that must be present
)
```

- `threshold=1.0` — all keywords must be present
- `threshold=0.8` — 80% of keywords must be present

This criterion is not included in any preset because keywords are domain-specific. Add it manually to `EvalConfig.criteria`:

```python
from agentflow.qa.evaluation import EvalConfig, CriterionConfig

config = EvalConfig(
    criteria={
        "contains_keywords": CriterionConfig.contains_keywords(
            keywords=["refund", "policy"],
            threshold=1.0,
        ),
    }
)
```

---

## LLM-judge criteria

These criteria send the agent's response (and optionally the context) to a language model for scoring. They are slower and cost API credits, but catch semantic errors that token-overlap metrics miss.

The default judge model is `gemini-2.5-flash`. Override per criterion with `judge_model="gpt-4o"`.

---

### response_match_score — Semantic response matching

Uses an LLM to judge whether the actual response is semantically equivalent to the expected response. Handles paraphrasing and differently-worded but correct answers.

```python
CriterionConfig.response_match(
    threshold=0.8,
    judge_model="gemini-2.5-flash",
    num_samples=3,
)
```

- `num_samples` — the judge is called this many times; the final score is the average. This reduces noise from non-deterministic LLM responses.

**When to use:** when you want to verify the agent answered correctly without requiring an exact match. For example, "The capital of France is Paris" and "Paris is France's capital" should both pass.

---

### llm_judge — Overall quality scoring

Asks the LLM to assign a quality score (0–1) based on relevance, helpfulness, and coherence. Does not compare against an expected response.

```python
CriterionConfig.llm_judge(
    threshold=0.8,
    judge_model="gemini-2.5-flash",
    num_samples=3,
)
```

**When to use:** for open-ended tasks where a fixed expected response is not practical. Combine with other criteria — `llm_judge` alone is too permissive.

---

### factual_accuracy_v1 — Factual correctness

Checks whether all stated facts in the response are correct — numbers, dates, names, and verifiable claims.

```python
CriterionConfig.factual_accuracy(
    threshold=0.8,
    judge_model="gemini-2.5-flash",
    num_samples=3,
)
```

The judge looks for factual errors in the response relative to the query context. A score of `1.0` means all facts are correct.

**When to use:** for agents that report real-world data (stock prices, weather, historical facts, medical information).

---

### hallucinations_v1 — Groundedness detection

Checks whether the response is grounded in information the agent actually retrieved (tool results, provided context). A score of `1.0` means fully grounded; `0.0` means the agent invented information.

```python
CriterionConfig.hallucination(
    threshold=0.8,
    judge_model="gemini-2.5-flash",
    num_samples=3,
)
```

The evaluator provides both the tool results collected during execution and the final response to the judge. The judge then assesses whether claims in the response are supported by the evidence.

**When to use:** for RAG agents, research agents, or any agent that presents retrieved information as facts.

---

### safety_v1 — Safety scoring

Scores the response across five safety dimensions:

| Dimension | What it checks |
|---|---|
| `harmful_content` | Instructions or encouragement for harm |
| `hate_speech` | Discriminatory or dehumanising language |
| `privacy` | Exposure of personal information |
| `misinformation` | Deliberately false or misleading claims |
| `manipulation` | Psychological manipulation or deception |

The overall score is the **minimum** across all five dimensions. A single unsafe category fails the criterion.

```python
CriterionConfig.safety(
    threshold=0.8,
    judge_model="gemini-2.5-flash",
    num_samples=3,
)
```

**When to use:** for any customer-facing agent, especially in regulated industries (healthcare, finance, legal).

---

### rubric_based — Custom rubric scoring

Define your own evaluation criteria as free-text rubrics. The LLM scores the response against each rubric and returns a weighted average.

```python
from agentflow.qa.evaluation import CriterionConfig, Rubric

CriterionConfig.rubric_based(
    rubrics=[
        Rubric(
            rubric_id="concise",
            content="The response must be under 100 words and get to the point immediately.",
            weight=1.0,
        ),
        Rubric(
            rubric_id="empathetic",
            content="The response must acknowledge the user's frustration before offering a solution.",
            weight=0.5,
        ),
    ],
    threshold=0.8,
    judge_model="gemini-2.5-flash",
)
```

The final score is the weighted average of all rubric scores. `weight` controls relative importance — higher weight means the rubric has more influence on the outcome.

**When to use:** for product-specific quality requirements that generic criteria cannot express (tone, brand voice, compliance language, format requirements).

---

## CriterionConfig reference

All criteria are configured with `CriterionConfig`. You can also construct it directly instead of using the factory class methods:

```python
from agentflow.qa.evaluation import CriterionConfig, MatchType

config = CriterionConfig(
    threshold=0.8,
    match_type=MatchType.IN_ORDER,
    judge_model="gpt-4o",
    num_samples=3,
    rubrics=[],
    keywords=[],
    check_args=False,
    enabled=True,
)
```

| Field | Default | Description |
|---|---|---|
| `threshold` | `0.8` | Minimum score to pass (0.0 – 1.0) |
| `match_type` | `EXACT` | Match type for trajectory criteria |
| `judge_model` | `gemini-2.5-flash` | LLM used for judge-based criteria |
| `num_samples` | `3` | Number of judge calls (average reduces noise) |
| `rubrics` | `[]` | Custom rubrics for `rubric_based` |
| `keywords` | `[]` | Required keywords for `contains_keywords` |
| `check_args` | `False` | Verify tool arguments in trajectory matching |
| `enabled` | `True` | Set to `False` to disable without removing |

---

## EvalConfig — combining criteria

Wrap criteria in an `EvalConfig` to run them together:

```python
from agentflow.qa.evaluation import EvalConfig, CriterionConfig, MatchType

config = EvalConfig(
    criteria={
        "tool_trajectory_avg_score": CriterionConfig.trajectory(
            threshold=1.0,
            match_type=MatchType.EXACT,
        ),
        "rouge_match": CriterionConfig.rouge_match(threshold=0.5),
        "hallucinations_v1": CriterionConfig.hallucination(threshold=0.8),
    },
    parallel=True,
    max_concurrency=4,
    timeout=120.0,
)
```

| EvalConfig field | Default | Description |
|---|---|---|
| `criteria` | `{}` | Dict of criterion key → `CriterionConfig` |
| `parallel` | `False` | Run cases concurrently |
| `max_concurrency` | `4` | Max parallel cases when `parallel=True` |
| `timeout` | `300.0` | Seconds per case before timeout |
| `verbose` | `False` | Extra logging during evaluation |
| `mock_mode` | `False` | Skip actual execution (for config testing) |

---

## Disabling criteria

```python
config.disable_criterion("rouge_match")   # sets enabled=False
config.enable_criterion("rouge_match")    # re-enables with existing config
config.enable_criterion("rouge_match", CriterionConfig.rouge_match(0.4))  # re-enable with new config
```

---

## Next steps

- [Presets](./presets.md) — ready-made configs for common scenarios
- [Reports](./reports.md) — how scores are reported
- [Eval sets](./eval-set.md) — building test cases
