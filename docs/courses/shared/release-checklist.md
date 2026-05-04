---
title: GenAI Application Release Checklist
description: A comprehensive release checklist for GenAI applications built with AgentFlow. Part of the AgentFlow genai course guide for production-ready Python AI agents.
keywords:
  - genai course
  - ai agent course
  - agent engineering course
  - agentflow
  - python ai agent framework
  - genai application release checklist
---


# GenAI Application Release Checklist

Use this checklist before deploying any GenAI application to production. It covers evaluation, safety, cost, monitoring, and documentation.

---

## Pre-Release Evaluation

### Functional Requirements

| Item | Status | Notes |
|------|--------|-------|
| [ ] All golden dataset tests pass (≥90%) | | |
| [ ] Schema compliance: 100% | | |
| [ ] Safety refusal rate: 100% for test cases | | |
| [ ] LLM-as-Judge average score ≥4/5 | | |
| [ ] Latency p95 < target (e.g., 3 seconds) | | |
| [ ] Error rate < target (e.g., 1%) | | |

### Regression Testing

| Item | Status | Notes |
|------|--------|-------|
| [ ] Core functionality tests pass | | |
| [ ] Tool integrations work correctly | | |
| [ ] State/memory persistence works | | |
| [ ] Streaming responses work | | |
| [ ] Structured outputs validate correctly | | |

---

## Safety and Security

### Input Validation

| Item | Status | Notes |
|------|--------|-------|
| [ ] Input length validation | | |
| [ ] Prompt injection detection | | |
| [ ] PII scrubbing (if required) | | |
| [ ] Rate limiting configured | | |
| [ ] File upload validation (type, size) | | |

### Output Safety

| Item | Status | Notes |
|------|--------|-------|
| [ ] PII filtering implemented | | |
| [ ] Content moderation (if needed) | | |
| [ ] Output length limits enforced | | |
| [ ] Schema validation on all outputs | | |

### Access Control

| Item | Status | Notes |
|------|--------|-------|
| [ ] Authentication required | | |
| [ ] Authorization levels configured | | |
| [ ] API keys/secrets secured | | |
| [ ] Audit logging enabled | | |

---

## Cost Management

### Cost Controls

| Item | Status | Notes |
|------|--------|-------|
| [ ] Cost per request estimated | | |
| [ ] Daily budget alert set | | |
| [ ] Monthly budget limit configured | | |
| [ ] Token usage logging | | |
| [ ] Model routing configured (if applicable) | | |

### Cost Estimates

| Metric | Estimate | Target |
|--------|----------|--------|
| Cost per 1000 requests | | |
| Daily request volume | | |
| Monthly projected cost | | |
| p95 latency | | |

---

## Monitoring and Observability

### Logging

| Item | Status | Notes |
|------|--------|-------|
| [ ] Request logging enabled | | |
| [ ] Error logging with stack traces | | |
| [ ] Tool call logging | | |
| [ ] Latency tracking | | |

### Metrics

| Item | Status | Notes |
|------|--------|-------|
| [ ] Request count | | |
| [ ] Error rate | | |
| [ ] Latency p50, p95, p99 | | |
| [ ] Token usage | | |
| [ ] Quality metrics (if tracked) | | |

### Alerts

| Item | Status | Notes |
|------|--------|-------|
| [ ] Error rate alert (> threshold) | | |
| [ ] Latency alert (> p95 threshold) | | |
| [ ] Cost alert (daily budget) | | |
| [ ] Health check endpoint | | |

---

## Documentation

### API Documentation

| Item | Status | Notes |
|------|--------|-------|
| [ ] API endpoints documented | | |
| [ ] Request/response schemas documented | | |
| [ ] Error codes documented | | |
| [ ] Authentication documented | | |

### User Documentation

| Item | Status | Notes |
|------|--------|-------|
| [ ] User guide created | | |
| [ ] Examples provided | | |
| [ ] Limitations documented | | |
| [ ] Support contacts provided | | |

### Operations Documentation

| Item | Status | Notes |
|------|--------|-------|
| [ ] Runbook created | | |
| [ ] Deployment instructions | | |
| [ ] Rollback procedures tested | | |
| [ ] On-call guide created | | |

---

## Deployment

### Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| [ ] Environment variables configured | | |
| [ ] Secrets secured (not in code) | | |
| [ ] Health checks configured | | |
| [ ] Graceful shutdown implemented | | |
| [ ] Containerization (if applicable) | | |

### Testing in Staging

| Item | Status | Notes |
|------|--------|-------|
| [ ] Staging deployment successful | | |
| [ ] Smoke tests pass | | |
| [ ] Load tests pass | | |
| [ ] Integration tests pass | | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Product Owner | | | |
| Security Review | | | |
| QA Sign-off | | | |

---

## Quick Summary

Before shipping, verify:

1. **Eval Pass** — Quality tests green
2. **Safety** — No PII leaks, no harmful outputs
3. **Cost** — Budget alerts configured
4. **Monitoring** — Logs, metrics, alerts working
5. **Docs** — API docs, user guide, runbook complete

---

## Related Checklists

- [Design checklists](/docs/courses/shared/design-checklists.md) — Design-time decisions
- [Evaluation worksheet](/docs/courses/shared/evaluation-worksheet.md) — How to build evaluations
- [Beginner Lesson 7](/docs/courses/genai-beginner/lesson-7-evals-safety-cost-and-release.md) — Lesson on release practices
- [Advanced Lesson 8](/docs/courses/genai-advanced/lesson-8-observability-testing-security-and-deployment.md) — Production readiness
