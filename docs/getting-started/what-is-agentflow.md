# What is AgentFlow?

## The 30-Second Explanation

**AgentFlow** is a Python framework for building AI agents and orchestrating multi-agent workflows.

An AI agent is a program that:

1. **Listens** — receives input (user message, event, API call)
2. **Thinks** — uses an LLM (Gemini, GPT-4, Claude) to reason
3. **Acts** — calls tools, generates output, or triggers other agents
4. **Loops** — repeats until the task is complete

AgentFlow gives you the **graph-based runtime** to wire all of that together, so you focus on your logic — not on orchestration plumbing.

---

## Why Does This Matter?

Without a framework, building a production agent means manually handling:

- Conversation state across multiple turns
- Tool discovery, calling, and result injection
- Routing decisions (which step runs next?)
- Error handling and retries
- Memory and checkpointing
- Streaming responses to clients
- Multi-agent coordination

That's months of infrastructure work. AgentFlow provides it all out of the box.

---

## Real-World Use Cases

| Use Case | What the Agent Does |
|----------|---------------------|
| **Customer Support Bot** | Reads queries → searches knowledge base → drafts reply |
| **Code Review Agent** | Receives PR diff → analyzes code → suggests improvements |
| **Research Assistant** | Gets a topic → searches web → reads articles → summarizes |
| **Data Pipeline Agent** | Gets a task → queries DB → transforms data → writes report |
| **Multi-Agent Team** | Orchestrator delegates tasks to specialized sub-agents |

---

## How AgentFlow Works

AgentFlow is built around a **StateGraph** — a directed graph where:

- **Nodes** are processing steps (your agent, your tools, your logic)
- **Edges** define what runs next (fixed or conditional)
- **State** flows through every node, carrying messages and context

```
User Message
     ↓
  [MAIN node]    ← Agent (LLM) thinks about what to do
     ↓
  [TOOL node]    ← Tool executes (e.g., searches database)
     ↓
  [MAIN node]    ← Agent sees tool result, generates final answer
     ↓
  END → Response
```

Every time you call `app.invoke(...)`, the graph runs — routing through nodes, executing tools, and stopping when complete.

---

## What Makes AgentFlow Different?

### Provider-Agnostic

Use the official SDK for your LLM provider. AgentFlow doesn't force you through a wrapper:

```python
# Google Gemini
Agent(model="gemini/gemini-2.5-flash", ...)

# OpenAI GPT-4
Agent(model="openai/gpt-4o", ...)

# Anthropic Claude
Agent(model="anthropic/claude-3-5-sonnet-20241022", ...)
```

All work with the same graph code. Switching providers is one line.

### Production-Ready Out of the Box

| Feature | Description |
|---------|-------------|
| Checkpointing | InMemory (dev) or PostgreSQL + Redis (prod) |
| Streaming | Real-time token streaming to clients |
| Human-in-the-loop | Pause execution, await human input, resume |
| Async-first | Native async/await, parallel tool execution |
| Observability | Built-in event publishers (Console, Redis, Kafka) |
| Multi-agent | Agent handoff and collaborative pipelines |

### Minimal Boilerplate

```python
# This is a complete, working tool-calling agent:
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import Message

def search(query: str) -> str:
    return f"Results for: {query}"

graph = StateGraph()
graph.add_node("MAIN", Agent(model="gemini/gemini-2.5-flash", tool_node_name="TOOL"))
graph.add_node("TOOL", ToolNode([search]))
graph.set_entry_point("MAIN")

app = graph.compile()
result = app.invoke({"messages": [Message.text_message("Search Python tutorials")]})
```

---

## What You Need to Know

### Prerequisites

- **Python basics** — functions, classes, async/await
- **Command line** — running `pip install` and `python script.py`
- **An API key** — from Google, OpenAI, or Anthropic

### You Do NOT Need

- Prior experience with LangChain, LlamaIndex, or other frameworks
- Graph theory or advanced architecture knowledge
- Databases or infrastructure (use in-memory mode to start)

---

## Comparison

| | AgentFlow | LangChain | AutoGen |
|---|---|---|---|
| Learning curve | Low | High | Medium |
| Provider flexibility | Any SDK | Via LangChain adapters | Via model wrappers |
| Production checkpointing | Built-in | Built-in | Limited |
| Multi-agent | Built-in | Built-in | Core feature |
| TypeScript client | Built-in | Separate package | None |
| First agent in | 5 min | 20–30 min | 15 min |

---

## Your Learning Path

```
What is AgentFlow? ← YOU ARE HERE
         ↓
   Installation (pick your LLM provider)
         ↓
   Hello World (your first working agent with tools)
         ↓
   Core Concepts (5 building blocks explained)
         ↓
   Tutorials (memory, RAG, multi-agent, streaming...)
```

---

**Ready?** Let's [install AgentFlow →](installation.md)
