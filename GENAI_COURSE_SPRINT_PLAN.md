# GenAI Course Sprint Plan

Prepared on April 9, 2026.

## Goal

Design two public GenAI courses for software engineers:

1. Beginner
2. Advanced

The courses should teach engineers how to build, evaluate, and ship GenAI systems with AgentFlow, not just explain LLM concepts in isolation.

## Audience

- Software engineers who can already build backend or frontend applications
- New to LLM apps, retrieval systems, or agent runtimes
- Teams deciding how far to go from prompt-based apps to durable multi-agent systems
- Engineers who want practical system design guidance with production tradeoffs

## Product Framing

These courses should reinforce AgentFlow's core value proposition:

- start simple,
- add tools and structured outputs,
- introduce memory and checkpoints,
- grow into multi-agent only when needed,
- and ship with testing, safety, and deployment discipline.

The curriculum should feel opinionated and implementation-oriented, with AgentFlow examples as the main bridge from concept to code.

## Research Summary

Research checked on April 9, 2026.

### What current guidance consistently recommends

- OpenAI's practical guide to building agents recommends starting from a strong single-agent foundation with clear instructions, well-defined tools, and explicit guardrails before introducing multi-agent orchestration.
- OpenAI's model guidance reinforces that model choice is an engineering decision across accuracy, latency, cost, and modality, not just "pick the smartest model".
- OpenAI's structured outputs guidance makes schema-controlled output a baseline reliability technique for serious apps.
- OpenAI's evaluation guidance emphasizes that evals should be designed early and tied to real tasks because GenAI behavior is variable by nature.
- OpenAI's prompting and prompt caching guidance shows that prompt structure affects both quality and runtime cost, which means context engineering should be taught explicitly.
- Anthropic's guidance on effective agents recommends simple, composable patterns over over-engineered agent orchestration.
- Anthropic's long-context guidance suggests that document ordering, explicit structure, and quote-grounding matter in long-context workflows.
- LangChain's retrieval guidance now clearly distinguishes 2-step RAG, agentic RAG, and hybrid RAG, which is useful for teaching architecture choices instead of treating "RAG" as one thing.
- LangChain's multi-agent guidance separates router, subagent, handoff, and skill patterns and frames them as tradeoff decisions around context isolation, repeated work, and latency.
- LangGraph and LangChain human-in-the-loop guidance reinforces that approval flows depend on persistence, resumability, and clear interrupt semantics, which aligns well with AgentFlow's checkpointing story.

### Implication for this curriculum

The original draft had the right backbone, but it undercovered several topics that now feel essential for a modern course:

- model selection and modality choice,
- context engineering beyond basic prompting,
- tools, files, and MCP-style integration,
- state, threads, and streaming UX,
- multimodal inputs,
- human-in-the-loop approval design,
- observability and testing depth,
- security, auth, and deployment concerns,
- and explicit frontend/backend integration patterns.

## Primary Sources

- OpenAI practical guide to building agents: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- OpenAI models guide: https://developers.openai.com/api/docs/models
- OpenAI evaluation best practices: https://developers.openai.com/api/docs/guides/evals
- OpenAI structured outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI prompting guide: https://platform.openai.com/docs/guides/prompting
- OpenAI prompt caching guide: https://platform.openai.com/docs/guides/prompt-caching
- Anthropic building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic long context tips: https://docs.anthropic.com/en/docs/long-context-window-tips
- LangChain retrieval overview: https://docs.langchain.com/oss/python/langchain/retrieval
- LangChain multi-agent patterns: https://docs.langchain.com/oss/python/langchain/multi-agent
- LangChain human-in-the-loop: https://docs.langchain.com/oss/python/langchain/human-in-the-loop
- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph workflows and agents: https://docs.langchain.com/oss/python/langgraph/workflows-agents

## Curriculum Principles

