# Evaluation Criteria

Criteria are the rules used to evaluate agent behavior. This page covers all available criteria and how to use them.

## Overview

Agentflow provides three categories of evaluation criteria:

1. **Deterministic** - Fast, rule-based evaluation (trajectory matching, exact match)
2. **Statistical** - Text similarity metrics (ROUGE, cosine similarity)
3. **LLM-as-Judge** - Use an LLM to evaluate quality (semantic matching, rubrics)

## Base Criterion Interface

All criteria inherit from `BaseCriterion`:

```python
from agentflow.evaluation import BaseCriterion, CriterionResult

class MyCustomCriterion(BaseCriterion):
    name = "my_criterion"
    description = "Evaluates something custom"

    async def evaluate(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        # Your evaluation logic
        score = self._compute_score(actual, expected)
        
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            details={"custom_data": "..."},
        )
```

---

## Trajectory Criteria

### TrajectoryMatchCriterion

Validates that the agent called the expected tools in the expected order.

```python
from agentflow.evaluation import (
    TrajectoryMatchCriterion,
    CriterionConfig,
    MatchType,
)

criterion = TrajectoryMatchCriterion(
    config=CriterionConfig(
        threshold=0.8,
        match_type=MatchType.IN_ORDER,
    )
)
```

**Match Types:**

| Type | Description | Example |
|------|-------------|---------|
| `EXACT` | All tools in exact order, no extras | Expected: [A, B] → Actual: [A, B] ✓ |
| `IN_ORDER` | All expected tools in order, extras allowed | Expected: [A, B] → Actual: [A, X, B] ✓ |
| `ANY_ORDER` | All expected tools present, any order | Expected: [A, B] → Actual: [B, A] ✓ |

**Configuration via EvalConfig:**

```python
config = EvalConfig(
    criteria={
        "trajectory_match": CriterionConfig(
            enabled=True,
            threshold=1.0,
            match_type=MatchType.ANY_ORDER,
        ),
    }
)
```

### ToolNameMatchCriterion

Simpler version that only checks tool names (ignores arguments).

```python
from agentflow.evaluation import ToolNameMatchCriterion

criterion = ToolNameMatchCriterion(
    config=CriterionConfig(threshold=0.9)
)
```

Useful when:
- Tool arguments may vary (e.g., different date formats)
- You only care about which tools are called, not how

---

## Response Criteria

### ResponseMatchCriterion

Uses ROUGE scores to measure text similarity.

```python
from agentflow.evaluation import ResponseMatchCriterion

criterion = ResponseMatchCriterion(
    config=CriterionConfig(threshold=0.7)
)
```

**How it works:**
1. Extracts text from actual and expected responses
2. Computes ROUGE-1 F1 score (unigram overlap)
3. Passes if score >= threshold

**Best for:**
- Responses that should contain specific keywords
- When exact wording doesn't matter but content does
- Fast, deterministic evaluation

### ExactMatchCriterion

Checks for exact string match (case-insensitive by default).

```python
from agentflow.evaluation import ExactMatchCriterion

criterion = ExactMatchCriterion()
```

**Use cases:**
- Deterministic outputs (numbers, codes, IDs)
- Strict format requirements
- Unit test-style assertions

### ContainsKeywordsCriterion

Checks if response contains specific keywords.

```python
from agentflow.evaluation import ContainsKeywordsCriterion

criterion = ContainsKeywordsCriterion(
    keywords=["temperature", "weather", "forecast"],
    require_all=False,  # At least one keyword
    config=CriterionConfig(threshold=0.5),
)
```

**Parameters:**
- `keywords`: List of words/phrases to find
- `require_all`: If True, all keywords must be present
- `case_sensitive`: Whether matching is case-sensitive

---

## LLM-as-Judge Criteria

These criteria use an LLM to evaluate response quality. They require the `litellm` extra.

### LLMJudgeCriterion

Semantic similarity judged by an LLM.

```python
from agentflow.evaluation import LLMJudgeCriterion, CriterionConfig

criterion = LLMJudgeCriterion(
    config=CriterionConfig(
        threshold=0.7,
        judge_model="gpt-4o-mini",
    )
)
```

**How it works:**
1. Sends actual and expected responses to judge LLM
2. LLM rates semantic similarity from 0-1
3. Passes if score >= threshold

**Configuration:**

```python
config = EvalConfig(
    criteria={
        "llm_judge": CriterionConfig(
            enabled=True,
            threshold=0.75,
            judge_model="gpt-4o",  # Use more capable model
        ),
    }
)
```

### RubricBasedCriterion

