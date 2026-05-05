---
title: Glossary — AgentFlow Python AI Agent Framework
sidebar_label: Glossary
description: Key terms and definitions used throughout the GenAI courses. Part of the AgentFlow genai course guide for production-ready Python AI agents.
keywords:
  - genai course
  - ai agent course
  - agent engineering course
  - agentflow
  - python ai agent framework
  - glossary
---


# Glossary

This glossary defines terms used across both the Beginner and Advanced GenAI courses. It is a quick reference, not a replacement for the full explanations in each lesson.

---

## A

### Agent

A system that uses an LLM to decide which actions to take, can use tools, maintains state across calls, and can operate with varying levels of autonomy.

**Related:** [Beginner Lesson 1: Use cases, models, and the LLM app lifecycle](../genai-beginner/lesson-1-use-cases-models-and-app-lifecycle.md)

### Agentic RAG

A retrieval-augmented generation pattern where the agent decides what to retrieve, when to retrieve, and whether to retrieve again. Contrast with 2-step RAG where retrieval happens once before generation.

**Related:** [Advanced Lesson 4: Knowledge systems and advanced RAG](../genai-advanced/lesson-4-knowledge-systems-and-advanced-rag.md)

### Attention

A mechanism in transformer models that allows each token to attend to all other tokens in the sequence, enabling the model to understand relationships and context.

**Related:** [Shared: Transformer basics](./transformer-basics.md)

---

## B

### Bounded Autonomy

Designing agent behavior so that it operates within explicit limits (step budgets, tool restrictions, approval gates) rather than running unbounded until completion.

**Related:** [Advanced Lesson 2: Single-agent runtime and bounded autonomy](../genai-advanced/lesson-2-single-agent-runtime-and-bounded-autonomy.md)

### BPE (Byte Pair Encoding)

A common tokenization algorithm that splits text into subword units based on frequency. Most modern LLMs use BPE or similar algorithms.

**Related:** [Shared: Tokenization and context windows](./tokenization-and-context-windows.md)

---

## C

### Checkpoint

A snapshot of agent state that enables resuming execution after interruption. Checkpoints store the full conversation history and any intermediate variables.

**Related:** [Beginner Lesson 5: State, memory, threads, and streaming](../genai-beginner/lesson-5-state-memory-threads-and-streaming.md)

### Chunk

A segment of a document created during the ingestion process. Chunk size and overlap affect retrieval quality.

**Related:** [Shared: Chunking and retrieval primitives](./chunking-and-retrieval-primitives.md)

### Citation

A reference to the source document or passage used to ground an LLM's response. Citations increase trust and enable fact-checking.

**Related:** [Beginner Lesson 4: Retrieval, grounding, and citations](../genai-beginner/lesson-4-retrieval-grounding-and-citations.md)

### Context Window

The maximum number of tokens (input + output) that an LLM can process in a single request. Context window size limits how much information you can pass to the model.

**Related:** [Shared: Tokenization and context windows](./tokenization-and-context-windows.md)

### Cosine Similarity

A measure of similarity between two vectors, ranging from -1 to 1. In retrieval, documents with high cosine similarity to a query are considered relevant.

**Related:** [Shared: Embeddings and similarity](./embeddings-vectorization-and-similarity.md)

---

## D

### Deterministic Workflow

A predefined sequence of steps with no LLM decision-making. Contrast with agentic systems where the model chooses actions.

**Related:** [Advanced Lesson 1: Agentic product fit and system boundaries](../genai-advanced/lesson-1-agentic-product-fit-and-system-bounded-autonomy.md)

### Durable Execution

An execution model where long-running tasks survive server restarts and can be resumed from the last checkpoint.

**Related:** [Advanced Lesson 7: Memory, checkpoints, artifacts, and durable execution](../genai-advanced/lesson-7-memory-checkpoints-artifacts-and-durable-execution.md)

---

## E

### Embedding

A numerical representation of text (or other data) as a vector of numbers. Semantically similar texts have embeddings that are close in vector space.

**Related:** [Shared: Embeddings and similarity](./embeddings-vectorization-and-similarity.md)

