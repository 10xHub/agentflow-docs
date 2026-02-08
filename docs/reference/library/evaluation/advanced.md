# Advanced Topics

This guide covers advanced evaluation patterns, custom implementations, and best practices.

## Custom Criteria

### Creating Custom Criteria

Extend `BaseCriterion` for domain-specific evaluation:

```python
from agentflow.evaluation import BaseCriterion, CriterionResult, CriterionConfig

class APICallCriterion(BaseCriterion):
    """Validates that specific APIs were called correctly."""
    
    name = "api_call_validation"
    description = "Ensures correct API endpoints were called"
    
    def __init__(
        self,
        required_apis: list[str],
        config: CriterionConfig | None = None,
    ):
        super().__init__(config)
        self.required_apis = required_apis
    
    async def evaluate(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        # Extract API calls from trajectory
        api_calls = [
            step.name for step in actual.trajectory
            if step.step_type == StepType.TOOL and step.name in self.required_apis
        ]
        
        # Check coverage
        missing = set(self.required_apis) - set(api_calls)
        score = len(api_calls) / len(self.required_apis) if self.required_apis else 1.0
        
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            details={
                "called": api_calls,
                "missing": list(missing),
                "coverage": f"{len(api_calls)}/{len(self.required_apis)}",
            },
        )
```

### Stateful Criteria

For criteria that need to maintain state across evaluations:

```python
class PerformanceCriterion(BaseCriterion):
    """Tracks performance metrics across evaluations."""
    
    name = "performance"
    description = "Monitors response time and resource usage"
    
    def __init__(self, config: CriterionConfig | None = None):
        super().__init__(config)
        self.metrics = []
    
    async def evaluate(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        # Calculate metrics
        duration = actual.end_time - actual.start_time if actual.start_time else 0
        tool_count = len([s for s in actual.trajectory if s.step_type == StepType.TOOL])
        
        # Store for later analysis
        self.metrics.append({
            "duration": duration,
            "tool_count": tool_count,
            "eval_id": expected.eval_id,
        })
        
        # Score based on performance
        score = 1.0 if duration < 5.0 else max(0.0, 1.0 - (duration - 5.0) / 10.0)
        
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            details={
                "duration_seconds": duration,
                "tool_calls": tool_count,
            },
        )
    
    def get_stats(self) -> dict:
        """Get aggregate statistics."""
        if not self.metrics:
            return {}
        
        durations = [m["duration"] for m in self.metrics]
        return {
            "avg_duration": sum(durations) / len(durations),
            "max_duration": max(durations),
            "min_duration": min(durations),
            "total_evaluations": len(self.metrics),
        }
```

---

## Multi-Agent Evaluation

### Evaluating Agent Handoffs

```python
class HandoffCriterion(BaseCriterion):
    """Validates agent-to-agent handoffs."""
    
    name = "handoff_validation"
    description = "Ensures proper handoffs between specialized agents"
    
    def __init__(
        self,
        expected_agent_sequence: list[str],
        config: CriterionConfig | None = None,
    ):
        super().__init__(config)
        self.expected_sequence = expected_agent_sequence
    
    async def evaluate(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        # Extract agent transitions from trajectory
        agent_sequence = []
        current_agent = None
        
        for step in actual.trajectory:
            if step.step_type == StepType.NODE and "agent" in step.metadata:
                agent = step.metadata["agent"]
                if agent != current_agent:
                    agent_sequence.append(agent)
                    current_agent = agent
        
        # Compare sequences
        if len(agent_sequence) != len(self.expected_sequence):
            score = 0.5
        else:
            matches = sum(
                a == e for a, e in zip(agent_sequence, self.expected_sequence)
            )
            score = matches / len(self.expected_sequence)
        
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            details={
                "expected_sequence": self.expected_sequence,
                "actual_sequence": agent_sequence,
            },
        )
```

---

## RAG-Specific Evaluation

### Source Citation Validation