- Teach software engineers how to ship GenAI systems, not how to memorize model trivia
- Start with use-case fit and single-agent design before multi-agent architecture
- Put structured outputs, tools, evals, and safety early in the learning path
- Treat context engineering as a first-class skill, not a sub-bullet under prompting
- Teach RAG as a family of architectures, not a default answer to every problem
- Distinguish state, memory, retrieval, and checkpoints clearly
- Cover both developer experience and runtime operations
- Reuse existing AgentFlow docs, examples, and APIs wherever possible

## Scope Decisions

### In scope

- Practical LLM app construction
- Structured outputs and tool use
- Retrieval and knowledge system choices
- State, memory, threads, checkpoints, and background tasks
- Single-agent and multi-agent architecture patterns
- Streaming, multimodal, and client/server integration
- Evaluation, guardrails, testing, observability, and deployment readiness

### Out of scope

- Fine-tuning as a major course module
- Transformer internals and academic theory
- Exhaustive provider benchmarking
- Deep research on every agent paper
- Very large enterprise governance or procurement material

## Proposed Information Architecture

Recommended public docs location:

```text
agentflow-docs/docs/courses/
  index.md
  shared/
    glossary.md
    llm-basics-for-engineers.md
    transformer-basics.md
    tokenization-and-context-windows.md
    embeddings-vectorization-and-similarity.md
    chunking-and-retrieval-primitives.md
    prompt-and-output-patterns-cheatsheet.md
    design-checklists.md
    evaluation-worksheet.md
  genai-beginner/
    index.md
    lesson-1-use-cases-models-and-app-lifecycle.md
    lesson-2-prompting-context-and-structured-outputs.md
    lesson-3-tools-files-and-mcp-basics.md
    lesson-4-retrieval-grounding-and-citations.md
    lesson-5-state-memory-threads-and-streaming.md
    lesson-6-multimodal-and-client-server-integration.md
    lesson-7-evals-safety-cost-and-release.md
    capstone.md
  genai-advanced/
    index.md
    lesson-1-agentic-product-fit-and-system-boundaries.md
    lesson-2-single-agent-runtime-and-bounded-autonomy.md
    lesson-3-context-engineering-long-context-and-caching.md
    lesson-4-knowledge-systems-and-advanced-rag.md
    lesson-5-router-manager-and-specialist-patterns.md
    lesson-6-handoffs-human-review-and-control-surfaces.md
    lesson-7-memory-checkpoints-artifacts-and-durable-execution.md
    lesson-8-observability-testing-security-and-deployment.md
    architecture-review-exercise.md
```

For now, this file remains an internal planning document.

## Shared Foundations

The `shared/` section should cover concepts that both courses rely on, but should not be repeated in full in each track.

This shared material should stay practical and lightweight:

- enough theory to understand system behavior,
- enough terminology to read docs and examples,
- but not enough depth to become a separate ML course.

### Recommended Shared Pages

#### 1. `llm-basics-for-engineers.md`

Purpose:

- Give a fast mental model of what an LLM is, what it does well, and where it fails

Should cover:

- next-token prediction at a high level
- pretraining vs instruction tuning at a high level
- prompts, outputs, reasoning, and tool use in practical terms
- why LLM systems are probabilistic
- common failure modes: hallucination, omission, formatting drift, brittle instruction following

Keep it light:

- no deep training pipeline detail
- no benchmark deep dive

#### 2. `transformer-basics.md`

Purpose:

- Explain just enough transformer architecture to make concepts like attention, context windows, and scaling intuitive

Should cover:

- what changed with the transformer architecture
- attention at a conceptual level
- tokens, positional information, and sequence modeling
- why transformers handle long sequences differently from older recurrent approaches
- why long context still has quality and cost tradeoffs

Keep it light:

- no matrix-heavy derivations
- no full encoder/decoder math treatment

#### 3. `tokenization-and-context-windows.md`

Purpose:

- Help engineers reason about token budgets, prompt size, chunking, and cost

Should cover:

- what tokens are
- why token count is not the same as word count
- rough token budgeting heuristics
- context windows, truncation risk, and overflow behavior
- why tokenization matters for latency, cost, and retrieval chunk design

