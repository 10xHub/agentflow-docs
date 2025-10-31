# Agentflow (Python library)

![PyPI](https://img.shields.io/pypi/v/10xscale-agentflow?color=blue)
![License](https://img.shields.io/github/license/10xhub/agentflow)
![Python](https://img.shields.io/pypi/pyversions/10xscale-agentflow)
[![Coverage](https://img.shields.io/badge/coverage-75%25-yellow.svg)](#)

Agentflow is a lightweight, LLM-agnostic Python framework for building intelligent agents and orchestrating multi-agent workflows. Bring your favorite LLM SDK (LiteLLM, OpenAI, Gemini, Claude, etc.); Agentflow handles the orchestration, state, tools, and control flow.

---

## ✨ What you get

- LLM-agnostic orchestration with nodes, edges, and conditional control flow
- Structured responses with optional thinking and token usage
- Tool calling with MCP, Composio, and LangChain adapters — with parallel execution
- Streaming (delta updates) and human-in-the-loop (pause/resume)
- Built-in persistence (InMemory or PostgreSQL+Redis checkpointers)
- Production signals: publishers (Console, Redis, Kafka, RabbitMQ), metrics, observability
- Clean dependency injection for tools and nodes

---

## 🚀 Quick start

Install (uv recommended):

```bash
uv pip install 10xscale-agentflow
```

Or with pip:

```bash
pip install 10xscale-agentflow
```

Optional extras:

```bash
# Checkpointing (PostgreSQL + Redis)
pip install 10xscale-agentflow[pg_checkpoint]

# Tools
pip install 10xscale-agentflow[mcp]
pip install 10xscale-agentflow[composio]
pip install 10xscale-agentflow[langchain]

# Publishers
pip install 10xscale-agentflow[redis]
pip install 10xscale-agentflow[kafka]
pip install 10xscale-agentflow[rabbitmq]
```

Set your LLM API key (example for OpenAI):

```bash
export OPENAI_API_KEY=sk-...
```

---

## 🧪 Minimal example

```python
from litellm import acompletion
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state.agent_state import AgentState
from agentflow.utils import Message
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages


def get_weather(location: str, tool_call_id: str | None = None, state: AgentState | None = None) -> Message:
    return Message.tool_message(content=f"Weather in {location}: sunny", tool_call_id=tool_call_id)


tool_node = ToolNode([get_weather])


async def main_agent(state: AgentState):
    sys = "You are a helpful assistant. Use tools if needed."
    messages = convert_messages(system_prompts=[{"role": "system", "content": sys}], state=state)

    needs_tools = bool(state.context) and getattr(state.context[-1], "role", "") != "tool"
    if needs_tools:
        tools = await tool_node.all_tools()
        return await acompletion(model="gemini/gemini-2.5-flash", messages=messages, tools=tools)
    return await acompletion(model="gemini/gemini-2.5-flash", messages=messages)


def route(state: AgentState) -> str:
    last = (state.context or [])[-1] if state.context else None
    has_calls = hasattr(last, "tools_calls") and last.tools_calls
    return "TOOL" if (not state.context or has_calls) else END


graph = StateGraph()
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())

res = app.invoke({"messages": [Message.from_text("What's the weather in Tokyo?")]}, config={"thread_id": "demo"})
for m in res["messages"]:
    print(m)
```

---

## 📚 Learn the concepts

- Graph: nodes, edges, execution — see [Graph](./graph/index.md)
- State, message context, checkpointers — see [Context](./context/index.md)
- Tools, MCP, DI, converters — see [Tools](./graph/tools.md)
- Control flow and interrupts — see [Control Flow](./graph/control_flow.md)
- Human-in-the-loop — see [HITL](./graph/human-in-the-loop.md)

Explore step-by-step guides in [Tutorials](../Tutorial/index.md), including React patterns, RAG, memory, and validation.

---

## � Ecosystem

- CLI for deployment and scaffolding: [Agentflow CLI](../cli/index.md)
- TypeScript client for consuming Agentflow APIs: [@10xscale/agentflow-client](../client/index.md)

Useful links:

- GitHub: https://github.com/10xhub/agentflow
- PyPI: https://pypi.org/project/10xscale-agentflow/
- Examples: https://github.com/10xhub/agentflow/tree/main/examples
