# Agentflow Tutorials

Welcome to Agentflow! This tutorial series will guide you through building intelligent agents and multi-agent workflows, from simple Agent class usage to advanced patterns like streaming, persistence, and tool integration.

## 🎯 Choose Your Path

Agentflow offers two approaches to building agents:

| Path | Best For | Time to First Agent |
|------|----------|---------------------|
| **⭐ Quick Path (Agent Class)** | Most use cases, rapid prototyping, production apps | 5 minutes |
| **🔧 Advanced Path (Custom Functions)** | Complex custom logic, non-LiteLLM providers, fine-grained control | 30+ minutes |

!!! tip "Recommendation"
    **Start with the Agent class!** It handles 90% of use cases with minimal code. You can always switch to custom functions later when you need more control.

## 🎯 What You'll Learn

Agentflow is a lightweight Python framework for building agent graphs. By the end of these tutorials, you'll understand how to:

- Build agents quickly using the **Agent class** (recommended)
- Create custom agent workflows using `StateGraph` and nodes
- Manage conversation state and message flow with `AgentState`
- Create tool-calling agents using `ToolNode` and dependency injection
- Add persistence with checkpointers and memory stores
- Stream real-time responses and monitor execution events
- Use prebuilt agent patterns for common scenarios

## 🚀 Prerequisites

Before diving in, ensure you have:

- **Python 3.12+** installed
- Basic familiarity with **async/await** patterns
- Experience with **LLM APIs** (OpenAI, Gemini, etc.)
- Comfort with command-line tools and environment variables

### Quick Setup

1. **Install Agentflow** with LiteLLM support:
   ```bash
   pip install 10xscale-agentflow[litellm]
   # Optional: add persistence and tools
   pip install 10xscale-agentflow[pg_checkpoint,mcp]
   ```

2. **Set up environment variables** in `.env`:
   ```bash
   # For LiteLLM examples
   OPENAI_API_KEY=your_openai_key
   # Or use Gemini
   GEMINI_API_KEY=your_gemini_key
   ```

3. **Clone examples** to experiment:
   ```bash
   git clone https://github.com/10xHub/agentflow.git
   cd agentflow/examples/agent-class
   python graph.py  # Your first agent!
   ```

## 📚 Tutorial Path

### ⭐ Quick Path: Agent Class (Recommended)

Start here for the fastest path to building agents:

1. **[Agent Class](agent-class.md)** ⭐ - Build complete agents in 10-30 lines of code
2. **[React with Agent Class](react/00-agent-class-react.md)** - ReAct pattern made simple
3. **[Tool Decorator](tool-decorator.md)** - Organize tools with metadata and tags

### 🔧 Advanced Path: Custom Functions

For when you need full control:

1. **[Graph Fundamentals](graph.md)** - Build agents with `StateGraph`, nodes, and edges
2. **[State & Messages](state.md)** - Master conversation state and message schemas
3. **[Tools & Dependency Injection](adapter.md)** - Create tool-calling agents with `ToolNode`
4. **[React Agent Patterns](react/01-basic-react.md)** - Complete guide to ReAct agents

### 🔀 Control & Flow
- **[Control Flow & Routing](graph.md#control-flow)** - Conditional edges, interrupts, and error handling
- **[Persistence & Memory](checkpointer.md)** - Save state with checkpointers and stores
- **[Streaming & Events](publisher.md)** - Real-time responses and observability

### 🎯 Advanced Patterns
- **[Prebuilt Agents & Orchestration](misc/advanced_patterns.md)** - Ready-to-use patterns and multi-agent workflows

## 💡 Learning Tips

- **Run the examples**: Every tutorial references working code in `examples/`. Clone, modify, and experiment!
- **Start with Agent class**: Build your first agent in 5 minutes, then learn the internals
- **Use the console**: The `ConsolePublisher` shows you what's happening under the hood
- **Debug with state**: Use `ResponseGranularity.FULL` to inspect complete execution state

## 📖 Additional Resources

- **[API Reference](../reference/)** - Detailed documentation for all classes and methods
- **[Examples Directory](../../examples/)** - Runnable code for every major pattern
- **[PyProject.toml](../../pyproject.toml)** - Optional dependencies and their features

## 🔗 Quick Navigation

| Tutorial | Focus | Key Files |
|----------|-------|-----------|
| [Agent Class](agent-class.md) ⭐ | Simple agent creation | `examples/agent-class/graph.py` |
| [React with Agent Class](react/00-agent-class-react.md) | ReAct made simple | `examples/agent-class/` |
| [Graph Fundamentals](graph.md) | StateGraph, nodes, compilation | `examples/react/react_sync.py` |
| [State & Messages](state.md) | AgentState, message handling | `agentflow/state/` |
| [Tools & DI](adapter.md) | ToolNode, dependency injection | `examples/react-injection/` |
| [Tool Decorator](tool-decorator.md) | Metadata, tags, filtering | `examples/tool-decorator/` |
| [React Agents](react/) | Complete ReAct guide | `examples/react*/` |
| [Persistence](checkpointer.md) | Checkpointers, stores | `agentflow/checkpointer/` |
| [Streaming](publisher.md) | Real-time responses | `examples/react_stream/` |
| [Advanced](misc/advanced_patterns.md) | Prebuilt agents | `agentflow/prebuilt/agent/` |

---

Ready to build your first agent? Start with **[Agent Class](agent-class.md)** for the quickest path, or **[Graph Fundamentals](graph.md)** if you want to understand the internals!
