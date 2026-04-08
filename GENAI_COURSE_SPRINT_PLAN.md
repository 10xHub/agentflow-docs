# GenAI Course Sprint Plan

Prepared on April 8, 2026.

## Goal

Add two compact GenAI courses for software engineers:

1. Beginner
2. Advanced

These courses should help engineers quickly understand modern GenAI application building, then go deeper into agent architecture and production tradeoffs.

## Audience

- Software engineers who can already code
- New to GenAI, LLM apps, or agent systems
- Want practical guidance, not research-heavy theory

## Size Constraints

- Keep the beginner course short and high-signal
- Keep the advanced course curated, but detailed
- Favor architecture patterns, implementation tradeoffs, and production thinking over broad surveys

## Research Notes

Research checked on April 8, 2026:

- OpenAI practical guide to building agents recommends starting with a strong single-agent foundation, clear tools, and explicit instructions before adding more agents.
- OpenAI evaluation guidance emphasizes that GenAI systems are variable by nature, so evals are a core engineering practice rather than an optional polish step.
- OpenAI structured outputs guidance reinforces that schema-controlled outputs are a baseline engineering tool for reliable applications.
- Anthropic's guidance on effective agents recommends simple, composable patterns over unnecessary orchestration complexity.
- Anthropic and LangGraph both separate deterministic workflows from dynamic agents, which is useful for teaching architecture decisions clearly.
- LangGraph's framing around durable execution, streaming, human-in-the-loop, and stateful orchestration aligns well with AgentFlow's strengths.

### Primary Sources

- OpenAI: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- OpenAI: https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OpenAI: https://developers.openai.com/api/docs/guides/structured-outputs
- Anthropic: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic: https://docs.anthropic.com/en/docs/overview
- LangGraph: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph: https://docs.langchain.com/oss/python/langgraph/workflows-agents
- LangChain multi-agent patterns: https://docs.langchain.com/oss/python/langchain/multi-agent

## Curriculum Principles

- Teach software engineers how to build and ship, not just how models work
- Start with one-agent systems before multi-agent systems
- Put structured outputs, tools, evals, and guardrails early
- Treat RAG as one pattern, not the entire course
- In the advanced track, focus on architecture choice and failure modes
- Reuse existing AgentFlow examples wherever possible

## Proposed Information Architecture

Recommended future public docs location:

```text
agentflow-docs/docs/courses/
  index.md
  genai-beginner/
    index.md
    lesson-1-llm-basics.md
    lesson-2-prompting-and-outputs.md
    lesson-3-rag-and-grounding.md
    lesson-4-building-a-useful-agent.md
    lesson-5-evals-safety-cost.md
  genai-advanced/
    index.md
    lesson-1-agentic-design.md
    lesson-2-single-agent-architecture.md
    lesson-3-manager-router-patterns.md
    lesson-4-handoffs-and-multi-agent.md
    lesson-5-memory-checkpoints-runtime.md
    lesson-6-production-reliability.md
```

For now, this file is an internal planning document only.

## Course 1: Beginner

### Positioning

This is a short, practical introduction for engineers who want to understand the minimum GenAI building blocks without getting lost in architecture debates.

### Target Length

- 5 lessons
- 30 to 45 minutes each
- 1 small capstone

### Learning Outcome

By the end, a learner should be able to build a simple GenAI app with prompting, structured output, tool calling, basic retrieval, and a lightweight evaluation checklist.

### Curated Lesson Outline

#### 1. LLM App Basics For Engineers

Focus:

- What an LLM app is and is not
- Tokens, context window, latency, and cost
- Prompt -> model -> output lifecycle
- Why GenAI apps are probabilistic, not deterministic

Keep it quick:

- No deep transformer theory
- No model benchmark comparison section

#### 2. Prompting, Context, And Structured Outputs

Focus:

- System instructions, user input, examples
- Prompt iteration for real product work
- Structured outputs and schema validation
- Tool calling as an engineering interface, not magic

Why it matters:

- This is the bridge from toy chatbot to dependable software behavior

#### 3. Retrieval And Grounding

Focus:

