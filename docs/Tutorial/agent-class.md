# Agent Class - The Simple Way to Build Agents

The **Agent class** is Agentflow's high-level abstraction for building intelligent agents with minimal boilerplate. It handles message conversion, LLM calls, tool integration, and streaming automatically—letting you focus on what matters: your agent's behavior.

!!! tip "When to Use Agent Class"
    **Use Agent class** for 90% of your agent needs. It's simple, powerful, and production-ready.
    
    **Use custom functions** only when you need fine-grained control over message handling, custom LLM integrations, or complex multi-step reasoning within a single node.

---

## 🚀 Quick Start (5 Minutes)

Here's a complete working agent in under 20 lines:

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END


# 1. Define your tool
def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"The weather in {location} is sunny, 72°F"


# 2. Build the graph
graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node_name="TOOL"
))
graph.add_node("TOOL", ToolNode([get_weather]))


# 3. Define routing
def route(state: AgentState) -> str:
    if state.context and state.context[-1].tools_calls:
        return "TOOL"
    return END


graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

# 4. Run it!
app = graph.compile()
result = app.invoke({
    "messages": [Message.text_message("What's the weather in New York?")]
}, config={"thread_id": "1"})

for msg in result["messages"]:
    print(f"{msg.role}: {msg.content}")
```

**That's it!** No manual message conversion, no LLM response handling, no boilerplate.

---

## 🎯 Why Agent Class?

### Before: Custom Functions (50+ lines)

```python
async def main_agent(state: AgentState):
    # Manual system prompt setup
    system_prompt = "You are a helpful assistant."
    
    # Manual message conversion
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": system_prompt}],
        state=state,
    )
    
    # Manual tool result detection
    if state.context and state.context[-1].role == "tool":
        response = await acompletion(model="gpt-4", messages=messages)
    else:
        # Manual tool retrieval
        tools = await tool_node.all_tools()
        response = await acompletion(model="gpt-4", messages=messages, tools=tools)
    
    # Manual response conversion
    return ModelResponseConverter(response, converter="litellm")
```

### After: Agent Class (3 lines)

```python
Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node_name="TOOL"
)
```

The Agent class handles all the complexity internally while giving you the same power and flexibility.

---

## 📖 Agent Class Parameters

### Required Parameters

#### `model` (str)
The LiteLLM model identifier. Supports any provider via LiteLLM.

```python
# OpenAI
Agent(model="gpt-4", ...)
Agent(model="gpt-4-turbo", ...)
Agent(model="gpt-4o", ...)

# Google Gemini
Agent(model="gemini/gemini-2.5-flash", ...)
Agent(model="gemini/gemini-2.0-flash", ...)

# Anthropic Claude
Agent(model="claude-3-5-sonnet-20241022", ...)
Agent(model="claude-3-opus-20240229", ...)

# Azure OpenAI
Agent(model="azure/gpt-4", ...)

# Local models via Ollama
Agent(model="ollama/llama3", ...)
```

See [LiteLLM Providers](https://docs.litellm.ai/docs/providers) for the complete list.

#### `system_prompt` (list[dict])
The system prompt as a list of message dictionaries. Supports provider-specific options like cache control.

```python
# Simple system prompt
Agent(
    model="gpt-4",
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant."
    }]
)

# With cache control (Anthropic)
Agent(
    model="claude-3-5-sonnet-20241022",
    system_prompt=[{
        "role": "system",
        "content": [
            {
                "type": "text",
                "text": "You are a research assistant with expertise in Python.",
                "cache_control": {"type": "ephemeral"}
            }
        ]
    }]
)

# Multiple system messages
Agent(
    model="gpt-4",
    system_prompt=[
        {"role": "system", "content": "You are a code reviewer."},
        {"role": "system", "content": "Always provide constructive feedback."}
    ]
)
```

### Tool Configuration

#### `tools` (list[Callable] | ToolNode | None)
Pass tools directly to the Agent. Can be a list of functions or an existing ToolNode.

```python
def search(query: str) -> str:
    """Search the web."""
    return f"Results for: {query}"

def calculator(expression: str) -> str:
    """Calculate a math expression."""
    return str(eval(expression))

# Option 1: List of functions
Agent(
    model="gpt-4",
    system_prompt=[...],
    tools=[search, calculator]
)

# Option 2: Existing ToolNode
tool_node = ToolNode([search, calculator])
Agent(
    model="gpt-4",
    system_prompt=[...],
    tools=tool_node
)
```

#### `tool_node_name` (str | None)
Reference an existing ToolNode by name in the graph. This is useful when you want to share a ToolNode between multiple nodes.

```python
graph = StateGraph()

