# Configuration Reference

This page documents all configuration classes for the evaluation module.

> `from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType, Rubric, ReporterConfig, UserSimulatorConfig`

---

## EvalConfig

Main evaluation configuration container.

```python
class EvalConfig(BaseModel):
    criteria: dict[str, CriterionConfig] = {}
    user_simulator_config: UserSimulatorConfig | None = None
    parallel: bool = False
    max_concurrency: int = 4
    timeout: float = 300.0
    verbose: bool = False
    mock_mode: bool = False
    reporter: ReporterConfig = ReporterConfig()
```

| Field | Type | Default | Description |
|---|---|---|---|
| `criteria` | `dict[str, CriterionConfig]` | `{}` | Criterion name → configuration |
| `user_simulator_config` | `UserSimulatorConfig \| None` | `None` | User simulation settings |
| `parallel` | `bool` | `False` | Run evaluations in parallel |
| `max_concurrency` | `int` | `4` | Max concurrent evaluations (if parallel) |
| `timeout` | `float` | `300.0` | Per-case timeout in seconds |
| `verbose` | `bool` | `False` | Verbose logging |
| `mock_mode` | `bool` | `False` | Dry-run without graph execution |
| `reporter` | `ReporterConfig` | `ReporterConfig()` | Reporter configuration |

### Factory Methods

| Method | Description |
|---|---|
| `EvalConfig.default()` | Trajectory (EXACT) + response match (0.8) |
| `EvalConfig.strict()` | Trajectory (EXACT, check_args) + response (0.9) + LLM judge (0.9) |
| `EvalConfig.relaxed()` | Trajectory (IN_ORDER, 0.8) + response (0.6) |
| `EvalConfig.from_file(path)` | Load from JSON file |

### Utility Methods

```python
# Serialization
config.to_file("eval_config.json")
config = EvalConfig.from_file("eval_config.json")

# Criterion management
config.enable_criterion("safety_v1", CriterionConfig.safety(threshold=0.9))
config.disable_criterion("llm_judge")
cfg = config.get_criterion_config("response_match_score")

# Add rubrics (returns new copy)
config_with_rubrics = config.with_rubrics([
    Rubric.create("helpful", "Response is helpful"),
])
```

---

## CriterionConfig

Configuration for a single evaluation criterion.

```python
class CriterionConfig(BaseModel):
    threshold: float = 0.8
    match_type: MatchType = MatchType.EXACT
    judge_model: str = "gemini-2.5-flash"
    num_samples: int = 3
    rubrics: list[Rubric] = []
    check_args: bool = False
    enabled: bool = True
```

| Field | Type | Default | Description |
|---|---|---|---|
| `threshold` | `float` | `0.8` | Minimum score to pass (0.0–1.0) |
| `match_type` | `MatchType` | `EXACT` | For trajectory/node-order criteria |
| `judge_model` | `str` | `"gemini-2.5-flash"` | Model for LLM-based criteria |
| `num_samples` | `int` | `3` | Majority voting samples for LLM criteria |
| `rubrics` | `list[Rubric]` | `[]` | Custom rubrics for rubric-based criterion |
| `check_args` | `bool` | `False` | Check tool arguments in trajectory matching |
| `enabled` | `bool` | `True` | Enable/disable this criterion |

### Factory Methods

| Method | Parameters | Description |
|---|---|---|
| `tool_name_match` | `threshold=1.0` | Tool name matching (no LLM) |
| `trajectory` | `threshold=1.0, match_type=EXACT, check_args=False` | Tool sequence matching (no LLM) |
| `node_order` | `threshold=1.0, match_type=EXACT` | Node visit order matching (no LLM) |
| `rouge_match` | `threshold=0.5` | ROUGE-1 F1 token-overlap score (no LLM) |
| `response_match` | `threshold=0.8, judge_model=..., num_samples=3` | LLM-based semantic response matching |
| `contains_keywords` | `keywords=[...], threshold=1.0` | Keyword presence check (no LLM) |
| `llm_judge` | `threshold=0.8, judge_model=..., num_samples=3` | LLM-as-judge overall quality |
| `rubric_based` | `rubrics=[...], threshold=0.8, judge_model=...` | Custom rubric-based scoring |
| `factual_accuracy` | `threshold=0.8, judge_model=..., num_samples=3` | Factual verification |
| `hallucination` | `threshold=0.8, judge_model=..., num_samples=3` | Groundedness detection |
| `safety` | `threshold=0.8, judge_model=..., num_samples=3` | Safety evaluation |

---

## MatchType

Enum for trajectory/node-order comparison modes.

```python
class MatchType(str, Enum):
    EXACT = "EXACT"       # Same items, same order, same count
    IN_ORDER = "IN_ORDER" # Expected items appear in order, extras allowed
    ANY_ORDER = "ANY_ORDER" # Expected items present in any order
```

---

## Rubric

Custom evaluation rubric for LLM-as-judge scoring.

```python
class Rubric(BaseModel):
    rubric_id: str
    content: str
    weight: float = 1.0
```

**Factory Method:**

```python
rubric = Rubric.create(
    rubric_id="helpful",
    content="Response is helpful and actionable",
    weight=1.0,
)
```

---

## ReporterConfig

Controls which reporters run and where output files are written.