- When to use RAG and when not to
- Basic retrieval flow: ingest, chunk, retrieve, generate
- Freshness and citation mindset
- Common failure modes: irrelevant retrieval, stale context, overstuffed prompts

Keep it quick:

- One simple architecture diagram
- One small example, not a full retrieval systems course

#### 4. Build A Useful Single-Agent App

Focus:

- Single agent with a small toolset
- Thread state or short-term memory
- Structured response + tool invocation
- Basic UX considerations for engineers

Suggested AgentFlow tie-ins:

- `docs/beginner/your-first-agent.md`
- `docs/beginner/add-a-tool.md`
- `docs/beginner/add-memory.md`
- `docs/tutorials/from-examples/google-genai.md`

#### 5. Eval, Safety, And Cost Basics

Focus:

- Why evals are required for GenAI systems
- Golden test cases and task-based evaluation
- Prompt injection awareness
- Tool safety, rate limits, retries, and budget controls

Keep it quick:

- One simple release checklist
- One example of a failing case and how to catch it

### Beginner Capstone

Build a small engineer-facing assistant that:

- answers from a curated knowledge source,
- uses one or two tools,
- returns structured output,
- and includes a tiny eval checklist before release.

## Course 2: Advanced

### Positioning

This course is for engineers who already understand the basics and now need to design reliable agent systems, especially around orchestration patterns and production tradeoffs.

### Target Length

- 6 lessons
- 45 to 75 minutes each
- 1 architecture review exercise

### Learning Outcome

By the end, a learner should be able to choose between workflow, single-agent, and multi-agent patterns; explain why a pattern fits; and design a production-minded agent architecture with memory, guardrails, and evaluation.

### Curated Lesson Outline

#### 1. Agentic System Design: Workflow Vs Agent Vs Multi-Agent

Focus:

- Deterministic workflow vs dynamic agent
- When not to use an agent
- When a single agent is enough
- Signals that justify multi-agent design

Key engineering questions:

- Is the task ambiguous?
- Is tool choice dynamic?
- Does context need to be partitioned?
- Do we need specialization or just better prompting?

#### 2. Single-Agent Architecture Done Right

Focus:

- ReAct-style loops and tool-use cycles
- Planner-executor variants
- Reflection, retry, and bounded autonomy
- State design and deterministic checkpoints between agentic steps

Why this lesson matters:

- Many teams jump to multi-agent too early instead of strengthening the single-agent core

Suggested AgentFlow tie-ins:

- `docs/concepts/state-graph.md`
- `docs/concepts/agents-and-tools.md`
- `docs/concepts/checkpointing-and-threads.md`
- `docs/tutorials/from-examples/react-agent.md`

#### 3. Manager, Router, And Specialist Patterns

Focus:

- Manager agent calling specialist agents as tools
- Router pattern for task classification
- Parallel specialist execution
- Cost, latency, and observability tradeoffs

Teach in detail:

- Centralized control
- Failure containment
- Context isolation
- When routers are cheaper than broad prompts

#### 4. Handoffs And Decentralized Multi-Agent Systems

Focus:

- Agent-to-agent handoff
- Ownership of conversation state
- Context transfer rules
- Human escalation points

Teach in detail:

- Differences between manager/subagent and peer handoff systems
- Where handoffs improve user experience
- Where handoffs create debugging complexity

Suggested AgentFlow tie-ins:

- `docs/tutorials/from-examples/multiagent.md`
- `docs/tutorials/from-examples/handoff.md`
- `agentflow/examples/multiagent/multiagent.py`
- `agentflow/examples/handoff/handoff_multi_agent.py`

#### 5. Memory, Checkpoints, And Long-Running Runtime Design

Focus:

- Short-term state vs long-term memory
- Checkpoints, threads, resumability
- File artifacts and retrieval context
- Background tasks and long-running flows

Teach in detail:

- Why memory is not just a vector database
- Why checkpoints matter for reliability and recovery
- How state design changes debugging and replay

Suggested AgentFlow tie-ins:

- `docs/concepts/memory-and-store.md`
- `docs/concepts/production-runtime.md`
- `docs/reference/python/checkpointers.md`
- `docs/tutorials/from-examples/memory.md`
- `docs/tutorials/from-examples/qdrant-memory.md`

