# How to Create a Python Function Tool

**Problem:** You want your agent to perform a specific action by calling a Python function.

**Time:** 10 minutes

**Prerequisites:**
- Understanding of [basic agents](../agents/create-simple-agent.md)
- Python functions knowledge

---

## Quick Solution

```python
from agentflow.graph import StateGraph, END, Agent, ToolNode
from agentflow.state import AgentState, Message


# 1. Define your tool (just a Python function!)
def get_weather(location: str) -> str:
    """Get weather for a location."""
    # Your logic here
    return f"The weather in {location} is sunny, 72°F"


# 2. Create ToolNode
tool_node = ToolNode([get_weather])

# 3. Create agent connected to tools
agent = Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt="You are a helpful assistant. Use tools when needed.",
    tool_node_name="TOOLS"  # Connect to tools
)

# 4. Build workflow with routing
workflow = StateGraph(state_schema=AgentState)
workflow.add_node("AGENT", agent)
workflow.add_node("TOOLS", tool_node)


def route(state: AgentState) -> str:
    if state.context and state.context[-1].tools_calls:
        return "TOOLS"
    return END


workflow.set_entry_point("AGENT")
workflow.add_conditional_edges("AGENT", route, {"TOOLS": "TOOLS", END: END})
workflow.add_edge("TOOLS", "AGENT")

# 5. Run
app = workflow.compile()
result = app.invoke({
    "messages": [Message.text_message("What's the weather in NYC?", "user")]
})
print(result["messages"][-1].content)
```

---

## Step-by-Step

### 1. Define Your Tool Function

**Requirements for tools:**
- Must have a clear docstring (LLM uses this!)
- Must have type hints on parameters
- Should return a string (or dict/list)

```python
def get_weather(location: str) -> str:
    """
    Get current weather for a location.

    Args:
        location: City name (e.g., "London", "Tokyo")

    Returns:
        Weather information as a string
    """
    # Your implementation
    return f"Weather in {location}: Sunny, 75°F"
```

**🔑 Key Point:** The docstring tells the LLM what the tool does!

### 2. Create ToolNode

```python
from agentflow.graph import ToolNode

tool_node = ToolNode([get_weather])  # List of functions
```

**Multiple tools:**
```python
tool_node = ToolNode([get_weather, calculate, search_web])
```

### 3. Connect Agent to Tools

```python
agent = Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt="You are helpful. Use tools when needed.",
    tool_node_name="TOOLS"  # <-- This is the connection
)
```

### 4. Build Workflow with Tool Routing

```python
workflow = StateGraph(state_schema=AgentState)
workflow.add_node("AGENT", agent)
workflow.add_node("TOOLS", tool_node)


# Routing function - decides if we need tools
def should_use_tools(state: AgentState) -> str:
    """Route to tools or end"""
    if not state.context:
        return END

    last_msg = state.context[-1]

    # If agent called tools, go to TOOLS node
    if hasattr(last_msg, "tools_calls") and last_msg.tools_calls:
        return "TOOLS"

    return END


# Set up routing
workflow.set_entry_point("AGENT")
workflow.add_conditional_edges(
    "AGENT",
    should_use_tools,
    {"TOOLS": "TOOLS", END: END}
)
workflow.add_edge("TOOLS", "AGENT")  # After tools, back to agent

app = workflow.compile()
```

---

## Complete Example with Real API

