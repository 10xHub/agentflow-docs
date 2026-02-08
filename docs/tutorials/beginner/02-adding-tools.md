# Tutorial 2: Adding Tools to Your Agent (20 minutes)

**What you'll build:** An agent that can actually DO things - like fetch real weather data and perform calculations.

**What you'll learn:**
- What tools are and why they're powerful
- How to create Python function tools
- How to connect tools to your agent
- How to handle tool calling and responses

**Prerequisites:**
- Completed [Tutorial 1: Your First Agent](01-your-first-agent.md)
- Basic Python functions knowledge

---

## The Problem

Remember our weather agent from Tutorial 1? It could talk about weather, but it couldn't actually *fetch* real weather data. It was just making educated guesses.

**Tools** solve this problem by giving your agent the ability to perform real actions.

---

## What Are Tools?

**Simple explanation:** Tools are Python functions that your agent can call.

Think of it like this:
- **Without tools:** Agent can only talk
- **With tools:** Agent can talk AND take actions

### Examples of Tools

- `get_weather(location)` - Fetch real weather data from an API
- `search_web(query)` - Search the internet
- `send_email(to, subject, body)` - Send an email
- `query_database(sql)` - Get data from a database
- `calculate(expression)` - Perform calculations

---

## Step 1: Create Simple Tools

Let's start with a simple calculator tool:

Create `agent_with_tools.py`:

```python
import os
from dotenv import load_dotenv
from agentflow.graph import StateGraph, END, ToolNode
from agentflow.state import AgentState, Message
from agentflow.graph.agent_class import Agent

load_dotenv()


# Define a tool - it's just a Python function!
def calculate(expression: str) -> str:
    """
    Perform a mathematical calculation.

    Args:
        expression: A mathematical expression like "2 + 2" or "10 * 5"

    Returns:
        The result of the calculation
    """
    try:
        result = eval(expression)
        return f"The answer is: {result}"
    except Exception as e:
        return f"Error calculating: {str(e)}"


# Let's add another tool
def get_current_time() -> str:
    """
    Get the current date and time.

    Returns:
        The current date and time as a string
    """
    from datetime import datetime
    now = datetime.now()
    return now.strftime("%Y-%m-%d %H:%M:%S")
```

**🔑 Key Point:** Notice the docstrings! The LLM uses them to understand what each tool does.

---

## Step 2: Create the ToolNode

A `ToolNode` is a special node that holds all your tools:

```python
# Create a ToolNode with our tools
tool_node = ToolNode([calculate, get_current_time])
```

---

## Step 3: Create an Agent That Can Use Tools

```python
# System prompt tells the agent about its abilities
system_prompt = """You are a helpful assistant with access to tools.

You have these abilities:
1. Perform calculations (use the calculate tool)
2. Tell the current time (use the get_current_time tool)

When a user asks for something you can do with a tool, USE THE TOOL!
Don't guess or make up answers.
"""

# Create the agent and connect it to the tools
agent = Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt=system_prompt,
    tool_node_name="TOOLS"  # <-- This connects the agent to tools
)
```

---

## Step 4: Build the Workflow with Routing

This is where it gets interesting. We need to:
1. Run the agent
2. Check if it wants to use a tool
3. If yes → run the tool → go back to agent
4. If no → we're done

```python
# Create workflow
workflow = StateGraph(state_schema=AgentState)

# Add nodes
workflow.add_node("AGENT", agent)
workflow.add_node("TOOLS", tool_node)


# Routing function - decides what to do next
def should_use_tools(state: AgentState) -> str:
    """
    Check if the agent wants to use tools or if we're done.
    """
    if not state.context or len(state.context) == 0:
        return END

    last_message = state.context[-1]

    # If the agent called tools, run them
    if hasattr(last_message, "tools_calls") and last_message.tools_calls:
        return "TOOLS"

    # Otherwise, we're done
    return END


# Set up the routing
workflow.set_entry_point("AGENT")
workflow.add_conditional_edges(
    "AGENT",
    should_use_tools,
    {
        "TOOLS": "TOOLS",  # Go to tools
        END: END  # Or end
    }
)
workflow.add_edge("TOOLS", "AGENT")  # After tools, go back to agent

# Compile
app = workflow.compile()

print("✅ Agent with tools ready!")
```

