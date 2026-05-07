# AgentFlow

> The open-source Python framework for building production-grade multi-agent systems — with built-in orchestration, memory, REST API, and TypeScript client.

[![PyPI](https://img.shields.io/pypi/v/agentflow.svg)](https://pypi.org/project/agentflow/)
[![Python](https://img.shields.io/pypi/pyversions/agentflow.svg)](https://pypi.org/project/agentflow/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-agentflow.10xscale.ai-blue)](https://agentflow.10xscale.ai)
[![GitHub Stars](https://img.shields.io/github/stars/10xHub/Agentflow?style=social)](https://github.com/10xHub/Agentflow)

**AgentFlow** is a batteries-included framework for building AI agents in Python. It gives you a typed `StateGraph`, durable threads with `PgCheckpointer`, a REST + SSE API, and a typed TypeScript client — so you can ship a working agent fast and scale to production without rewriting the foundation.

A modern alternative to LangGraph, CrewAI, AutoGen, LlamaIndex Agents, and Google ADK. See the [framework comparisons](https://agentflow.10xscale.ai/docs/compare).

## ✨ Features

- 🧩 **Graph-based orchestration** — typed `StateGraph` with conditional edges, sub-graphs, and recursion limits
- 💾 **Durable threads** — `InMemoryCheckpointer` for dev, `PgCheckpointer` (Postgres + Redis) for production
- 🌊 **Streaming** — token-level SSE, async streams, and tool-event events
- 🔌 **Multi-provider** — OpenAI, Anthropic, Google (Gemini + Vertex AI), and more
- 🚀 **Built-in API + CLI** — `agentflow api` serves any compiled graph at `/v1/graph/invoke` and `/v1/graph/stream`
- 🌐 **Typed TypeScript client** — `@10xscale/agentflow-client` for invoking and streaming from any frontend
- 🔬 **Hosted playground** — test deployed graphs in the browser without writing client code
- 🔁 **Multi-agent patterns** — handoffs, supervisors, human-in-the-loop interrupts, sub-graphs

## 🚀 Quick start

```bash
pip install 10xscale-agentflow 10xscale-agentflow-cli
```

```python
from agentflow.core.graph import Agent, StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

def get_weather(location: str) -> str:
    """Get current weather for a city."""
    return f"It is sunny and 22°C in {location}."

tool_node = ToolNode([get_weather])
agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node="TOOL",
)

graph = StateGraph(AgentState)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

def route(state):
    last = state.context[-1] if state.context else None
    if last and getattr(last, "tools_calls", None) and last.role == "assistant":
        return "TOOL"
    if last and last.role == "tool":
        return "MAIN"
    return END

graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")
app = graph.compile()

result = app.invoke(
    {"messages": [Message.text_message("Weather in Tokyo?")]},
    config={"thread_id": "demo-1"},
)
print(result["messages"][-1].text())
```

Full guide: [agentflow.10xscale.ai/docs/get-started](https://agentflow.10xscale.ai/docs/get-started)

## 📚 Documentation

- [**Get started**](https://agentflow.10xscale.ai/docs/get-started) — install, build, expose, connect a client
- [**Concepts**](https://agentflow.10xscale.ai/docs/concepts/architecture) — state graphs, agents, tools, memory, streaming
- [**Tutorials**](https://agentflow.10xscale.ai/docs/tutorials) — runnable examples (ReAct, multi-agent, MCP, RAG)
- [**How-to guides**](https://agentflow.10xscale.ai/docs/how-to/python/handoff-between-agents) — focused, task-oriented
- [**Reference**](https://agentflow.10xscale.ai/docs/reference/python/agent) — full API surface

## 🔁 Migrating from another framework?

- [AgentFlow vs LangGraph](https://agentflow.10xscale.ai/docs/compare/agentflow-vs-langgraph) — closest drop-in alternative
- [AgentFlow vs CrewAI](https://agentflow.10xscale.ai/docs/compare/agentflow-vs-crewai) — graphs vs role-based crews
- [AgentFlow vs AutoGen](https://agentflow.10xscale.ai/docs/compare/agentflow-vs-autogen) — typed graphs vs conversational agents
- [AgentFlow vs LlamaIndex Agents](https://agentflow.10xscale.ai/docs/compare/agentflow-vs-llamaindex-agents) — runtime-first vs RAG-first
- [AgentFlow vs Google ADK](https://agentflow.10xscale.ai/docs/compare/agentflow-vs-google-adk) — open-source, provider-neutral
- [LangGraph → AgentFlow migration walkthrough](https://agentflow.10xscale.ai/blog/langgraph-to-agentflow-migration)

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Your code: graphs, tools, system prompts                │
└────────────┬─────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────┐
│  agentflow (Python)                                       │
│  ├── StateGraph + Agent + ToolNode                        │
│  ├── AgentState + Message                                 │
│  ├── Checkpointers (InMemory, Pg, …)                      │
│  └── Providers (OpenAI / Anthropic / Google / …)          │
└────────────┬─────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────┐
│  agentflow-cli                                            │
│  └── `agentflow api` → REST + SSE server                  │
└────────────┬─────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────┐
│  @10xscale/agentflow-client (TypeScript)                  │
│  └── invoke + stream from any JS / TS frontend            │
└──────────────────────────────────────────────────────────┘
```

## 🤝 Community

- [Discussions](https://github.com/10xHub/Agentflow/discussions) — questions, ideas, show-and-tell
- [Issues](https://github.com/10xHub/Agentflow/issues) — bug reports and feature requests
- [Documentation](https://agentflow.10xscale.ai)

## 📜 License

MIT — see [LICENSE](LICENSE).

## ⭐ Support the project

If AgentFlow saves you time, a GitHub star helps others find it. Thanks!
