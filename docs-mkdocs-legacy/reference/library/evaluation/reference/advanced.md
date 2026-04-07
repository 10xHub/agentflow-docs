# Advanced Topics

This page covers advanced evaluation patterns — writing custom criteria, combining presets, multi-agent evaluation, regression testing, cost optimization, and RAG evaluation.

---

## Custom Criteria

### Synchronous Criterion

For criteria that don't require async I/O:

```python
from agentflow.evaluation import SyncCriterion, CriterionConfig, CriterionResult
from agentflow.evaluation.execution.result import ExecutionResult
from agentflow.evaluation.dataset import EvalCase

class ResponseLengthCriterion(SyncCriterion):
    """Check that response length is within expected bounds."""

    name = "response_length"
    description = "Validates response length"

    def __init__(self, min_length: int = 10, max_length: int = 500, config=None):
        super().__init__(config=config)
        self.min_length = min_length
        self.max_length = max_length

    def evaluate_sync(self, actual: ExecutionResult, expected: EvalCase) -> CriterionResult:
        length = len(actual.actual_response)

        if self.min_length <= length <= self.max_length:
            score = 1.0
        elif length < self.min_length:
            score = length / self.min_length
        else:
            score = self.max_length / length

        return CriterionResult.success(
            criterion=self.name,
            score=min(score, 1.0),
            threshold=self.threshold,
            details={
                "reason": f"Response length: {length} chars (expected {self.min_length}-{self.max_length})",
                "actual_length": length,
                "min_length": self.min_length,
                "max_length": self.max_length,
            },
        )
```

### Async Criterion

For criteria that need API calls or I/O:

```python
from agentflow.evaluation import BaseCriterion, CriterionResult
from agentflow.evaluation.execution.result import ExecutionResult
from agentflow.evaluation.dataset import EvalCase

class ExternalValidatorCriterion(BaseCriterion):
    """Validate response against an external API."""

    name = "external_validator"
    description = "Validates response via external service"

    async def evaluate(self, actual: ExecutionResult, expected: EvalCase) -> CriterionResult:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://validator.example.com/check",
                    json={"response": actual.actual_response},
                )
                data = resp.json()
                score = data.get("score", 0.0)

            return CriterionResult.success(
                criterion=self.name,
                score=score,
                threshold=self.threshold,
                details={"validator_response": data},
            )
        except Exception as e:
            return CriterionResult.failure(
                criterion=self.name,
                error=str(e),
                threshold=self.threshold,
            )
```

### LLM-Based Custom Criterion

Extend `LLMCallerMixin` for criteria that use LLM scoring:

```python
from agentflow.evaluation import BaseCriterion, CriterionResult
from agentflow.evaluation.criteria.llm_utils import LLMCallerMixin
from agentflow.evaluation.execution.result import ExecutionResult
from agentflow.evaluation.dataset import EvalCase

class ToneCriterion(LLMCallerMixin, BaseCriterion):
    """Evaluate whether the response has the expected tone."""

    name = "tone_check"
    description = "Checks if response tone matches expectations"

    TONE_PROMPT = """Rate whether the following response has a {tone} tone.
    
Response: {response}

Rate on a scale of 0.0 to 1.0 where 1.0 means perfectly {tone}.
Return only a number."""

    def __init__(self, expected_tone: str = "professional", config=None):
        super().__init__(config=config)
        self.expected_tone = expected_tone

    async def evaluate(self, actual: ExecutionResult, expected: EvalCase) -> CriterionResult:
        scores = await self._run_samples(
            prompt=self.TONE_PROMPT.format(
                tone=self.expected_tone,
                response=actual.actual_response,
            ),
        )
        avg_score = sum(scores) / len(scores) if scores else 0.0

        return CriterionResult.success(
            criterion=self.name,
            score=avg_score,
            threshold=self.threshold,
            details={
                "reason": f"Tone '{self.expected_tone}' score: {avg_score:.2f}",
                "expected_tone": self.expected_tone,
                "individual_scores": scores,
            },
        )
```

### Using Custom Criteria

Custom criteria can be added directly to `AgentEvaluator`:

```python
evaluator = AgentEvaluator(compiled, collector, config=config)
evaluator.criteria.append(ResponseLengthCriterion(min_length=20, max_length=200))
evaluator.criteria.append(ToneCriterion(expected_tone="friendly"))
```

