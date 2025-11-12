# 10xScale Agentflow

![PyPI](https://img.shields.io/pypi/v/agentflow?color=blue)
![License](https://img.shields.io/github/license/10xhub/agentflow)
![Python](https://img.shields.io/pypi/pyversions/agentflow)
[![Coverage](https://img.shields.io/badge/coverage-73%25-yellow.svg)](#)

**Agentflow** is a lightweight Python framework for building intelligent agents and orchestrating multi-agent workflows. It's an **LLM-agnostic orchestration tool** that works with any LLM provider—use LiteLLM, native SDKs from OpenAI, Google Gemini, Anthropic Claude, or any other provider. You choose your LLM library; Agentflow provides the workflow orchestration.

---

## ✨ Key Features

- **🎯 LLM-Agnostic Orchestration** - Works with any LLM provider (LiteLLM, OpenAI, Gemini, Claude, native SDKs)
- **🤖 Multi-Agent Workflows** - Build complex agent systems with your choice of orchestration patterns
- **📊 Structured Responses** - Get `content`, optional `thinking`, and `usage` in a standardized format
- **🌊 Streaming Support** - Real-time incremental responses with delta updates
- **🔧 Tool Integration** - Native support for function calling, MCP, Composio, and LangChain tools with **parallel execution**
- **🔀 LangGraph-Inspired Engine** - Flexible graph orchestration with nodes, conditional edges, and control flow
- **💾 State Management** - Built-in persistence with in-memory and PostgreSQL+Redis checkpointers
- **🔄 Human-in-the-Loop** - Pause/resume execution for approval workflows and debugging
- **🚀 Production-Ready** - Event publishing (Console, Redis, Kafka, RabbitMQ), metrics, and observability
- **🧩 Dependency Injection** - Clean parameter injection for tools and nodes
- **📦 Prebuilt Patterns** - React, RAG, Swarm, Router, MapReduce, SupervisorTeam, and more

---

## 🌟 What Makes Agentflow Unique

Agentflow stands out with powerful features designed for production-grade AI applications:

### 🏗️ **Architecture & Scalability**

1. **💾 Checkpointer with Caching Design**  
   Intelligent state persistence with built-in caching layer to scale efficiently. PostgreSQL + Redis implementation ensures high performance in production environments.

2. **🧠 3-Layer Memory System**  
   - **Short-term memory**: Current conversation context
   - **Conversational memory**: Session-based chat history
   - **Long-term memory**: Persistent knowledge across sessions

### 🔧 **Advanced Tooling Ecosystem**

3. **🔌 Remote Tool Calls**  
   Execute tools remotely using our TypeScript SDK for distributed agent architectures.

4. **🛠️ Comprehensive Tool Integration**  
   - Local tools (Python functions)
   - Remote tools (via TypeScript SDK)
   - Agent handoff tools (multi-agent collaboration)
   - MCP (Model Context Protocol)
   - LangChain tools
   - Composio tools

### 🎯 **Intelligent Context Management**

5. **📏 Dedicated Context Manager**  
   - Automatically controls context size to prevent token overflow
   - Called at iteration end to avoid mid-execution context loss
   - Fully extensible with custom implementations

### ⚙️ **Dependency Injection & Control**

6. **💉 First-Class Dependency Injection**  
   Powered by InjectQ library for clean, testable, and maintainable code patterns.

7. **🎛️ Custom ID Generation Control**  
   Choose between string, int, or bigint IDs. Smaller IDs save significant space in databases and indexes compared to standard 128-bit UUIDs.

### 📊 **Observability & Events**

8. **📡 Internal Event Publishing**  
   Emit execution events to any publisher:
   - Kafka
   - RabbitMQ
   - Redis Pub/Sub
   - OpenTelemetry (planned)
   - Custom publishers

### 🔄 **Advanced Execution Features**

9. **⏰ Background Task Manager**  
   Built-in manager for running tasks asynchronously:
   - Prefetching data
   - Memory persistence
   - Cleanup operations
   - Custom background jobs

10. **🚦 Human-in-the-Loop with Interrupts**  
    Pause execution at any point for human approval, then seamlessly resume with full state preservation.

11. **🧭 Flexible Agent Navigation**  
    - Condition-based routing between agents
    - Command-based jumps to specific agents
    - Agent handoff tools for smooth transitions

### 🛡️ **Security & Validation**

12. **🎣 Comprehensive Callback System**  
    Hook into various execution stages for:
    - Logging and monitoring
    - Custom behavior injection
    - **Prompt injection attack prevention**
    - Input/output validation

### 📦 **Ready-to-Use Components**

13. **🤖 Prebuilt Agent Patterns**  
    Production-ready implementations:
    - React agents
    - RAG (Retrieval-Augmented Generation)
    - Swarm architectures
    - Router agents
    - MapReduce patterns
    - Supervisor teams

### 📐 **Developer Experience**

14. **📋 Pydantic-First Design**  
    All core classes (State, Message, ToolCalls) are Pydantic models:
    - Automatic JSON serialization
    - Type safety
    - Easy debugging and logging
    - Seamless database storage

---

## 🚀 Quick Start

### Installation

**Basic installation with [uv](https://github.com/astral-sh/uv) (recommended):**

```bash
uv pip install 10xscale-agentflow
```

Or with pip:

```bash
pip install 10xscale-agentflow
```

**Optional Dependencies:**

Agentflow supports optional dependencies for specific functionality:

```bash
# PostgreSQL + Redis checkpointing
pip install 10xscale-agentflow[pg_checkpoint]

# MCP (Model Context Protocol) support
pip install 10xscale-agentflow[mcp]

# Composio tools (adapter)
pip install 10xscale-agentflow[composio]

# LangChain tools (registry-based adapter)
pip install 10xscale-agentflow[langchain]

# Individual publishers
pip install 10xscale-agentflow[redis]     # Redis publisher
pip install 10xscale-agentflow[kafka]     # Kafka publisher
pip install 10xscale-agentflow[rabbitmq]  # RabbitMQ publisher

# Multiple extras
pip install 10xscale-agentflow[pg_checkpoint,mcp,composio,langchain]
```

### Environment Setup

Set your LLM provider API key:

```bash
export OPENAI_API_KEY=sk-...  # for OpenAI models
# or
export GEMINI_API_KEY=...     # for Google Gemini
# or
export ANTHROPIC_API_KEY=...  # for Anthropic Claude
```

If you have a `.env` file, it will be auto-loaded (via `python-dotenv`).

---

## 📚 Documentation Structure

### [🎓 Tutorials](Tutorial/index.md)
Learn Agentflow step-by-step with practical examples:

- **[Graph Fundamentals](Tutorial/index.md)** - Build your first agent with StateGraph, nodes, and edges
- **[React Agent Patterns](Tutorial/react/)** - Complete guide: basic patterns, DI, MCP, streaming
- **[State & Messages](Tutorial/index.md)** - Master conversation state and message handling
- **[Tools & Dependency Injection](Tutorial/index.md)** - Create tool-calling agents with ToolNode
- **[Persistence & Memory](Tutorial/long_term_memory.md)** - Save state with checkpointers and stores
- **[RAG Implementation](Tutorial/rag.md)** - Build retrieval-augmented generation systems
- **[Plan-Act-Reflect](Tutorial/plan_act_reflect.md)** - Advanced reasoning patterns

### [📖 Concepts](Concept/index.md)
Deep dives into Agentflow's architecture:

- **[Graph Architecture](Concept/graph/)** - StateGraph, nodes, edges, compiled execution
- **[State Management](Concept/context/)** - AgentState, checkpointers, stores
- **[Tools & Integration](Concept/graph/tools.md)** - ToolNode, MCP, Composio, LangChain
- **[Control Flow](Concept/graph/control_flow.md)** - Conditional routing, interrupts
- **[Human-in-the-Loop](Concept/graph/human-in-the-loop.md)** - Approval workflows, pause/resume
- **[Dependency Injection](Concept/dependency-injection.md)** - InjectQ container patterns
- **[Publishers & Events](Concept/publisher.md)** - Observability and monitoring
- **[Response Converters](Concept/response_converter.md)** - LLM output normalization

### [📘 API Reference](reference/)
Complete API documentation for all modules:

- [Graph](reference/graph/) - StateGraph, CompiledGraph, Node, Edge, ToolNode
- [State](reference/state/) - AgentState, ExecutionState, MessageContext
- [Checkpointer](reference/checkpointer/) - InMemory, PostgreSQL+Redis
- [Store](reference/store/) - BaseStore, Qdrant, Mem0
- [Publisher](reference/publisher/) - Console, Redis, Kafka, RabbitMQ
- [Adapters](reference/adapters/) - LiteLLM, MCP, Composio, LangChain
- [Utils](reference/utils/) - Message, Command, Callbacks, Converters
- [Prebuilt Agents](reference/prebuilt/agent/) - Ready-to-use patterns

---

## 💡 Simple Example

Here's a minimal React agent with tool calling:

```python
from dotenv import load_dotenv
from litellm import acompletion

from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state.agent_state import AgentState
from agentflow.utils import Message
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages

load_dotenv()


# Define a tool with dependency injection
def get_weather(
        location: str,
        tool_call_id: str | None = None,
        state: AgentState | None = None,
) -> Message:
    """Get the current weather for a specific location."""
    res = f"The weather in {location} is sunny"
    return Message.tool_message(
        content=res,
        tool_call_id=tool_call_id,
    )


# Create tool node
tool_node = ToolNode([get_weather])


# Define main agent node
async def main_agent(state: AgentState):
    prompts = "You are a helpful assistant. Use tools when needed."

    messages = convert_messages(
        system_prompts=[{"role": "system", "content": prompts}],
        state=state,
    )

    # Check if we need tools
    if (
            state.context
            and len(state.context) > 0
            and state.context[-1].role == "tool"
    ):
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
        )
    else:
        tools = await tool_node.all_tools()
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            tools=tools,
        )

    return response


# Define routing logic
def should_use_tools(state: AgentState) -> str:
    """Determine if we should use tools or end."""
    if not state.context or len(state.context) == 0:
        return "TOOL"

    last_message = state.context[-1]

    if (
            hasattr(last_message, "tools_calls")
            and last_message.tools_calls
            and len(last_message.tools_calls) > 0
    ):
        return "TOOL"

    return END


# Build the graph
graph = StateGraph()
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges(
    "MAIN",
    should_use_tools,
    {"TOOL": "TOOL", END: END},
)

graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# Compile and run
app = graph.compile(checkpointer=InMemoryCheckpointer())

inp = {"messages": [Message.from_text("What's the weather in New York?")]}
config = {"thread_id": "12345", "recursion_limit": 10}

res = app.invoke(inp, config=config)

for msg in res["messages"]:
    print(msg)
```

---

## 🎯 Use Cases & Patterns

Agentflow includes prebuilt agent patterns for common scenarios:

### 🤖 Agent Types

- **[React Agent](reference/prebuilt/agent/react.md)** - Reasoning and acting with tool calls
- **[RAG Agent](reference/prebuilt/agent/rag.md)** - Retrieval-augmented generation
- **[Guarded Agent](reference/prebuilt/agent/guarded.md)** - Input/output validation and safety
- **[Plan-Act-Reflect](reference/prebuilt/agent/plan_act_reflect.md)** - Multi-step reasoning

### 🔀 Orchestration Patterns

- **[Router Agent](reference/prebuilt/agent/router.md)** - Route queries to specialized agents
- **[Swarm](reference/prebuilt/agent/swarm.md)** - Dynamic multi-agent collaboration
- **[SupervisorTeam](reference/prebuilt/agent/supervisor_team.md)** - Hierarchical agent coordination
- **[MapReduce](reference/prebuilt/agent/map_reduce.md)** - Parallel processing and aggregation
- **[Sequential](reference/prebuilt/agent/sequential.md)** - Linear workflow chains
- **[Branch-Join](reference/prebuilt/agent/branch_join.md)** - Parallel branches with synchronization

### 🔬 Advanced Patterns

- **[Deep Research](reference/prebuilt/agent/deep_research.md)** - Multi-level research and synthesis
- **[Network](reference/prebuilt/agent/network.md)** - Complex agent networks

See the [Prebuilt Agents Reference](reference/prebuilt/agent/) for complete documentation.

---

## 🔧 Development

### For Library Users

Install Agentflow as shown above. The `pyproject.toml` contains all runtime dependencies.

### For Contributors

```bash
# Clone the repository
git clone https://github.com/10xhub/agentflow.git
cd agentflow

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dev dependencies
pip install -r requirements-dev.txt
# or
uv pip install -r requirements-dev.txt

# Run tests
make test
# or
pytest -q

# Build docs
make docs-serve  # Serves at http://127.0.0.1:8000

# Run examples
cd examples/react
python react_sync.py
```

### Development Tools

The project uses:
- **pytest** for testing (with async support)
- **ruff** for linting and formatting
- **mypy** for type checking
- **mkdocs** with Material theme for documentation
- **coverage** for test coverage reports

See `pyproject.dev.toml` for complete tool configurations.

---

## 🗺️ Roadmap

- ✅ Core graph engine with nodes and edges
- ✅ State management and checkpointing
- ✅ Tool integration (MCP, Composio, LangChain)
- ✅ **Parallel tool execution** for improved performance
- ✅ Streaming and event publishing
- ✅ Human-in-the-loop support
- ✅ Prebuilt agent patterns
- 🚧 Agent-to-Agent (A2A) communication protocols
- 🚧 Remote node execution for distributed processing
- 🚧 Enhanced observability and tracing
- 🚧 More persistence backends (Redis, DynamoDB)
- 🚧 Parallel/branching strategies
- 🚧 Visual graph editor

---

## 📄 License

MIT License - see [LICENSE](https://github.com/10xhub/agentflow/blob/main/LICENSE) for details.

---

## 🔗 Links & Resources

- **[GitHub Repository](https://github.com/10xhub/agentflow)** - Source code and issues
- **[PyPI Project](https://pypi.org/project/agentflow/)** - Package releases
- **[Examples Directory](https://github.com/10xhub/agentflow/tree/main/examples)** - Runnable code samples
- **[API Reference](reference/)** - Complete documentation
- **[Tutorials](Tutorial/)** - Step-by-step guides

---

## 🙏 Contributing

Contributions are welcome! Please see our [GitHub repository](https://github.com/10xhub/agentflow) for:

- Issue reporting and feature requests
- Pull request guidelines
- Development setup instructions
- Code style and testing requirements

---

## 💬 Support

- **Documentation**: You're reading it! See [Tutorials](Tutorial/) and [Concepts](Concept/)
- **Examples**: Check the [examples directory](https://github.com/10xhub/agentflow/tree/main/examples)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/10xhub/agentflow/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/10xhub/agentflow/discussions)

---

**Ready to build intelligent agents?** Start with the [Tutorials](Tutorial/index.md) or dive into a [Quick Example](#simple-example)!
