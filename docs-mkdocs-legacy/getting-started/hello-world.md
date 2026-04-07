# Hello World - Your First Agent

Build a working AI agent in 5 minutes using **real examples from the AgentFlow codebase**.

---

## Two Ways to Build Agents

AgentFlow offers two approaches:

| Approach | Best For | Lines of Code |
|----------|----------|---------------|
| **Agent Class** ⭐ | Most use cases, rapid development | 15-20 lines |
| **Custom Functions** | Advanced control, custom LLM handling | 40-60 lines |

**Start with the Agent class!** It's simpler and handles 90% of use cases.

---

## Method 1: Agent Class (Quickest)

Real example from [`examples/agent-class/graph.py`](https://github.com/10xscale/agentflow/blob/main/examples/agent-class/graph.py):

### Complete Working Code

Create `my_first_agent.py`:

```python
from dotenv import load_dotenv
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END

load_dotenv()  # Load API keys from .env file


# Step 1: Define a tool (just a Python function!)
def get_weather(location: str) -> str:
    """Get the current weather for a specific location."""
    return f"The weather in {location} is sunny, 72°F"


# Step 2: Create tool node
tool_node = ToolNode([get_weather])


# Step 3: Build the workflow
graph = StateGraph()

# Add agent node using Agent class
graph.add_node(
    "MAIN",
    Agent(
        model="google/gemini-2.5-flash",  # Works with google-genai library
        system_prompt=[{
            "role": "system",
            "content": "You are a helpful assistant. Help user queries effectively."
        }],
        tool_node_name="TOOL",  # Connect to tools
    ),
)
graph.add_node("TOOL", tool_node)


# Step 4: Define routing logic
def should_use_tools(state: AgentState) -> str:
    """Determine if we should use tools or end."""
    if not state.context or len(state.context) == 0:
        return END

    last_message = state.context[-1]

    # If agent wants to call tools, route to TOOL
    if (
        hasattr(last_message, "tools_calls")
        and last_message.tools_calls
        and last_message.role == "assistant"
    ):
        return "TOOL"

    # After tool execution, go back to MAIN
    if last_message.role == "tool":
        return "MAIN"

    return END


# Step 5: Set up the flow
graph.add_conditional_edges(
    "MAIN",
    should_use_tools,
    {"TOOL": "TOOL", END: END},
)
graph.add_edge("TOOL", "MAIN")  # After tools, return to agent
graph.set_entry_point("MAIN")

# Step 6: Compile
app = graph.compile()


# Step 7: Run it!
if __name__ == "__main__":
    inp = {"messages": [Message.text_message("What's the weather in New York?")]}
    config = {"thread_id": "12345", "recursion_limit": 10}

    res = app.invoke(inp, config=config)

    # Print all messages in the conversation
    for msg in res["messages"]:
        print("=" * 50)
        print(f"Role: {msg.role}")
        if msg.content:
            print(f"Content: {msg.content}")
        print("=" * 50)
```

### Run It

```bash
python my_first_agent.py
```

### Expected Output

```
==================================================
Role: user
Content: What's the weather in New York?
==================================================
==================================================
Role: assistant
Content: [Calling get_weather tool...]
==================================================
==================================================
Role: tool
Content: The weather in New York is sunny, 72°F
==================================================
==================================================
Role: assistant
Content: The weather in New York is currently sunny with a temperature of 72°F! ☀️
==================================================
```

**🎉 You just built an agent that can use tools!**

---

## What Just Happened?

### The Flow

```
1. User asks: "What's the weather in New York?"
   ↓
2. Agent (MAIN) receives question
   ↓
3. Agent decides to call get_weather tool
   ↓
4. Router sends to TOOL node
   ↓
5. Tool executes: get_weather("New York")
   ↓
6. Router sends back to MAIN
   ↓
7. Agent sees tool result and generates final response
   ↓
8. Router sees no more tools needed → END
   ↓
9. Return final conversation
```

### Key Components

```python
# 1. Agent - The LLM wrapper
Agent(
    model="google/gemini-2.5-flash",  # Which LLM to use
    system_prompt=[...],  # Agent's personality/instructions
    tool_node_name="TOOL"  # Connect to tools
)

# 2. ToolNode - Holds your Python functions
ToolNode([get_weather, calculate, search])

# 3. StateGraph - The workflow orchestrator
graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

# 4. Routing - Decides what happens next
def should_use_tools(state):
    if agent_called_tools: return "TOOL"
    if just_ran_tools: return "MAIN"
    return END

# 5. Compile & Run
app = graph.compile()
result = app.invoke({"messages": [...]}, config={...})
```

---

## Method 2: Custom Functions (Advanced Control)

For maximum control over LLM calls, write your own async node function. This lets you use any LLM library directly and apply custom logic before/after each call.

```python
from dotenv import load_dotenv
from google import genai
from google.genai import types
from agentflow.adapters.llm import GoogleGenAIConverter
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages_to_google

import os

load_dotenv()


def get_weather(location: str, tool_call_id: str | None = None) -> str:
    """Get the current weather for a specific location."""
    return f"The weather in {location} is sunny"


tool_node = ToolNode([get_weather])
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))


# Custom agent function — you control the entire LLM call
async def main_agent(state: AgentState):
    """Main agent node with manual Google GenAI handling."""
    system_prompt = "You are a helpful assistant. Answer questions using available tools."

    # Convert AgentFlow state to Google GenAI format
    contents = convert_messages_to_google(state)

    # Decide whether to include tools this turn
    if state.context and state.context[-1].role == "tool":
        # Final response after tool execution — no tools needed
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=system_prompt),
        )
    else:
        # Regular turn — make tools available
        tools = await tool_node.all_tools(format="google_genai")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=tools,
            ),
        )

    # Convert Google GenAI response to AgentFlow message format
    converter = GoogleGenAIConverter()
    return await converter.convert_response(response)


def should_use_tools(state: AgentState) -> str:
    """Routing logic."""
    if not state.context or len(state.context) == 0:
        return END

    last_message = state.context[-1]

    if (
        hasattr(last_message, "tools_calls")
        and last_message.tools_calls
        and last_message.role == "assistant"
    ):
        return "TOOL"

    if last_message.role == "tool":
        return "MAIN"

    return END


# Build workflow
graph = StateGraph()
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())

# Run it
inp = {"messages": [Message.text_message("What's the weather in Tokyo?")]}
config = {"thread_id": "12345", "recursion_limit": 10}

res = app.invoke(inp, config=config)

for msg in res["messages"]:
    print(f"{msg.role}: {msg.content}")
```

**Why use this approach?**

- Full control over every LLM call — temperature, max tokens, safety settings, etc.
- Use Google GenAI, OpenAI, or Anthropic SDKs directly
- Custom message pre/post-processing
- Useful when you need provider-specific features not exposed by the Agent class

---

## Experiment & Learn

### Try Different Models

```python
# Google Gemini (fast & free tier)
Agent(model="google/gemini-2.5-flash", ...)

# OpenAI GPT-4 (very capable)
Agent(model="openai/gpt-4o", ...)

# Anthropic Claude (excellent reasoning)
Agent(model="anthropic/claude-3-5-sonnet-20241022", ...)
```

For **local models (Ollama)** and **OpenAI-compatible endpoints** (DeepSeek, Qwen, OpenRouter, vLLM), you must pass `provider="openai"` and `base_url` explicitly — the model prefix trick doesn't apply here:

```python
# Local model via Ollama
Agent(
    model="llama3:8b",          # exact model tag from `ollama list`
    provider="openai",          # Ollama exposes an OpenAI-compatible API
    base_url="http://localhost:11434/v1",
    system_prompt="You are a helpful assistant.",
)

# DeepSeek (Chinese model, OpenAI-compatible API)
Agent(
    model="deepseek-chat",
    provider="openai",
    base_url="https://api.deepseek.com/v1",
    api_key="your-deepseek-key",   # passed as a kwarg
    system_prompt="You are a helpful assistant.",
)

# Qwen via OpenRouter (or Alibaba Cloud)
Agent(
    model="qwen/qwen-2.5-72b-instruct",
    provider="openai",
    base_url="https://openrouter.ai/api/v1",
    api_key="your-openrouter-key",
    system_prompt="You are a helpful assistant.",
)
```

> `provider="openai"` tells AgentFlow to use the OpenAI SDK (`AsyncOpenAI`). Any endpoint that speaks the OpenAI Chat Completions format works — Ollama, vLLM, LM Studio, OpenRouter, DeepSeek, Qwen, etc.

### Add More Tools

```python
def calculate(expression: str) -> str:
    """Perform a math calculation."""
    return str(eval(expression))

def get_current_time() -> str:
    """Get the current time."""
    from datetime import datetime
    return datetime.now().strftime("%H:%M:%S")

# Add all tools to ToolNode
tool_node = ToolNode([get_weather, calculate, get_current_time])
```

### Customize Personality

```python
Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{
        "role": "system",
        "content": """You are an expert Python developer.

        Guidelines:
        - Give concise, working code examples
        - Explain your reasoning briefly
        - Use proper Python conventions
        - Suggest best practices"""
    }]
)
```

---

## Common Issues

### "No module named 'google.genai'"

```bash
pip install google-genai
```

### "No API key provided"

Create a `.env` file:
```
GOOGLE_API_KEY=your-key-here
```

Then use `load_dotenv()` in your code.

### "Tool not being called"

1. **Check docstring** - Must be clear and descriptive
2. **Verify tool_node_name** - Must match the node name
3. **Check routing** - Ensure function returns "TOOL" when needed

---

## Next Steps

**You now have a working agent! What's next?**

1. **Understand the concepts** → [Core Concepts](core-concepts.md)
2. **Build more complex agents** → [Beginner Tutorials](../Tutorial/beginner/index.md)
3. **Task-specific guides** → [How-To Guides](../how-to/index.md)
4. **Deep dive tutorials** → [All Tutorials](../Tutorial/index.md)

---

## What You Learned

✅ Built an agent using the Agent class
✅ Added Python function tools
✅ Created a workflow with routing logic
✅ Ran a complete conversation with tool calling
✅ Saw both simple and advanced approaches
✅ Explored real examples from the codebase

**You're ready to build real AI agents!** 🚀

---

**Next:** [Learn the Core Concepts →](core-concepts.md)