---

## Step 5: Test Your Agent

```python
def ask_agent(question: str):
    """Ask the agent a question"""
    print(f"\n🙋 You: {question}")

    result = app.invoke({
        "messages": [Message.text_message(question, "user")]
    })

    # Print the conversation
    for msg in result["messages"]:
        if msg.role == "user":
            print(f"  🙋 User: {msg.content}")
        elif msg.role == "assistant":
            if msg.content:
                print(f"  🤖 Agent: {msg.content}")
        elif msg.role == "tool":
            print(f"  🔧 Tool result: {msg.content}")


if __name__ == "__main__":
    # Test calculations
    ask_agent("What is 156 times 789?")

    # Test time
    ask_agent("What time is it right now?")

    # Test compound question
    ask_agent("What time is it, and what is 50 divided by 2?")
```

---

## Step 6: Run It!

```bash
python agent_with_tools.py
```

### Expected Output

```
✅ Agent with tools ready!

🙋 You: What is 156 times 789?
  🙋 User: What is 156 times 789?
  🔧 Tool result: The answer is: 123084
  🤖 Agent: 156 times 789 equals 123,084.

🙋 You: What time is it right now?
  🙋 User: What time is it right now?
  🔧 Tool result: 2026-02-08 14:30:45
  🤖 Agent: It's currently 2:30 PM and 45 seconds on February 8th, 2026.

🙋 You: What time is it, and what is 50 divided by 2?
  🙋 User: What time is it, and what is 50 divided by 2?
  🔧 Tool result: 2026-02-08 14:30:47
  🔧 Tool result: The answer is: 25.0
  🤖 Agent: It's 2:30 PM (2026-02-08 14:30:47), and 50 divided by 2 equals 25.
```

**🎉 Your agent is now taking real actions!**

---

## What Just Happened?

Let's break down the flow:

```
User asks "What is 156 times 789?"
    ↓
Agent receives the question
    ↓
Agent thinks: "I should use the calculate tool"
    ↓
Agent calls: calculate("156 * 789")
    ↓
Tool runs and returns: "The answer is: 123084"
    ↓
Agent receives tool result
    ↓
Agent responds: "156 times 789 equals 123,084"
```

### The Magic of Routing

The `should_use_tools` function is key:

```python
def should_use_tools(state: AgentState) -> str:
    # Check if agent wants to call tools
    if last_message.tools_calls:
        return "TOOLS"  # Go run the tools
    return END  # We're done
```

---

## Now Let's Build Something Real

Let's create a **real weather tool** using a free API:

### Step 7: Add Real Weather Tool

```python
import requests


def get_real_weather(city: str) -> str:
    """
    Get real weather data for a city.

    Args:
        city: Name of the city (e.g., "London", "New York")

    Returns:
        Current weather information
    """
    try:
        # Using wttr.in - a free weather API
        url = f"https://wttr.in/{city}?format=3"
        response = requests.get(url, timeout=5)

        if response.status_code == 200:
            return response.text.strip()
        else:
            return f"Couldn't fetch weather for {city}"
    except Exception as e:
        return f"Error getting weather: {str(e)}"


# Update system prompt
system_prompt = """You are a helpful weather assistant.

You have access to:
1. get_real_weather - Get current weather for any city
2. calculate - Perform calculations
3. get_current_time - Get current date/time

Always use tools when available instead of guessing!
"""

# Create tool node with all tools
tool_node = ToolNode([get_real_weather, calculate, get_current_time])

# Rest of the code stays the same...
```

### Test the Weather Tool

```python
ask_agent("What's the weather like in London right now?")
ask_agent("Compare the weather in Tokyo and Paris")
```

**Output:**
```
🙋 You: What's the weather like in London right now?
  🔧 Tool result: London: ☁️  +8°C
  🤖 Agent: The weather in London is currently cloudy with a temperature of 8°C.
```

---

## Tool Best Practices

### 1. **Write Clear Docstrings**
The LLM uses docstrings to understand your tool:

```python
def good_tool(city: str) -> str:
    """
    Get weather for a city.  # <-- Clear description

    Args:
        city: Name of the city  # <-- Parameter explanation

    Returns:
        Weather information  # <-- What it returns
    """
    pass
```

