---
title: Evaluation Worksheet — AgentFlow Python AI Agent Framework
sidebar_label: Evaluation Worksheet
description: A practical worksheet for designing and running evaluations for GenAI systems. Part of the AgentFlow genai course guide for production-ready Python AI agents.
keywords:
  - genai course
  - ai agent course
  - agent engineering course
  - agentflow
  - python ai agent framework
  - evaluation worksheet
---


# Evaluation Worksheet

Use this worksheet to design an evaluation system for your GenAI application. A good evaluation is essential for shipping reliable AI features.

## Step 1: Define What You're Evaluating

Before writing tests, define what "good" means for your system.

### Functional Requirements

| Question | Your Answer |
|----------|-------------|
| What task does the system perform? | |
| What are acceptable outputs? | |
| What are clearly unacceptable outputs? | |
| Are there any safety requirements? | |

### Quality Dimensions

Rate importance (1-5) for your use case:

| Dimension | Score | What It Means |
|-----------|-------|---------------|
| **Accuracy** | /5 | Output is factually correct |
| **Relevance** | /5 | Output addresses the user's question |
| **Completeness** | /5 | Output includes all necessary information |
| **Consistency** | /5 | Similar inputs produce similar outputs |
| **Safety** | /5 | No harmful or inappropriate content |
| **Latency** | /5 | Response time is acceptable |

## Step 2: Build Your Golden Dataset

A golden dataset is a collection of inputs with expected outputs.

### Golden Dataset Template

```csv
id,input,expected_output,expected_category,notes
g001,"How do I reset my password?","Click 'Forgot Password' on the login page...",informational,Main path
g002,"I can't login","Check if you're using the correct email...",troubleshooting,Common issue
g003,"Delete all my data",REJECT,"",safety test - should refuse
g004,"What's 2+2?","4",informational,Edge case - factual
```

### Golden Dataset Guidelines

| Guideline | Why |
|-----------|-----|
| **Cover main paths** | At least 20-30 examples for core functionality |
| **Include edge cases** | Boundary conditions, unusual inputs |
| **Add negative examples** | Invalid inputs, safety tests, should-fail cases |
| **Update regularly** | Add examples from production failures |

### Example: Golden Dataset Entry

```python
from dataclasses import dataclass

@dataclass
class GoldenExample:
    id: str
    input: str
    expected_output: str | None  # None for should-fail cases
    expected_category: str
    metadata: dict = None

# Example
golden = GoldenExample(
    id="qa_001",
    input="How do I reset my password?",
    expected_output="Click 'Forgot Password' on the login page...",
    expected_category="informational",
    metadata={"channel": "chat", "user_type": "new"}
)
```

## Step 3: Define Evaluation Metrics

### Quantitative Metrics

| Metric | How to Measure | Target |
|--------|---------------|--------|
| **Exact Match** | Output == expected exactly | Varies |
| **Contains Key Phrases** | Output contains required terms | >95% |
| **Semantic Similarity** | Embedding similarity to expected | >0.85 |
| **Schema Compliance** | Output matches required JSON schema | 100% |
| **Classification Accuracy** | Correct category assigned | >90% |

### Qualitative Checks (Human Review)

| Check | Frequency | Who |
|-------|-----------|-----|
| Random sampling | 5% of outputs | QA team |
| Escalated issues | 100% | Senior review |
| Safety concerns | 100% | Safety team |

## Step 4: Build Automated Tests

### Test Structure Template

```python
import pytest
from agentflow.testing import Evaluator

class TestQASystem:
    @pytest.fixture
    def evaluator(self):
        return Evaluator(
            golden_path="tests/golden/qa_examples.csv",
            model=qa_agent
        )
    
    def test_exact_match_examples(self, evaluator):
        """Test examples where we expect exact answers."""
        results = evaluator.evaluate(
            filter_category="informational",
            metric="exact_match"
        )
        assert results["exact_match_rate"] > 0.7
    
    def test_refuses_destructive_requests(self, evaluator):
        """Safety test: system should refuse harmful requests."""
        results = evaluator.evaluate(
            filter_category="safety",
            metric="refusal_rate"
        )
        assert results["refusal_rate"] == 1.0
    
    def test_schema_compliance(self, evaluator):
        """All outputs should match expected schema."""
        results = evaluator.evaluate(
            metric="schema_validation"
        )
        assert results["compliance_rate"] == 1.0
```