Evaluates against custom rubrics for multi-dimensional scoring.

```python
from agentflow.evaluation import (
    RubricBasedCriterion,
    CriterionConfig,
    Rubric,
)

rubrics = [
    Rubric(
        name="helpfulness",
        description="Is the response helpful and actionable?",
        scoring_guide="5: Extremely helpful with clear next steps\n"
                      "4: Helpful with some guidance\n"
                      "3: Somewhat helpful\n"
                      "2: Minimally helpful\n"
                      "1: Not helpful at all",
        weight=2.0,
    ),
    Rubric(
        name="accuracy",
        description="Is the information accurate and correct?",
        scoring_guide="5: Completely accurate\n"
                      "3: Mostly accurate\n"
                      "1: Inaccurate or misleading",
        weight=1.5,
    ),
    Rubric(
        name="tone",
        description="Is the tone appropriate and professional?",
        scoring_guide="5: Professional and friendly\n"
                      "3: Acceptable\n"
                      "1: Inappropriate",
        weight=1.0,
    ),
]

criterion = RubricBasedCriterion(
    config=CriterionConfig(
        threshold=0.7,
        rubrics=rubrics,
        judge_model="gpt-4o-mini",
    )
)
```

**Scoring:**
- Each rubric is scored independently
- Scores are weighted and averaged
- Result includes per-rubric breakdown

---

## Advanced Criteria

These criteria evaluate specific safety and quality aspects.

### HallucinationCriterion

Detects when the agent makes claims not grounded in the context or tool results.

```python
from agentflow.evaluation import HallucinationCriterion

criterion = HallucinationCriterion(
    config=CriterionConfig(
        threshold=0.8,
        judge_model="gpt-4o-mini",
    )
)
```

**How it works:**
1. Collects all context (tool results, knowledge base)
2. Asks LLM to verify each claim in the response
3. Scores groundedness (1.0 = fully grounded, 0.0 = hallucinated)

**Result details:**
```python
result.details = {
    "hallucinated_claims": ["claim that wasn't grounded"],
    "grounded_claims": ["claim supported by context"],
    "groundedness_score": 0.85,
}
```

### SafetyCriterion

Evaluates response safety and harmlessness.

```python
from agentflow.evaluation import SafetyCriterion

criterion = SafetyCriterion(
    config=CriterionConfig(
        threshold=0.9,
        judge_model="gpt-4o-mini",
    )
)
```

**Safety categories evaluated:**
- Harmful content
- Hate speech / discrimination
- Violence
- Personal information disclosure
- Illegal activities
- Sexual content
- Self-harm

**Result details:**
```python
result.details = {
    "category_scores": {
        "harmful_content": 0.0,
        "hate_speech": 0.0,
        "violence": 0.0,
        "pii_disclosure": 0.1,  # Slight concern
    },
    "overall_safe": True,
    "concerns": ["Minor PII disclosure risk"],
}
```

### FactualAccuracyCriterion

Checks factual accuracy of claims against known facts.

```python
from agentflow.evaluation import FactualAccuracyCriterion

criterion = FactualAccuracyCriterion(
    config=CriterionConfig(
        threshold=0.8,
        judge_model="gpt-4o",  # Use capable model for fact checking
    ),
    reference_facts=["Tokyo is in Japan", "Python was created by Guido van Rossum"],
)
```

---

## Composite Criteria

Combine multiple criteria for complex evaluation.

### CompositeCriterion

Runs multiple criteria and aggregates results.

```python
from agentflow.evaluation import CompositeCriterion

criterion = CompositeCriterion(
    criteria=[
        TrajectoryMatchCriterion(config=CriterionConfig(threshold=0.8)),
        ResponseMatchCriterion(config=CriterionConfig(threshold=0.6)),
        SafetyCriterion(config=CriterionConfig(threshold=0.9)),
    ],
    aggregation="all",  # all, any, average
)
```

**Aggregation modes:**
- `all`: Pass only if all criteria pass
- `any`: Pass if any criterion passes
- `average`: Pass if average score >= threshold

### WeightedCriterion

Weighted combination of criteria.

```python
from agentflow.evaluation import WeightedCriterion

criterion = WeightedCriterion(
    criteria=[
        (TrajectoryMatchCriterion(), 2.0),   # Weight 2
        (ResponseMatchCriterion(), 1.0),     # Weight 1
        (SafetyCriterion(), 3.0),            # Weight 3 (safety is important!)
    ],
    config=CriterionConfig(threshold=0.75),
)
```

---

## Custom Criteria

Create your own criteria for domain-specific evaluation.

### Synchronous Criterion

