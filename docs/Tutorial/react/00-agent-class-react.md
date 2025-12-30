# React Agent with Agent Class

The **ReAct (Reasoning and Acting)** pattern is the foundation of intelligent agents. This tutorial shows you how to build ReAct agents using the Agent class—the simplest way to create powerful agents in Agentflow.

!!! tip "Why Agent Class?"
    The Agent class reduces a typical ReAct implementation from 50+ lines to under 30 lines, while maintaining full functionality.

---

## 🎯 Learning Objectives

By the end of this tutorial, you'll understand:

- How to build a ReAct agent with the Agent class
- Tool integration patterns with Agent class
- Routing logic for tool execution
- Streaming with Agent class
- When to use Agent class vs custom functions

---

## 🧠 Quick ReAct Refresher

The ReAct pattern follows this loop:

```
User Input → Reasoning → Action (Tool Call) → Observation → More Reasoning → Final Answer
```

The Agent class handles the "Reasoning" and "Action" parts automatically—you just define the tools and routing.

---

## 🚀 Complete Example: Weather Agent

Let's build a weather agent that can check weather in any location.

### Full Code

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END


# 1. Define your tool
def get_weather(location: str) -> str:
    """Get the current weather for a location.
    
    Args:
        location: The city or location to check weather for.
    
    Returns:
        A string describing the current weather.
    """
    # In production, call a real weather API
    weather_data = {
        "new york": "Sunny, 72°F, light breeze",
        "london": "Cloudy, 58°F, chance of rain",
        "tokyo": "Clear, 68°F, humid",
    }
    location_lower = location.lower()
    return weather_data.get(
        location_lower, 
        f"Weather in {location}: Partly cloudy, 65°F"
    )


# 2. Create the Agent
graph = StateGraph()

graph.add_node("MAIN", Agent(
    model="gemini/gemini-2.5-flash",  # or "gpt-4", "claude-3-5-sonnet-20241022"
    system_prompt=[{
        "role": "system",
        "content": """You are a helpful weather assistant. 
When users ask about weather, use the get_weather tool to provide accurate information.
Always be friendly and provide helpful context about the weather."""
    }],
    tool_node_name="TOOL"
))

graph.add_node("TOOL", ToolNode([get_weather]))


# 3. Define routing
def should_use_tools(state: AgentState) -> str:
    """Determine if we should use tools or end the conversation."""
    if not state.context:
        return "TOOL"
    
    last_message = state.context[-1]
    
    # If the assistant made tool calls, execute them
    if (hasattr(last_message, "tools_calls") 
        and last_message.tools_calls 
        and last_message.role == "assistant"):
        return "TOOL"
    
    # If we just got tool results, go back to MAIN
    if last_message.role == "tool":
        return "MAIN"
    
    # Otherwise, we're done
    return END


# 4. Wire up the graph
graph.add_conditional_edges("MAIN", should_use_tools, {
    "TOOL": "TOOL",
    "MAIN": "MAIN",
    END: END
})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# 5. Compile and run
app = graph.compile()

# Test it!
if __name__ == "__main__":
    result = app.invoke({
        "messages": [Message.text_message("What's the weather like in Tokyo?")]
    }, config={"thread_id": "weather-123"})
    
    for msg in result["messages"]:
        print(f"\n{msg.role.upper()}:")
        print(msg.content if hasattr(msg, 'content') else msg)
```

### What's Happening

1. **Tool Definition**: Simple function with a docstring (Agent class extracts the schema automatically)
2. **Agent Node**: One line creates a complete agent with LLM, system prompt, and tool awareness
3. **Tool Node**: Handles tool execution with automatic parameter injection
4. **Routing**: Determines the next step based on the last message
5. **Execution**: The graph handles all the complexity

---

## 🔧 Step-by-Step Breakdown

### Step 1: Define Tools

Tools are just Python functions with docstrings:

```python
def get_weather(location: str) -> str:
    """Get the current weather for a location.
    
    Args:
        location: The city or location to check weather for.
    
    Returns:
        A string describing the current weather.
    """
    return f"Weather in {location}: Sunny, 72°F"