Must include:

- one practical token budgeting example
- one example of how bad chunk boundaries hurt retrieval quality

#### 4. `embeddings-vectorization-and-similarity.md`

Purpose:

- Introduce the math concepts behind retrieval in a practical way

Should cover:

- what embeddings are
- vectorization as turning text into numeric representations
- semantic similarity at a high level
- cosine similarity and cosine distance
- why nearest-neighbor retrieval works for search and recommendation
- limits of embeddings: ambiguity, domain mismatch, and stale representations

Must include:

- cosine similarity formula at a high level
- one intuition-first diagram or explanation
- one warning that high similarity does not guarantee factual correctness

Suggested positioning:

- this page should prepare learners for retrieval and memory topics later

#### 5. `chunking-and-retrieval-primitives.md`

Purpose:

- Bridge the gap between embeddings theory and real retrieval systems

Should cover:

- what chunking is and why it exists
- chunk size vs overlap tradeoffs
- metadata, citations, and source IDs
- query vs document embeddings at a high level
- top-k retrieval, reranking, and context assembly

Must include:

- common failure modes caused by poor chunking
- why retrieval quality is partly a data preparation problem

#### 6. `prompt-and-output-patterns-cheatsheet.md`

Purpose:

- Give learners a reusable quick-reference page both tracks can link to

Should cover:

- instruction hierarchy
- examples vs schemas
- structured output patterns
- tool calling patterns
- grounding and citation prompt patterns
- short anti-pattern list

### Additional Shared Concepts Worth Covering Briefly

These can live as sub-sections inside the shared pages rather than separate files:

- attention and self-attention
- positional encoding or positional information
- context compaction and summarization
- sparse vs dense retrieval at a conceptual level
- cosine similarity vs cosine distance
- retrieval recall vs answer quality
- why long context does not eliminate the need for retrieval design

### Why These Topics Belong In `shared/`

These concepts are prerequisites for both tracks:

- the beginner course needs enough foundation to explain prompts, retrieval, and cost,
- the advanced course needs the same vocabulary to talk about context engineering, memory, and RAG tradeoffs.

Putting them in `shared/` keeps the lesson pages cleaner and avoids repeating the same basics in both courses.

## Course 1: Beginner

### Positioning

This course should help engineers go from "I know what an LLM is" to "I can build a small, production-shaped GenAI app with AgentFlow".

### Target Length

- 7 lessons
- 30 to 45 minutes each
- 1 capstone
- 1 shared release checklist

### Learning Outcome

By the end, a learner should be able to build a small GenAI application that uses prompting, structured outputs, tools, grounding, state or memory, streaming, and a basic evaluation and safety process before release.

### Lesson Outline

#### 1. Use Cases, Models, And The LLM App Lifecycle

Focus:

- What problems fit automation, workflow, chatbot, or agent
- The core building blocks: model, instructions, tools, state, output
- Tokens, context window, latency, cost, and modality
- Basic model selection for quality, speed, and budget
- Why GenAI apps are probabilistic systems with failure cases

Must cover:

- "Do we even need an agent?"
- Model choice as a product and systems decision
- The simplest end-to-end request lifecycle

Exercise:

- Classify three product ideas into no-LLM, LLM app, workflow, or agent

Suggested AgentFlow tie-ins:

- `docs/get-started/what-is-agentflow.md`
- `docs/concepts/architecture.md`
- `docs/get-started/first-python-agent.md`

#### 2. Prompting, Context Engineering, And Structured Outputs

Focus:

- System instructions, user messages, examples, and delimiters
- Prompt iteration for real engineering work
- Context packing and avoiding prompt clutter
- Structured outputs and schema validation
- Tool calling as a reliable interface between model and code

Must cover:

- The difference between "better prompting" and "better system design"
- Why structured output should arrive before advanced agent patterns
- How to recover when the model output is malformed or incomplete

Exercise:

- Convert a free-form prompt into a schema-validated response flow

