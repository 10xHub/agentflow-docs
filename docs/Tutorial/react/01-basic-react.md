# Basic React Patterns

The **ReAct (Reasoning and Acting)** pattern is the cornerstone of intelligent agent design. This tutorial covers the fundamental concepts and implementation patterns using  Agentflow's core components.

## 🎯 Learning Objectives

By the end of this tutorial, you'll understand:

- How the ReAct loop works: think → act → observe → repeat
- Building basic React agents with `StateGraph` and `ToolNode`
- Implementing conditional routing for tool execution
- Synchronous vs asynchronous patterns
- Debugging and optimizing React agents

## 🧠 Understanding the ReAct Pattern

### The Core Loop

React agents follow a simple but powerful pattern:

```
User Input → Reasoning → Action (Tool Call) → Observation (Tool Result) → More Reasoning → Final Answer
```

1. **Reasoning**: The LLM analyzes the problem and decides what to do
2. **Acting**: If needed, the agent calls tools to gather information or perform actions
3. **Observing**: The agent processes the tool results
4. **Iterating**: The cycle repeats until the task is complete

### Why React Works

Traditional LLMs have limitations:
- ❌ **Knowledge cutoff**: Can't access recent information
- ❌ **No actions**: Can't interact with external systems
- ❌ **Static responses**: Can't adapt based on new information

React agents solve these problems:
- ✅ **Real-time data**: Tools provide fresh information
- ✅ **External actions**: Can call APIs, databases, services
- ✅ **Dynamic adaptation**: Adjusts approach based on results

## 🏗️ Basic Architecture Components

A React agent requires these  Agentflow components:

### 1. Tools (Action Layer)

```python
from agentflow.graph import ToolNode


def get_weather(location: str) -> str:
    """Get weather for a location."""
    # In production: call weather API
    return f"The weather in {location} is sunny, 75°F"


def search_web(query: str) -> str:
    """Search the web for information."""
    # In production: call search API
    return f"Search results for: {query}"


tool_node = ToolNode([get_weather, search_web])
```

### 2. Main Agent (Reasoning Layer)

```python
from litellm import acompletion
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter


async def main_agent(state: AgentState) -> ModelResponseConverter:
    """The reasoning component that decides when to use tools."""

    system_prompt = "You are a helpful assistant. Use tools when needed."
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state
    )

    # Check if we just got tool results
    if state.context and state.context[-1].role == "tool":
        # Final response without tools
        response = await acompletion(model="gpt-4", messages=messages)
    else:
        # Regular response with tools available
        tools = await tool_node.all_tools()
        response = await acompletion(model="gpt-4", messages=messages, tools=tools)

    return ModelResponseConverter(response, converter="litellm")
```

### 3. Conditional Routing (Control Layer)

```python
from agentflow.utils.constants import END


def should_use_tools(state: AgentState) -> str:
    """Decide whether to use tools, continue reasoning, or end."""

    if not state.context:
        return "TOOL"  # No context, might need tools

    last_message = state.context[-1]

    # If assistant made tool calls, execute them
    if (hasattr(last_message, "tools_calls") and
            last_message.tools_calls and
            last_message.role == "assistant"):
        return "TOOL"

    # If we got tool results, return to reasoning
    if last_message.role == "tool":
        return "MAIN"

    # Otherwise, we're done
    return END
```

### 4. Graph Assembly

```python
from agentflow.graph import StateGraph

graph = StateGraph()
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)

# Conditional routing from main agent
graph.add_conditional_edges("MAIN", should_use_tools, {
    "TOOL": "TOOL",
    END: END
})

# Tools always return to main agent
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

## 🌤️ Complete Example: Weather Agent

Let's build a complete weather agent that demonstrates all the concepts:

### Step 1: Define the Tool

```python
from dotenv import load_dotenv
from agentflow.graph import ToolNode
from agentflow.state.agent_state import AgentState

load_dotenv()


