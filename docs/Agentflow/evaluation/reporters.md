# Reporters

Reporters format and output evaluation results. Agentflow includes four built-in reporters for different use cases.

## Overview

| Reporter | Use Case | Output Format |
|----------|----------|---------------|
| `ConsoleReporter` | Development, debugging | Terminal (ANSI colors) |
| `JSONReporter` | Data analysis, storage | JSON file/dict |
| `JUnitXMLReporter` | CI/CD integration | JUnit XML |
| `HTMLReporter` | Stakeholder reporting | Interactive HTML |

---

## ConsoleReporter

Pretty-prints evaluation results to the terminal with ANSI colors.

### Basic Usage

```python
from agentflow.evaluation import ConsoleReporter, print_report

# Quick usage
print_report(eval_report)

# Or with options
reporter = ConsoleReporter(
    verbose=True,       # Show detailed output
    use_color=True,     # Use ANSI colors
)
reporter.report(eval_report)
```

### Output Example

```
═══════════════════════════════════════════════════════════════════════
                     EVALUATION REPORT: weather_tests
═══════════════════════════════════════════════════════════════════════

Summary
───────────────────────────────────────────────────────────────────────
  Total Cases:    10
  Passed:         8 ✓
  Failed:         2 ✗
  Pass Rate:      80.0%
  Duration:       3.45s

Criterion Statistics
───────────────────────────────────────────────────────────────────────
  trajectory_match    9/10 passed    avg: 0.92
  response_match      8/10 passed    avg: 0.78
  llm_judge           8/10 passed    avg: 0.81

Failed Cases
───────────────────────────────────────────────────────────────────────
✗ test_edge_case_1 (0.45s)
  - trajectory_match: 0.50 (threshold: 0.80)
  - response_match: 0.62 (threshold: 0.70)

✗ test_complex_query (1.23s)
  - trajectory_match: 0.75 (threshold: 0.80)
```

### Options

```python
reporter = ConsoleReporter(
    verbose=True,      # Show all cases, not just failures
    use_color=True,    # Colorful output
    output=sys.stdout, # Where to write (default: stdout)
)
```

### Disable Colors

For non-terminal environments:

```python
from agentflow.evaluation.reporters.console import Colors

Colors.disable()  # Removes all ANSI codes
reporter = ConsoleReporter(use_color=False)
```

---

## JSONReporter

Exports evaluation results as JSON for analysis and storage.

### Save to File

```python
from agentflow.evaluation import JSONReporter

reporter = JSONReporter()
reporter.save(eval_report, "results/report.json")
```

### Get as Dictionary

```python
# Full report
data = reporter.to_dict(eval_report)

# Only failed cases
data = reporter.to_dict(eval_report, include_passed=False)

# Include full trajectory data
data = reporter.to_dict(eval_report, include_trajectory=True)
```

### JSON Structure

```json
{
  "report_id": "rpt_abc123",
  "eval_set_id": "weather_tests",
  "eval_set_name": "Weather Agent Tests",
  "created_at": "2024-01-15T10:30:00Z",
  "duration_seconds": 3.45,
  "summary": {
    "total_cases": 10,
    "passed_cases": 8,
    "failed_cases": 2,
    "pass_rate": 0.8,
    "avg_score": 0.85,
    "criterion_stats": {
      "trajectory_match": {
        "passed": 9,
        "failed": 1,
        "avg_score": 0.92
      }
    }
  },
  "results": [
    {
      "eval_id": "test_1",
      "name": "Basic Weather Query",
      "passed": true,
      "duration_seconds": 0.45,
      "criterion_results": [
        {
          "criterion": "trajectory_match",
          "score": 1.0,
          "passed": true,
          "threshold": 0.8,
          "details": {}
        }
      ]
    }
  ],
  "config_used": {
    "criteria": {...}
  }
}
```

### Options

```python
reporter = JSONReporter(
    indent=2,              # JSON indentation
    include_metadata=True, # Include config and metadata
)

# Filter output
data = reporter.to_dict(
    report,
    include_passed=True,     # Include passing cases
    include_trajectory=False, # Include raw trajectory data
    include_config=True,     # Include configuration used
)
```

---

## JUnitXMLReporter

Generates JUnit XML format for CI/CD integration (GitHub Actions, Jenkins, etc.).

### Save to File

```python
from agentflow.evaluation import JUnitXMLReporter

reporter = JUnitXMLReporter()
reporter.save(eval_report, "results/junit.xml")
```

### XML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="weather_tests" tests="10" failures="2" time="3.45">
  <testsuite name="weather_tests" tests="10" failures="2" time="3.45">
    <testcase name="test_basic_weather" classname="weather_tests" time="0.45">
    </testcase>
    <testcase name="test_edge_case" classname="weather_tests" time="0.67">
      <failure message="trajectory_match failed: 0.50 &lt; 0.80">
        Criterion: trajectory_match
        Score: 0.50
        Threshold: 0.80
        Details: Expected [get_weather], Got [get_forecast]
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

### CI/CD Integration

**GitHub Actions:**

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Evaluations
        run: python run_evals.py
        
      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: results/junit.xml
          
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: 'results/junit.xml'
```

**Jenkins:**

```groovy
pipeline {
    stages {
        stage('Evaluate') {
            steps {
                sh 'python run_evals.py'
            }
            post {
                always {
                    junit 'results/junit.xml'
                }
            }
        }
    }
}
```

---

## HTMLReporter

Generates interactive HTML reports for sharing with stakeholders.

### Save to File

```python
from agentflow.evaluation import HTMLReporter