Suggested AgentFlow tie-ins:

- `docs/beginner/mental-model.md`
- `docs/tutorials/from-examples/react-agent-validation.md`
- `docs/reference/python/agent.md`

#### 3. Tools, Files, And MCP Basics

Focus:

- Read-only vs action tools
- Tool descriptions, schemas, and safe argument design
- Tool failure handling, retries, and idempotency
- File and media inputs in GenAI workflows
- MCP-style integration as a standard pattern for external capabilities

Must cover:

- Why tool design quality matters as much as prompt quality
- How to decide which operations should never be directly callable
- How files change the shape of an agent application

Exercise:

- Add two safe tools and one file input path to a beginner agent

Suggested AgentFlow tie-ins:

- `docs/concepts/agents-and-tools.md`
- `docs/reference/python/tools.md`
- `docs/concepts/media-and-files.md`
- `docs/tutorials/from-examples/mcp-client.md`

#### 4. Retrieval, Grounding, And Citations

Focus:

- When to use retrieval and when not to
- Basic ingest, chunk, index, retrieve, generate flow
- 2-step retrieval vs agentic retrieval at a beginner level
- Freshness, metadata, and citation mindset
- Common failure modes: irrelevant chunks, stale data, prompt injection through documents

Must cover:

- Retrieval is one way to ground a system, not the only way
- Why citations and source visibility matter for trust
- Why "more context" can make answers worse

Exercise:

- Add a small knowledge source and return an answer with citations

Suggested AgentFlow tie-ins:

- `docs/tutorials/from-examples/qdrant-memory.md`
- `docs/concepts/memory-and-store.md`
- `docs/how-to/python/protect-against-prompt-injection.md`

#### 5. State, Memory, Threads, And Streaming

Focus:

- Conversation state vs memory vs knowledge base
- Threads, checkpoints, and resumability
- Short-term memory patterns for chat and task flows
- Streaming responses and progressive UX
- When to summarize, when to persist, and when to drop context

Must cover:

- Memory is not the same thing as retrieval
- Thread and checkpoint concepts should appear before advanced runtime lessons
- Why streaming changes perceived responsiveness even when total latency stays similar

Exercise:

- Add thread persistence and streaming to a simple agent interaction

Suggested AgentFlow tie-ins:

- `docs/beginner/add-memory.md`
- `docs/concepts/checkpointing-and-threads.md`
- `docs/concepts/streaming.md`
- `docs/tutorials/from-examples/react-streaming.md`

#### 6. Multimodal And Client/Server Integration

Focus:

- Text plus image or file workflows
- Upload, processing, and returned artifacts
- When the frontend should stay thin
- How API, runtime, and UI responsibilities should be separated
- Using the playground and client SDKs as learning tools

Must cover:

- A beginner should see that "GenAI app" is not equal to "text chat only"
- Frontend and backend integration should appear before release content
- AgentFlow should be shown as a full-stack delivery path, not just a Python library

Exercise:

- Connect an agent to a basic client flow with file upload or multimodal input

Suggested AgentFlow tie-ins:

- `docs/get-started/connect-client.md`
- `docs/how-to/client/upload-files.md`
- `docs/tutorials/from-examples/multimodal.md`
- `docs/get-started/open-playground.md`

#### 7. Evals, Safety, Cost, And Release

Focus:

- Golden datasets, scenario tests, and regression checks
- Prompt injection awareness and unsafe tool use boundaries
- Moderation, PII awareness, and basic policy checks
- Rate limits, retries, budget controls, and latency budgets
- A practical release checklist for GenAI systems

Must cover:

- Evals are part of development, not just launch week
- Safety must cover prompts, tools, retrieved data, and output handling
- Cost and latency are product constraints, not ops-only concerns

Exercise:

- Create a 10-case evaluation sheet and a go/no-go release checklist

Suggested AgentFlow tie-ins:

- `docs/reference/python/evaluation.md`
- `docs/tutorials/from-examples/evaluation.md`
- `docs/how-to/python/protect-against-prompt-injection.md`
- `docs/how-to/production/troubleshooting.md`

### Beginner Capstone

Build a small engineer-facing assistant that:

- answers using a curated knowledge source,
- uses one or two tools,
- accepts at least one file or multimodal input,
- returns structured output,
- supports thread continuity or memory,
- streams responses to a client or playground,
- and includes a lightweight evaluation and release checklist.

## Course 2: Advanced

### Positioning

This course is for engineers who already understand the basics and now need to make reliable architecture choices for agent systems in production.

### Target Length

- 8 lessons
- 45 to 75 minutes each
- 1 architecture review exercise
- 1 production readiness worksheet

### Learning Outcome

By the end, a learner should be able to choose between deterministic workflows, single-agent systems, and multi-agent architectures; design runtime boundaries for state and control; and prepare an AgentFlow-based system for production with testing, observability, and security in mind.

### Lesson Outline

#### 1. Agentic Product Fit And System Boundaries

Focus:

- When a workflow beats an agent
- When a single agent is enough
- Signals that justify multi-agent design
- User goals, SLA expectations, and approval boundaries
- Defining what the agent may decide vs what the system decides

Key engineering questions:

- Is the task open-ended or mostly deterministic?
- Are tool choices dynamic or known in advance?
- What actions require user approval?
- What does failure look like for this system?

Exercise:

- Write a one-page architecture brief including a "why this is not just a workflow" section

Suggested AgentFlow tie-ins:

- `docs/concepts/architecture.md`
- `docs/get-started/expose-with-api.md`
- `docs/how-to/production/deployment.md`

#### 2. Single-Agent Runtime And Bounded Autonomy

Focus:

- ReAct-style loops, planner-executor variants, and bounded retries
- Step budgets, tool budgets, and stop conditions
- Reflection and repair without unbounded agent wandering
- Deterministic wrappers around agentic steps
- Failure containment before multi-agent expansion

Why this lesson matters:

- Many teams still split into multiple agents too early instead of fixing weak single-agent design first

Exercise:

- Take a fragile single-agent flow and redesign it with explicit limits and recovery paths

Suggested AgentFlow tie-ins:

- `docs/concepts/state-graph.md`
- `docs/tutorials/from-examples/react-agent.md`
- `docs/reference/python/testing.md`

#### 3. Context Engineering, Long Context, And Caching

Focus:

- Designing stable prompt structure for large systems
- Long-context usage patterns and context compaction
- Summaries, scratchpads, and retrieved context boundaries
- Prompt caching and stable prompt prefixes
- Cost and latency tradeoffs in context-heavy systems

Teach in detail:

- What belongs in instructions, retrieved context, thread state, or external storage
- How context design affects both quality and spend
- Why context engineering is broader than prompt wording

Exercise:

- Re-layout a long prompt and estimate where caching and compaction help

Suggested AgentFlow tie-ins:

- `docs/concepts/state-and-messages.md`
- `docs/concepts/media-and-files.md`
- `docs/reference/client/stream.md`

#### 4. Knowledge Systems And Advanced RAG

Focus:

- 2-step RAG, agentic RAG, and hybrid RAG
- Query rewriting, retrieval grading, and answer grounding
- Source trust, freshness, metadata, and citation strategies
- Vector stores vs existing enterprise systems as knowledge sources
- Retrieved-content prompt injection and data contamination risks

Teach in detail:

- Retrieval is a subsystem with its own latency and quality profile
- Not every knowledge problem needs a vector database
- Advanced RAG should be framed as an architecture decision, not a keyword

Exercise:

- Compare three retrieval architectures for the same product requirement

Suggested AgentFlow tie-ins:

- `docs/concepts/memory-and-store.md`
- `docs/reference/rest-api/memory-store.md`
- `docs/tutorials/from-examples/qdrant-memory.md`
- `docs/how-to/python/protect-against-prompt-injection.md`

#### 5. Router, Manager, And Specialist Patterns

