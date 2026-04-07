# Agent Class — Deep Dive

The **Agent class** is AgentFlow's high-level abstraction for building intelligent agents. It handles message conversion, LLM calls via native provider SDKs, tool integration, and streaming — so you can focus on your agent's behavior.

!!! tip "When to Use Agent Class"
    **Use Agent class** for the vast majority of your agent needs. It's simple, powerful, and production-ready.

    **Use custom async functions** only when you need very fine-grained control over LLM calls — for example, calling a provider that isn't OpenAI or Google, or chaining multiple LLM calls within a single node.

---

## Quick Start (5 minutes)

A complete working agent in under 20 lines:

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
    model="google/gemini-2.5-flash",
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
result = app.invoke(
    {"messages": [Message.text_message("What's the weather in New York?")]},
    config={"thread_id": "1"}
)

for msg in result["messages"]:
    print(f"{msg.role}: {msg.content}")
```

No manual message conversion, no LLM response handling, no boilerplate.

---

## Supported Providers

The Agent class uses **native SDKs** — no adapter layer in between.

| Provider | Model prefix | Required SDK | Install |
|----------|-------------|-------------|---------|
| **OpenAI** | `openai/` or `gpt-`, `o1-` | `openai` | `pip install 10xscale-agentflow[openai]` |
| **Google Gemini** | `gemini/` or `gemini-` | `google-genai` | `pip install 10xscale-agentflow[google-genai]` |
| **Ollama** (local) | any model name | `openai` + `base_url` | `pip install 10xscale-agentflow[openai]` |
| **DeepSeek / Qwen / vLLM** | any model name | `openai` + `base_url` | `pip install 10xscale-agentflow[openai]` |

### Model string format

The provider is inferred from the model string prefix:

```python
# Google Gemini — provider auto-detected from "gemini/" prefix
Agent(model="google/gemini-2.5-flash", ...)
Agent(model="google/gemini-2.0-flash", ...)

# OpenAI — provider auto-detected from "openai/" prefix or "gpt-"/"o1-" prefix
Agent(model="openai/gpt-4o", ...)
Agent(model="openai/gpt-4o-mini", ...)
Agent(model="openai/o3-mini", ...)

# OpenAI-compatible endpoints (Ollama, DeepSeek, Qwen, vLLM, OpenRouter)
# Requires explicit provider="openai" and base_url
Agent(
    model="llama3:8b",
    provider="openai",
    base_url="http://localhost:11434/v1",
    ...
)

Agent(
    model="deepseek-chat",
    provider="openai",
    base_url="https://api.deepseek.com/v1",
    api_key="your-deepseek-key",
    ...
)
```

---

## Agent Class Parameters

### Core Parameters

#### `model` (str) — required

The model identifier. Use `"provider/model-name"` format or an auto-detectable prefix:

```python
Agent(model="google/gemini-2.5-flash", ...)   # Google
Agent(model="openai/gpt-4o", ...)             # OpenAI
Agent(model="gpt-4o-mini", ...)               # OpenAI (auto-detected)
Agent(model="gemini-2.0-flash", ...)          # Google (auto-detected)
```

#### `provider` (str | None)

Explicitly set the provider. Use this when auto-detection won't work (e.g., third-party OpenAI-compatible APIs):

```python
Agent(
    model="llama3:8b",
    provider="openai",
    base_url="http://localhost:11434/v1",
)
```

Supported values: `"openai"`, `"google"`

#### `system_prompt` (list[dict] | None)

The system prompt as a list of message dicts. Supports multi-message system prompts:

```python
# Single system message
Agent(
    model="openai/gpt-4o",
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant."
    }]
)

# Multi-message system prompt (e.g., for few-shot examples)
Agent(
    model="openai/gpt-4o",
    system_prompt=[
        {"role": "system", "content": "You are a code reviewer."},
        {"role": "system", "content": "Always provide constructive feedback."}
    ]
)
```

#### `base_url` (str | None)

Base URL for OpenAI-compatible APIs:

```python
# Ollama (local)
Agent(
    model="llama3:8b",
    provider="openai",
    base_url="http://localhost:11434/v1",
)

# OpenRouter
Agent(
    model="qwen/qwen-2.5-72b-instruct",
    provider="openai",
    base_url="https://openrouter.ai/api/v1",
    api_key="your-openrouter-key",
)
```

---

### Tool Configuration

#### `tools` (list[Callable] | ToolNode | None)

Pass tools directly to the Agent:

```python
def search(query: str) -> str:
    """Search the web."""
    return f"Results for: {query}"

