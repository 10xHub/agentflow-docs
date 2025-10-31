# React Agent Patterns ( Agentflow)

This directory provides comprehensive tutorials for building **ReAct (Reasoning and Acting)** agents in  Agentflow, from basic patterns to advanced integrations. These tutorials demonstrate the most common and powerful agent architecture: the think → act → observe → repeat loop.

## 🎯 What Are React Agents?

React agents combine **reasoning** (LLM thinking) with **acting** (tool usage) to solve complex problems by iteratively:
1. **Analyzing** the current situation
2. **Choosing** appropriate tools to gather information
3. **Observing** the results
4. **Adapting** their approach based on what they learned

This pattern enables agents to access real-time data, perform actions, and handle multi-step workflows dynamically.

## 📚 Tutorial Progression

Follow these tutorials in order for the best learning experience:

### 🏗️ Foundation
1. **[Basic React Patterns](01-basic-react.md)** - Core ReAct architecture with weather agents
2. **[Dependency Injection](02-dependency-injection.md)** - Advanced parameter injection and container management
3. **[MCP Integration](03-mcp-integration.md)** - Model Context Protocol for external tool systems
4. **[Streaming Responses](04-streaming.md)** - Real-time agent responses and event handling

## 🗂️ Files Overview

| Tutorial | Focus | Example Files | Key Concepts |
|----------|-------|---------------|--------------|
| [Basic React](01-basic-react.md) | Core patterns, sync/async | `react_sync.py`, `react_weather_agent.py` | StateGraph, ToolNode, conditional routing |
| [Dependency Injection](02-dependency-injection.md) | Advanced DI patterns | `react_di.py`, `react_di2.py` | InjectQ container, service injection |
| [MCP Integration](03-mcp-integration.md) | External tool systems | `react-mcp.py`, `server.py` | FastMCP client, protocol integration |
| [Streaming](04-streaming.md) | Real-time responses | `stream_react_agent.py`, `stream1.py` | Event streaming, delta updates |

## 🚀 Quick Start

### Prerequisites

```bash
# Install  Agentflow with dependencies
pip install -agentflow[litellm]

# For MCP examples
pip install -agentflow[mcp]

# Set up environment
export OPENAI_API_KEY=your_key
# or
export GEMINI_API_KEY=your_key
```

### Run Your First React Agent

```bash
# Basic synchronous React agent
cd examples/react
python react_sync.py

# Streaming React agent
cd examples/react_stream
python stream1.py
```

## 🎯 When to Use Each Pattern

| Pattern | Use Case | Benefits | Complexity |
|---------|----------|----------|------------|
| **Basic React** | Simple tool calling, weather/search agents | Easy to understand, quick setup | ⭐ |
| **Dependency Injection** | Enterprise apps, complex services | Testable, modular, scalable | ⭐⭐⭐ |
| **MCP Integration** | External APIs, microservices | Protocol standardization, flexibility | ⭐⭐⭐ |
| **Streaming** | Real-time UIs, chat interfaces | Low latency, responsive UX | ⭐⭐ |

## 🏗️ Core React Architecture

All React agents in  Agentflow follow this pattern:

```python
from agentflow.graph import StateGraph, ToolNode
from agentflow.utils.constants import END


# 1. Define tools
def my_tool(param: str) -> str:
    return f"Result for {param}"


tool_node = ToolNode([my_tool])


# 2. Create reasoning agent
async def main_agent(state: AgentState):
    # LLM reasoning with optional tool calls
    return llm_response_with_tools


# 3. Implement conditional routing
def should_use_tools(state: AgentState) -> str:
    # Logic to decide: tools, main agent, or end
    return "TOOL" | "MAIN" | END


# 4. Build the graph
graph = StateGraph()
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", should_use_tools, {
    "TOOL": "TOOL", END: END
})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# 5. Compile and run
app = graph.compile()
result = app.invoke({"messages": [Message.text_message("Hello")]})
```

## 🔧 Common Patterns

