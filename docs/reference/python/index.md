---
title: Python Library
description: Reference entry point for the core AgentFlow Python library.
slug: /reference/python
---

# Python library reference

This section documents the `agentflow` Python package: the core runtime for workflows, agents, tools, state, checkpoints, stores, callbacks, and evaluation primitives.

:::note Source alignment
Before removing draft labels from deeper reference pages, check each behavior against the current `agentflow` source.
:::

## Reference map

| Area | What belongs here |
| --- | --- |
| Workflows and graph execution | State graph creation, node registration, routing, compilation, invocation, and end states. |
| Agent class | Model configuration, system prompts, tool access, and runtime behavior. |
| Tool decorator and filtering | How tools are declared, validated, selected, and executed. |
| State and messages | Agent state schemas, message helpers, media, and state update rules. |
| Checkpointer interface | Thread persistence, resumable runs, and checkpoint lifecycle. |
| Store and embedding store | Long-term memory, vector-backed lookups, and storage contracts. |
| Callbacks and publishers | Observability hooks, streaming events, and integration callbacks. |
| Evaluation utilities | Test helpers, trajectory checks, and evaluation data models. |

Reference pages should be factual and complete. Beginner explanation belongs in Get Started and Concepts.