def get_weather(
        location: str,
        tool_call_id: str | None = None,  # Auto-injected by InjectQ
        state: AgentState | None = None,  # Auto-injected by InjectQ
) -> str:
    """
    Get the current weather for a specific location.

    Args:
        location: The city or location to get weather for
        tool_call_id: Unique identifier for this tool call (injected)
        state: Current agent state (injected)

    Returns:
        Weather information as a string
    """
    # Access injected parameters
    if tool_call_id:
        print(f"Weather lookup [ID: {tool_call_id}] for {location}")

    if state and state.context:
        print(f"Context has {len(state.context)} messages")

    # In production, call a real weather API
    # For demo, return mock data
    return f"The weather in {location} is sunny with a temperature of 72°F (22°C)"


# Register the tool
tool_node = ToolNode([get_weather])
```

### Step 2: Create the Main Agent

```python
from litellm import acompletion
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.utils.converter import convert_messages


async def main_agent(state: AgentState) -> ModelResponseConverter:
    """
    Main reasoning agent that handles conversation and tool decisions.
    """

    system_prompt = """
    You are a helpful weather assistant. You can provide current weather
    information for any location using the get_weather tool.

    When users ask about weather:
    1. Use the get_weather function with the location they specify
    2. Provide helpful, detailed responses based on the results
    3. Be conversational and friendly

    If no location is specified, ask the user to provide one.
    """

    # Convert agent state to LiteLLM message format
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state,
    )

    # Determine if we need to call tools or give final response
    if state.context and state.context[-1].role == "tool":
        # We just received tool results, give final response without tools
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            temperature=0.7
        )
    else:
        # Regular interaction, make tools available
        tools = await tool_node.all_tools()
        response = await acompletion(
            model="gemini/gemini-2.5-flash",
            messages=messages,
            tools=tools,
            temperature=0.7
        )

    return ModelResponseConverter(response, converter="litellm")
```

### Step 3: Implement Smart Routing

```python
from agentflow.utils.constants import END


def should_use_tools(state: AgentState) -> str:
    """
    Intelligent routing that determines the next step in the conversation.

    Returns:
        - "TOOL": Execute pending tool calls
        - "MAIN": Continue with main agent reasoning
        - END: Finish the conversation
    """

    if not state.context:
        return "TOOL"  # Fresh conversation, might need tools

    # Prevent infinite loops by counting recent tool calls
    recent_tools = sum(1 for msg in state.context[-5:] if msg.role == "tool")
    if recent_tools >= 3:
        print("Warning: Too many recent tool calls, ending conversation")
        return END

    last_message = state.context[-1]

    # If the assistant just made tool calls, execute them
    if (hasattr(last_message, "tools_calls") and
            last_message.tools_calls and
            len(last_message.tools_calls) > 0 and
            last_message.role == "assistant"):
        return "TOOL"

    # If we just received tool results, go back to main agent
    if last_message.role == "tool":
        return "MAIN"

    # Default: conversation is complete
    return END
```

### Step 4: Build the Graph

```python
from agentflow.graph import StateGraph
from agentflow.checkpointer import InMemoryCheckpointer

# Create the state graph
graph = StateGraph()

# Add nodes
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)

# Add conditional routing from main agent
graph.add_conditional_edges("MAIN", should_use_tools, {
    "TOOL": "TOOL",  # Execute tools
    END: END  # End conversation
})

# Tools always return to main agent for processing
graph.add_edge("TOOL", "MAIN")

# Set the entry point
graph.set_entry_point("MAIN")

# Compile the graph with memory
app = graph.compile(
    checkpointer=InMemoryCheckpointer()  # Remembers conversation
)
```

### Step 5: Run the Agent

```python
from agentflow.utils import Message