Focus:

- Router and classifier patterns
- Manager agent with specialists as tools
- Parallel fan-out and aggregation
- Context isolation and specialization boundaries
- Cost, latency, and observability tradeoffs

Teach in detail:

- When centralized control is worth the extra orchestration layer
- When routing is cheaper than giving one large prompt many tools
- How to predict failure containment in specialist architectures

Exercise:

- Draw a manager-plus-specialists design and estimate latency, cost, and failure points

Suggested AgentFlow tie-ins:

- `docs/tutorials/from-examples/multiagent.md`
- `docs/reference/python/command-handoff.md`
- `docs/tutorials/from-examples/skills.md`

#### 6. Handoffs, Human Review, And Control Surfaces

Focus:

- Peer handoffs and decentralized control
- Ownership transfer of conversation state
- Interrupts, approvals, edits, and resume semantics
- Human escalation points for risky actions
- UX implications of handoffs vs centralized orchestration

Teach in detail:

- Differences between manager/subagent and peer handoff systems
- Why human-in-the-loop depends on durable state and clear control surfaces
- How approval flows change both architecture and product design

Exercise:

- Add a review gate before a high-risk tool and define the resume behavior

Suggested AgentFlow tie-ins:

- `docs/tutorials/from-examples/handoff.md`
- `docs/how-to/python/handoff-between-agents.md`
- `docs/concepts/checkpointing-and-threads.md`
- `docs/reference/python/background-tasks.md`

#### 7. Memory, Checkpoints, Artifacts, And Durable Execution

Focus:

- Short-term state vs long-term memory
- Threads, checkpoints, replay, and resumability
- Artifacts, files, and intermediate outputs
- Background tasks and long-running workflows
- Debugging, recovery, and operational replay

Teach in detail:

- Why memory is broader than a vector store
- Why checkpoints are a runtime primitive, not a convenience feature
- How durable execution changes failure handling and human review design

Exercise:

- Add a recovery and replay plan for a long-running task flow

Suggested AgentFlow tie-ins:

- `docs/concepts/memory-and-store.md`
- `docs/concepts/production-runtime.md`
- `docs/reference/python/checkpointers.md`
- `docs/reference/python/background-tasks.md`
- `docs/tutorials/from-examples/memory.md`

#### 8. Observability, Testing, Security, And Deployment

Focus:

- Traceability, logs, and step-level observability
- Offline evals, regression tests, and online monitoring
- Auth, authorization, secret handling, and tool permissions
- Deployment topology across library, API, and client layers
- Rate limiting, quotas, budget control, and rollback planning

Teach in detail:

- Agent failures are system failures, not just prompt failures
- Reliability spans prompts, tools, memory, runtime, UI, and auth boundaries
- Production readiness should end with explicit runbooks and rollback criteria

Exercise:

- Build a production readiness scorecard for an AgentFlow system

Suggested AgentFlow tie-ins:

- `docs/reference/python/evaluation.md`
- `docs/reference/python/testing.md`
- `docs/how-to/production/auth-and-authorization.md`
- `docs/how-to/production/deployment.md`
- `docs/how-to/production/checkpointing.md`

### Advanced Exercise

Ask learners to compare three architectures for the same product:

- single agent with tools,
- manager plus specialists,
- decentralized handoff system.

They should justify:

- why they chose one,
- what control boundaries exist,
- what failure modes they expect,
- what they would evaluate before production,
- and where human approval or rollback is required.

## Must-Cover Topic Matrix