def calculator(expression: str) -> str:
    """Calculate a math expression."""
    return str(eval(expression))

# List of functions — Agent wraps them in a ToolNode internally
Agent(
    model="openai/gpt-4o",
    system_prompt=[...],
    tools=[search, calculator]
)
```

#### `tool_node_name` (str | None)

Reference an existing `ToolNode` by its node name in the graph. Useful when sharing tools across agents:

```python
graph = StateGraph()
graph.add_node("TOOL", ToolNode([get_weather, search]))

graph.add_node("MAIN", Agent(
    model="openai/gpt-4o",
    system_prompt=[...],
    tool_node_name="TOOL"   # References the "TOOL" node
))
```

#### `tools_tags` (set[str] | None)

Filter which tools the Agent can see by tags. Only tools decorated with matching tags are exposed:

```python
from agentflow.utils import tool

@tool(tags={"search", "safe"})
def search_docs(query: str) -> str:
    """Search internal documents."""
    return f"Found: {query}"

@tool(tags={"write", "dangerous"})
def delete_file(path: str) -> str:
    """Delete a file."""
    return f"Deleted: {path}"

# This agent only sees "safe" tools
Agent(
    model="openai/gpt-4o",
    system_prompt=[...],
    tools=[search_docs, delete_file],
    tools_tags={"safe"}  # Only search_docs is available
)
```

---

### Message Configuration

#### `extra_messages` (list[Message] | None)

Additional messages included in every LLM call. Useful for few-shot examples or persistent context:

```python
from agentflow.state import Message

Agent(
    model="openai/gpt-4o",
    system_prompt=[{"role": "system", "content": "You translate text."}],
    extra_messages=[
        Message.text_message("Translate 'hello' to Spanish", role="user"),
        Message.text_message("hola", role="assistant"),
        Message.text_message("Translate 'goodbye' to Spanish", role="user"),
        Message.text_message("adiós", role="assistant"),
    ]
)
```

---

### Context Management

#### `trim_context` (bool)

Enable automatic context trimming using a registered `BaseContextManager`. Prevents token overflow in long conversations:

```python
from agentflow.state.base_context import BaseContextManager

class MyContextManager(BaseContextManager):
    async def trim_context(self, state: AgentState) -> AgentState:
        # Keep only last 10 messages
        if len(state.context) > 10:
            state.context = state.context[-10:]
        return state

# Register in InjectQ
from injectq import InjectQ
InjectQ.get_instance().register(BaseContextManager, MyContextManager())

# Enable trimming in Agent
Agent(
    model="openai/gpt-4o",
    system_prompt=[...],
    trim_context=True
)
```

---

### LLM Parameters

#### `**kwargs` — temperature, max_tokens, etc.

Additional parameters passed to the LLM API:

```python
Agent(
    model="openai/gpt-4o",
    system_prompt=[...],
    temperature=0.7,     # Creativity (0.0–2.0)
    max_tokens=1000,     # Max response length
    top_p=0.9,           # Nucleus sampling
)
```

#### `api_key` (str | None) — for third-party APIs

```python
Agent(
    model="deepseek-chat",
    provider="openai",
    base_url="https://api.deepseek.com/v1",
    api_key="your-api-key",    # Passed via **kwargs
)
```

---

## Common Patterns

### Pattern 1: Simple Conversational Agent

```python
from agentflow.graph import Agent, StateGraph
from agentflow.utils.constants import END

graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="google/gemini-2.5-flash",
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

The most common production pattern:

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState
from agentflow.utils.constants import END


def search(query: str) -> str:
    """Search the web for information."""
    return f"Results for: {query}"


graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="openai/gpt-4o",
    system_prompt=[{
        "role": "system",
        "content": "You are a helpful assistant. Use tools when needed."
    }],
    tool_node_name="TOOL"
))
graph.add_node("TOOL", ToolNode([search]))


def route(state: AgentState) -> str:
    if state.context and state.context[-1].tools_calls:
        return "TOOL"
    return END


graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile()
```

### Pattern 3: Agent with Tool Filtering

Control exactly which tools each agent can access:

```python
from agentflow.utils import tool
from agentflow.graph import Agent, StateGraph, ToolNode


@tool(tags={"safe", "search"})
def search_docs(query: str) -> str:
    """Search internal documents."""
    return f"Found: {query}"


@tool(tags={"dangerous", "write"})
def delete_document(doc_id: str) -> str:
    """Delete a document permanently."""
    return f"Deleted: {doc_id}"


