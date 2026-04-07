---
title: Concepts
description: A draft map of AgentFlow's core concepts.
slug: /concepts
---

# Concepts

Concept pages explain how AgentFlow works after you have seen a workflow run. They are practical, short, and independent of LangGraph knowledge.

:::tip Use concepts for design decisions
Read these pages when you are choosing boundaries, naming state, deciding where persistence belongs, or explaining the stack to another teammate.
:::

## Core map

| Concept | Why it matters |
| --- | --- |
| [Why AgentFlow](./why-agentflow.md) | Understand the product idea and the problems AgentFlow is trying to make repeatable. |
| [Architecture](./architecture.md) | Learn how the Python library, API, client, playground, and docs divide responsibilities. |
| State graphs | Model multi-agent behavior as explicit workflow transitions. |
| Agents and tools | Keep reasoning, capabilities, and application actions separated. |
| State and messages | Make execution data predictable across nodes and API calls. |
| Checkpointing and stores | Preserve threads, memory, and recoverable workflow state. |
| Streaming | Move partial results from runtime to API to client surfaces. |
| Production runtime | Add failure handling, observability, deployment, and team maintenance practices. |

## Concept style

Every concept should explain the idea first, show the smallest useful code or diagram, then link to a deeper tutorial or reference page.

If you are still learning the basics, start with [Get Started](../get-started/index.md). If you already know what you need to do, jump to [How-To Guides](../how-to/index.md).