```python
class CitationCriterion(BaseCriterion):
    """Validates that responses cite sources correctly."""
    
    name = "citation_validation"
    description = "Ensures claims are properly cited"
    
    async def evaluate(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        response = actual.final_response
        
        # Extract citations (assuming [1], [2] format)
        import re
        citations = re.findall(r'\[(\d+)\]', response)
        
        # Extract retrieved documents from trajectory
        retrieved_docs = []
        for step in actual.trajectory:
            if step.step_type == StepType.TOOL and step.name == "retrieve_documents":
                result = step.metadata.get("result", [])
                retrieved_docs.extend(result)
        
        # Validate all citations reference retrieved docs
        valid_citations = [
            c for c in citations 
            if int(c) <= len(retrieved_docs)
        ]
        
        score = len(valid_citations) / len(citations) if citations else 1.0
        
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            details={
                "total_citations": len(citations),
                "valid_citations": len(valid_citations),
                "retrieved_docs": len(retrieved_docs),
            },
        )
```

### Context Relevance

```python
class ContextRelevanceCriterion(BaseCriterion):
    """Evaluates relevance of retrieved context."""
    
    name = "context_relevance"
    description = "Measures how relevant retrieved documents are to the query"
    
    async def evaluate(
        self,
        actual: TrajectoryCollector,
        expected: EvalCase,
    ) -> CriterionResult:
        # Get query and retrieved docs
        query = expected.conversation[0].user_content.get_text()
        
        retrieved_docs = []
        for step in actual.trajectory:
            if step.step_type == StepType.TOOL and "retrieve" in step.name:
                docs = step.metadata.get("result", [])
                retrieved_docs.extend(docs)
        
        if not retrieved_docs:
            return CriterionResult.failure(
                self.name,
                0.0,
                self.threshold,
                details={"error": "No documents retrieved"},
            )
        
        # Use LLM to judge relevance
        from litellm import acompletion
        
        prompt = f"""Rate the relevance of these documents to the query on a scale of 0-1.

Query: {query}

Documents:
{chr(10).join(f"{i+1}. {doc}" for i, doc in enumerate(retrieved_docs))}

Return only a number between 0 and 1."""
        
        response = await acompletion(
            model=self.config.judge_model,
            messages=[{"role": "user", "content": prompt}],
        )
        
        score = float(response.choices[0].message.content.strip())
        
        return CriterionResult(
            criterion=self.name,
            score=score,
            passed=score >= self.threshold,
            threshold=self.threshold,
            details={
                "num_docs": len(retrieved_docs),
            },
        )
```

---

## Batch Processing

### Evaluating Multiple Agents

```python
async def evaluate_multiple_agents(
    agents: dict[str, CompiledGraph],
    eval_sets: dict[str, EvalSet],
    config: EvalConfig,
) -> dict[str, EvalReport]:
    """Evaluate multiple agents against their eval sets."""
    from agentflow.evaluation import AgentEvaluator
    
    reports = {}
    
    for agent_name, graph in agents.items():
        eval_set = eval_sets.get(agent_name)
        if not eval_set:
            continue
        
        evaluator = AgentEvaluator(graph, config)
        report = await evaluator.evaluate(eval_set)
        reports[agent_name] = report
    
    return reports
```

### Comparative Analysis

```python
def compare_agent_performance(reports: dict[str, EvalReport]):
    """Compare performance across multiple agents."""
    comparison = []
    
    for agent_name, report in reports.items():
        comparison.append({
            "agent": agent_name,
            "pass_rate": report.summary.pass_rate,
            "avg_score": report.summary.avg_score,
            "total_cases": report.summary.total_cases,
            "failed_cases": report.summary.failed_cases,
        })
    
    # Sort by pass rate
    comparison.sort(key=lambda x: x["pass_rate"], reverse=True)
    
    # Print comparison table
    print("\n{:<20} {:>10} {:>10} {:>10}".format(
        "Agent", "Pass Rate", "Avg Score", "Failed"
    ))
    print("-" * 60)
    
    for row in comparison:
        print("{:<20} {:>9.1%} {:>10.2f} {:>10}".format(
            row["agent"],
            row["pass_rate"],
            row["avg_score"],
            row["failed_cases"],
        ))
    
    return comparison
```

