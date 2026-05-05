# r/LocalLLaMA — launch post draft

## Subreddit norms

- Audience: hands-on LLM developers, many running local models. Skeptical of marketing.
- What works: real code, real benchmarks, "I built X — here's the architecture."
- What doesn't: vague hype, "leveraging AI" language, anything that smells like a sales pitch.

## Title

```
[Open Source] AgentFlow: Python agent framework with built-in REST/SSE server, Postgres-backed threads, and a TypeScript client (LangGraph alternative)
```

## Body

> I've been building an agent framework that scratches an itch I had with the existing options. Sharing in case anyone here finds it useful — happy to take feedback.
>
> **What it is**: AgentFlow is an open-source (MIT) Python framework for production AI agents. Same graph-based mental model as LangGraph (typed `StateGraph`, conditional edges, checkpointers) but with a few differences:
>
> - **Built-in production server.** `pip install 10xscale-agentflow-cli` → `agentflow api` and you have `POST /v1/graph/invoke` and `POST /v1/graph/stream` (SSE). No FastAPI to wire yourself.
> - **Typed TypeScript client** (`@10xscale/agentflow-client`) for calling the API from Next.js / React / Node — handles SSE parsing and types end-to-end.
> - **Postgres + Redis checkpointer** for durable, resumable threads. Same `thread_id` survives restarts and replicas.
> - **Multi-provider** — OpenAI, Anthropic, Google (Gemini + Vertex AI). One-line swap.
> - **No required SaaS account.** Runs on a laptop, in Docker, on EC2, anywhere Python runs.
>
> **What it isn't**: a LangChain replacement. AgentFlow is the runtime + API layer; you can still pull in LangChain retrievers, LlamaIndex indexes, raw vector clients — they fit as tools.
>
> **Code shape (full ReAct agent + tool):**
>
> ```python
> from agentflow.core.graph import Agent, StateGraph, ToolNode
> from agentflow.core.state import AgentState, Message
> from agentflow.utils import END
>
> def get_weather(location: str) -> str:
>     """Get current weather."""
>     return f"It is sunny and 22°C in {location}."
>
> tool_node = ToolNode([get_weather])
> agent = Agent(model="google/gemini-2.5-flash",
>               system_prompt=[{"role": "system", "content": "Helpful assistant."}],
>               tool_node="TOOL")
>
> graph = StateGraph(AgentState)
> graph.add_node("MAIN", agent)
> graph.add_node("TOOL", tool_node)
> # ... edges and routing fn ...
> app = graph.compile()
> ```
>
> **Repo**: https://github.com/10xHub/Agentflow
> **Docs**: https://agentflow.10xscale.ai
> **Quickstart**: https://agentflow.10xscale.ai/docs/get-started
>
> **Comparisons** (honest — we don't trash competitors): vs LangGraph, CrewAI, AutoGen, LlamaIndex Agents, Google ADK. Each page shows the same agent in both frameworks.
>
> Thanks for reading. Genuinely interested in feedback on the API surface, missing features, and where it falls short.

## Things to include in comments if asked

- Concrete latency numbers (TTFB) for a basic ReAct agent on Gemini 2.5 Flash
- Where AgentFlow ISN'T the right pick (LangChain-deep stacks, single-tool RAG with LlamaIndex)
- Roadmap items you're working on next

## Don't

- Do not crosspost the same exact text to other subs. Re-write per audience.
- Do not respond to early "is this AI slop?" comments defensively. Show code.
- Do not delete and repost. The mods notice.

## After posting

Pin the comment with the link in case the title gets clipped. Engage replies for 2–3 hours.