```

!!! tip "Tool Best Practices"
    - Always include a descriptive docstring
    - Use type hints for parameters
    - Keep tools focused on one task
    - Return clear, actionable information

### Step 2: Create the Agent

The Agent class handles everything:

```python
Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful weather assistant."
    }],
    tool_node_name="TOOL"  # References the ToolNode
)
```

**Key Parameters:**

| Parameter | Purpose |
|-----------|---------|
| `model` | LiteLLM model identifier |
| `system_prompt` | System instructions for the agent |
| `tool_node_name` | Name of the ToolNode in the graph |
| `tools` | Alternative: pass tools directly |

### Step 3: Routing Logic

The routing function determines graph flow:

```python
def should_use_tools(state: AgentState) -> str:
    # Get the last message
    if not state.context:
        return "TOOL"
    
    last_message = state.context[-1]
    
    # Assistant made tool calls → execute them
    if last_message.tools_calls and last_message.role == "assistant":
        return "TOOL"
    
    # Tool results → go back to reasoning
    if last_message.role == "tool":
        return "MAIN"
    
    # Done
    return END
```

### Step 4: Wire the Graph

```python
# Conditional routing from MAIN
graph.add_conditional_edges("MAIN", should_use_tools, {
    "TOOL": "TOOL",
    "MAIN": "MAIN",
    END: END
})

# After tools, always return to MAIN
graph.add_edge("TOOL", "MAIN")

# Start at MAIN
graph.set_entry_point("MAIN")
```

---

## 🛠️ Multiple Tools Example

Add more tools to your agent:

```python
def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: Sunny, 72°F"


def get_forecast(location: str, days: int = 3) -> str:
    """Get weather forecast for upcoming days."""
    return f"{days}-day forecast for {location}: Sunny → Cloudy → Rain"


def convert_temperature(temp: float, from_unit: str, to_unit: str) -> str:
    """Convert temperature between Celsius and Fahrenheit."""
    if from_unit.lower() == "c" and to_unit.lower() == "f":
        converted = (temp * 9/5) + 32
        return f"{temp}°C = {converted}°F"
    elif from_unit.lower() == "f" and to_unit.lower() == "c":
        converted = (temp - 32) * 5/9
        return f"{temp}°F = {converted:.1f}°C"
    return "Invalid conversion"


# Create agent with multiple tools
graph.add_node("MAIN", Agent(
    model="gpt-4",
    system_prompt=[{
        "role": "system",
        "content": """You are a comprehensive weather assistant.
You can check current weather, get forecasts, and convert temperatures.
Use the appropriate tool based on what the user asks for."""
    }],
    tool_node_name="TOOL"
))

graph.add_node("TOOL", ToolNode([
    get_weather, 
    get_forecast, 
    convert_temperature
]))
```

---

## 🌊 Streaming Example

Enable streaming for real-time responses:

```python
import asyncio
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END


def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: Sunny, 72°F"


# Build graph (same as before)
graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "You are a weather assistant."}],
    tool_node_name="TOOL"
))
graph.add_node("TOOL", ToolNode([get_weather]))


def route(state: AgentState) -> str:
    if state.context and state.context[-1].tools_calls:
        return "TOOL"
    if state.context and state.context[-1].role == "tool":
        return "MAIN"
    return END


graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", "MAIN": "MAIN", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()


# Streaming execution
async def main():
    config = {"thread_id": "stream-1", "is_stream": True}
    
    async for event in app.astream(
        {"messages": [Message.text_message("What's the weather in Paris?")]},
        config=config
    ):
        if hasattr(event, 'content') and event.content:
            print(event.content, end="", flush=True)
    
    print()  # Final newline


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 🏷️ Tool Filtering with Tags