---

## Composite and Weighted Criteria

### CompositeCriterion

Combine multiple criteria with AND/OR logic:

```python
from agentflow.evaluation import (
    CompositeCriterion,
    ToolNameMatchCriterion,
    ExactMatchCriterion,
    ContainsKeywordsCriterion,
    CriterionConfig,
)

# AND: All must pass (score = min of sub-scores)
strict = CompositeCriterion(
    criteria=[
        ToolNameMatchCriterion(config=CriterionConfig(threshold=1.0)),
        ExactMatchCriterion(config=CriterionConfig(threshold=1.0)),
    ],
    require_all=True,
)

# OR: Any must pass (score = max of sub-scores)
lenient = CompositeCriterion(
    criteria=[
        ExactMatchCriterion(config=CriterionConfig(threshold=1.0)),
        ContainsKeywordsCriterion(config=CriterionConfig(threshold=0.8)),
    ],
    require_all=False,
)
```

### WeightedCriterion

Compute weighted average of sub-criteria:

```python
from agentflow.evaluation import (
    WeightedCriterion,
    ToolNameMatchCriterion,
    ResponseMatchCriterion,
    CriterionConfig,
)

weighted = WeightedCriterion(
    criteria_weights=[
        (ToolNameMatchCriterion(config=CriterionConfig(threshold=1.0)), 0.4),
        (ResponseMatchCriterion(config=CriterionConfig(threshold=0.7)), 0.6),
    ],
)
# Score = (0.4 * tool_score + 0.6 * response_score) / (0.4 + 0.6)
```

---

## EvalConfig Deep Dive

### EvalConfig Structure

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, ReporterConfig, UserSimulatorConfig

config = EvalConfig(
    criteria={
        "tool_name_match_score": CriterionConfig(threshold=1.0),
        "response_match_score": CriterionConfig(threshold=0.7),
    },
    reporter=ReporterConfig(console=True, json_report=True, html=True),
    user_simulator_config=UserSimulatorConfig(model="gemini/gemini-2.5-flash"),
)
```

### Default Configuration

```python
config = EvalConfig.default()
```

### Disabling Criteria

```python
config = EvalConfig(criteria={
    "tool_name_match_score": CriterionConfig(threshold=1.0, enabled=True),
    "llm_judge": CriterionConfig(threshold=0.8, enabled=False),  # Disabled
})
```

### EvalConfig Utility Methods

```python
# Save / load configuration to/from JSON
config.to_file("eval_config.json")
loaded = EvalConfig.from_file("eval_config.json")

# Programmatic criterion management
config.enable_criterion("safety_v1", CriterionConfig.safety(threshold=0.9))
config.disable_criterion("llm_judge")

# Check a specific criterion's config
cfg = config.get_criterion_config("response_match_score")
print(cfg.threshold)  # 0.7

# Add rubrics to an existing config (returns a new copy)
from agentflow.evaluation import Rubric
config_with_rubrics = config.with_rubrics([
    Rubric.create("helpful", "Response is helpful and actionable"),
    Rubric.create("concise", "Response is concise without unnecessary detail"),
])
```

### Mock Mode

Set `mock_mode=True` to validate the pipeline without executing the agent graph.
Useful for CI dry-runs or testing evaluation scaffolding:

```python
config = EvalConfig(
    criteria={"response_match_score": CriterionConfig.response_match()},
    mock_mode=True,  # No actual graph execution
)
```

---

## Presets

### Available Presets

```python
from agentflow.evaluation import EvalPresets

# Response quality only
config = EvalPresets.response_quality(threshold=0.7, use_llm_judge=True)

# Tool usage validation
config = EvalPresets.tool_usage(threshold=1.0, strict=True, check_args=True)

# Multi-turn conversation
config = EvalPresets.conversation_flow(threshold=0.8)

# Quick sanity check (relaxed thresholds)
config = EvalPresets.quick_check()

# Everything enabled
config = EvalPresets.comprehensive(threshold=0.8, use_llm_judge=True)