#### 6. Production Reliability For Agent Systems

Focus:

- Evaluation design and architecture-aware test cases
- Tracing and observability
- Guardrails and tool-risk boundaries
- Timeouts, retries, rate limits, and budget controls
- Shipping criteria for an agent system

Teach in detail:

- Agent failures are system failures, not just prompt failures
- Reliability must be designed across prompts, tools, memory, runtime, and user flows

Suggested AgentFlow tie-ins:

- `docs/reference/python/evaluation.md`
- `agentflow/examples/evaluation/`
- `docs/how-to/python/protect-against-prompt-injection.md`

### Advanced Exercise

Ask learners to compare three possible architectures for the same product:

- single-agent with tools,
- manager plus specialists,
- decentralized handoff system.

They should justify:

- why they chose one,
- what failure modes they expect,
- what they would evaluate before production.

## Topic Mapping To Existing AgentFlow Material

| Course Topic | Existing Repo Material To Reuse |
| --- | --- |
| Beginner single-agent basics | `docs/beginner/*` |
| Structured tool use | `docs/concepts/agents-and-tools.md`, `docs/tutorials/from-examples/tool-decorator.md` |
| Memory and persistence | `docs/concepts/memory-and-store.md`, `docs/tutorials/from-examples/memory.md` |
| Multi-agent | `docs/tutorials/from-examples/multiagent.md` |
| Handoffs | `docs/tutorials/from-examples/handoff.md` |
| Evals | `agentflow/examples/evaluation/`, `docs/reference/python/evaluation.md` |
| Runtime and reliability | `docs/concepts/production-runtime.md`, `docs/concepts/checkpointing-and-threads.md` |

## Recommended Sprint Plan

Recommended cadence: 1 week per sprint.

## Sprint 1: Curriculum Framing And Skeleton

Goal:

- Lock the course scope before writing full lessons

Deliverables:

- Course naming and positioning
- Final lesson list for both tracks
- Public docs folder skeleton under `docs/courses/`
- Sidebar proposal for future publication
- One-page style guide for course pages

Acceptance criteria:

- Both courses stay intentionally compact
- No lesson duplicates existing docs without adding course value
- Each lesson has a clear outcome and one practical exercise

## Sprint 2: Beginner Course Draft

Goal:

- Ship the complete beginner track

Deliverables:

- 5 beginner lesson drafts
- 1 capstone page
- 2 diagrams max
- A lightweight engineer release checklist for GenAI apps

Acceptance criteria:

- Beginner course can be completed in one focused weekend
- Every lesson uses simple language and practical examples
- No advanced multi-agent content appears here except a brief preview

## Sprint 3: Advanced Architecture Course Draft

Goal:

- Build the detailed advanced track

Deliverables:

- 6 advanced lesson drafts
- Architecture comparison worksheet
- 3 architecture diagrams:
  - workflow vs agent
  - manager/router pattern
  - handoff pattern

Acceptance criteria:

- Advanced lessons explain tradeoffs, not just definitions
- Every architecture lesson includes "when not to use this pattern"
- Content clearly distinguishes state, memory, orchestration, and runtime concerns

## Sprint 4: Review, Polish, And Publication Readiness

Goal:

- Make the courses ready for public docs release

Deliverables:

- Technical review of examples and imports
- Consistent terminology across both tracks
- Final exercises, links, and navigation
- Build verification in `agentflow-docs`

Acceptance criteria:

- `cd agentflow-docs && npm run build` passes after the courses are added to navigation
- Internal links work
- Course pages match current AgentFlow concepts and example files
- Each lesson ends with "What you learned" and "Next step"

## Out Of Scope

- Fine-tuning course material
- Deep model internals or transformer math
- Exhaustive provider comparisons
- Academic survey of all agent papers
- Very large enterprise governance section

## Recommendation

Start by publishing the beginner course first, then use it as the prerequisite for the advanced architecture track.

This keeps the learning path clean:

1. learn GenAI app fundamentals,
2. build one solid agent,
3. then study orchestration and production architecture.
