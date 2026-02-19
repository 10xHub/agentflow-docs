# Getting Started with AgentFlow

Welcome! This section takes you from zero to a working AI agent — step by step, with real code at every stage.

---

## Your Path

| Step | Page | What You'll Do | Time |
|------|------|----------------|------|
| 1 | [What is AgentFlow?](what-is-agentflow.md) | Understand what you're building and why | 3 min |
| 2 | [Installation](installation.md) | Install AgentFlow + your LLM provider | 5 min |
| 3 | [Hello World](hello-world.md) | Build a working agent with tool calling | 10 min |
| 4 | [Core Concepts](core-concepts.md) | Learn the 5 building blocks you use every time | 5 min |

**Total: ~23 minutes to your first working agent.**

---

## Choose Your Starting Point

**I'm brand new to AI agents**
→ Start with [What is AgentFlow?](what-is-agentflow.md) to get oriented, then follow the path above.

**I know what agents are — just let me build**
→ Jump to [Installation](installation.md) → [Hello World](hello-world.md)

**I prefer understanding theory first**
→ [Core Concepts](core-concepts.md) → [Hello World](hello-world.md)

---

## What You'll Build

By the end of this section you'll have a **tool-calling AI agent** that:

- Accepts user messages
- Decides when to call Python functions (tools)
- Returns a synthesized response from the LLM

Here's the complete code you'll understand by the end:

```python
from dotenv import load_dotenv
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import Message
from agentflow.utils.constants import END

load_dotenv()

def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny, 72°F"

tool_node = ToolNode([get_weather])

graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt="You are a helpful assistant.",
    tool_node_name="TOOL",
))
graph.add_node("TOOL", tool_node)
graph.set_entry_point("MAIN")

app = graph.compile()

result = app.invoke({
    "messages": [Message.text_message("What's the weather in New York?")]
})
print(result["messages"][-1].content)
```

15 lines. One agent. Tool calling included.

---

## What's Next After Getting Started?

Once you've completed this section, you'll be ready for:

- **[Tutorials](../Tutorial/index.md)** — Step-by-step guides for real-world patterns (memory, RAG, multi-agent, streaming)
- **[How-To Guides](../how-to/index.md)** — Quick recipes for specific tasks
- **[Reference](../reference/library/index.md)** — Full API documentation for every class and method

---

**Let's go!** Start with [What is AgentFlow? →](what-is-agentflow.md)
