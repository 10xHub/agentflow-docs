---
title: Eval Presets & Configuration — Testing and evaluation
sidebar_label: Presets & Config
description: Ready-to-use EvalPresets and how to build custom EvalConfig — tool_usage, response_quality, conversation_flow, comprehensive, safety_check, and quick_check presets.
keywords:
  - EvalPresets
  - EvalConfig
  - agentflow evaluation config
  - tool usage eval
  - response quality eval
  - safety eval
  - python ai agent framework
---

# Presets & Configuration

`EvalConfig` defines which criteria run and at what thresholds. `EvalPresets` provides ready-made configs so you can get meaningful results without writing config from scratch.

---

## Built-in presets

All presets are factory class methods on `EvalPresets`. Every preset that calls an LLM accepts an optional `judge_model` parameter (default: `"gemini-2.5-flash"`).

### quick_check — Fastest, no LLM

Uses ROUGE-1 token overlap only. No API calls, instant feedback. Good for a smoke test during active development.

```python
from agentflow.qa.evaluation import EvalPresets

config = EvalPresets.quick_check()
```

Criteria included:
- `rouge_match` (threshold 0.5)

---

### tool_usage — Verify tool selection

Checks that the agent called the right tools with the right arguments. No LLM required.

```python
config = EvalPresets.tool_usage(
    threshold=1.0,
    strict=True,      # EXACT match; set False for IN_ORDER
    check_args=True,
)
```

Criteria included:
- `tool_name_match_score` — tool names match
- `tool_trajectory_avg_score` — tool sequence matches

**When to use:** any agent that must call specific tools (weather, search, database lookups). This is the most common first-pass eval.

---

### response_quality — Semantic accuracy

Uses an LLM to evaluate whether the agent's response is correct and relevant.

```python
config = EvalPresets.response_quality(
    threshold=0.7,
    use_llm_judge=True,
    judge_model="gemini-2.5-flash",
)
```

Criteria included:
- `response_match_score` — semantic match with expected response
- `llm_judge` — overall quality score (when `use_llm_judge=True`)

**When to use:** Q&A agents, FAQ bots, or any agent where response accuracy matters but exact wording varies.

---

### conversation_flow — Multi-turn quality

Validates both response quality and tool sequencing in multi-turn conversations.

```python
config = EvalPresets.conversation_flow(
    threshold=0.8,
    judge_model="gemini-2.5-flash",
)
```

Criteria included:
- `response_match_score` — semantic match (IN_ORDER tool matching)
- `tool_trajectory_avg_score` — tool sequence with IN_ORDER matching

**When to use:** agents with multi-turn dialogue where the conversation follows a predictable flow.

---

### safety_check — Safety and hallucination

Focused on what the agent outputs rather than whether it answers correctly.

```python
config = EvalPresets.safety_check(
    threshold=0.8,
    judge_model="gemini-2.5-flash",
)
```

Criteria included:
- `hallucinations_v1` — groundedness check
- `safety_v1` — harmful content, hate speech, privacy, misinformation, manipulation

**When to use:** customer-facing agents, regulated industries, or any agent you are about to put in production.

---

### comprehensive — All criteria

Runs every available criterion. Use this before a major release or for a thorough regression check.

```python
config = EvalPresets.comprehensive(
    threshold=0.8,
    use_llm_judge=True,
    judge_model="gemini-2.5-flash",
)
```

Criteria included (no-LLM):
- `tool_name_match_score`
- `tool_trajectory_avg_score`
- `rouge_match`

Criteria included (LLM-judge):
- `llm_judge`
- `factual_accuracy_v1`
- `hallucinations_v1`
- `safety_v1`