| Topic | Beginner | Advanced | Why it matters |
| --- | --- | --- | --- |
| Model selection and modality | Yes | Yes | Engineers need to reason about cost, latency, and fit early |
| Prompting and context engineering | Yes | Yes, deeper | Reliability depends on context design, not prompt tricks alone |
| Structured outputs | Yes | Yes | Baseline reliability pattern |
| Tools and tool safety | Yes | Yes | Core bridge from model to software behavior |
| Files and multimodal input | Yes | Yes | Modern agent systems are not text-only |
| Retrieval and grounding | Yes | Yes, deeper | Common requirement, but needs architecture tradeoff teaching |
| Threads, memory, and checkpoints | Yes | Yes, deeper | AgentFlow differentiator and runtime foundation |
| Streaming UX | Yes | Yes | Important for product feel and debugging visibility |
| Human-in-the-loop | Intro only | Yes | Critical for sensitive actions and resumable systems |
| Multi-agent patterns | Preview only | Yes | Should remain advanced, architecture-driven material |
| Evals and testing | Yes | Yes, deeper | Required engineering practice |
| Security, auth, and deployment | Intro only | Yes | Production systems need more than prompts and tools |

## Topic Mapping To Existing AgentFlow Material

| Course Topic | Existing Repo Material To Reuse |
| --- | --- |
| Core AgentFlow framing | `docs/get-started/what-is-agentflow.md`, `docs/concepts/architecture.md` |
| Beginner first agent path | `docs/beginner/your-first-agent.md`, `docs/get-started/first-python-agent.md` |
| Tools and validation | `docs/concepts/agents-and-tools.md`, `docs/reference/python/tools.md`, `docs/tutorials/from-examples/react-agent-validation.md` |
| Files and multimodal | `docs/concepts/media-and-files.md`, `docs/tutorials/from-examples/multimodal.md`, `docs/how-to/client/upload-files.md` |
| Memory, threads, and checkpoints | `docs/beginner/add-memory.md`, `docs/concepts/checkpointing-and-threads.md`, `docs/reference/python/checkpointers.md` |
| Streaming and client integration | `docs/concepts/streaming.md`, `docs/tutorials/from-examples/react-streaming.md`, `docs/get-started/connect-client.md` |
| Retrieval and knowledge systems | `docs/tutorials/from-examples/qdrant-memory.md`, `docs/concepts/memory-and-store.md`, `docs/reference/rest-api/memory-store.md` |
| Multi-agent and handoffs | `docs/tutorials/from-examples/multiagent.md`, `docs/tutorials/from-examples/handoff.md`, `docs/how-to/python/handoff-between-agents.md` |
| Evals and testing | `docs/reference/python/evaluation.md`, `docs/reference/python/testing.md`, `docs/tutorials/from-examples/evaluation.md`, `docs/tutorials/from-examples/testing.md` |
| Production and security | `docs/how-to/production/deployment.md`, `docs/how-to/production/auth-and-authorization.md`, `docs/how-to/production/checkpointing.md`, `docs/how-to/production/troubleshooting.md` |

## Recommended Sprint Plan

Recommended cadence: 1 week per sprint for drafting, with an optional extra review week if diagrams and runnable examples grow.

## Sprint 1: Finalize Scope And Public Course Skeleton

Goal:

- Lock the curriculum boundaries before writing lesson pages

Deliverables:

- Final lesson list for both tracks
- Public docs folder skeleton under `docs/courses/`
- Shared foundations outline and page list
- Sidebar and navigation proposal
- Shared glossary and worksheet placeholders
- Course page style guide with a standard lesson template

Acceptance criteria:

- Each lesson has one clear learning outcome
- Each lesson has one exercise or worksheet
- Beginner and advanced tracks are clearly separated
- Shared pages cover the minimum theory needed for later retrieval and agent topics

## Sprint 2: Shared Foundations Draft

Goal:

- Build the shared prerequisite layer both courses depend on

Deliverables:

- Drafts for:
  - `shared/llm-basics-for-engineers.md`
  - `shared/transformer-basics.md`
  - `shared/tokenization-and-context-windows.md`
  - `shared/embeddings-vectorization-and-similarity.md`
  - `shared/chunking-and-retrieval-primitives.md`
  - `shared/prompt-and-output-patterns-cheatsheet.md`
- Shared glossary first pass
- One diagram for tokenization and context windows
- One diagram for embeddings and cosine similarity intuition
- One simple transformer/attention diagram
- Cross-links from shared pages to later beginner and advanced lessons

