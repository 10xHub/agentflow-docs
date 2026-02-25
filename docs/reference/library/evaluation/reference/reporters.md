# Reporters Reference

This page documents all evaluation reporters — classes that format `EvalReport` results for output. The module provides four reporter formats plus a manager to orchestrate them all.

---

## Reporter Summary

| Reporter | Output | Config Key | Use Case |
|---|---|---|---|
| `ConsoleReporter` | Terminal (stdout) | `console` | Development, debugging |
| `JSONReporter` | `.json` file | `json` | Data analysis, CI pipelines |
| `HTMLReporter` | `.html` file | `html` | Stakeholder reports, detailed review |
| `JUnitXMLReporter` | `.xml` file | `junit_xml` | CI/CD integration (Jenkins, GitHub Actions) |
| `ReporterManager` | All of the above | — | Run all enabled reporters at once |

---

## BaseReporter

Abstract base class for all reporters.

```python
from agentflow.evaluation import BaseReporter

class BaseReporter(ABC):
    def generate(self, report: EvalReport, output_dir: str | None = None) -> str | None: ...

    @property
    def name(self) -> str: ...  # Human-readable name (defaults to class name)
```

---

## ConsoleReporter

Pretty-prints evaluation results to the terminal with ANSI colors.

```python
from agentflow.evaluation import ConsoleReporter

reporter = ConsoleReporter(
    use_color=True,                  # ANSI color codes
    verbose=False,                   # Show detailed per-case output
    output=sys.stdout,               # Output stream
    include_trajectory=False,        # Show trajectory data
    include_actual_response=False,   # Show agent's response text
)
```

### Usage

```python
# Print a full report
reporter = ConsoleReporter(verbose=True, include_trajectory=True)
reporter.report(report)

# Quick one-liner
from agentflow.evaluation import print_report
print_report(report)
```

### Options

| Parameter | Type | Default | Description |
|---|---|---|---|
| `use_color` | `bool` | `True` | Enable ANSI colors. Set `False` for CI logs. |
| `verbose` | `bool` | `False` | Show per-case criterion details |
| `output` | `TextIO` | `sys.stdout` | Output stream |
| `include_trajectory` | `bool` | `False` | Show tool call trajectory data |
| `include_actual_response` | `bool` | `False` | Show the agent's actual response text |

### `print_report()`

Module-level convenience function:

```python
from agentflow.evaluation import print_report

print_report(report)  # Uses default ConsoleReporter
```

---

## JSONReporter

Exports evaluation results as JSON with configurable filtering.

```python
from agentflow.evaluation import JSONReporter

reporter = JSONReporter(
    indent=2,                        # JSON indentation (None for compact)
    include_details=True,            # Include criterion details dicts
    include_trajectory=True,         # Include trajectory data
    include_node_responses=True,     # Include node response snapshots
    include_actual_response=True,    # Include actual response text
    include_tool_call_details=True,  # Include tool call details
)
```

### Usage

```python
# Save to file
reporter = JSONReporter(indent=2)
reporter.save(report, "eval_reports/results.json")

# Get as string
json_str = reporter.to_json(report)

# Get as dict
data = reporter.to_dict(report)

# Quick save (class method)
JSONReporter.quick_save(report, "eval_reports/results.json")
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `generate` | `(report, output_dir?) → str \| None` | Write JSON file to dir; returns path |
| `to_dict` | `(report) → dict` | Convert report to dictionary |
| `to_json` | `(report) → str` | Convert report to JSON string |
| `save` | `(report, path) → None` | Save report to JSON file |
| `quick_save` | `@classmethod (report, path, indent=2)` | Static shortcut to save |

### JSON Output Structure

```json
{
  "eval_set_id": "weather_tests",
  "eval_set_name": "Weather Agent Tests",
  "timestamp": 1740200000.0,
  "config_used": { ... },
  "summary": {
    "total_cases": 5,
    "passed_cases": 4,
    "failed_cases": 1,
    "error_cases": 0,
    "pass_rate": 0.8,
    "avg_duration_seconds": 2.5,
    "total_duration_seconds": 12.5,
    "criterion_stats": { ... }
  },
  "results": [
    {
      "eval_id": "london_weather",
      "name": "London Weather",
      "passed": true,
      "actual_response": "The weather in London is sunny",
      "actual_tool_calls": [ ... ],
      "actual_trajectory": [ ... ],
      "criterion_results": [
        {
          "criterion": "tool_name_match_score",
          "score": 1.0,
          "passed": true,
          "threshold": 1.0,
          "details": { ... }
        }
      ],
      "duration_seconds": 2.3
    }
  ]
}
```

---

## HTMLReporter

Generates self-contained, interactive HTML reports for detailed review.

```python
from agentflow.evaluation import HTMLReporter

