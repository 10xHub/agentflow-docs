---
title: Shared Foundations
seoTitle: "GenAI course shared foundations"
description: Prerequisite concepts shared by both 10xGraph GenAI courses, to read before you start either learning path.
section: Courses
group: Shared foundations
order: 2300
label: Shared Foundations
updated: "2026-07-21"
---

These pages cover concepts that both the Beginner and Advanced courses rely on. They provide just enough theory to understand system behavior without becoming a separate ML course.

## Why These Topics Are Shared

Both courses need a common vocabulary for:

- **Tokenization and context windows** — to reason about prompt size and cost
- **Embeddings and similarity** — to understand retrieval
- **Transformers and attention** — to understand why context design matters
- **Prompt patterns** — to build reliable outputs

```mermaid
flowchart LR
    subgraph Beginner["Beginner Course"]
        B1["Lesson 1"]
        B2["Lesson 2"]
        B3["Lesson 4"]
    end
    
    subgraph Advanced["Advanced Course"]
        A1["Lesson 2"]
        A2["Lesson 3"]
        A3["Lesson 4"]
    end
    
    subgraph Shared["Shared Foundations"]
        S1["LLM Basics"]
        S2["Transformers"]
        S3["Tokens & Context"]
        S4["Embeddings"]
        S5["Chunking"]
        S6["Prompt Patterns"]
    end
    
    S1 & S2 & S3 & S4 & S5 & S6 --> B1 & B2 & B3
    S1 & S2 & S3 & S4 & S5 & S6 --> A1 & A2 & A3
```

## Pages in This Section

### Foundational Concepts

| Page | What You'll Learn |
|------|-------------------|
| [LLM basics for engineers](/docs/courses/shared/llm-basics-for-engineers) | What LLMs are, how they work, and why they're probabilistic |
| [Transformer basics](/docs/courses/shared/transformer-basics) | Self-attention, context windows, and architecture intuition |
| [Tokenization and context windows](/docs/courses/shared/tokenization-and-context-windows) | Token budgeting, context limits, and cost reasoning |

### Retrieval Foundations

| Page | What You'll Learn |
|------|-------------------|
| [Embeddings and similarity](/docs/courses/shared/embeddings-vectorization-and-similarity) | Vector representations, cosine similarity, nearest-neighbor |
| [Chunking and retrieval primitives](/docs/courses/shared/chunking-and-retrieval-primitives) | Document preparation, top-k retrieval, and reranking |

### Reference Material

| Page | What You'll Learn |
|------|-------------------|
| [Prompt and output patterns cheatsheet](/docs/courses/shared/prompt-and-output-patterns-cheatsheet) | Reusable patterns for prompting and structured output |
| [Glossary](/docs/courses/shared/glossary) | Definitions of key terms used throughout both courses |
| [Design checklists](/docs/courses/shared/design-checklists) | Decision checklists for GenAI system design |
| [Evaluation worksheet](/docs/courses/shared/evaluation-worksheet) | Practical guide to building evaluations |

## How to Use These Pages

### For the Beginner Course

Read these pages **before** or **alongside** the lessons:

1. [LLM basics for engineers](/docs/courses/shared/llm-basics-for-engineers) → Before Lesson 1
2. [Tokenization and context windows](/docs/courses/shared/tokenization-and-context-windows) → Before Lesson 2
3. [Embeddings and similarity](/docs/courses/shared/embeddings-vectorization-and-similarity) → Before Lesson 4
4. [Prompt and output patterns cheatsheet](/docs/courses/shared/prompt-and-output-patterns-cheatsheet) → Reference throughout

### For the Advanced Course

These pages serve as a **refresher and common vocabulary**:

- [Context engineering recap](/docs/courses/shared/tokenization-and-context-windows) → Lesson 3
- [Retrieval architecture](/docs/courses/shared/chunking-and-retrieval-primitives) → Lesson 4
- [Design checklists](/docs/courses/shared/design-checklists) → Reference for architecture decisions
- [Glossary](/docs/courses/shared/glossary) → For consistent terminology

## Key Principles

### 1. Enough Theory, Not Too Much

These pages teach concepts needed for building, not for publishing papers. We skip:

- ❌ Matrix derivations and math
- ❌ Full training pipeline details
- ❌ Exhaustive benchmark comparisons

We focus on:

- ✅ Mental models that predict system behavior
- ✅ Engineering decisions and tradeoffs
- ✅ Practical patterns that work

### 2. Theory → Practice → Theory

Each page includes:

1. Conceptual explanation with diagrams
2. Practical code examples
3. Design implications

### 3. Consistent Terminology

Both courses use these terms consistently. If you see a term you don't recognize, check the [Glossary](/docs/courses/shared/glossary).

## Next Steps

- Continue to [LLM basics for engineers](/docs/courses/shared/llm-basics-for-engineers) to start learning
- Or jump directly to a course:
  - [Beginner Course: Start here](/docs/courses/genai-beginner)
  - [Advanced Course: Start here](/docs/courses/genai-advanced)