### LLM-as-Judge Pattern

For subjective quality checks, use an LLM to evaluate outputs:

```python
def llm_judge_eval(prompt: str, output: str, criteria: str) -> dict:
    judge_prompt = f"""
    Evaluate this AI output against the criteria.

    Task: {prompt}
    Output: {output}
    
    Criteria: {criteria}
    
    Respond with JSON:
    {{
        "score": 1-5,
        "reasoning": "brief explanation",
        "passed": true/false
    }}
    """
    
    response = llm.generate(judge_prompt)
    return json.loads(response)
```

## Step 5: Set Up Continuous Evaluation

### Evaluation Pipeline

```mermaid
flowchart LR
    subgraph Pipeline["Continuous Evaluation"]
        Commit["Code Commit"] --> Test["Run Test Suite"]
        Test --> |"Pass"| Deploy["Deploy"]
        Test --> |"Fail"| Fix["Fix Issues"]
        Fix --> Test
        
        Schedule["Daily: Run full eval"] --> Report["Update Metrics"]
        Report --> |"Regression"| Alert["Alert Team"]
    end
```

### Regression Testing

| When | What | Action |
|------|------|--------|
| Every commit | Unit tests, schema validation | Block if fail |
| Daily | Full golden dataset | Report trends |
| Weekly | Random production sample | Human review |
| Pre-release | Complete evaluation | Go/no-go |

## Step 6: Create Your Evaluation Scorecard

### Scorecard Template

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Exact match rate | >80% | 85% | ✅ Pass |
| Schema compliance | 100% | 100% | ✅ Pass |
| Safety refusal rate | 100% | 100% | ✅ Pass |
| Latency p95 | Less than 2s | 1.8s | ✅ Pass |
| Semantic similarity | >0.85 | 0.82 | ⚠️ Monitor |
| User satisfaction | >4/5 | 4.2/5 | ✅ Pass |

### Threshold Guidelines

| Quality Level | Description | When Acceptable |
|---------------|-------------|-----------------|
| **Excellent** | Meets or exceeds human baseline | Production ready |
| **Good** | Minor issues, easily handled | Production with monitoring |
| **Acceptable** | Works for most cases | Beta, with user feedback |
| **Needs Work** | Frequent failures | Internal testing only |
| **Poor** | Unreliable | Not ready for users |

## Step 7: Document and Iterate

### Evaluation Report Template

```markdown
## Evaluation Report: [System Name]
**Date:** YYYY-MM-DD
**Evaluated by:** [Name]

### Summary
[Brief overview of results]

### Metrics
| Metric | Target | Actual | Status |
|--------|--------|---------|--------|

### Failure Analysis
[Analysis of any failures or regressions]

### Recommendations
[Suggested improvements]

### Next Evaluation
[Scheduled date and focus areas]
```

### Iteration Checklist

- [ ] Review evaluation results weekly
- [ ] Add failing cases to golden dataset
- [ ] Update prompts based on failure analysis
- [ ] Retest after changes
- [ ] Document lessons learned

## Quick Start: 10-Case Evaluation

For quick validation, start with these 10 cases:

1. **Happy path** — Normal, expected input
2. **Edge case** — Boundary condition input
3. **Ambiguous** — Vague or unclear input
4. **Out of scope** — Input the system shouldn't handle
5. **Safety test** — Harmful request
6. **Contradictory** — Conflicting information
7. **Long input** — Maximum length input
8. **Short input** — Minimal input
9. **Multi-part** — Multiple questions in one
10. **Re-phrased** — Same question, different words

## Related Resources

- [Beginner Lesson 7: Evals, safety, cost, and release](../genai-beginner/lesson-7-evals-safety-cost-and-release.md)
- [Advanced Lesson 8: Observability, testing, security, and deployment](../genai-advanced/lesson-8-observability-testing-security-and-deployment.md)
- [AgentFlow Evaluation Reference](/docs/reference/python/evaluation.md)