Note: `contains_keywords` is not included in `comprehensive` because keywords are domain-specific. Add it manually if needed (see [Criteria — contains_keywords](./criteria.md#contains_keywords)).

---

### custom — Build from parameters

`EvalPresets.custom()` lets you enable exactly the criteria you need by passing threshold values. Any criterion whose threshold is `None` is excluded.

```python
config = EvalPresets.custom(
    response_threshold=0.7,
    tool_threshold=1.0,
    llm_judge_threshold=None,           # excluded
    hallucination_threshold=0.8,
    safety_threshold=0.8,
    factual_accuracy_threshold=None,    # excluded
    tool_match_type=MatchType.IN_ORDER,
    check_tool_args=True,
    judge_model="gpt-4o",
)
```

---

### combine — Merge presets

`EvalPresets.combine()` merges multiple configs. Later configs overwrite earlier ones when keys conflict.

```python
config = EvalPresets.combine(
    EvalPresets.tool_usage(threshold=1.0),
    EvalPresets.safety_check(threshold=0.8),
)
```

---

## EvalConfig built-in presets

`EvalConfig` also ships three class-method presets:

```python
from agentflow.qa.evaluation import EvalConfig

config = EvalConfig.default()   # tool trajectory (EXACT) + response match (ROUGE)
config = EvalConfig.strict()    # EXACT trajectory with args + high-threshold LLM judge
config = EvalConfig.relaxed()   # IN_ORDER trajectory + lower response threshold
```

| Preset | Trajectory | Response | Extra |
|---|---|---|---|
| `default()` | EXACT, threshold 1.0 | ROUGE, threshold 0.8 | — |
| `strict()` | EXACT + args, threshold 1.0 | LLM judge, threshold 0.9 | LLM judge, 5 samples |
| `relaxed()` | IN_ORDER, threshold 0.8 | LLM judge, threshold 0.6 | — |

---

## Save and load config

```python
# Save to JSON
config.to_file("eval_config.json")

# Load from JSON
config = EvalConfig.from_file("eval_config.json")
```

---

## Building a custom EvalConfig from scratch

```python
from agentflow.qa.evaluation import EvalConfig, CriterionConfig, MatchType, Rubric

config = EvalConfig(
    criteria={
        # No-LLM: tool correctness
        "tool_trajectory_avg_score": CriterionConfig.trajectory(
            threshold=1.0,
            match_type=MatchType.EXACT,
            check_args=True,
        ),

        # No-LLM: response overlap
        "rouge_match": CriterionConfig.rouge_match(threshold=0.5),

        # LLM: semantic accuracy
        "response_match_score": CriterionConfig.response_match(
            threshold=0.8,
            judge_model="gemini-2.5-flash",
            num_samples=3,
        ),

        # LLM: hallucination
        "hallucinations_v1": CriterionConfig.hallucination(threshold=0.9),

        # LLM: domain-specific rubric
        "tone_check": CriterionConfig.rubric_based(
            rubrics=[
                Rubric(
                    rubric_id="professional_tone",
                    content=(
                        "The response must use professional, formal language. "
                        "Avoid colloquialisms and slang."
                    ),
                    weight=1.0,
                )
            ],
            threshold=0.8,
        ),

        # Keyword check
        "has_disclaimer": CriterionConfig.contains_keywords(
            keywords=["consult a professional", "not financial advice"],
            threshold=1.0,
        ),
    },
    parallel=True,
    max_concurrency=4,
    timeout=120.0,
)
```

### Add rubrics to an existing config

```python
from agentflow.qa.evaluation import Rubric

config = config.with_rubrics([
    Rubric(rubric_id="concise", content="Response must be under 50 words.", weight=1.0),
])
```

---

## Choosing criteria for your use case

| Agent type | Recommended criteria |
|---|---|
| Tool-calling (search, API) | `tool_usage` preset |
| Q&A / FAQ | `response_quality` preset |
| RAG / retrieval | `response_quality` + `hallucinations_v1` |
| Customer support | `response_quality` + `safety_check` |
| Multi-turn dialogue | `conversation_flow` preset |
| Pre-production gate | `comprehensive` preset |
| CI fast check | `quick_check` preset |

Start fast (no-LLM criteria) and add LLM-judge criteria incrementally as your eval suite matures.

---

## Next steps

- [Reports](./reports.md) — how scores are presented in HTML, JSON, and JUnit XML
- [Criteria reference](./criteria.md) — full details on each criterion
- [Eval sets](./eval-set.md) — building test cases
