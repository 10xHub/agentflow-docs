# r/LangChain — launch post draft

## Audience and tone

This subreddit is full of people who chose LangGraph or LangChain. The wrong move is to march in saying "LangChain is bad, use my thing." The right move is to acknowledge LangGraph's strengths, show what's different, and give an honest migration path.

## Title

```
Built an MIT-licensed alternative to LangGraph with built-in API + TS client. Honest comparison + migration guide inside.
```

## Body

> LangGraph has been my mental model for agent runtimes for a while, so this isn't a "LangGraph bad" post — the graph + state + checkpointer abstraction is right. Just sharing what I built when I wanted that mental model with fewer dependencies and a production stack out of the box.
>
> **AgentFlow** (MIT, Python): typed `StateGraph`, `Agent`, `ToolNode`, conditional edges, checkpointers — same shapes you already know. What's different:
>
> 1. **No LangChain dependency.** Imports are `from agentflow.core.graph import StateGraph` and that's the only graph package you install.
> 2. **REST + SSE server bundled.** `agentflow api` is the production server. No need for LangGraph Platform or hand-rolled FastAPI.
> 3. **Typed TypeScript client** (`@10xscale/agentflow-client`) for invoking and streaming from Next.js/React. SSE parsing, types, and reconnection handled.
> 4. **Postgres + Redis checkpointer** for durable threads in production. Drop-in replacement for `MemorySaver` for dev.
>
> **Where LangGraph stays the right pick**: if you're heavy in LangChain runnables / retrievers / LangSmith, that ecosystem cohesion is real. AgentFlow doesn't try to replace that.
>
> **Migration walkthrough** (full diff-style port of a ReAct agent + tool, then a multi-agent handoff): https://agentflow.10xscale.ai/blog/langgraph-to-agentflow-migration
>
> **Side-by-side comparison** (TL;DR table, code in both frameworks, FAQ): https://agentflow.10xscale.ai/docs/compare/agentflow-vs-langgraph
>
> The 1-line summary of the migration: replace `from langgraph.graph import StateGraph` with `from agentflow.core.graph import StateGraph`, replace `MemorySaver` with `InMemoryCheckpointer`, replace `HumanMessage(...)` with `Message.text_message(...)`, and use `config={"thread_id": ...}` (no `configurable` wrapper). Most ReAct agents migrate in an afternoon.
>
> Genuinely interested in feedback. The migration guide especially — if you've ported a non-trivial LangGraph project to anything, where did the abstractions break down?

## Comments to engage

- Anyone asking "but why?" — point at concrete production friction (no built-in TS client, paid Platform tier, LangChain dependency tree)
- Anyone hostile — don't engage. Mods sometimes pre-empt these threads. Be patient.
- Folks comparing to other forks/alternatives — be precise about what AgentFlow is vs. AutoGen / CrewAI / etc., link the compare pages.

## Don't

- Don't tell people to "just switch." Not the goal. The goal is to be the obvious option for new projects + the obvious destination for teams already exploring alternatives.
- Don't disable Reddit DMs. Some great conversations come from there.
