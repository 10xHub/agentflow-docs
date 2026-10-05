---
title: "AI Agent Use Cases: Build with 10xGraph"
seoTitle: "AI agent use cases with 10xGraph"
description: Reference architectures for customer support, data extraction, coding, research and RAG agents built with 10xGraph, with the tools and failure modes of each.
section: Learn more
group: Use cases
order: 1970
label: Overview
updated: "2026-10-06"
---

The use-case pages are reference architectures for five common agent patterns: customer support, data extraction, coding, research and retrieval-augmented generation (RAG). Each one shows the graph shape, the tools the agent needs, and what to watch in production. They are written for engineers who know what they want to build and want to see how it maps onto 10xGraph before writing code.

## Start here

Begin with the [customer support agent](/docs/use-cases/customer-support-agent). It is the clearest example of a multi-user production agent: a router, a refund specialist, several tools and a handoff to a human. Refunds are the kind of side-effecting tool where replay safety applies, so a crash and resume does not repeat the action. The mechanism is explained in [Replay-safe tools](/docs/concepts/replay-safe-tools).

If your input is documents or messy text, read the [data extraction agent](/docs/use-cases/data-extraction-agent) for the structured-output pattern. For answers grounded in your own content, the [RAG agent](/docs/use-cases/rag-agent) covers retrieval, grounding and citations; the glossary entry [What is RAG?](/docs/glossary/what-is-retrieval-augmented-generation) gives the definition first.

The [research agent](/docs/use-cases/research-agent) combines web search with synthesis and citations, and the [coding agent](/docs/use-cases/coding-agent) covers code generation, review and tool use including production considerations and common mistakes.

## Using these pages

Each architecture is a starting point, not a template to copy. The graph, state and tool patterns are the same across all five, so once one page makes sense the others read quickly. To build one end to end, follow the [beginner path](/docs/beginner) or the [first agent guide](/docs/get-started/first-agent), then return here for the shape of your case. For ready-made agents such as ReAct or RAG, see [Use prebuilt agents](/docs/how-to/python/use-prebuilt-agents).

## Pick a use case

- [**Customer support agent**](/docs/use-cases/customer-support-agent). Multi-tool support flow with handoff to human
- [**Data extraction agent**](/docs/use-cases/data-extraction-agent). Structured data from unstructured input
- [**Coding agent**](/docs/use-cases/coding-agent). Code generation, review, and tool use
- [**Research agent**](/docs/use-cases/research-agent). Web search + synthesis with citations
- [**RAG agent**](/docs/use-cases/rag-agent). Chat-with-your-docs done right

If your use case is not here, start with [Get started](/docs/get-started). The runtime supports any agent shape.
