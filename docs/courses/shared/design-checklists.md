---
title: Design Checklists — AgentFlow Python AI Agent Framework
sidebar_label: Design Checklists
description: Decision checklists for GenAI system design across both beginner and advanced tracks. Part of the AgentFlow genai course guide for production-ready Python AI.
keywords:
  - genai course
  - ai agent course
  - agent engineering course
  - agentflow
  - python ai agent framework
  - design checklists
---


# Design Checklists

Use these checklists to make sure your GenAI system design is complete before implementation.

## Use Case Fit Checklist

Before starting any GenAI project, answer these questions:

### Problem Fit

- [ ] Is the task mostly deterministic or does it require judgment?
- [ ] Would a rule-based system work? If not, why?
- [ ] Is the task something LLMs are good at (generation, summarization, classification)?
- [ ] Is the task something LLMs struggle with (precise calculations, real-time data)?

### LLM vs. Workflow Decision

- [ ] **Use a workflow** if: Task is mostly sequential, steps are known, no real judgment needed
- [ ] **Use a single agent** if: Task has branching, needs tool use, context-dependent decisions
- [ ] **Use multiple agents** if: Tasks require different expertise, parallel processing needed, or complex handoffs

### Output Requirements

- [ ] Do you need structured output (JSON, specific format)?
- [ ] Is freeform text acceptable?
- [ ] Do you need citations or source tracking?
- [ ] Are there latency requirements?

## Model Selection Checklist

### Capability Requirements

- [ ] What modality do you need? (text only, images, audio, video)
- [ ] Do you need function calling / tool use support?
- [ ] Do you need structured outputs?
- [ ] What context window size do you need?

### Cost and Latency

- [ ] What is your latency budget? (real-time < 1s, async < 30s, batch acceptable)
- [ ] What is your cost ceiling per request?
- [ ] Can you cache prompts to reduce costs?
- [ ] Is latency or cost more critical for your use case?

### Quality Requirements

- [ ] What quality level is acceptable?
- [ ] Do you need reasoning capabilities (o1, o3, Claude extended thinking)?
- [ ] Have you tested multiple models on your specific use case?

## Prompt Design Checklist

### Structure

- [ ] Is the system instruction clear and specific?
- [ ] Are there explicit format instructions?
- [ ] Is the task clearly defined at the end?
- [ ] Have you placed important instructions at the beginning and end?

### Examples

- [ ] Do you have few-shot examples for complex formats?
- [ ] Are examples representative of edge cases?
- [ ] Are examples in the same format you expect?

### Context Management

- [ ] Is all necessary context included?
- [ ] Is unnecessary context removed?
- [ ] Is the most important information last (recency effect)?

## Tool Design Checklist

### Safety

- [ ] Are destructive operations (DELETE, DROP) restricted?
- [ ] Is PII handling prohibited or limited?
- [ ] Are there rate limits or quotas?
- [ ] Can you trace tool calls to audit logs?

### Design Quality

- [ ] Do tool names clearly describe their function?
- [ ] Are parameters typed and constrained?
- [ ] Are descriptions explicit about preconditions and side effects?
- [ ] Can tools be called idempotently?

### Error Handling

- [ ] What happens when a tool fails?
- [ ] Can the agent retry, or is manual intervention needed?
- [ ] Are error messages user-friendly?

## Retrieval Design Checklist

### Data Preparation

- [ ] Is your data clean and well-structured?
- [ ] Are chunk boundaries semantically coherent?
- [ ] Do chunks have metadata for filtering and citation?
- [ ] Is the data fresh enough for your use case?

### Retrieval Strategy

- [ ] Have you chosen an appropriate chunk size?
- [ ] Do you need hybrid search (vector + keyword)?
- [ ] Do you need reranking?
- [ ] How many chunks do you retrieve?

### Grounding

- [ ] Does the model cite sources?
- [ ] Can users verify citations?
- [ ] Is hallucination risk mitigated?

## State and Memory Checklist

### State Management

- [ ] What state needs to persist across interactions?
- [ ] Is state stored in thread or in external memory?
- [ ] Do you need checkpointing for resumability?

### Memory Design

- [ ] What memories should be short-term (thread)?
- [ ] What memories should be long-term (store)?
- [ ] When should memories be summarized vs. stored raw?

### Streaming

- [ ] Should responses be streamed for better UX?
- [ ] Can the client handle streaming?
- [ ] Do you need to update UI during generation?

## Multi-Agent Design Checklist

### Architecture Decision

- [ ] Have you justified why single agent isn't sufficient?
- [ ] Is the task complex enough to warrant multiple agents?
- [ ] Can a router classify and delegate tasks?

### Handoff Design

- [ ] Are handoff points clearly defined?
- [ ] Does context transfer correctly between agents?
- [ ] Is failure handling defined for handoff failures?

### Human-in-the-Loop

- [ ] Are there approval gates for risky actions?
- [ ] Can users interrupt and correct agent behavior?
- [ ] Is checkpointing enabled for resumability?

## Evaluation Checklist

### Test Coverage

- [ ] Do you have golden dataset examples?
- [ ] Are edge cases covered?
- [ ] Are failure modes tested?

### Quality Metrics

- [ ] Have you defined success criteria?
- [ ] Can you measure accuracy, relevance, or task completion?
- [ ] Do you have automated regression tests?

### Monitoring

- [ ] Can you track output quality over time?
- [ ] Are there alerts for quality degradation?
- [ ] Can you sample and review outputs?

## Security Checklist

### Prompt Injection

- [ ] Can user input manipulate system behavior?
- [ ] Are retrieved documents sanitized?
- [ ] Do you validate and constrain outputs?

### Access Control

- [ ] Is authentication required?
- [ ] Are there authorization levels?
- [ ] Can you audit who accessed what?

### Data Safety

- [ ] Is PII handled appropriately?
- [ ] Are API keys and secrets protected?
- [ ] Is sensitive data logged?

## Deployment Checklist

### Infrastructure

- [ ] Do you have deployment documentation?
- [ ] Is the system containerized?
- [ ] Are there rollback procedures?

### Monitoring

- [ ] Are there logs for debugging?
- [ ] Can you trace requests end-to-end?
- [ ] Are there cost and usage alerts?

### Reliability

- [ ] Is there retry logic for transient failures?
- [ ] Are there circuit breakers for downstream failures?
- [ ] Is there a runbook for common issues?

## Quick Reference: Decision Tree

```
Start: Do you need an LLM?
│
├─ No → Use traditional software
│
└─ Yes → Is the task deterministic?
         │
         ├─ Yes → Is it sequential?
         │        ├─ Yes → Workflow (no LLM needed)
         │        └─ No → Use LLM for specific steps only
         │
         └─ No → Does it need tool use or context?
                 │
                 ├─ No → Simple prompting + structured output
                 │
                 └─ Yes → Does it need multiple capabilities?
                          │
                          ├─ No → Single agent
                          │
                          └─ Yes → Multiple agents with routing
```

## Related Resources

- [Beginner Lesson 1: Use cases, models, and the LLM app lifecycle](../genai-beginner/lesson-1-use-cases-models-and-app-lifecycle.md)
- [Advanced Lesson 1: Agentic product fit and system boundaries](../genai-advanced/lesson-1-agentic-product-fit-and-system-bounded-autonomy.md)
- [Advanced Lesson 5: Router, manager, and specialist patterns](../genai-advanced/lesson-5-router-manager-and-specialist-patterns.md)