---

## Regression Testing

### Tracking Performance Over Time

```python
import json
from pathlib import Path
from datetime import datetime

class RegressionTracker:
    """Track evaluation results over time."""
    
    def __init__(self, history_file: str = "eval_history.json"):
        self.history_file = Path(history_file)
        self.history = self._load_history()
    
    def _load_history(self) -> list[dict]:
        if self.history_file.exists():
            with open(self.history_file) as f:
                return json.load(f)
        return []
    
    def save_report(
        self,
        report: EvalReport,
        git_commit: str | None = None,
    ) -> None:
        """Save report to history."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "eval_set_id": report.eval_set_id,
            "pass_rate": report.summary.pass_rate,
            "avg_score": report.summary.avg_score,
            "failed_cases": report.summary.failed_cases,
            "git_commit": git_commit,
            "criterion_stats": {
                name: {
                    "avg_score": stats.avg_score,
                    "passed": stats.passed,
                }
                for name, stats in report.summary.criterion_stats.items()
            },
        }
        
        self.history.append(entry)
        
        with open(self.history_file, "w") as f:
            json.dump(self.history, f, indent=2)
    
    def check_regression(
        self,
        current_report: EvalReport,
        threshold: float = 0.05,
    ) -> dict:
        """Check if current results show regression."""
        if not self.history:
            return {"regression": False, "message": "No history to compare"}
        
        # Get previous results for same eval set
        previous = [
            h for h in self.history
            if h["eval_set_id"] == current_report.eval_set_id
        ]
        
        if not previous:
            return {"regression": False, "message": "No previous results"}
        
        last = previous[-1]
        
        # Compare pass rate
        current_pass_rate = current_report.summary.pass_rate
        previous_pass_rate = last["pass_rate"]
        
        diff = current_pass_rate - previous_pass_rate
        
        if diff < -threshold:
            return {
                "regression": True,
                "message": f"Pass rate decreased by {abs(diff)*100:.1f}%",
                "current": current_pass_rate,
                "previous": previous_pass_rate,
            }
        
        return {
            "regression": False,
            "improvement": diff > threshold,
            "diff": diff,
        }
```

### Usage in CI

```python
# ci_eval.py
import sys
from agentflow.evaluation import AgentEvaluator, EvalConfig

async def main():
    # Run evaluation
    evaluator = AgentEvaluator(graph, EvalConfig.default())
    report = await evaluator.evaluate("tests/fixtures/main.evalset.json")
    
    # Track regression
    tracker = RegressionTracker()
    
    import subprocess
    git_commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"]
    ).decode().strip()
    
    tracker.save_report(report, git_commit)
    
    # Check for regression
    regression = tracker.check_regression(report)
    
    if regression["regression"]:
        print(f"❌ REGRESSION DETECTED: {regression['message']}")
        sys.exit(1)
    elif regression.get("improvement"):
        print(f"✅ IMPROVEMENT: Pass rate increased by {regression['diff']*100:.1f}%")
    else:
        print(f"✅ No regression detected")
    
    # Require minimum pass rate
    if report.summary.pass_rate < 0.95:
        print(f"❌ Pass rate {report.summary.pass_rate*100:.1f}% below required 95%")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

---

## Cost Optimization

### Selective LLM-as-Judge

Only use expensive LLM criteria on failures:

```python
async def smart_evaluate(
    evaluator: AgentEvaluator,
    eval_set: EvalSet,
) -> EvalReport:
    """Run fast criteria first, then LLM judge on failures."""
    
    # Phase 1: Fast deterministic criteria
    fast_config = EvalConfig(
        criteria={
            "trajectory_match": CriterionConfig(enabled=True),
            "response_match": CriterionConfig(enabled=True),
        }
    )
    
    fast_evaluator = AgentEvaluator(evaluator.graph, fast_config)
    report = await fast_evaluator.evaluate(eval_set)
    
    # Phase 2: LLM judge only on failures
    if report.failed_cases:
        llm_config = EvalConfig(
            criteria={
                "llm_judge": CriterionConfig(enabled=True),
            }
        )
        
        failed_eval_set = EvalSet(
            eval_set_id=eval_set.eval_set_id,
            name=f"{eval_set.name} (Failures)",
            eval_cases=[
                case for case in eval_set.eval_cases
                if case.eval_id in {r.eval_id for r in report.failed_cases}
            ],
        )
        
        llm_evaluator = AgentEvaluator(evaluator.graph, llm_config)
        llm_report = await llm_evaluator.evaluate(failed_eval_set)
        
        # Merge results
        # ... (implementation details)
    
    return report