### Eval (Evaluation)

A systematic test of LLM output quality. Evals can be golden dataset comparisons, regression tests, or human ratings.

**Related:** [Beginner Lesson 7: Evals, safety, cost, and release](../genai-beginner/lesson-7-evals-safety-cost-and-release.md)

---

## F

### Fan-out / Fan-in

A pattern where one agent distributes work to multiple parallel agents (fan-out) and collects results (fan-in). Common in manager-specialist architectures.

**Related:** [Advanced Lesson 5: Router, manager, and specialist patterns](../genai-advanced/lesson-5-router-manager-and-specialist-patterns.md)

---

## G

### Grounding

Ensuring an LLM's output is based on reliable information. Grounding techniques include retrieval from knowledge bases, citations, and structured constraints.

**Related:** [Beginner Lesson 4: Retrieval, grounding, and citations](../genai-beginner/lesson-4-retrieval-grounding-and-citations.md)

---

## H

### Handoff

The transfer of control or context between agents. Handoffs can be peer-to-peer (equal agents transfer conversation) or hierarchical (manager delegates to specialist).

**Related:** [Advanced Lesson 6: Handoffs, human review, and control surfaces](../genai-advanced/lesson-6-handoffs-human-review-and-control-surfaces.md)

### Human-in-the-loop

Patterns where a human approves, edits, or interrupts agent actions. Requires durable state and clear interrupt semantics.

**Related:** [Advanced Lesson 6: Handoffs, human review, and control surfaces](../genai-advanced/lesson-6-handoffs-human-review-and-control-surfaces.md)

### Hybrid RAG

A retrieval strategy that combines vector similarity search with keyword/exact-match search for better coverage.

**Related:** [Advanced Lesson 4: Knowledge systems and advanced RAG](../genai-advanced/lesson-4-knowledge-systems-and-advanced-rag.md)

---

## I

### Instruction Hierarchy

The precedence order for different instruction types. System instructions typically take priority over user instructions, which take priority over examples.

**Related:** [Shared: Prompt and output patterns cheatsheet](./prompt-and-output-patterns-cheatsheet.md)

---

## M

### MCP (Model Context Protocol)

A standard protocol for connecting AI models to external tools and data sources. AgentFlow supports MCP-style integration.

**Related:** [Beginner Lesson 3: Tools, files, and MCP basics](../genai-beginner/lesson-3-tools-files-and-mcp-basics.md)

### Memory

Storage of conversation context or learned information. In AgentFlow, memory can be short-term (thread state) or long-term (persistent store).

**Related:** [Beginner Lesson 5: State, memory, threads, and streaming](../genai-beginner/lesson-5-state-memory-threads-and-streaming.md)

### Multimodal

The ability to process multiple types of input (text, images, audio, video) or generate multiple types of output. Contrast with text-only models.

**Related:** [Beginner Lesson 6: Multimodal and client/server integration](../genai-beginner/lesson-6-multimodal-and-client-server-integration.md)

---

## N

### Next-token Prediction

The core task LLMs are trained on: predicting the most likely next token given all previous tokens. This probabilistic nature is why outputs vary.

**Related:** [Shared: LLM basics for engineers](./llm-basics-for-engineers.md)

---

## P

### Positional Encoding

A mechanism that gives transformer models information about token positions. Without it, attention would be position-agnostic.

**Related:** [Shared: Transformer basics](./transformer-basics.md)

### Prompt Injection

A security risk where an attacker embeds malicious instructions in user input or retrieved documents to manipulate LLM behavior.

**Related:** [Beginner Lesson 7: Evals, safety, cost, and release](../genai-beginner/lesson-7-evals-safety-cost-and-release.md)

### Prompt Template

A parameterized prompt structure where variables are replaced at runtime. Templates enable reusable prompt engineering.

**Related:** [Beginner Lesson 2: Prompting, context engineering, and structured outputs](../genai-beginner/lesson-2-prompting-context-and-structured-outputs.md)

---

## R

### RAG (Retrieval-Augmented Generation)