### 2. **Handle Errors**
Always wrap in try-except:

```python
def safe_tool(param: str) -> str:
    try:
        # Your logic
        return result
    except Exception as e:
        return f"Error: {str(e)}"
```

### 3. **Return Strings**
Tools should return strings for best compatibility:

```python
# Good
def calculate(expr: str) -> str:
    result = eval(expr)
    return str(result)  # Convert to string

# Also fine
def get_data() -> dict:
    return {"key": "value"}  # Dict is okay too
```

---

## Complete Code

```python
import os
import requests
from dotenv import load_dotenv
from agentflow.graph import StateGraph, END, ToolNode
from agentflow.state import AgentState, Message
from agentflow.graph.agent_class import Agent

load_dotenv()


# Define tools
def calculate(expression: str) -> str:
    """Perform a mathematical calculation."""
    try:
        result = eval(expression)
        return f"The answer is: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


def get_current_time() -> str:
    """Get the current date and time."""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_real_weather(city: str) -> str:
    """Get real weather data for a city."""
    try:
        url = f"https://wttr.in/{city}?format=3"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return response.text.strip()
        return f"Couldn't fetch weather for {city}"
    except Exception as e:
        return f"Error: {str(e)}"


# System prompt
system_prompt = """You are a helpful assistant with tools.

Available tools:
1. get_real_weather - Get current weather for any city
2. calculate - Perform math calculations
3. get_current_time - Get current date/time

Always use tools when available!
"""

# Create tool node and agent
tool_node = ToolNode([get_real_weather, calculate, get_current_time])
agent = Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt=system_prompt,
    tool_node_name="TOOLS"
)

# Build workflow
workflow = StateGraph(state_schema=AgentState)
workflow.add_node("AGENT", agent)
workflow.add_node("TOOLS", tool_node)


def should_use_tools(state: AgentState) -> str:
    if not state.context or len(state.context) == 0:
        return END
    last_message = state.context[-1]
    if hasattr(last_message, "tools_calls") and last_message.tools_calls:
        return "TOOLS"
    return END


workflow.set_entry_point("AGENT")
workflow.add_conditional_edges("AGENT", should_use_tools, {"TOOLS": "TOOLS", END: END})
workflow.add_edge("TOOLS", "AGENT")

app = workflow.compile()


def ask_agent(question: str):
    print(f"\n🙋 You: {question}")
    result = app.invoke({"messages": [Message.text_message(question, "user")]})
    print(f"🤖 Agent: {result['messages'][-1].content}")


if __name__ == "__main__":
    ask_agent("What's the weather in Tokyo?")
    ask_agent("What is 23 * 67?")
    ask_agent("What time is it?")
```

---

## Challenges

### Challenge 1: Add More Tools
Create these tools:
- `flip_coin()` - Returns "Heads" or "Tails"
- `roll_dice(sides: int)` - Rolls a dice with N sides
- `convert_temperature(temp: float, from_unit: str, to_unit: str)` - Convert temperatures

### Challenge 2: Web Search Tool
Use the free DuckDuckGo search:
```python
from duckduckgo_search import DDGS

def search_web(query: str) -> str:
    """Search the web and return results."""
    results = DDGS().text(query, max_results=3)
    return str(results)
```

### Challenge 3: Multi-Step Tasks
Ask your agent: "What's the weather in Paris, and calculate how many hours until midnight?"

Watch how it uses multiple tools!

---

## Common Issues

### "Tool not being called"
1. Check your docstring - make it clear what the tool does
2. Make sure `tool_node_name` matches in Agent and workflow
3. Verify routing function logic

### "Error in tool execution"
Add better error handling:
```python
def my_tool(param: str) -> str:
    try:
        # Logic here
        pass
    except Exception as e:
        return f"Tool error: {str(e)}"
```

---

## Next Steps

Congratulations! Your agents can now take real actions!

**Next tutorial:** [Chat with Memory](03-chat-with-memory.md) →

Learn how to make your agent remember conversations across multiple messages.

---

## What You've Accomplished ✅

- ✅ Created Python function tools
- ✅ Connected tools to your agent
- ✅ Implemented tool routing logic
- ✅ Built an agent that can fetch real data
- ✅ Handled tool errors gracefully

**Your agents are getting superpowers!** 🚀