async def run_weather_agent():
    """Demonstrate the weather agent in action."""

    # Test queries
    queries = [
        "What's the weather like in New York?",
        "How about San Francisco?",
        "Tell me about the weather in Tokyo"
    ]

    for i, query in enumerate(queries):
        print(f"\n{'=' * 50}")
        print(f"Query {i + 1}: {query}")
        print('=' * 50)

        # Create input
        inp = {"messages": [Message.text_message(query)]}
        config = {"thread_id": f"weather-{i}", "recursion_limit": 10}

        # Run the agent
        try:
            result = await app.ainvoke(inp, config=config)

            # Display results
            for message in result["messages"]:
                role_emoji = {"user": "👤", "assistant": "🤖", "tool": "🔧"}
                emoji = role_emoji.get(message.role, "❓")
                print(f"{emoji} {message.role.upper()}: {message.content}")

        except Exception as e:
            print(f"Error: {e}")


# Run it
if __name__ == "__main__":
    import asyncio

    asyncio.run(run_weather_agent())
```

## 🔄 Synchronous vs Asynchronous Patterns

 Agentflow supports both synchronous and asynchronous React patterns:

### Asynchronous (Recommended)

**Pros**: Better performance, handles multiple requests, non-blocking I/O
**Cons**: Slightly more complex code

```python
# Async main agent
async def main_agent(state: AgentState) -> ModelResponseConverter:
    tools = await tool_node.all_tools()  # async
    response = await acompletion(...)     # async
    return ModelResponseConverter(response, converter="litellm")

# Async invocation
result = await app.ainvoke(inp, config=config)
```

### Synchronous (Simpler)

**Pros**: Simpler code, easier debugging
**Cons**: Blocking operations, lower throughput

```python
from litellm import completion

# Sync main agent
def main_agent(state: AgentState) -> ModelResponseConverter:
    tools = tool_node.all_tools_sync()    # sync
    response = completion(...)             # sync
    return ModelResponseConverter(response, converter="litellm")

# Sync invocation
result = app.invoke(inp, config=config)
```

**Best Practice**: Use async for production applications, sync for simple scripts or learning.

## 🛠️ Tool Design Best Practices

### 1. Clear Function Signatures

```python
def well_designed_tool(
    location: str,                       # Required parameter
    unit: str = "fahrenheit",           # Optional with default
    include_forecast: bool = False,      # Boolean options
    tool_call_id: str | None = None,    # Auto-injected
    state: AgentState | None = None     # Auto-injected
) -> str:
    """
    Get weather information for a location.

    Args:
        location: City name or coordinates ("New York" or "40.7,-74.0")
        unit: Temperature unit ("fahrenheit" or "celsius")
        include_forecast: Whether to include 3-day forecast
        tool_call_id: Unique call identifier (auto-injected)
        state: Current agent state (auto-injected)

    Returns:
        Formatted weather information
    """
    # Implementation here
```

### 2. Error Handling

```python
def robust_weather_tool(location: str) -> str:
    """Weather tool with proper error handling."""

    try:
        if not location or location.strip() == "":
            return "Error: Please provide a valid location name"

        # Validate location format
        if len(location) > 100:
            return "Error: Location name too long"

        # Call weather API (with timeout)
        weather_data = call_weather_api(location, timeout=5)

        if not weather_data:
            return f"Sorry, I couldn't find weather data for '{location}'"

        return format_weather_response(weather_data)

    except requests.Timeout:
        return "Error: Weather service is currently slow. Please try again."
    except requests.RequestException:
        return "Error: Unable to connect to weather service"
    except Exception as e:
        return f"Unexpected error: {str(e)}"
```

### 3. Dependency Injection Usage

```python
def advanced_weather_tool(
    location: str,
    tool_call_id: str | None = None,
    state: AgentState | None = None
) -> str:
    """Tool that leverages dependency injection."""

    # Use tool_call_id for logging/tracing
    if tool_call_id:
        logger.info(f"Weather request [{tool_call_id}]: {location}")

    # Access conversation context via state
    if state and state.context:
        # Check user preferences from conversation history
        user_prefs = extract_user_preferences(state.context)
        preferred_unit = user_prefs.get("temperature_unit", "fahrenheit")
    else:
        preferred_unit = "fahrenheit"

    # Get weather with user's preferred unit
    weather_data = get_weather_data(location, unit=preferred_unit)
    return format_weather_response(weather_data, preferred_unit)