```python
import os
import requests
from agentflow.graph import StateGraph, END, Agent, ToolNode
from agentflow.state import AgentState, Message


def get_real_weather(city: str) -> str:
    """
    Get real weather data for a city.

    Args:
        city: Name of the city

    Returns:
        Current weather information
    """
    try:
        # Using wttr.in free API
        url = f"https://wttr.in/{city}?format=3"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            return response.text.strip()
        return f"Could not fetch weather for {city}"

    except Exception as e:
        return f"Error: {str(e)}"


def calculate(expression: str) -> str:
    """
    Perform a mathematical calculation.

    Args:
        expression: Math expression like "2 + 2"

    Returns:
        The result
    """
    try:
        result = eval(expression)
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


# Create tool node with both tools
tool_node = ToolNode([get_real_weather, calculate])

# Create agent
agent = Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt="""You are a helpful assistant with tools.

You can:
- Get real weather data
- Perform calculations

Always use tools when appropriate!""",
    tool_node_name="TOOLS"
)

# Build workflow
workflow = StateGraph(state_schema=AgentState)
workflow.add_node("AGENT", agent)
workflow.add_node("TOOLS", tool_node)


def route(state: AgentState) -> str:
    if not state.context:
        return END
    last = state.context[-1]
    if hasattr(last, "tools_calls") and last.tools_calls:
        return "TOOLS"
    return END


workflow.set_entry_point("AGENT")
workflow.add_conditional_edges("AGENT", route, {"TOOLS": "TOOLS", END: END})
workflow.add_edge("TOOLS", "AGENT")

app = workflow.compile()

# Test it
questions = [
    "What's the weather in Tokyo?",
    "Calculate 156 * 23",
    "What's the weather in Paris and calculate 100 / 4"
]

for q in questions:
    print(f"\n🙋 Question: {q}")
    result = app.invoke({"messages": [Message.text_message(q, "user")]})
    print(f"🤖 Answer: {result['messages'][-1].content}")
```

---

## Tool Best Practices

### ✅ Do This

```python
def good_tool(city: str, date: str = "today") -> str:
    """
    Get weather for a specific date.  # Clear description

    Args:
        city: City name  # Explain each parameter
        date: Date (default: today)  # Include defaults

    Returns:
        Weather data  # What it returns
    """
    # Always handle errors
    try:
        # Your logic
        return result
    except Exception as e:
        return f"Error: {str(e)}"
```

### ❌ Avoid This

```python
def bad_tool(c):  # No type hints
    # No docstring
    return api_call(c)  # No error handling
```

---

## Verification

Test that your tool is called correctly:

```python
# Send a message that should trigger the tool
result = app.invoke({
    "messages": [Message.text_message("What's the weather in London?", "user")]
})

# Check messages
for msg in result["messages"]:
    if msg.role == "tool":
        print(f"✅ Tool called successfully: {msg.content}")
```

---

## Common Issues

### "Tool not being called"

**Possible causes:**
1. Docstring is unclear or missing
2. `tool_node_name` doesn't match node name
3. Routing function has bugs

**Solution:**
```python
# Make docstring very clear
def my_tool(param: str) -> str:
    """Get weather. Use this when user asks about weather."""
    ...

# Verify names match
agent = Agent(..., tool_node_name="TOOLS")
workflow.add_node("TOOLS", tool_node)  # Same name!
```

### "Tool error"

Add comprehensive error handling:
```python
def safe_tool(param: str) -> str:
    """Tool description"""
    try:
        # Your logic
        result = do_something(param)
        return str(result)
    except Exception as e:
        return f"Tool error: {str(e)}"
```

---

## Advanced: Dependency Injection

Tools can receive injected parameters:

```python
def advanced_tool(
    query: str,  # User parameter
    tool_call_id: str | None = None,  # Injected automatically
    state: AgentState | None = None  # Injected automatically
) -> str:
    """
    Advanced tool with dependency injection.

    Args:
        query: The user's search query
    """
    # Access full state
    print(f"Current conversation: {len(state.messages)} messages")

    # Your logic
    return f"Result for {query}"
```

---

## Related Guides

- [Add Multiple Tools](add-multiple-tools.md)
- [Use External APIs](use-external-apis.md)
- [Handle Tool Errors](handle-tool-errors.md)
- [Parallel Tool Execution](parallel-execution.md)

---

## Next Steps

**Next:** [Add Multiple Tools](add-multiple-tools.md) →

**Also see:**
- [Tutorial: Adding Tools](../../tutorials/beginner/02-adding-tools.md) for a full walkthrough
- [Tool Decorator API](../../Agentflow/graph/tool-decorator-api.md) for advanced usage

---

**Now your agents can take real actions!** 🔧🚀