@tool(tags={"safe", "read"})
def get_document(doc_id: str) -> str:
    """Get a document by ID."""
    return f"Document {doc_id}: ..."


all_tools = [search_docs, delete_document, get_document]

# Read-only agent — can only search and retrieve
read_agent = Agent(
    model="openai/gpt-4o",
    system_prompt=[{"role": "system", "content": "You help users find documents."}],
    tools=all_tools,
    tools_tags={"safe"}  # Only search_docs and get_document
)

# Admin agent — has all tools
admin_agent = Agent(
    model="openai/gpt-4o",
    system_prompt=[{"role": "system", "content": "You are an admin with full access."}],
    tools=all_tools   # No tags filter — all tools available
)
```

### Pattern 4: Multi-Agent with Shared ToolNode

Multiple agents sharing the same tool set:

```python
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState
from agentflow.utils.constants import END


def search(query: str) -> str:
    """Search for information."""
    return f"Results: {query}"


def calculate(expr: str) -> str:
    """Evaluate a math expression."""
    return str(eval(expr))


graph = StateGraph()

# Shared tool node
graph.add_node("TOOL", ToolNode([search, calculate]))

# Research agent
graph.add_node("RESEARCHER", Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "You research topics thoroughly."}],
    tool_node_name="TOOL"
))

# Math agent
graph.add_node("MATH", Agent(
    model="openai/gpt-4o",
    system_prompt=[{"role": "system", "content": "You solve math problems step by step."}],
    tool_node_name="TOOL"
))
```

### Pattern 5: Streaming Agent

Stream tokens as the agent generates them:

```python
import asyncio
from agentflow.state import Message


async def stream_agent():
    app = graph.compile()

    async for event in app.astream(
        {"messages": [Message.text_message("Tell me about Python")]},
        config={"thread_id": "1", "is_stream": True}
    ):
        # Process streaming events
        print(event)


asyncio.run(stream_agent())
```

### Pattern 6: Using the ReactAgent Prebuilt

For the common MAIN → TOOL → MAIN pattern, use the prebuilt `ReactAgent`:

```python
from agentflow.graph import Agent, ToolNode
from agentflow.prebuilt.agent import ReactAgent
from agentflow.checkpointer import InMemoryCheckpointer


def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Sunny, 72°F in {location}"


agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node_name="TOOL"
)

tool_node = ToolNode([get_weather])

# ReactAgent handles the StateGraph setup and routing automatically
app = ReactAgent().compile(
    main_node=agent,
    tool_node=tool_node,
    checkpointer=InMemoryCheckpointer(),
)
```

---

## Agent Class vs Custom Functions

| Aspect | Agent Class | Custom Async Functions |
|--------|-------------|----------------------|
| **Setup time** | Minutes | Hours |
| **Lines of code** | 10–30 | 50–150 |
| **Message handling** | Automatic | Manual |
| **Tool integration** | Built-in | Manual |
| **Streaming** | Built-in | Manual |
| **Learning curve** | Low | Medium–High |
| **Flexibility** | High (covers 95% of use cases) | Maximum |

### When to Use Custom Functions

Choose custom async functions when you need:

- A provider not supported by the Agent class (not OpenAI or Google)
- Multiple LLM calls within a single node
- Custom message preprocessing before the LLM call
- Non-standard response parsing or post-processing

---

## Complete API Reference

```python
class Agent:
    def __init__(
        self,
        model: str,                                     # Model identifier
        provider: str | None = None,                    # "openai" or "google"
        output_type: str = "text",                      # "text", "image", "video", "audio"
        system_prompt: list[dict[str, Any]] | None = None,
        tools: list[Callable] | ToolNode | None = None,
        tool_node_name: str | None = None,
        extra_messages: list[Message] | None = None,
        base_url: str | None = None,                    # For OpenAI-compatible APIs
        trim_context: bool = False,
        tools_tags: set[str] | None = None,
        api_style: str = "chat",                        # "chat" or "responses"
        reasoning_config: dict[str, Any] | None = None,
        **kwargs,                                       # temperature, max_tokens, api_key, etc.
    ):
```

The Agent class uses native provider SDKs: `AsyncOpenAI` for OpenAI-compatible endpoints and `google.genai.Client` for Google Gemini.

---

## Next Steps

- **[Tool Decorator & Filtering](tool-decorator.md)** — Organize tools with metadata and tags
- **[Multi-Agent Handoff](handoff.md)** — Build systems with multiple specialized agents
- **[ReAct with Agent Class](react/00-agent-class-react.md)** — The complete ReAct tutorial
- **[Streaming](react/04-streaming.md)** — Real-time token streaming