# Safety focused
config = EvalPresets.safety_check(threshold=0.8)
```

### Combining Presets

```python
config = EvalPresets.combine(
    EvalPresets.tool_usage(strict=True),
    EvalPresets.response_quality(threshold=0.7),
    EvalPresets.safety_check(threshold=0.9),
)
```

### Custom Presets

Use `EvalPresets.custom()` to cherry-pick criteria without building a full config:

```python
config = EvalPresets.custom(
    response_threshold=0.7,
    tool_threshold=1.0,
    tool_match_type=MatchType.IN_ORDER,
    check_tool_args=True,
    hallucination_threshold=0.8,
    safety_threshold=0.9,
    factual_accuracy_threshold=0.8,
    llm_judge_threshold=0.8,
)
```

Only parameters you provide are enabled — omitted criteria stay off.

Or define your own preset function:

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType, Rubric

def my_preset(threshold: float = 0.8) -> EvalConfig:
    return EvalConfig(criteria={
        "tool_trajectory_avg_score": CriterionConfig.trajectory(
            threshold=1.0,
            match_type=MatchType.IN_ORDER,
        ),
        "response_match_score": CriterionConfig.response_match(threshold=threshold),
        "rubric_based": CriterionConfig.rubric_based(
            rubrics=[
                Rubric.create("helpful", "Response is helpful and actionable"),
                Rubric.create("concise", "Response is concise without unnecessary detail"),
            ],
            threshold=threshold,
        ),
    })
```

---

## Regression Testing

Track evaluation scores over time to catch regressions:

```python
import json
from pathlib import Path
from agentflow.evaluation import AgentEvaluator, JSONReporter

async def run_regression_test(evaluator, eval_set, baseline_path="baseline.json"):
    report = await evaluator.evaluate(eval_set)

    # Save current results
    JSONReporter().save(report, "eval_reports/latest.json")

    # Compare against baseline
    baseline = Path(baseline_path)
    if baseline.exists():
        with baseline.open() as f:
            baseline_data = json.load(f)

        baseline_pass_rate = baseline_data["summary"]["pass_rate"]
        current_pass_rate = report.summary.pass_rate

        regression = current_pass_rate < baseline_pass_rate - 0.05  # 5% tolerance
        if regression:
            raise AssertionError(
                f"Regression detected: pass rate dropped from "
                f"{baseline_pass_rate:.1%} to {current_pass_rate:.1%}"
            )

    # Update baseline on success
    JSONReporter().save(report, baseline_path)
```

### Per-Criterion Regression

```python
def check_criterion_regression(current_report, baseline_data, tolerance=0.05):
    """Check each criterion for regressions."""
    regressions = []

    for name, stats in current_report.summary.criterion_stats.items():
        baseline_stats = baseline_data.get("summary", {}).get("criterion_stats", {}).get(name)
        if baseline_stats:
            current_avg = stats["avg_score"]
            baseline_avg = baseline_stats["avg_score"]
            if current_avg < baseline_avg - tolerance:
                regressions.append({
                    "criterion": name,
                    "baseline": baseline_avg,
                    "current": current_avg,
                    "delta": current_avg - baseline_avg,
                })

    return regressions
```

---

## Cost Optimization

### Minimize LLM API Calls

```python
# 1. Use no-LLM criteria first — they're free
config = EvalConfig(criteria={
    "tool_name_match_score": CriterionConfig(threshold=1.0),
    "contains_keywords": CriterionConfig.contains_keywords(keywords=["expected", "keyword"], threshold=1.0),
    "exact_match": CriterionConfig(threshold=1.0),
})

# 2. Use fewer samples for LLM judge
config = EvalConfig(criteria={
    "llm_judge": CriterionConfig.llm_judge(
        threshold=0.8,
        num_samples=1,  # Reduce from default 3
    ),
})

# 3. Use cheaper models
config = EvalConfig(criteria={
    "llm_judge": CriterionConfig.llm_judge(
        judge_model="gemini/gemini-2.0-flash-lite",  # Cheaper model
    ),
})

# 4. Disable expensive criteria during development
config = EvalConfig(criteria={
    "tool_name_match_score": CriterionConfig(threshold=1.0, enabled=True),
    "response_match_score": CriterionConfig(threshold=0.7, enabled=True),
    "hallucinations_v1": CriterionConfig(enabled=False),  # Skip in dev
    "safety_v1": CriterionConfig(enabled=False),           # Skip in dev
})
```

### Tiered Evaluation Strategy

