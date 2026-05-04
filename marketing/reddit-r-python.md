# r/Python — launch post draft

## Subreddit norms

Bigger and more general than r/LocalLLaMA. Many engineers who don't track the AI agent space day-to-day. Lead with what AgentFlow *does for a Python project*, not the AI hype.

## Title

```
[Project] AgentFlow: a Python framework for AI agents with built-in REST API, Postgres-backed threads, and a typed TypeScript client
```

## Body

> Hi r/Python — sharing a project I've been working on, in case anyone is building Python apps with LLM-powered agent behaviour.
>
> **AgentFlow** is an open-source (MIT) Python framework for AI agents. It targets the gap between "I have a Python script that calls an LLM" and "I have a deployed service with persistent state, streaming, and a typed frontend."
>
> The Python parts you might care about:
>
> - **`StateGraph` API.** A Python class that compiles your nodes + edges into a runnable graph. Async-first.
> - **`AgentState` and `Message`** as proper typed objects. Multimodal aware. No dict-soup.
> - **`PgCheckpointer`** built on `asyncpg` + `redis-py` for durable, resumable threads.
> - **CLI** (`agentflow api`) wraps the graph in a Starlette/ASGI server. Same code locally and in production.
> - **Pydantic-friendly state.** Subclass `AgentState`, add fields, the runtime treats them as state slots.
> - **Type hints everywhere.** `mypy --strict` clean across the runtime.
>
> Quick example (full ReAct agent with one tool):
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
> graph = StateGraph(AgentState)
> graph.add_node("MAIN", Agent(
>     model="google/gemini-2.5-flash",
>     system_prompt=[{"role": "system", "content": "Helpful assistant."}],
>     tool_node="TOOL",
> ))
> graph.add_node("TOOL", ToolNode([get_weather]))
> # ... edges ...
> app = graph.compile()
> ```
>
> **Why share here**: the framework intentionally feels like writing normal Python. No DSLs, no magic strings, no surprise side effects. If you've built workflow systems with `asyncio` + Pydantic, the API will feel familiar.
>
> **Repo**: https://github.com/10xscale/agentflow
> **Docs**: https://agentflow.10xscale.ai
> **Quickstart**: https://agentflow.10xscale.ai/docs/get-started
>
> Comparisons to LangGraph, CrewAI, AutoGen, LlamaIndex Agents, and Google ADK are linked in the docs.
>
> Feedback welcome — especially on the API ergonomics from a "writing this every day" Python perspective.

## Comments

- Be ready for "is asyncio really the right choice here" type questions
- Pydantic vs attrs vs dataclasses comes up — answer honestly: Pydantic for compatibility with the JSON contract, but state classes are not required to be Pydantic
- Type-checking + tooling questions — point at `pyproject.toml` and the test suite

## Don't

- Don't over-pitch. r/Python users don't want a sales pitch.
- Don't post during weekends. Tuesdays/Wednesdays mid-morning ET get the most engineering eyeballs.