reporter = HTMLReporter()
reporter.save(eval_report, "results/report.html")
```

### HTML Features

The generated HTML includes:

- **Summary Dashboard** - Pass/fail rates, charts
- **Filtering** - Filter by status, criterion, tags
- **Case Details** - Expandable sections for each case
- **Criterion Breakdown** - Per-criterion scores and details
- **Search** - Find specific test cases
- **Responsive Design** - Works on desktop and mobile

### Customization

```python
reporter = HTMLReporter(
    title="Agent Evaluation Report",
    theme="light",  # "light" or "dark"
    include_charts=True,
)
```

### Sample Output

The HTML report displays:

```
┌─────────────────────────────────────────────────────────┐
│  📊 Weather Agent Evaluation Report                     │
│  Generated: 2024-01-15 10:30:00                        │
├─────────────────────────────────────────────────────────┤
│  Summary                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ 10 Total │ │ 8 Passed │ │ 2 Failed │               │
│  │   Cases  │ │   ✓      │ │   ✗      │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                        │
│  Pass Rate: [████████░░] 80%                           │
├─────────────────────────────────────────────────────────┤
│  Filter: [All ▼] [Status ▼] [Criterion ▼] [🔍 Search]  │
├─────────────────────────────────────────────────────────┤
│  ✓ test_basic_weather                         0.45s    │
│    trajectory_match: 1.00 ✓                            │
│    response_match: 0.85 ✓                              │
│                                                        │
│  ✗ test_edge_case                             0.67s    │
│    trajectory_match: 0.50 ✗ (threshold: 0.80)          │
│    response_match: 0.62 ✗ (threshold: 0.70)            │
│    [▼ Show Details]                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Using Multiple Reporters

Generate reports in multiple formats:

```python
from agentflow.evaluation import (
    ConsoleReporter,
    JSONReporter,
    JUnitXMLReporter,
    HTMLReporter,
)

# Run evaluation
report = await evaluator.evaluate(eval_set)

# Output to console
ConsoleReporter(verbose=True).report(report)

# Save all formats
JSONReporter().save(report, "results/report.json")
JUnitXMLReporter().save(report, "results/junit.xml")
HTMLReporter().save(report, "results/report.html")
```

### Reporter Factory

Create a helper for consistent reporting:

```python
def save_all_reports(report, output_dir: str = "results"):
    from pathlib import Path
    
    Path(output_dir).mkdir(exist_ok=True)
    
    # Console
    ConsoleReporter(verbose=True).report(report)
    
    # Files
    JSONReporter().save(report, f"{output_dir}/report.json")
    JUnitXMLReporter().save(report, f"{output_dir}/junit.xml")
    HTMLReporter().save(report, f"{output_dir}/report.html")
    
    print(f"\nReports saved to {output_dir}/")
```

---

## Custom Reporters

Create custom reporters by implementing the base pattern:

```python
from agentflow.evaluation import EvalReport

class MarkdownReporter:
    """Generate Markdown report."""
    
    def report(self, report: EvalReport) -> str:
        lines = [
            f"# Evaluation Report: {report.eval_set_name}",
            "",
            "## Summary",
            "",
            f"- **Total Cases**: {report.summary.total_cases}",
            f"- **Passed**: {report.summary.passed_cases}",
            f"- **Failed**: {report.summary.failed_cases}",
            f"- **Pass Rate**: {report.summary.pass_rate * 100:.1f}%",
            "",
            "## Results",
            "",
        ]
        
        for result in report.results:
            status = "✓" if result.passed else "✗"
            lines.append(f"### {status} {result.name or result.eval_id}")
            
            for cr in result.criterion_results:
                status = "✓" if cr.passed else "✗"
                lines.append(f"- {cr.criterion}: {cr.score:.2f} {status}")
            
            lines.append("")
        
        return "\n".join(lines)
    
    def save(self, report: EvalReport, filepath: str) -> None:
        content = self.report(report)
        with open(filepath, "w") as f:
            f.write(content)
```

### Slack Reporter Example

```python
import httpx

class SlackReporter:
    """Send evaluation results to Slack."""
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
    
    async def report(self, report: EvalReport) -> None:
        status = "✅" if report.summary.pass_rate == 1.0 else "⚠️"
        
        message = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{status} Evaluation: {report.eval_set_name}",
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Pass Rate:* {report.summary.pass_rate * 100:.1f}%"},
                        {"type": "mrkdwn", "text": f"*Duration:* {report.duration_seconds:.2f}s"},
                        {"type": "mrkdwn", "text": f"*Passed:* {report.summary.passed_cases}"},
                        {"type": "mrkdwn", "text": f"*Failed:* {report.summary.failed_cases}"},
                    ]
                },
            ]
        }
        
        async with httpx.AsyncClient() as client:
            await client.post(self.webhook_url, json=message)
```

---

## Best Practices

### Development Workflow

```python
# During development
ConsoleReporter(verbose=True).report(report)

# Save for analysis
if report.summary.pass_rate < 1.0:
    JSONReporter().save(report, f"failures/{report.eval_set_id}.json")
```

### CI/CD Workflow

```python
# Always save structured output
JSONReporter().save(report, "results/report.json")
JUnitXMLReporter().save(report, "results/junit.xml")

# Fail the build if pass rate is too low
if report.summary.pass_rate < 0.95:
    sys.exit(1)
```

### Stakeholder Reports

```python
# Generate HTML for sharing
HTMLReporter(title="Weekly Agent Quality Report").save(
    report, 
    f"reports/week_{week_number}.html"
)
```