For simple, non-async evaluation:

```python
from agentflow.evaluation import SyncCriterion, CriterionResult

class WordCountCriterion(SyncCriterion):
    name = "word_count"
    description = "Checks response is within word limit"

    def __init__(self, min_words: int = 10, max_words: int = 200):
        super().__init__()
        self.min_words = min_words
        self.max_words = max_words

    def evaluate_sync(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        response = actual.final_response
        word_count = len(response.split())
        
        in_range = self.min_words <= word_count <= self.max_words
        score = 1.0 if in_range else 0.0
        
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=in_range,
            threshold=1.0,
            details={"word_count": word_count},
        )
```

### Async Criterion

For criteria requiring external API calls:

```python
from agentflow.evaluation import BaseCriterion, CriterionResult

class ExternalAPIValidator(BaseCriterion):
    name = "api_validator"
    description = "Validates response against external service"

    async def evaluate(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        response = actual.final_response
        
        # Call external validation service
        async with httpx.AsyncClient() as client:
            result = await client.post(
                "https://api.validator.com/check",
                json={"text": response}
            )
            validation = result.json()
        
        score = validation["score"]
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            details=validation,
        )
```

### Using Custom Criteria

```python
# Add to evaluator
evaluator = AgentEvaluator(graph, config)
evaluator.criteria.append(WordCountCriterion(min_words=50))

# Or create from config
class MyConfig(CriterionConfig):
    min_words: int = 50
    max_words: int = 200
```

---

## Configuring Criteria

### Via EvalConfig

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType

config = EvalConfig(
    criteria={
        # Trajectory matching
        "trajectory_match": CriterionConfig(
            enabled=True,
            threshold=0.9,
            match_type=MatchType.IN_ORDER,
        ),
        
        # Response similarity
        "response_match": CriterionConfig(
            enabled=True,
            threshold=0.6,
        ),
        
        # LLM judge (semantic)
        "llm_judge": CriterionConfig(
            enabled=True,
            threshold=0.7,
            judge_model="gpt-4o-mini",
        ),
        
        # Rubric-based
        "rubric_based": CriterionConfig(
            enabled=True,
            threshold=0.75,
            rubrics=[
                Rubric(name="quality", description="...", scoring_guide="..."),
            ],
        ),
        
        # Disable if not needed
        "hallucination": CriterionConfig(enabled=False),
    }
)
```

### Criterion Names Map

| Config Name | Criterion Class |
|-------------|-----------------|
| `trajectory_match` | `TrajectoryMatchCriterion` |
| `tool_trajectory_avg_score` | `TrajectoryMatchCriterion` |
| `response_match` | `ResponseMatchCriterion` |
| `response_match_score` | `ResponseMatchCriterion` |
| `llm_judge` | `LLMJudgeCriterion` |
| `final_response_match_v2` | `LLMJudgeCriterion` |
| `rubric_based` | `RubricBasedCriterion` |
| `rubric_based_final_response_quality_v1` | `RubricBasedCriterion` |

---

## Best Practices

### Choose the Right Criteria

| Scenario | Recommended Criteria |
|----------|---------------------|
| Testing tool calls | `TrajectoryMatchCriterion` |
| Deterministic output | `ExactMatchCriterion` |
| Content coverage | `ContainsKeywordsCriterion` |
| General quality | `LLMJudgeCriterion` |
| Safety-critical apps | `SafetyCriterion` |
| RAG applications | `HallucinationCriterion` |
| Customer-facing | `RubricBasedCriterion` |

### Performance Considerations

- **Fast (milliseconds)**: Trajectory, Exact, Keywords, ROUGE
- **Slow (1-5 seconds)**: LLM-as-Judge criteria

For CI/CD, consider:
```python
# Fast config for CI
ci_config = EvalConfig(
    criteria={
        "trajectory_match": CriterionConfig(enabled=True),
        "response_match": CriterionConfig(enabled=True),
        "llm_judge": CriterionConfig(enabled=False),  # Skip slow LLM checks
    }
)

# Full config for nightly
nightly_config = EvalConfig.default()
```

### Threshold Tuning

Start with these thresholds and adjust based on your requirements:

| Criterion | Suggested Range | Notes |
|-----------|-----------------|-------|
| Trajectory | 0.8 - 1.0 | Lower for flexible tool usage |
| Response ROUGE | 0.5 - 0.7 | Lower = more tolerance |
| LLM Judge | 0.6 - 0.8 | Higher for strict matching |
| Safety | 0.9 - 1.0 | Safety should be high |
| Hallucination | 0.7 - 0.9 | Higher for accuracy-critical |
