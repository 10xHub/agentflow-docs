# React Agent Patterns (Agentflow)

This directory provides comprehensive tutorials for building **ReAct (Reasoning and Acting)** agents in Agentflow, from the simple Agent class approach to advanced custom function integrations.

## 🎯 Choose Your Path

| Approach | Best For | Lines of Code | Tutorial |
|----------|----------|---------------|----------|
| **⭐ Agent Class** | Most use cases, rapid development | 10-30 lines | [00-agent-class-react.md](00-agent-class-react.md) |
| **Custom Functions** | Complex custom logic, fine-grained control | 50-150 lines | [01-basic-react.md](01-basic-react.md) |

!!! tip "Start Here"
    **New to ReAct?** Start with the [Agent Class tutorial](00-agent-class-react.md)—it's the fastest way to build powerful agents.

## 🎯 What Are React Agents?

React agents combine **reasoning** (LLM thinking) with **acting** (tool usage) to solve complex problems by iteratively:
1. **Analyzing** the current situation
2. **Choosing** appropriate tools to gather information
3. **Observing** the results
4. **Adapting** their approach based on what they learned

This pattern enables agents to access real-time data, perform actions, and handle multi-step workflows dynamically.

## 📚 Tutorial Progression

### ⭐ Quick Path (Recommended)
Start here for the fastest route to building agents:

1. **[Agent Class React](00-agent-class-react.md)** ⭐ - Build ReAct agents in 30 lines or less

### 🔧 Advanced Path
For when you need full control:

1. **[Basic React Patterns](01-basic-react.md)** - Core ReAct architecture with custom functions
2. **[Dependency Injection](02-dependency-injection.md)** - Advanced parameter injection and container management
3. **[MCP Integration](03-mcp-integration.md)** - Model Context Protocol for external tool systems
4. **[Streaming Responses](04-streaming.md)** - Real-time agent responses and event handling

## 🗂️ Files Overview

| Tutorial | Focus | Approach | Key Concepts |
|----------|-------|----------|--------------|
| [Agent Class React](00-agent-class-react.md) ⭐ | Simple ReAct | Agent Class | Agent, ToolNode, tool_node_name |
| [Basic React](01-basic-react.md) | Core patterns | Custom Functions | StateGraph, convert_messages, acompletion |
| [Dependency Injection](02-dependency-injection.md) | Advanced DI | Custom Functions | InjectQ container, service injection |
| [MCP Integration](03-mcp-integration.md) | External tools | Both | FastMCP client, protocol integration |
| [Streaming](04-streaming.md) | Real-time | Both | Event streaming, delta updates |

## 🚀 Quick Start

### Prerequisites

```bash
# Install Agentflow with LiteLLM (required for Agent class)
pip install 10xscale-agentflow[litellm]

# For MCP examples
pip install 10xscale-agentflow[mcp]

# Set up environment
export OPENAI_API_KEY=your_key
# or
export GEMINI_API_KEY=your_key
```

### Run Your First React Agent

```bash
# Agent Class approach (recommended)
cd examples/agent-class
python graph.py

# Custom function approach
cd examples/react
python react_sync.py
```

## 🎯 When to Use Each Approach

| Approach | Use Case | Benefits | Complexity |
|----------|----------|----------|------------|
| **Agent Class** ⭐ | Most ReAct agents | Minimal code, automatic handling | ⭐ |
| **Custom Functions** | Complex logic, custom LLM clients | Full control | ⭐⭐⭐ |
| **Dependency Injection** | Enterprise apps | Testable, modular | ⭐⭐⭐ |
| **MCP Integration** | External APIs | Protocol standardization | ⭐⭐⭐ |
| **Streaming** | Real-time UIs | Low latency, responsive UX | ⭐⭐ |

## 🏗️ Core React Architecture

### Agent Class Approach (Recommended)

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState
from agentflow.utils.constants import END


# 1. Define tools
def get_weather(location: str) -> str:
    return f"Weather in {location}: sunny, 72°F"


# 2. Build the graph with Agent class
graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You are helpful."}],
    tool_node_name="TOOL"
))
graph.add_node("TOOL", ToolNode([get_weather]))


# 3. Routing
def route(state: AgentState) -> str:
    if state.context and state.context[-1].tools_calls:
        return "TOOL"
    return END


graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# 4. Run
app = graph.compile()
```

### Custom Function Approach

```python
from agentflow.graph import StateGraph, ToolNode
from agentflow.utils.constants import END


# 1. Define tools
def my_tool(param: str) -> str:
    return f"Result for {param}"


tool_node = ToolNode([my_tool])


# 2. Create reasoning agent (manual message handling)
async def main_agent(state: AgentState):
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": "..."}],
        state=state,
    )
    
    if state.context and state.context[-1].role == "tool":
        response = await acompletion(model="gpt-4", messages=messages)
    else:
        tools = await tool_node.all_tools()
        response = await acompletion(model="gpt-4", messages=messages, tools=tools)
    
    return ModelResponseConverter(response, converter="litellm")


# 3. Implement conditional routing
def should_use_tools(state: AgentState) -> str:
    if state.context and state.context[-1].tools_calls:
        return "TOOL"
    return END


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
