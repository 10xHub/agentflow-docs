---
title: GenAI Beginner Course — AgentFlow Python AI Agent Framework
description: Learn to build production-shaped GenAI applications with AgentFlow from scratch. Part of the AgentFlow genai course guide for production-ready Python AI agents.
keywords:
  - genai course
  - ai agent course
  - agent engineering course
  - agentflow
  - python ai agent framework
  - genai beginner course
---


# GenAI Beginner Course

Build your first production-ready GenAI application with AgentFlow. This course takes you from "I know what an LLM is" to "I can ship a GenAI app with tools, memory, and evaluation."

## What You'll Build

A small engineer-facing assistant that:
- Answers questions using a curated knowledge source
- Uses tools safely (calculator, search, file operations)
- Accepts file or multimodal input
- Returns structured output (JSON)
- Supports thread continuity and memory
- Streams responses to a client
- Includes evaluation and a release checklist

## What You'll Learn

| Lesson | Topic | Key Concept |
|--------|-------|-------------|
| 1 | [Use cases, models, and the LLM app lifecycle](./lesson-1-use-cases-models-and-app-lifecycle.md) | Pick the right use case before building |
| 2 | [Prompting, context engineering, and structured outputs](./lesson-2-prompting-context-and-structured-outputs.md) | Build reliable outputs with schemas |
| 3 | [Tools, files, and MCP basics](./lesson-3-tools-files-and-mcp-basics.md) | Extend the agent with safe tool use |
| 4 | [Retrieval, grounding, and citations](./lesson-4-retrieval-grounding-and-citations.md) | Ground answers in real knowledge |
| 5 | [State, memory, threads, and streaming](./lesson-5-state-memory-threads-and-streaming.md) | Build conversation-aware applications |
| 6 | [Multimodal and client/server integration](./lesson-6-multimodal-and-client-server-integration.md) | Connect to frontends and handle files |
| 7 | [Evals, safety, cost, and release](./lesson-7-evals-safety-cost-and-release.md) | Ship with confidence |

## Course Structure

```mermaid
flowchart LR
    L1[Lesson 1: Use Cases] --> L2[Lesson 2: Prompting]
    L2 --> L3[Lesson 3: Tools]
    L3 --> L4[Lesson 4: Retrieval]
    L4 --> L5[Lesson 5: State & Memory]
    L5 --> L6[Lesson 6: Integration]
    L6 --> L7[Lesson 7: Release]
    L7 --> Capstone[Capstone Project]
```

## Prerequisites

- Python basics (functions, classes, async/await)
- Comfortable with API request/response formats
- No prior LLM or agent experience needed

## Time Commitment

| Component | Time |
|-----------|------|
| 7 lessons | 30-45 min each |
| Capstone exercise | 1-2 hours |
| **Total** | ~5-6 hours |

## How Each Lesson Is Structured

Every lesson includes:

```mermaid
flowchart TB
    subgraph Lesson["Lesson Structure"]
        Concept["1. Concept\nBrief explanation with diagrams"]
        Example["2. Example\nRunnable AgentFlow code"]
        Exercise["3. Exercise\nTry it yourself"]
        Check["4. What you learned\nKey takeaways"]
        Next["5. Next step\nWhere to go next"]
    end
```

1. **Concept** — Brief explanation with diagrams
2. **Example** — Complete, runnable AgentFlow code
3. **Exercise** — Try it yourself with guidance
4. **What you learned** — Key takeaways
5. **Next step** — Where to go next

## AgentFlow Concepts You'll Master

| Concept | Where It's Used |
|---------|----------------|
| [StateGraph](/docs/concepts/state-graph.md) | Lesson 1+ |
| [Tools and validation](/docs/concepts/agents-and-tools.md) | Lesson 3 |
| [Structured outputs](/docs/reference/python/agent.md) | Lesson 2, 7 |
| [Memory and stores](/docs/concepts/memory-and-store.md) | Lesson 4, 5 |
| [Checkpointing](/docs/concepts/checkpointing-and-threads.md) | Lesson 5 |
| [Streaming](/docs/concepts/streaming.md) | Lesson 5, 6 |
| [Client integration](/docs/get-started/connect-client.md) | Lesson 6 |

## Your Learning Path

### Start Here

If you're new to AgentFlow, start with these shared foundations:

1. [LLM basics for engineers](/docs/courses/shared/llm-basics-for-engineers.md) — What LLMs are
2. [Tokenization and context windows](/docs/courses/shared/tokenization-and-context-windows.md) — Why tokens matter
3. [Prompt patterns cheatsheet](/docs/courses/shared/prompt-and-output-patterns-cheatsheet.md) — Reliable prompting

### Then Continue With Lessons

Start with [Lesson 1: Use cases, models, and the LLM app lifecycle](./lesson-1-use-cases-models-and-app-lifecycle.md)

## After This Course

After completing this course, you'll be ready for:

- **Advanced Course**: [Agentic product fit and system boundaries](/docs/courses/genai-advanced/lesson-1-agentic-product-fit-and-system-bounded-autonomy.md)
- **Production deployment**: [How-to guides](/docs/how-to/api-cli/initialize-project.md)
- **Real projects**: Build your own GenAI applications

:::note Coming from the Beginner Path?
If you've already completed the [Beginner Path](/docs/beginner/index.md), this course goes deeper into the "why" and "when" of GenAI system design. The lessons will feel familiar but with more context.
:::

---

**Ready to start?** Begin with [Lesson 1: Use cases, models, and the LLM app lifecycle](./lesson-1-use-cases-models-and-app-lifecycle.md).