```python
# Development: fast, free
dev_config = EvalPresets.quick_check()

# PR/staging: moderate
staging_config = EvalPresets.combine(
    EvalPresets.tool_usage(strict=True),
    EvalPresets.response_quality(threshold=0.7, use_llm_judge=False),
)

# Production/release: comprehensive
prod_config = EvalPresets.comprehensive(threshold=0.8, use_llm_judge=True)
```

---

## Multi-Agent Evaluation

Evaluate multiple agents in a pipeline.

> **Note:** Due to the compile-once constraint, you should only evaluate **one graph per process**. If you need to evaluate multiple graphs, run each evaluation in a separate process (e.g., separate pytest sessions or subprocess calls). Within a single process, compile the graph you want to evaluate first and reuse it.

```python
from agentflow.evaluation import (
    AgentEvaluator,
    EvalConfig,
    CriterionConfig,
    create_eval_app,
)

# Evaluate a single agent graph
compiled, collector = create_eval_app(router_graph)

router_eval = AgentEvaluator(
    compiled,
    collector,
    config=EvalConfig(criteria={
        "tool_name_match_score": CriterionConfig(threshold=1.0),
    }),
)
router_report = await router_eval.evaluate(eval_set)
```

To evaluate a different graph (e.g., a specialist), run it in a **separate process**:

```bash
# Shell — evaluate each graph in its own process
python eval_router.py
python eval_specialist.py
```

---

## RAG Evaluation

Evaluate retrieval-augmented generation agents:

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, Rubric

rag_config = EvalConfig(criteria={
    # Check that retrieval tools were called
    "tool_name_match_score": CriterionConfig.tool_name_match(threshold=1.0),

    # Check factual accuracy against retrieved documents
    "factual_accuracy_v1": CriterionConfig.factual_accuracy(threshold=0.9),

    # Check for hallucination (response grounded in retrieved context)
    "hallucinations_v1": CriterionConfig.hallucination(threshold=0.9),

    # Custom rubrics for RAG quality
    "rubric_based": CriterionConfig.rubric_based(
        rubrics=[
            Rubric.create(
                "source_attribution",
                "Response cites or references the source documents",
            ),
            Rubric.create(
                "completeness",
                "Response covers all relevant information from retrieved documents",
            ),
            Rubric.create(
                "no_extrapolation",
                "Response does not add information beyond what is in the retrieved documents",
            ),
        ],
        threshold=0.8,
    ),
})
```

---

## TrajectoryCollector Internals

### How Collection Works

The `TrajectoryCollector` hooks into graph execution via the callback system:

```
Graph.compile(callback_manager=mgr)
         │
         ▼
    ┌──────────────────┐
    │ CallbackManager   │ ← Registers AfterInvokeCallbacks
    │                   │    for AI, TOOL, MCP invocations
    └────────┬─────────┘
             │
         fires after each invocation
             │
             ▼
    ┌──────────────────┐
    │ PublisherCallback  │ ← Builds EventModel from context
    │                   │    Publishes to TrajectoryCollector
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ TrajectoryCollector│ ← Stores tool_calls, node_visits,
    │                   │    trajectory, node_responses
    └──────────────────┘
```

> **Compile-once constraint:** The `CallbackManager` is bound to a global dependency-injection container (`InjectQ`) on the first `compile()` call. Subsequent `compile()` calls in the same process create a new `CallbackManager` but may not bind it correctly, resulting in empty trajectory data. Always compile your graph **once** and reuse the compiled app and collector. Use `create_eval_app()` for the simplest setup:
>
> ```python
> from agentflow.evaluation import create_eval_app
> compiled, collector = create_eval_app(my_graph)
> ```

### Key Properties

```python
collector = TrajectoryCollector()

# After graph execution:
collector.tool_calls        # list[ToolCall]
collector.node_visits       # list[str] — node names in order
collector.trajectory        # list[TrajectoryStep]
collector.node_responses    # list[NodeResponse] — per-node LLM snapshots
collector.duration          # float — wall-clock seconds
```

### EventCollector

For debugging, capture all raw events:

```python
from agentflow.evaluation import EventCollector

event_collector = EventCollector()
# ... wire into graph ...

# After execution:
for event in event_collector.events:
    print(f"{event.event}: {event.node_name} at {event.timestamp}")
```

---

## Next Steps

- [Criteria Reference](criteria.md) — All criterion classes
- [Data Models](data_models.md) — Model API reference
- [Quickstart](../getting_started/quickstart.md) — Getting started