Control which tools are available using tags:

```python
from agentflow.utils import tool


@tool(tags={"weather", "read"})
def get_weather(location: str) -> str:
    """Get current weather."""
    return f"Weather in {location}: Sunny"


@tool(tags={"weather", "read"})
def get_forecast(location: str) -> str:
    """Get weather forecast."""
    return f"Forecast for {location}: Sunny tomorrow"


@tool(tags={"weather", "write", "dangerous"})
def report_weather_issue(location: str, issue: str) -> str:
    """Report a weather-related issue (admin only)."""
    return f"Issue reported for {location}: {issue}"


# Regular user agent - only read tools
user_agent = Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "Help users check weather."}],
    tools=[get_weather, get_forecast, report_weather_issue],
    tools_tags={"read"}  # Only get_weather and get_forecast
)

# Admin agent - all tools
admin_agent = Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "Full weather system access."}],
    tools=[get_weather, get_forecast, report_weather_issue]
    # No tags filter = all tools
)
```

---

## 🔄 Comparison: Agent Class vs Custom Functions

### Agent Class (This Tutorial)

```python
graph.add_node("MAIN", Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You are helpful."}],
    tool_node_name="TOOL"
))
```

**Lines: 5** | **Time to write: 2 minutes**

### Custom Functions (Traditional)

```python
async def main_agent(state: AgentState):
    prompts = "You are helpful."
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": prompts}],
        state=state,
    )
    
    if state.context and state.context[-1].role == "tool":
        response = await acompletion(model="gpt-4", messages=messages)
    else:
        tools = await tool_node.all_tools()
        response = await acompletion(model="gpt-4", messages=messages, tools=tools)
    
    return ModelResponseConverter(response, converter="litellm")


graph.add_node("MAIN", main_agent)
```

**Lines: 15** | **Time to write: 10 minutes**

### When to Use Each

| Use Agent Class When... | Use Custom Functions When... |
|-------------------------|------------------------------|
| Building standard ReAct agents | Need custom LLM client |
| Rapid prototyping | Complex message preprocessing |
| Production apps | Multiple LLM calls per node |
| Most tool-calling scenarios | Non-standard response handling |

---

## ⚠️ Common Pitfalls

### 1. Forgetting the Routing Loop

❌ **Wrong:**
```python
graph.add_edge("MAIN", END)  # Never goes to tools!
```

✅ **Correct:**
```python
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")  # Loop back!
```

### 2. Missing Tool Node Reference

❌ **Wrong:**
```python
Agent(model="gpt-4", system_prompt=[...])  # No tools!
```

✅ **Correct:**
```python
Agent(model="gpt-4", system_prompt=[...], tool_node_name="TOOL")
```

### 3. Infinite Loops

❌ **Wrong:**
```python
def route(state):
    return "MAIN"  # Always loops!
```

✅ **Correct:**
```python
def route(state):
    if state.context and not state.context[-1].tools_calls:
        return END  # Exit condition!
    return "TOOL"
```

---

## 🎓 Next Steps

Now that you've mastered ReAct with Agent class:

1. **[Tool Decorator](../tool-decorator.md)** - Organize tools with rich metadata
2. **[Streaming](04-streaming.md)** - Real-time response streaming
3. **[MCP Integration](03-mcp-integration.md)** - External tool protocols
4. **[Persistence](../long_term_memory.md)** - Save conversation state

---

## 📚 Key Takeaways

1. **Agent class simplifies ReAct** - 5 lines instead of 15+
2. **Tools are just functions** - Add docstrings for automatic schema
3. **Routing is essential** - Loop between agent and tools
4. **Streaming is built-in** - Just add `is_stream: True` to config
5. **Tags filter tools** - Control access per agent

Ready to explore more patterns? Check out the [Basic React Tutorial](01-basic-react.md) to understand the underlying mechanics!