Acceptance criteria:

- Shared pages explain tokenization, embeddings, cosine similarity, and transformers without drifting into ML-course depth
- Shared pages read as prerequisites for engineers, not as standalone theory lectures
- Each shared page names which beginner or advanced lessons depend on it
- Terminology is consistent with the rest of the docs

## Sprint 3: Beginner Foundations Draft

Goal:

- Draft the first half of the beginner track on top of the shared prerequisites

Deliverables:

- Lesson 1 through lesson 3 drafts
- One diagram for the LLM app lifecycle
- One diagram for tool and structured output flow
- First pass of the shared release checklist

Acceptance criteria:

- Beginner content stays simple without becoming vague
- Lessons link back to the shared pages instead of re-explaining theory
- Structured outputs and tools appear before multi-agent previews
- All examples map to actual AgentFlow docs or examples

## Sprint 4: Beginner Delivery Track And Capstone

Goal:

- Finish the beginner course and make it runnable end to end

Deliverables:

- Lesson 4 through lesson 7 drafts
- Beginner capstone page
- One retrieval diagram
- One streaming plus client integration diagram

Acceptance criteria:

- Beginner course can still be completed in one focused weekend
- Retrieval, memory, streaming, and release topics are all represented
- Shared pages are sufficient prerequisites for the retrieval lessons
- Capstone includes eval and safety checks, not just code steps

## Sprint 5: Advanced Architecture Draft

Goal:

- Draft the architecture-heavy half of the advanced track

Deliverables:

- Lesson 1 through lesson 4 drafts
- Architecture comparison worksheet
- Three diagrams:
  - workflow vs agent
  - context layers and knowledge sources
  - retrieval architecture options

Acceptance criteria:

- Every lesson explains "when not to use this pattern"
- Advanced content clearly distinguishes context, retrieval, state, and memory
- Advanced lessons reuse the shared foundations instead of restating tokenization, embeddings, or transformer basics
- The architecture review exercise uses realistic tradeoffs

## Sprint 6: Advanced Runtime, Ops, And Publication Readiness

Goal:

- Finish the advanced track and prepare both courses for release

Deliverables:

- Lesson 5 through lesson 8 drafts
- Production readiness worksheet
- Final technical review of examples and links
- Navigation, terminology, and page consistency pass
- Build verification in `agentflow-docs`

Acceptance criteria:

- Advanced lessons include human review, runtime durability, and deployment concerns
- Internal links work and point to current docs
- `cd agentflow-docs && npm run build` passes once the pages are added to navigation
- Each lesson ends with "What you learned", "Common failure mode", and "Next step"

## Sprint 7: Shared Review And Course Cohesion Pass

Goal:

- Make the shared layer and both course tracks feel like one coherent learning system

Deliverables:

- Final pass on cross-links between `shared/`, beginner, and advanced pages
- Terminology and glossary cleanup
- Duplication review to remove repeated theory from lesson pages
- Diagram consistency pass across all tracks
- Final checklist that identifies prerequisites for every lesson

Acceptance criteria:

- Shared pages are referenced wherever foundational concepts appear
- No lesson repeats large foundation sections that belong in `shared/`
- The reading path is clear for a learner starting from zero
- Beginner and advanced tracks feel connected but still distinct

## Publication Recommendations

- Publish the beginner course first, but write the advanced outline in parallel so terminology stays consistent
- Treat the beginner capstone as the entry requirement for the advanced course
- Keep diagrams opinionated and architecture-specific rather than generic AI artwork
- Prefer reusable worksheets and checklists over long prose appendices

## Final Recommendation

The updated plan should stay compact in spirit, but not minimal in coverage.

The right teaching sequence is:

1. pick the right use case,
2. build one reliable GenAI app,
3. add tools, grounding, memory, and streaming,
4. then introduce orchestration, durability, human review, and production operations.

That sequence matches both current industry guidance and AgentFlow's strengths as a production-minded agent framework.
