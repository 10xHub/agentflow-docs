---
title: Why AgentFlow
description: Understand the product idea behind AgentFlow.
---

# Why AgentFlow

:::note Draft
This page is a sprint-0 placeholder for the final product-positioning concept guide.
:::

AgentFlow exists because agent applications quickly become platform work.

The first demo usually needs only a prompt and a model call. A real application needs a stable shape for:

1. Agent orchestration.
2. Tool execution.
3. State and message handling.
4. Persistence and checkpoints.
5. Streaming and API transport.
6. Frontend integration.
7. Evaluation and production operations.

AgentFlow tries to make those foundations reusable so every team does not have to rebuild them from scratch.

## Design goals

| Goal | Meaning |
| --- | --- |
| Beginner-friendly | A new developer should be able to build one useful agent without learning every abstraction first. |
| Production-aware | The framework should make room for persistence, deployment, error handling, and observability. |
| Full-stack ready | Backend, API, TypeScript client, and hosted playground docs should fit together. |
| Explicit workflows | Multi-agent behavior should be understandable as a workflow, not hidden inside prompt chains. |

## What AgentFlow is not

AgentFlow is not only a prompt helper. It is a framework for building and maintaining agent systems as software products.
