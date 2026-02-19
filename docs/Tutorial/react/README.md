# ReAct Pattern

**ReAct (Reasoning and Acting)** is the core pattern behind most production agents. Agents alternate between *thinking* about what to do and *acting* by calling tools — iterating until the task is complete.

---

## The ReAct Loop

```
User Input
    ↓
Reasoning   ← LLM decides: answer directly, or call a tool?
    ↓
Acting      ← Tool executes and returns a result
    ↓
Observation ← LLM sees the result and reasons again
    ↓
Answer      ← LLM provides a final response
```

This loop repeats until the LLM produces a final text answer with no tool calls.

---

## Two Approaches

AgentFlow gives you two ways to build ReAct agents:

| Approach | Lines of code | Use case |
|----------|--------------|---------|
| **Agent Class** | 10–30 lines | Almost everything — fast to build, easy to maintain |
| **Custom async functions** | 50–150 lines | When you need full control over message handling or LLM calls |

**Start with the Agent Class approach.** Only use custom functions if you hit a limitation.

---

## Quick Start

### Agent Class approach (recommended)

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END


def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: sunny, 72°F"


graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node_name="TOOL"
))
graph.add_node("TOOL", ToolNode([get_weather]))


def route(state: AgentState) -> str:
    if state.context and state.context[-1].tools_calls:
        return "TOOL"
    return END


graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
result = app.invoke(
    {"messages": [Message.text_message("What's the weather in Tokyo?")]},
    config={"thread_id": "1"}
)
print(result["messages"][-1].content)
```

### Using the ReactAgent prebuilt

For even less boilerplate, use the prebuilt `ReactAgent` which sets up the graph, routing, and edges automatically:

```python
from agentflow.graph import Agent, ToolNode
from agentflow.prebuilt.agent import ReactAgent
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.state import Message


def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: sunny, 72°F"


agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node_name="TOOL"
)

app = ReactAgent().compile(
    main_node=agent,
    tool_node=ToolNode([get_weather]),
    checkpointer=InMemoryCheckpointer(),
)

result = app.invoke(
    {"messages": [Message.text_message("What's the weather in Tokyo?")]},
    config={"thread_id": "1"}
)
print(result["messages"][-1].content)
```

---

## Prerequisites

```bash
# Install AgentFlow with OpenAI SDK
pip install 10xscale-agentflow[openai]

# Or with Google GenAI SDK
pip install 10xscale-agentflow[google-genai]

# For MCP integration
pip install 10xscale-agentflow[mcp]
```

Set your API key:

```bash
export OPENAI_API_KEY=your_key
# or
export GEMINI_API_KEY=your_key
```

---

## Tutorial Progression

| Tutorial | Focus | Time |
|----------|-------|------|
| [ReAct with Agent Class](00-agent-class-react.md) | Simplest ReAct — start here | 15 min |
| [Custom ReAct (Advanced)](01-basic-react.md) | Build from scratch with custom async functions | 30 min |
| [Dependency Injection](02-dependency-injection.md) | Inject services and config with InjectQ | 30 min |
| [MCP Integration](03-mcp-integration.md) | Connect to Model Context Protocol servers | 30 min |
| [Streaming](04-streaming.md) | Real-time token streaming | 20 min |
| [Unit Testing](05-unit-testing.md) | Test without real LLM API calls | 20 min |

---

## Debugging Tips

### Enable execution logging

```python
from agentflow.publisher import ConsolePublisher
from agentflow.checkpointer import InMemoryCheckpointer

app = graph.compile(
    checkpointer=InMemoryCheckpointer(),
    publisher=ConsolePublisher()  # Shows execution flow in console
)
```

### Debug your routing function

```python
def route(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    print(f"Last message role: {last.role if last else None}")
    print(f"Has tool calls: {bool(last and last.tools_calls)}")
    if last and last.tools_calls:
        return "TOOL"
    return END
```

### Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Agent never calls tools | Docstring unclear | Add descriptive docstrings to tool functions |
| Tool not found | Name mismatch | `tool_node_name` must match the node name in `add_node()` |
| Infinite loop | Routing logic bug | Check that routing returns `END` when there are no tool calls |
| Context loss between turns | No checkpointer | Pass `checkpointer=InMemoryCheckpointer()` to `compile()` |

---

## Related Docs

- [Agent Class Deep Dive](../agent-class.md) — Full Agent class API
- [Tool Decorator & Filtering](../tool-decorator.md) — Organize tools with tags
- [AgentState reference](../../reference/library/context/state.md)
- [Checkpointers reference](../../reference/library/context/checkpointer.md)

---

**Start here:** [ReAct with Agent Class →](00-agent-class-react.md)