# Add ToolNode to graph
graph.add_node("TOOL", ToolNode([get_weather, search]))

# Reference it by name in Agent
graph.add_node("MAIN", Agent(
    model="gpt-4",
    system_prompt=[...],
    tool_node_name="TOOL"  # References the "TOOL" node
))
```

#### `tools_tags` (set[str] | None)
Filter which tools are available to the Agent by tags. Only tools matching the specified tags will be exposed.

```python
from agentflow.utils import tool

@tool(tags={"search", "read"})
def search_docs(query: str) -> str:
    """Search documents."""
    return f"Found: {query}"

@tool(tags={"write", "dangerous"})
def delete_file(path: str) -> str:
    """Delete a file."""
    return f"Deleted: {path}"

# Only expose "read" tools
Agent(
    model="gpt-4",
    system_prompt=[...],
    tools=[search_docs, delete_file],
    tools_tags={"read"}  # Only search_docs is available
)
```

### Message Configuration

#### `extra_messages` (list[Message] | None)
Additional messages to include in every LLM call. Useful for few-shot examples or persistent context.

```python
from agentflow.state import Message

# Add few-shot examples
Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You translate text."}],
    extra_messages=[
        Message.text_message("Translate 'hello' to Spanish", role="user"),
        Message.text_message("hola", role="assistant"),
        Message.text_message("Translate 'goodbye' to Spanish", role="user"),
        Message.text_message("adiós", role="assistant"),
    ]
)
```

### Context Management

#### `trim_context` (bool)
Enable automatic context trimming using a registered `BaseContextManager`. Prevents token overflow in long conversations.

```python
from agentflow.state.base_context import BaseContextManager

class MyContextManager(BaseContextManager):
    async def trim_context(self, state: AgentState) -> AgentState:
        # Keep only last 10 messages
        if len(state.context) > 10:
            state.context = state.context[-10:]
        return state

# Register context manager in InjectQ container
container.register(BaseContextManager, MyContextManager())

# Enable trimming
Agent(
    model="gpt-4",
    system_prompt=[...],
    trim_context=True
)
```

### LLM Configuration

#### `**llm_kwargs`
Additional parameters passed directly to LiteLLM's `acompletion` function.

```python
Agent(
    model="gpt-4",
    system_prompt=[...],
    temperature=0.7,        # Creativity (0.0-2.0)
    max_tokens=1000,        # Max response length
    top_p=0.9,              # Nucleus sampling
    frequency_penalty=0.5,  # Reduce repetition
    presence_penalty=0.5,   # Encourage new topics
    stop=["END"],           # Stop sequences
)
```

---

## 🔧 Common Patterns

### Pattern 1: Simple Conversational Agent

No tools, just conversation:

```python
from agentflow.graph import Agent, StateGraph
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END

graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="gpt-4",
    system_prompt=[{
        "role": "system",
        "content": "You are a friendly conversational assistant."
    }],
    temperature=0.8
))

graph.add_edge("MAIN", END)
graph.set_entry_point("MAIN")

app = graph.compile()
```

### Pattern 2: Tool-Calling Agent (ReAct)

The most common pattern—agent with tools:

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END


def search(query: str) -> str:
    """Search the web for information."""
    return f"Search results for: {query}"


def calculator(expression: str) -> float:
    """Evaluate a math expression."""
    return eval(expression)


graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="gpt-4",
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant. Use tools when needed."
    }],
    tool_node_name="TOOL"
))
graph.add_node("TOOL", ToolNode([search, calculator]))


def should_use_tools(state: AgentState) -> str:
    """Route based on tool calls."""
    if not state.context:
        return "TOOL"
    
    last = state.context[-1]
    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"
    if last.role == "tool":
        return "MAIN"
    return END


graph.add_conditional_edges("MAIN", should_use_tools, {
    "TOOL": "TOOL",
    "MAIN": "MAIN",
    END: END
})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

### Pattern 3: Agent with Tool Filtering

Control which tools are available:

```python
from agentflow.utils import tool
from agentflow.graph import Agent, StateGraph, ToolNode


@tool(tags={"safe", "search"})
def search_docs(query: str) -> str:
    """Search internal documents."""
    return f"Found documents for: {query}"


@tool(tags={"dangerous", "write"})
def delete_document(doc_id: str) -> str:
    """Delete a document permanently."""
    return f"Deleted document: {doc_id}"