A pattern where an LLM retrieves relevant documents before generating a response. RAG helps ground outputs in specific knowledge.

**Related:** [Beginner Lesson 4: Retrieval, grounding, and citations](../genai-beginner/lesson-4-retrieval-grounding-and-citations.md), [Advanced Lesson 4: Knowledge systems and advanced RAG](../genai-advanced/lesson-4-knowledge-systems-and-advanced-rag.md)

### ReAct (Reasoning + Acting)

A agent pattern where the model alternates between reasoning about the current state and taking actions. Popular for tool-use agents.

**Related:** [Advanced Lesson 2: Single-agent runtime and bounded autonomy](../genai-advanced/lesson-2-single-agent-runtime-and-bounded-autonomy.md)

### Reranking

A secondary ranking step that reorders retrieved documents using a more expensive but accurate model.

**Related:** [Shared: Chunking and retrieval primitives](./chunking-and-retrieval-primitives.md)

---

## S

### Schema Validation

Checking that LLM output conforms to an expected structure. Structured outputs rely on schema validation for reliability.

**Related:** [Beginner Lesson 2: Prompting, context engineering, and structured outputs](../genai-beginner/lesson-2-prompting-context-and-structured-outputs.md)

### Specialist

A focused agent designed for a specific task or domain. Specialists are often used in manager-specialist architectures.

**Related:** [Advanced Lesson 5: Router, manager, and specialist patterns](../genai-advanced/lesson-5-router-manager-and-specialist-patterns.md)

### State

The data that persists across agent interactions. In AgentFlow, state includes conversation history, variables, and tool results.

**Related:** [Beginner Lesson 5: State, memory, threads, and streaming](../genai-beginner/lesson-5-state-memory-threads-and-streaming.md)

### Streaming

A response pattern where tokens are sent incrementally to the client, improving perceived latency for long responses.

**Related:** [Beginner Lesson 5: State, memory, threads, and streaming](../genai-beginner/lesson-5-state-memory-threads-and-streaming.md)

### Structured Output

LLM responses constrained to a specific schema (JSON, XML, enum values). Structured outputs improve reliability over freeform text.

**Related:** [Beginner Lesson 2: Prompting, context engineering, and structured outputs](../genai-beginner/lesson-2-prompting-context-and-structured-outputs.md)

---

## T

### Thread

A persistent conversation context identified by a unique ID. Threads enable conversation continuity and state restoration.

**Related:** [Beginner Lesson 5: State, memory, threads, and streaming](../genai-beginner/lesson-5-state-memory-threads-and-streaming.md)

### Token

The basic unit of text processed by an LLM. Tokens are not exactly words—a token is typically a few characters or a fraction of a word.

**Related:** [Shared: Tokenization and context windows](./tokenization-and-context-windows.md)

### Tool

A callable function that extends LLM capabilities beyond text generation. Tools enable agents to interact with external systems.

**Related:** [Beginner Lesson 3: Tools, files, and MCP basics](../genai-beginner/lesson-3-tools-files-and-mcp-basics.md)

### Top-k Retrieval

Returning the k most similar documents from a vector store based on embedding similarity.

**Related:** [Shared: Chunking and retrieval primitives](./chunking-and-retrieval-primitives.md)

### Transformer

The neural network architecture underlying modern LLMs. Transformers use self-attention to process sequences in parallel.

**Related:** [Shared: Transformer basics](./transformer-basics.md)

---

## V

### Vector Store

A database optimized for storing and searching embeddings. Common vector stores include Qdrant, Pinecone, and pgvector.

**Related:** [Shared: Embeddings and similarity](./embeddings-vectorization-and-similarity.md)

---

## 2

### 2-step RAG

The classic retrieval-augmented generation pattern: retrieve relevant documents, then generate a response using those documents as context. Contrast with agentic RAG.

**Related:** [Beginner Lesson 4: Retrieval, grounding, and citations](../genai-beginner/lesson-4-retrieval-grounding-and-citations.md), [Advanced Lesson 4: Knowledge systems and advanced RAG](../genai-advanced/lesson-4-knowledge-systems-and-advanced-rag.md)
