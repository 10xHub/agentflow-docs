# Agentflow Tutorials

Welcome to  Agentflow! This tutorial series will guide you through building intelligent agents and multi-agent workflows, from basic graph construction to advanced patterns like streaming, persistence, and tool integration.

## 🎯 What You'll Learn

 Agentflow is a lightweight Python framework for building agent graphs on top of LiteLLM. By the end of these tutorials, you'll understand how to:

- Build and execute agent workflows using `StateGraph` and nodes
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

1. **Install  Agentflow** with your preferred LLM provider:
   ```bash
   pip install -agentflow[litellm]
   # Optional: add persistence and tools
   pip install -agentflow[pg_checkpoint,mcp]
   ```

2. **Set up environment variables** in `.env`:
   ```bash
   # For LiteLLM examples
   OPENAI_API_KEY=your_openai_key
   # Or use Gemini
   # GEMINI_API_KEY=your_gemini_key
   ```

3. **Clone examples** to experiment:
   ```bash
   git clone https://github.com/10xHub/agentflow.git
   cd agentflow/examples/react
   python react_sync.py  # Your first agent!
   ```

## 📚 Tutorial Path

Follow these tutorials in order for the best learning experience:

### 🏗️ Foundation
1. **[Graph Fundamentals](graph.md)** - Build your first agent with `StateGraph`, nodes, and edges
2. **[State & Messages](state.md)** - Master conversation state and message schemas
3. **[Tools & Dependency Injection](adapter.md)** - Create tool-calling agents with `ToolNode`
4. **[React Agent Patterns](react/)** - Complete guide to ReAct agents: basic patterns, DI, MCP, streaming

### 🔀 Control & Flow
4. **[Control Flow & Routing](graph.md#control-flow)** - Conditional edges, interrupts, and error handling
5. **[Persistence & Memory](checkpointer.md)** - Save state with checkpointers and stores
6. **[Streaming & Events](publisher.md)** - Real-time responses and observability

### 🎯 Advanced Patterns
7. **[Prebuilt Agents & Orchestration](misc/advanced_patterns.md)** - Ready-to-use patterns and multi-agent workflows

## 💡 Learning Tips

- **Run the examples**: Every tutorial references working code in `examples/`. Clone, modify, and experiment!
- **Start simple**: Build a basic graph first, then add complexity gradually
- **Use the console**: The `ConsolePublisher` shows you what's happening under the hood
- **Debug with state**: Use `ResponseGranularity.FULL` to inspect complete execution state

## 📖 Additional Resources

- **[API Reference](../reference/)** - Detailed documentation for all classes and methods
- **[Examples Directory](../../examples/)** - Runnable code for every major pattern
- **[PyProject.toml](../../pyproject.toml)** - Optional dependencies and their features

## 🔗 Quick Navigation

| Tutorial | Focus | Key Files |
|----------|-------|-----------|
| [Graph Fundamentals](graph.md) | StateGraph, nodes, compilation | `examples/react/react_sync.py` |
| [State & Messages](state.md) | AgentState, message handling | `agentflow/state/`, `agentflow/utils/message.py` |
| [Tools & DI](adapter.md) | ToolNode, dependency injection | `examples/react-injection/`, `examples/react-mcp/` |
| [React Agents](react/) | Complete ReAct guide: basic, DI, MCP, streaming | `examples/react*/` |
| [Control Flow](graph.md#control-flow) | Conditional routing, interrupts | `examples/react/react_weather_agent.py` |
| [Persistence](checkpointer.md) | Checkpointers, stores | `agentflow/checkpointer/`, `agentflow/store/` |
| [Streaming](publisher.md) | Real-time responses, events | `examples/react_stream/` |
| [Advanced](misc/advanced_patterns.md) | Prebuilt agents, orchestration | `agentflow/prebuilt/agent/` |

---

Ready to build your first agent? Start with **[Graph Fundamentals](graph.md)**!