@tool(tags={"safe", "read"})
def get_document(doc_id: str) -> str:
    """Get a document by ID."""
    return f"Document {doc_id} content..."


# Safe agent - only has access to safe tools
safe_agent = Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You help users find documents."}],
    tools=[search_docs, delete_document, get_document],
    tools_tags={"safe"}  # Only search_docs and get_document
)

# Admin agent - has all tools
admin_agent = Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You are an admin with full access."}],
    tools=[search_docs, delete_document, get_document]
    # No tags filter = all tools available
)
```

### Pattern 4: Multi-Agent with Shared Tools

Multiple agents sharing the same ToolNode:

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState
from agentflow.utils.constants import END


def search(query: str) -> str:
    return f"Results: {query}"


def calculate(expr: str) -> str:
    return str(eval(expr))


graph = StateGraph()

# Shared tool node
graph.add_node("TOOL", ToolNode([search, calculate]))

# Research agent
graph.add_node("RESEARCHER", Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You research topics."}],
    tool_node_name="TOOL"
))

# Calculator agent  
graph.add_node("CALCULATOR", Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You solve math problems."}],
    tool_node_name="TOOL"
))

# Router to select agent
def route_query(state: AgentState) -> str:
    # Simple routing based on content
    if state.context:
        content = str(state.context[-1].content).lower()
        if "calculate" in content or "math" in content:
            return "CALCULATOR"
    return "RESEARCHER"


graph.add_conditional_edges("__start__", route_query, {
    "RESEARCHER": "RESEARCHER",
    "CALCULATOR": "CALCULATOR"
})
# ... add remaining edges
```

### Pattern 5: Streaming Agent

Agent class supports streaming out of the box:

```python
app = graph.compile()

# Enable streaming in config
config = {"thread_id": "1", "is_stream": True}

# Use astream for streaming responses
async for event in app.astream(
    {"messages": [Message.text_message("Tell me a story")]},
    config=config
):
    if event.content_type == "text":
        print(event.content, end="", flush=True)
```

---

## 🔄 Agent Class vs Custom Functions

| Aspect | Agent Class | Custom Functions |
|--------|-------------|------------------|
| **Setup time** | Minutes | Hours |
| **Lines of code** | 10-30 | 50-150 |
| **Message handling** | Automatic | Manual |
| **Tool integration** | Built-in | Manual setup |
| **Streaming** | Automatic | Manual implementation |
| **Context trimming** | Built-in option | Custom implementation |
| **Learning curve** | Low | Medium-High |
| **Flexibility** | High (90% use cases) | Maximum |
| **Best for** | Most agents | Complex custom logic |

### When to Use Custom Functions

Choose custom functions when you need:

- **Custom LLM clients**: Not using LiteLLM (e.g., direct OpenAI SDK)
- **Complex message preprocessing**: Multi-step transformations before LLM call
- **Custom response handling**: Non-standard response parsing
- **Multiple LLM calls per node**: Chains of LLM calls within a single step
- **Custom tool execution logic**: Non-standard tool handling

### Migration Path

Already using custom functions? Migration is straightforward:

```python
# Before: Custom function
async def my_agent(state: AgentState):
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

# After: Agent class
Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "..."}],
    tool_node_name="TOOL"
)
```

---

## ⚠️ Requirements

The Agent class requires LiteLLM:

```bash
pip install 10xscale-agentflow[litellm]
```

If LiteLLM is not installed, you'll get an `ImportError` with installation instructions.

---

## 🎓 Next Steps

Now that you understand the Agent class:

1. **[React Agent Patterns](react/00-agent-class-react.md)** - Build ReAct agents with Agent class
2. **[Tool Decorator](tool-decorator.md)** - Organize tools with metadata and tags
3. **[Streaming](react/04-streaming.md)** - Real-time responses
4. **[Persistence](long_term_memory.md)** - Save conversation state

---

## 📚 Complete API Reference

```python
class Agent:
    def __init__(
        self,
        model: str,                                    # LiteLLM model identifier
        system_prompt: list[dict[str, Any]],          # System prompt messages
        tools: list[Callable] | ToolNode | None = None,  # Tools for the agent
        tool_node_name: str | None = None,            # Reference existing ToolNode
        extra_messages: list[Message] | None = None,  # Additional context messages
        trim_context: bool = False,                   # Enable context trimming
        tools_tags: set[str] | None = None,           # Filter tools by tags
        **llm_kwargs,                                 # LiteLLM parameters
    ):
        ...
```

The Agent class uses `acompletion` from LiteLLM internally and returns a `ModelResponseConverter` that the graph engine processes automatically.