```python
class ReporterConfig(BaseModel):
    enabled: bool = True
    output_dir: str = "eval_reports"
    console: bool = True
    json_report: bool = True
    html: bool = True
    junit_xml: bool = False
    verbose: bool = True
    include_details: bool = True
    include_trajectory: bool = True
    include_node_responses: bool = True
    include_actual_response: bool = True
    include_tool_call_details: bool = True
    timestamp_files: bool = True
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `bool` | `True` | Master switch — when False, no reporters run |
| `output_dir` | `str` | `"eval_reports"` | Output directory for report files |
| `console` | `bool` | `True` | Console (stdout) reporting |
| `json_report` | `bool` | `True` | JSON file output |
| `html` | `bool` | `True` | HTML file output |
| `junit_xml` | `bool` | `False` | JUnit XML output (for CI/CD) |
| `verbose` | `bool` | `True` | Show all cases, not just failures |
| `include_details` | `bool` | `True` | Full criterion details in file reports |
| `include_trajectory` | `bool` | `True` | Trajectory data in JSON reports |
| `include_node_responses` | `bool` | `True` | Per-node intermediate data |
| `include_actual_response` | `bool` | `True` | Agent final response text |
| `include_tool_call_details` | `bool` | `True` | Tool arguments and results |
| `timestamp_files` | `bool` | `True` | Append timestamp to generated filenames |

---

## UserSimulatorConfig

Configuration for AI-powered user simulation.

```python
class UserSimulatorConfig(BaseModel):
    model: str = "gemini-2.5-flash"
    max_invocations: int = 10
    temperature: float = 0.7
    thinking_enabled: bool = False
    thinking_budget: int = 10240
```

| Field | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | `"gemini-2.5-flash"` | LLM model for user simulation |
| `max_invocations` | `int` | `10` | Maximum conversation turns |
| `temperature` | `float` | `0.7` | Temperature for generation |
| `thinking_enabled` | `bool` | `False` | Enable thinking/reasoning mode |
| `thinking_budget` | `int` | `10240` | Token budget for thinking |

---

## EvalPresets

Pre-configured evaluation configurations for common scenarios.

```python
from agentflow.evaluation import EvalPresets
```

| Method | Criteria Enabled |
|---|---|
| `quick_check()` | Response match (relaxed 0.5) |
| `response_quality(threshold, use_llm_judge?)` | Response match + optional LLM judge |
| `tool_usage(threshold, strict?, check_args?)` | Tool name match + trajectory match |
| `conversation_flow(threshold)` | Response match + trajectory (IN_ORDER) |
| `comprehensive(threshold, use_llm_judge?)` | All: tool, response, LLM judge, safety, hallucination, factual |
| `safety_check(threshold)` | Hallucination + safety |
| `combine(*configs)` | Merge multiple presets |
| `custom(response_threshold?, tool_threshold?, ...)` | Cherry-pick individual criteria |

### `EvalPresets.custom()` Parameters

| Parameter | Type | Description |
|---|---|---|
| `response_threshold` | `float \| None` | Enable response matching |
| `tool_threshold` | `float \| None` | Enable tool name + trajectory matching |
| `llm_judge_threshold` | `float \| None` | Enable LLM judge |
| `tool_match_type` | `MatchType` | Trajectory match mode (default: IN_ORDER) |
| `check_tool_args` | `bool` | Check tool arguments (default: True) |
| `hallucination_threshold` | `float \| None` | Enable hallucination detection |
| `safety_threshold` | `float \| None` | Enable safety checking |
| `factual_accuracy_threshold` | `float \| None` | Enable factual accuracy |

---

## Complete Example

```python
from agentflow.evaluation import (
    EvalConfig,
    CriterionConfig,
    MatchType,
    Rubric,
    ReporterConfig,
    UserSimulatorConfig,
)

config = EvalConfig(
    criteria={
        "tool_trajectory_avg_score": CriterionConfig.trajectory(
            threshold=1.0,
            match_type=MatchType.IN_ORDER,
            check_args=True,
        ),
        "response_match_score": CriterionConfig.response_match(threshold=0.7),
        "node_order_score": CriterionConfig.node_order(
            threshold=1.0,
            match_type=MatchType.EXACT,
        ),
        "rubric_based": CriterionConfig.rubric_based(
            rubrics=[
                Rubric.create("helpful", "Response is helpful and actionable"),
                Rubric.create("concise", "Response is concise"),
            ],
            threshold=0.8,
        ),
        "safety_v1": CriterionConfig.safety(threshold=0.9),
    },
    reporter=ReporterConfig(
        console=True,
        json_report=True,
        html=True,
        output_dir="eval_reports",
        verbose=True,
    ),
    user_simulator_config=UserSimulatorConfig(
        model="gemini/gemini-2.5-flash",
        max_invocations=10,
        thinking_enabled=True,
        thinking_budget=10240,
    ),
    parallel=True,
    max_concurrency=4,
    timeout=300.0,
)

# Save and reload
config.to_file("my_eval_config.json")
loaded = EvalConfig.from_file("my_eval_config.json")
```

---

## Next Steps

- [Criteria Reference](criteria.md) — All criterion classes
- [Reporters Reference](reporters.md) — Output format details
- [Advanced](advanced.md) — Custom criteria, presets, regression testing
