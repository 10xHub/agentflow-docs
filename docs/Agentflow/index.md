# Agentflow (Python library)

![PyPI](https://img.shields.io/pypi/v/10xscale-agentflow?color=blue)
![License](https://img.shields.io/github/license/10xhub/agentflow)
![Python](https://img.shields.io/pypi/pyversions/10xscale-agentflow)
[![Coverage](https://img.shields.io/badge/coverage-75%25-yellow.svg)](#)

Agentflow is a lightweight yet powerful Python framework designed for building intelligent agents and orchestrating sophisticated multi-agent workflows. Unlike frameworks that lock you into a specific LLM provider, Agentflow is provider-agnostic: bring your favorite LLM SDK—whether it's LiteLLM, OpenAI, Google Gemini, Anthropic Claude, or any other provider—and Agentflow handles everything else. The framework manages orchestration, state persistence, tool integration, control flow, and streaming, letting you focus on building agent logic rather than plumbing.

---

## ✨ What you get

Agentflow delivers a comprehensive set of features that cover the entire agent lifecycle, from development to production deployment:

### Core orchestration capabilities

- **LLM-agnostic architecture** — Works seamlessly with any language model provider through a flexible adapter pattern. Use LiteLLM for unified access to 100+ models, or integrate directly with native SDKs. Your agent logic remains portable across providers.

- **StateGraph-based orchestration** — Define your agent workflows as directed graphs with nodes (processing units) and edges (transitions). Support for conditional routing, dynamic branching, and cyclical flows enables sophisticated agent behaviors.

- **Structured responses** — Parse and validate LLM outputs with built-in support for thinking steps, tool calls, and token usage tracking. Leverage Pydantic models for type-safe state management.

### Tool integration and execution

- **Multi-framework tool support** — Integrate tools from Model Context Protocol (MCP) servers, Composio, LangChain, or native Python functions. Each ecosystem is treated as a first-class citizen with dedicated adapters.

- **Parallel execution** — Automatically execute independent tool calls in parallel to reduce latency. The framework handles orchestration, error handling, and result aggregation.

- **Dependency injection** — Clean separation of concerns through DI patterns. Tools and nodes receive state, configuration, and dependencies automatically, making code testable and maintainable.

### State management and persistence

- **Flexible checkpointing** — Choose between InMemory checkpointer for development or production-grade PostgreSQL+Redis checkpointer for high-performance persistence. Redis handles hot path writes while PostgreSQL provides durable storage.

- **Conversation threading** — Maintain multiple independent conversation threads with automatic state isolation. Each thread can be paused, resumed, or branched without affecting others.

- **Incremental state updates** — Only modified state is persisted, reducing storage overhead and improving performance. You control what gets saved and when.

### Real-time interaction and monitoring

- **Streaming responses** — Stream delta updates to clients for real-time user experiences. Support for partial messages, thinking steps, and progressive tool results.

- **Human-in-the-loop workflows** — Pause execution at any point for human review or approval. Resume with modifications, rollback to previous states, or branch into alternative paths.

- **Production observability** — Built-in publishers route events to Console (development), Redis, Kafka, or RabbitMQ (production). Comprehensive metrics track token usage, latency, errors, and custom events.

### Developer experience

- **Type safety** — Full type hints throughout the codebase with mypy validation. Pydantic models ensure runtime type checking for state and configurations.

- **Async-first design** — Native async/await support for efficient I/O operations. Sync wrappers provided for compatibility with synchronous codebases.

- **Extensive documentation** — Comprehensive guides, API references, and runnable examples help you get started quickly and troubleshoot effectively.

---

## 🚀 Quick start

### Installation

Install Agentflow using uv (recommended for faster dependency resolution):

```bash
uv pip install 10xscale-agentflow
```

Or use traditional pip:

```bash
pip install 10xscale-agentflow
```

### Optional extras

Agentflow supports optional dependencies for specific functionality. Install only what you need to keep your environment lean:

```bash
# Production-grade checkpointing with PostgreSQL and Redis
pip install 10xscale-agentflow[pg_checkpoint]

# Tool integration frameworks
pip install 10xscale-agentflow[mcp]        # Model Context Protocol servers
pip install 10xscale-agentflow[composio]   # Composio tool ecosystem
pip install 10xscale-agentflow[langchain]  # LangChain tools and chains

# Event publishers for production observability
pip install 10xscale-agentflow[redis]      # Redis Streams publisher
pip install 10xscale-agentflow[kafka]      # Apache Kafka publisher
pip install 10xscale-agentflow[rabbitmq]   # RabbitMQ publisher
```

### Configure your LLM provider

Set the API key for your chosen LLM provider. Here's an example using OpenAI:

```bash
export OPENAI_API_KEY=sk-your-key-here
```

For other providers like Anthropic, Google, or Azure, consult their respective documentation for authentication methods.

---

## 🧪 Minimal example: React agent with tool calling

This example demonstrates a React (Reason + Act) agent that can use tools to answer questions. The agent decides when to use tools based on the user's query and iterates until it has enough information to provide a complete answer.

```python
from litellm import acompletion
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state.agent_state import AgentState
from agentflow.utils import Message
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages


# Define a tool: a simple function that returns weather information
def get_weather(location: str, tool_call_id: str | None = None, state: AgentState | None = None) -> Message:
    """Get current weather for a location."""
    # In production, this would call a real weather API
    return Message.tool_message(
        content=f"Weather in {location}: sunny, 72°F",
        tool_call_id=tool_call_id
    )


# Create a ToolNode that manages tool execution
tool_node = ToolNode([get_weather])


# Define the main agent node: this is where LLM reasoning happens
async def main_agent(state: AgentState):
    """Main agent that reasons about the task and decides when to use tools."""
    # System prompt defines agent behavior
    sys = "You are a helpful assistant. Use the available tools when needed to provide accurate information."
    
    # Convert state to messages format expected by LLM
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": sys}],
        state=state
    )

    # Determine if we should offer tools to the LLM
    # If the last message wasn't a tool response, include tools in the request
    needs_tools = bool(state.context) and getattr(state.context[-1], "role", "") != "tool"
    
    if needs_tools:
        # Get tool schemas and include them in the LLM call
        tools = await tool_node.all_tools()
        return await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            tools=tools
        )
    
    # Final response without tools (when we have all needed information)
    return await acompletion(
        model="gemini/gemini-2.5-flash",
        messages=messages
    )


# Define routing logic: decides the next step based on agent output
def route(state: AgentState) -> str:
    """Route to tool execution if agent made tool calls, otherwise end."""
    last = (state.context or [])[-1] if state.context else None
    has_calls = hasattr(last, "tools_calls") and last.tools_calls
    return "TOOL" if (not state.context or has_calls) else END


# Build the graph: define nodes and edges
graph = StateGraph()
graph.add_node("MAIN", main_agent)      # Agent reasoning node
graph.add_node("TOOL", tool_node)        # Tool execution node

# Conditional edge: route from MAIN to TOOL or END based on agent output
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})

# After tools execute, return to MAIN for the agent to process results
graph.add_edge("TOOL", "MAIN")

# Set the entry point for execution
graph.set_entry_point("MAIN")

# Compile the graph with checkpointing for state persistence
app = graph.compile(checkpointer=InMemoryCheckpointer())

# Execute the agent with a user query
res = app.invoke(
    {"messages": [Message.from_text("What's the weather in Tokyo?")]},
    config={"thread_id": "demo"}
)

# Print the conversation history
for m in res["messages"]:
    print(m)
```

### Understanding the flow

1. **User query enters the system** — The graph starts at the MAIN node with the user's message.
2. **Agent reasoning** — The LLM receives the query and available tools, decides to call `get_weather("Tokyo")`.
3. **Tool execution** — The graph routes to TOOL node, which executes the weather function.
4. **Agent synthesis** — Results return to MAIN, where the LLM formulates a final answer using the weather data.
5. **Completion** — The graph routes to END, returning the complete conversation to the caller.

This pattern—reason, act, observe, synthesize—forms the foundation of React agents and can be extended to more complex multi-step workflows.

---

## 📚 Learn the concepts

Agentflow is built on a few core concepts that work together to enable sophisticated agent behaviors:

### Graph architecture

The heart of Agentflow is the StateGraph, which defines how data flows through your agent system. Learn about nodes (processing units), edges (transitions), conditional routing, and execution strategies:

- [Graph fundamentals](./graph/index.md) — Core concepts and patterns
- [Advanced graph patterns](./graph/advanced.md) — Cycles, branching, and complex flows
- [Execution model](./graph/execution.md) — How graphs process state updates

### State and context management

Understanding how Agentflow manages state is crucial for building reliable agents. Explore message handling, state schemas, checkpointing strategies, and persistence:

- [State architecture](./context/index.md) — State schemas and updates
- [Message context](./context/message.md) — Conversation threading
- [Checkpointers](./context/checkpointer.md) — Persistence strategies
- [Store abstractions](./context/store.md) — Custom storage backends

### Tools and integrations

Tools enable agents to interact with external systems. Learn how to integrate Python functions, MCP servers, Composio actions, and LangChain tools:

- [Tool system overview](./graph/tools.md) — Tool definition and execution
- [Dependency injection](./dependency-injection.md) — Clean tool architecture
- [Tool converters](./response_converter.md) — Adapting external tools

### Control flow and orchestration

Master advanced patterns like human-in-the-loop, interrupt handling, conditional branching, and error recovery:

- [Control flow patterns](./graph/control_flow.md) — Routing and conditions
- [Human-in-the-loop](./graph/human-in-the-loop.md) — Pause and resume
- [Error handling](./ERROR_HANDLING_GUIDELINES.md) — Graceful degradation

### Production deployment

Prepare your agents for production with monitoring, graceful shutdown, callbacks, and event publishing:

- [Callbacks and observability](./Callbacks.md) — Event tracking
- [Publishers](./publisher.md) — Event routing to external systems
- [Graceful shutdown](./graceful-shutdown.md) — Clean termination
- [Async patterns](./async-patterns.md) — Concurrency best practices

### Hands-on tutorials

Step-by-step guides walk you through building real-world agent systems:

- [React agent tutorial](../Tutorial/react/01-basic-react.md) — Build a reasoning agent from scratch
- [RAG implementation](../Tutorial/rag.md) — Retrieval-augmented generation
- [Long-term memory](../Tutorial/long_term_memory.md) — Cross-conversation learning
- [Input validation](../Tutorial/input_validation.md) — Secure agent inputs
- [Plan-Act-Reflect](../Tutorial/plan_act_reflect.md) — Advanced reasoning patterns

---

## 🌐 Ecosystem

Agentflow is part of a complete stack for building, deploying, and consuming multi-agent systems:

### Agentflow CLI

A command-line tool for scaffolding projects, running local development servers, and deploying to production:

- **Project initialization** — Generate boilerplate for new agent projects with best practices
- **Local development** — Run agents locally with hot reload and debugging
- **Deployment automation** — Generate Docker containers and Kubernetes manifests
- **Configuration management** — Environment-specific settings and secrets handling

[Learn more about the CLI →](../cli/index.md)

### AgentFlow TypeScript Client

A fully typed client library for consuming AgentFlow APIs from web and Node.js applications:

- **Typed API methods** — IntelliSense and compile-time safety for all endpoints
- **Streaming support** — Real-time updates with SSE and WebSocket fallbacks
- **Thread management** — Create, list, update, and delete conversation threads
- **Memory operations** — Search and manage agent memory across conversations
- **Error handling** — Comprehensive error types with recovery strategies

[Learn more about the TypeScript client →](../client/index.md)

---

## 🔗 Useful links

- **GitHub repository**: https://github.com/10xhub/agentflow — Source code, issues, and contributions
- **PyPI package**: https://pypi.org/project/10xscale-agentflow/ — Release notes and version history
- **Runnable examples**: https://github.com/10xhub/agentflow/tree/main/examples — Copy-paste examples for common patterns

Ready to build your first agent? Start with the [Graph fundamentals](./graph/index.md) or dive into the [React agent tutorial](../Tutorial/react/01-basic-react.md).