```

### Caching LLM Judgments

```python
import hashlib
import json
from pathlib import Path

class CachedLLMJudge:
    """Cache LLM judge results to avoid redundant API calls."""
    
    def __init__(self, cache_dir: str = ".eval_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
    
    def _get_cache_key(
        self,
        actual: str,
        expected: str,
        model: str,
    ) -> str:
        content = f"{actual}||{expected}||{model}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def judge(
        self,
        actual: str,
        expected: str,
        model: str = "gpt-4o-mini",
    ) -> float:
        """Get cached judgment or call LLM."""
        cache_key = self._get_cache_key(actual, expected, model)
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        # Check cache
        if cache_file.exists():
            with open(cache_file) as f:
                return json.load(f)["score"]
        
        # Call LLM
        from litellm import acompletion
        
        response = await acompletion(
            model=model,
            messages=[{
                "role": "user",
                "content": f"Rate similarity 0-1:\n\nActual: {actual}\n\nExpected: {expected}",
            }],
        )
        
        score = float(response.choices[0].message.content.strip())
        
        # Cache result
        with open(cache_file, "w") as f:
            json.dump({"score": score, "model": model}, f)
        
        return score
```

---

## Best Practices Summary

### 1. Start with Fast Criteria

```python
# Good: Fast feedback
config = EvalConfig(
    criteria={
        "trajectory_match": CriterionConfig(enabled=True),
        "response_match": CriterionConfig(enabled=True),
    }
)
```

### 2. Use Appropriate Thresholds

```python
# Critical functionality: strict threshold
"trajectory_match": CriterionConfig(threshold=0.95)

# Subjective quality: looser threshold  
"llm_judge": CriterionConfig(threshold=0.65)
```

### 3. Organize Eval Sets by Purpose

```
tests/fixtures/
├── smoke_tests.evalset.json       # Fast, catches major issues
├── integration.evalset.json       # Full feature coverage
├── edge_cases.evalset.json        # Unusual inputs
└── performance.evalset.json       # Load/stress testing
```

### 4. Monitor Costs

```python
# Track LLM usage
import litellm
litellm.set_verbose = True

# Use cheaper models for bulk testing
config = EvalConfig(
    criteria={
        "llm_judge": CriterionConfig(
            judge_model="gpt-4o-mini",  # Cheaper
        ),
    }
)
```

### 5. Version Control Eval Sets

```bash
# Track changes
git add tests/fixtures/*.evalset.json
git commit -m "Update eval sets for new feature"

# Tag releases
git tag -a eval-v1.0 -m "Baseline evaluation set"
```

### 6. Document Criteria Choices

```python
# Document why you chose specific criteria
config = EvalConfig(
    criteria={
        # Critical: ensure correct APIs are called
        "trajectory_match": CriterionConfig(threshold=1.0),
        
        # Important: response should be relevant
        "response_match": CriterionConfig(threshold=0.7),
        
        # Nice to have: semantic quality
        "llm_judge": CriterionConfig(threshold=0.6),
    }
)
```