```

## 🎛️ Advanced Routing Patterns

### Loop Prevention

```python
def safe_routing(state: AgentState) -> str:
    """Routing with loop prevention and error recovery."""

    if not state.context:
        return "MAIN"

    # Count recent tool calls to prevent infinite loops
    recent_tools = sum(1 for msg in state.context[-10:]
                      if msg.role == "tool")

    if recent_tools >= 5:
        logger.warning("Too many tool calls, forcing completion")
        return END

    last_message = state.context[-1]

    # Check for tool errors
    if (last_message.role == "tool" and
        "error" in last_message.content.lower()):
        logger.warning("Tool error detected, ending conversation")
        return END

    # Normal routing logic
    if has_pending_tool_calls(last_message):
        return "TOOL"
    elif last_message.role == "tool":
        return "MAIN"
    else:
        return END
```

### Multi-Modal Routing

```python
def intelligent_routing(state: AgentState) -> str:
    """Advanced routing that handles different tool types."""

    if not state.context:
        return "MAIN"

    last_message = state.context[-1]

    # Route based on tool types in the pending calls
    if has_weather_tools(last_message):
        return "WEATHER_TOOLS"
    elif has_search_tools(last_message):
        return "SEARCH_TOOLS"
    elif has_file_tools(last_message):
        return "FILE_TOOLS"
    elif last_message.role == "tool":
        return "MAIN"
    else:
        return END

# Multi-node graph for specialized tool handling
graph.add_node("WEATHER_TOOLS", weather_tool_node)
graph.add_node("SEARCH_TOOLS", search_tool_node)
graph.add_node("FILE_TOOLS", file_tool_node)
```

## 🐛 Debugging React Agents

### Enable Detailed Logging

```python
from agentflow.publisher import ConsolePublisher
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Add console publisher for real-time debugging
app = graph.compile(
    checkpointer=InMemoryCheckpointer(),
    publisher=ConsolePublisher()  # Shows execution flow
)
```

### State Inspection

```python
def debug_main_agent(state: AgentState) -> ModelResponseConverter:
    """Main agent with debug information."""

    print(f"🧠 Main Agent Debug:")
    print(f"   Context size: {len(state.context or [])}")

    if state.context:
        print(f"   Last message: {state.context[-1].role}")
        print(f"   Last content preview: {state.context[-1].content[:100]}...")

    # Your normal agent logic
    return normal_main_agent(state)

def debug_routing(state: AgentState) -> str:
    """Routing with debug output."""

    decision = normal_routing(state)
    print(f"🔀 Routing Decision: {decision}")

    if state.context:
        last_msg = state.context[-1]
        print(f"   Based on: {last_msg.role} message")
        if hasattr(last_msg, "tools_calls") and last_msg.tools_calls:
            print(f"   Tool calls: {len(last_msg.tools_calls)}")

    return decision
```

### Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Infinite Loops** | Same tool called repeatedly | Add loop detection in routing |
| **Missing Tools** | "Tool not found" errors | Verify tool registration in ToolNode |
| **Context Loss** | Agent forgets previous messages | Check checkpointer configuration |
| **Tool Errors** | Tools return error messages | Add error handling in tool functions |
| **Slow Responses** | Long response times | Use async patterns, add timeouts |
| **Memory Issues** | Agent runs out of context | Implement context compression |

### Testing Patterns

```python
import pytest
from agentflow.utils import Message