reporter = HTMLReporter(
    include_details=True,            # Include criterion details
    include_actual_response=True,    # Include response text
    include_tool_call_details=True,  # Include tool call data
    include_node_responses=True,     # Include node snapshots
    include_trajectory=True,         # Include trajectory visualization
)
```

### Usage

```python
# Save to file
reporter = HTMLReporter(include_trajectory=True)
reporter.save(report, "eval_reports/results.html")

# Get as HTML string
html_str = reporter.to_html(report)

# Generate into output directory
path = reporter.generate(report, output_dir="eval_reports/")
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `generate` | `(report, output_dir?) → str \| None` | Write HTML file to dir; returns path or HTML string |
| `to_html` | `(report) → str` | Convert report to HTML string |
| `save` | `(report, path) → None` | Save report to HTML file |

### Features

- Self-contained (no external CSS/JS dependencies)
- Collapsible case details
- Color-coded pass/fail indicators
- Trajectory visualization
- Tool call details with arguments and results
- Node response snapshots

---

## JUnitXMLReporter

Generates JUnit XML reports for CI/CD integration.

```python
from agentflow.evaluation import JUnitXMLReporter

reporter = JUnitXMLReporter()
reporter.save(report, "eval_reports/results.xml")
```

### Usage in CI

**GitHub Actions:**

```yaml
- name: Run agent evaluation
  run: python -m pytest tests/evaluation/ --junitxml=eval_reports/results.xml

- name: Publish test results
  uses: dorny/test-reporter@v1
  with:
    name: Agent Evaluation
    path: eval_reports/results.xml
    reporter: java-junit
```

**Jenkins:**

```groovy
junit 'eval_reports/results.xml'
```

---

## ReporterManager

Orchestrates multiple reporters with a single call. Failures in individual reporters are collected, not raised.

```python
from agentflow.evaluation import ReporterManager, ReporterConfig

config = ReporterConfig(
    console=True,        # Enable console output
    json_report=True,    # Enable JSON file output
    html=True,           # Enable HTML file output
    junit_xml=True,      # Enable JUnit XML output
)

manager = ReporterManager(config)
output = manager.run_all(report, output_dir="eval_reports/")
```

### ReporterConfig

```python
class ReporterConfig(BaseModel):
    enabled: bool = True                    # Master switch
    output_dir: str = "eval_reports"         # Output directory
    console: bool = True                    # Console (stdout) reporting
    json_report: bool = True                # JSON file reporting
    html: bool = True                       # HTML file reporting
    junit_xml: bool = False                 # JUnit XML file reporting
    verbose: bool = True                    # Show all cases, not just failures
    include_details: bool = True            # Full criterion details in reports
    include_trajectory: bool = True         # Trajectory data in JSON reports
    include_node_responses: bool = True     # Per-node intermediate data
    include_actual_response: bool = True    # Agent final response
    include_tool_call_details: bool = True  # Tool arguments and results
    timestamp_files: bool = True            # Append timestamp to filenames
```

### ReporterOutput

Result from `run_all()`:

```python
from dataclasses import dataclass

@dataclass
class ReporterOutput:
    json_path: str | None = None
    html_path: str | None = None
    junit_path: str | None = None
    console_output: bool = False
    errors: list[tuple[str, str]] = []   # (reporter_name, error_message)

    @property
    def has_errors(self) -> bool: ...
    @property
    def generated_files(self) -> list[str]: ...
```

### Usage

```python
output = manager.run_all(report, output_dir="eval_reports/")

# Check results
print(f"JSON: {output.json_path}")      # "eval_reports/abc123.json"
print(f"HTML: {output.html_path}")      # "eval_reports/abc123.html"
print(f"JUnit: {output.junit_path}")    # "eval_reports/abc123_junit.xml"
print(f"Console: {output.console_output}")  # True
print(f"Files: {output.generated_files}")   # ["eval_reports/abc123.json", ...]

if output.has_errors:
    for name, error in output.errors:
        print(f"Reporter '{name}' failed: {error}")
```

---

## Combining with Evaluation

### In AgentEvaluator Workflow

```python
from agentflow.evaluation import (
    AgentEvaluator,
    EvalPresets,
    ReporterManager,
    ReporterConfig,
)

evaluator = AgentEvaluator(compiled, collector, config=EvalPresets.comprehensive())
report = await evaluator.evaluate(eval_set)

# Run all reporters
manager = ReporterManager(ReporterConfig(console=True, json_report=True, html=True))
output = manager.run_all(report, output_dir="eval_reports/")
```

### In QuickEval

`QuickEval` methods automatically print to console. For additional formats, capture the report and run reporters:

```python
report = await QuickEval.check(
    graph=compiled,
    collector=collector,
    query="Hello",
    expected_response_contains="Hi",
    print_results=True,   # Console output built-in
)

# Additional reports
HTMLReporter().save(report, "eval_reports/quick_check.html")
```

---

## Next Steps

- [Pytest Integration](pytest_integration.md) — Testing utilities and CI/CD
- [Data Models](data_models.md) — EvalReport, EvalSummary structure
- [Advanced](advanced.md) — Custom reporters and output formats