### Weather Agent Pattern
```python
# Simple tool calling for information gathering
def get_weather(location: str) -> str:
    return f"Weather in {location}: sunny, 72°F"

# Use in: Basic information lookup, API integration
```

### Multi-Tool Routing
```python
def smart_routing(state: AgentState) -> str:
    last_msg = state.context[-1]
    if needs_weather_tool(last_msg):
        return "WEATHER_TOOLS"
    elif needs_search_tool(last_msg):
        return "SEARCH_TOOLS"
    return END

# Use in: Complex workflows, specialized tool groups
```

### Streaming with Tools
```python
async def streaming_agent(state: AgentState, config: dict):
    is_stream = config.get("is_stream", False)
    response = await acompletion(
        model="gpt-4",
        messages=messages,
        tools=tools,
        stream=is_stream
    )
    return ModelResponseConverter(response, converter="litellm")

# Use in: Real-time UIs, progressive responses
```

## 🐛 Debugging Tips

### Enable Detailed Logging

```python
from agentflow.publisher import ConsolePublisher

app = graph.compile(
    checkpointer=InMemoryCheckpointer(),
    publisher=ConsolePublisher()  # Shows execution flow
)
```

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Infinite loops | Agent keeps calling same tool | Add loop detection in routing function |
| Missing tools | "Tool not found" errors | Verify ToolNode registration |
| Context loss | Agent forgets conversation | Check checkpointer configuration |
| Streaming errors | Incomplete responses | Disable streaming for tool calls |

### Debug State Flow
```python
def debug_routing(state: AgentState) -> str:
    print(f"Context size: {len(state.context or [])}")
    if state.context:
        print(f"Last message: {state.context[-1].role}")
    return normal_routing_logic(state)
```

## 💡 Best Practices

### 1. Tool Design
- **Clear interfaces**: Use type hints and docstrings
- **Error handling**: Return meaningful error messages
- **Dependency injection**: Leverage auto-injected parameters

### 2. Routing Logic
- **Loop prevention**: Count recent tool calls
- **Clear conditions**: Make routing decisions explicit
- **Error recovery**: Handle edge cases gracefully

### 3. Performance
- **Use async**: For I/O bound operations
- **Cache responses**: For expensive API calls
- **Limit recursion**: Set reasonable recursion limits

### 4. Testing
- **Unit test tools**: Test individual functions
- **Integration tests**: Test complete workflows
- **Mock dependencies**: Use dependency injection for testing

## 🔗 Related Concepts

- **[State Management](../state.md)** - Understanding AgentState and message flow
- **[Tool Creation](../adapter.md)** - Building custom tools and integrations
- **[Checkpointers](../checkpointer.md)** - Conversation persistence
- **[Publishers](../publisher.md)** - Event streaming and monitoring

## 🎓 Learning Path

1. **Start here**: [Basic React Patterns](01-basic-react.md) - Core concepts
2. **Advanced features**: [Dependency Injection](02-dependency-injection.md) - Enterprise patterns
3. **External integration**: [MCP Integration](03-mcp-integration.md) - Protocol-based tools
4. **Real-time UX**: [Streaming Responses](04-streaming.md) - Progressive responses

## 📖 Example Files Reference

All examples are runnable and demonstrate real-world patterns:

```
examples/
├── react/                     # Basic patterns
│   ├── react_sync.py         # Synchronous React agent
│   ├── react_weather_agent.py # Async weather agent
├── react-injection/           # Dependency injection
│   ├── react_di.py           # Basic DI with InjectQ
│   └── react_di2.py          # Advanced DI patterns
├── react-mcp/                # MCP integration
│   ├── react-mcp.py          # MCP client integration
│   ├── server.py             # MCP server example
│   └── client.py             # Standalone MCP client
└── react_stream/             # Streaming patterns
    ├── stream_react_agent.py # Full streaming agent
    ├── stream1.py            # Basic streaming
    └── stream_sync.py        # Sync streaming variant
```

---

**Ready to build intelligent agents?** Start with **[Basic React Patterns](01-basic-react.md)** to learn the fundamentals, then progress through each tutorial to master advanced React agent development in  Agentflow!