@pytest.mark.asyncio
async def test_weather_agent_basic():
    """Test basic weather agent functionality."""

    # Test input
    inp = {"messages": [Message.text_message("Weather in Paris?")]}
    config = {"thread_id": "test-1", "recursion_limit": 5}

    # Run agent
    result = await app.ainvoke(inp, config=config)

    # Assertions
    assert len(result["messages"]) >= 2  # User + assistant response

    # Check for tool usage
    tool_messages = [m for m in result["messages"] if m.role == "tool"]
    assert len(tool_messages) > 0, "Expected tool to be called"

    # Check final response
    assistant_messages = [m for m in result["messages"] if m.role == "assistant"]
    final_response = assistant_messages[-1]
    assert "paris" in final_response.content.lower()
```

## ⚡ Performance Optimization

### Caching Responses

```python
from functools import lru_cache
import asyncio

@lru_cache(maxsize=100)
def cached_weather_lookup(location: str) -> str:
    """Cache weather responses to avoid repeated API calls."""
    return expensive_weather_api_call(location)

# For async caching, use a simple dict with TTL
weather_cache = {}
CACHE_TTL = 300  # 5 minutes

async def cached_async_weather(location: str) -> str:
    """Async weather lookup with TTL cache."""

    now = time.time()

    # Check cache
    if location in weather_cache:
        data, timestamp = weather_cache[location]
        if now - timestamp < CACHE_TTL:
            return data

    # Fetch fresh data
    data = await async_weather_api_call(location)
    weather_cache[location] = (data, now)

    return data
```

### Concurrent Tool Execution

```python
import asyncio

async def parallel_tool_node(state: AgentState) -> list[Message]:
    """Execute multiple tools concurrently."""

    # Extract tool calls from last assistant message
    tool_calls = extract_tool_calls(state.context[-1])

    # Execute tools in parallel
    tasks = [execute_tool_call(call) for call in tool_calls]
    results = await asyncio.gather(*tasks)

    # Convert results to messages
    return [Message.tool_message(result, call_id)
            for result, call_id in zip(results, [c.id for c in tool_calls])]
```

## 🎯 Example Variations

### Multi-Tool Weather Agent

```python
def get_weather(location: str) -> str:
    return f"Weather in {location}: Sunny, 75°F"

def get_forecast(location: str, days: int = 3) -> str:
    return f"{days}-day forecast for {location}: Mostly sunny"

def get_air_quality(location: str) -> str:
    return f"Air quality in {location}: Good (AQI: 45)"

# Multi-tool setup
tool_node = ToolNode([get_weather, get_forecast, get_air_quality])
```

### Error Recovery Agent

```python
async def resilient_agent(state: AgentState) -> ModelResponseConverter:
    """Agent with built-in error recovery."""

    try:
        return await normal_agent_logic(state)

    except Exception as e:
        logger.error(f"Agent error: {e}")

        # Return graceful error response
        error_message = Message.text_message(
            "I apologize, but I'm experiencing technical difficulties. "
            "Please try rephrasing your request or try again later."
        )
        return [error_message]
```

## 🚀 Next Steps

Congratulations! You now understand the fundamentals of React agents. Here's what to explore next:

1. **[Dependency Injection](02-dependency-injection.md)** - Advanced parameter injection and service management
2. **[MCP Integration](03-mcp-integration.md)** - Connect to external tool systems via protocol
3. **[Streaming Responses](04-streaming.md)** - Real-time agent responses and event handling

### Advanced Topics to Explore

- **Multi-Agent Orchestration** - Coordinating multiple React agents
- **Memory Integration** - Long-term conversation memory with stores
- **Custom Tool Protocols** - Building domain-specific tool systems
- **Production Deployment** - Scaling React agents in production

## 📁 Reference Files

Study these example files to see the patterns in action:

- `examples/react/react_sync.py` - Basic synchronous React agent
- `examples/react/react_weather_agent.py` - Asynchronous weather agent with caching

The React pattern is your gateway to building intelligent, capable agents. Master these fundamentals, and you'll be ready to tackle complex multi-step problems with confidence!
