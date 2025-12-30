# Agent Class

The **Agent class** is a high-level abstraction that wraps common LLM interaction patterns into a simple, reusable node function. It handles message conversion, tool management, and LLM calls automatically—letting you build sophisticated agents with minimal code.

---

## Overview

The Agent class is designed to be used as a node within a StateGraph. It's not a replacement for the graph system—it's a smart node function that eliminates boilerplate while maintaining full graph flexibility.

```python
from agentflow.graph import Agent, StateGraph, ToolNode

# Agent class as a graph node
graph = StateGraph()
graph.add_node("MAIN", Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You are helpful."}],
    tool_node_name="TOOL"
))
graph.add_node("TOOL", ToolNode([...]))
```

---

## Architecture

### How Agent Class Fits in the Graph

```
┌─────────────────────────────────────────────────────┐
│                    StateGraph                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────┐      ┌─────────────┐              │
│  │ Agent Node  │ ──── │  ToolNode   │              │
│  │ (Agent)     │      │             │              │
│  └─────────────┘      └─────────────┘              │
│         │                    │                      │
│         └────────────────────┘                      │
│              Routing Logic                          │
│                                                      │
└─────────────────────────────────────────────────────┘
```

The Agent class:
1. Receives state from the graph
2. Converts messages to LLM format
3. Calls the LLM with appropriate tools
4. Returns a `ModelResponseConverter` that the graph processes

### Internal Flow

```
State Input
    │
    ▼
┌─────────────────────────────────┐
│   1. Context Trimming           │  (optional, if trim_context=True)
│      - BaseContextManager       │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   2. Message Conversion         │
│      - System prompts           │
│      - State context            │
│      - Extra messages           │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   3. Tool Detection             │
│      - Check last message role  │
│      - Include tools or not     │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   4. LLM Call (LiteLLM)         │
│      - acompletion()            │
│      - Streaming supported      │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│   5. Response Conversion        │
│      - ModelResponseConverter   │
└─────────────────────────────────┘
    │
    ▼
State Output
```

---

## Key Features

### 1. Automatic Message Conversion

The Agent class automatically converts state context to LLM-compatible message format:

```python
# Manual approach
messages = convert_messages(
    system_prompts=[{"role": "system", "content": "..."}],
    state=state,
    extra_messages=extra_messages,
)

# Agent class handles this internally
Agent(model="gpt-4", system_prompt=[{"role": "system", "content": "..."}])
```

### 2. Intelligent Tool Handling

The Agent class automatically:
- Retrieves tools from the specified ToolNode
- Includes tools in LLM calls when appropriate
- Excludes tools when processing tool results (final response)

```python
# Logic handled internally:
if state.context and state.context[-1].role == "tool":
    # Make final response without tools
    response = await acompletion(model=self.model, messages=messages)
else:
    # Include tools for reasoning
    tools = await tool_node.all_tools()
    response = await acompletion(model=self.model, messages=messages, tools=tools)
```

### 3. Tool Filtering with Tags

Filter available tools using tags:

```python
from agentflow.utils import tool

@tool(tags={"read", "safe"})
def search(query: str) -> str:
    return f"Results: {query}"

@tool(tags={"write", "dangerous"})
def delete(id: str) -> str:
    return f"Deleted: {id}"

# Only expose safe tools
Agent(
    model="gpt-4",
    system_prompt=[...],
    tools=[search, delete],
    tools_tags={"safe"}  # Only search is available
)
```

### 4. Context Trimming

Prevent token overflow with automatic context trimming:

```python
from agentflow.state.base_context import BaseContextManager

class TokenLimitManager(BaseContextManager):
    async def trim_context(self, state: AgentState) -> AgentState:
        # Custom trimming logic
        if len(state.context) > 20:
            state.context = state.context[-20:]
        return state

# Register in container
container.register(BaseContextManager, TokenLimitManager())

# Enable in Agent
Agent(
    model="gpt-4",
    system_prompt=[...],
    trim_context=True
)
```

### 5. Streaming Support

Enable streaming by setting `is_stream` in the config:

```python
app = graph.compile()

# Streaming execution
async for event in app.astream(
    {"messages": [Message.text_message("Tell me a story")]},
    config={"thread_id": "1", "is_stream": True}
):
    print(event.content, end="", flush=True)
```

---

## API Reference

### Constructor Parameters

```python
class Agent:
    def __init__(
        self,
        model: str,                                    # Required: LiteLLM model identifier
        system_prompt: list[dict[str, Any]],          # Required: System prompt messages
        tools: list[Callable] | ToolNode | None = None,  # Direct tool specification
        tool_node_name: str | None = None,            # Reference existing ToolNode by name
        extra_messages: list[Message] | None = None,  # Additional context messages
        trim_context: bool = False,                   # Enable context trimming
        tools_tags: set[str] | None = None,           # Filter tools by tags
        **llm_kwargs,                                 # Additional LiteLLM parameters
    ):
```

### Parameter Details

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | LiteLLM model identifier (e.g., "gpt-4", "gemini/gemini-2.5-flash") |
| `system_prompt` | `list[dict]` | System messages with role and content |
| `tools` | `list[Callable]` or `ToolNode` | Tools to make available (alternative to tool_node_name) |
| `tool_node_name` | `str` | Name of ToolNode registered in the graph |
| `extra_messages` | `list[Message]` | Additional messages included in every call |
| `trim_context` | `bool` | Whether to trim context using BaseContextManager |
| `tools_tags` | `set[str]` | Tags to filter available tools |
| `**llm_kwargs` | `Any` | Additional parameters for acompletion (temperature, max_tokens, etc.) |

### Methods

#### `execute(state, config)`

Internal method called by the graph runtime. You typically don't call this directly.

```python
async def execute(
    self,
    state: AgentState,
    config: dict[str, Any],
) -> ModelResponseConverter:
```

---

## Comparison: Agent Class vs Custom Functions

### When to Use Agent Class

✅ **Recommended for:**
- Standard ReAct agents
- Tool-calling agents
- Conversational agents
- Rapid prototyping
- Production apps with typical LLM patterns

### When to Use Custom Functions

✅ **Choose custom functions when you need:**
- Custom LLM clients (not LiteLLM)
- Complex message preprocessing
- Multiple LLM calls per node
- Non-standard response handling
- Custom streaming logic

### Code Comparison

**Agent Class (5 lines):**
```python
Agent(
    model="gpt-4",
    system_prompt=[{"role": "system", "content": "You are helpful."}],
    tool_node_name="TOOL"
)
```

**Custom Function (15+ lines):**
```python
async def main_agent(state: AgentState):
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": "You are helpful."}],
        state=state,
    )
    
    if state.context and state.context[-1].role == "tool":
        response = await acompletion(model="gpt-4", messages=messages)
    else:
        tools = await tool_node.all_tools()
        response = await acompletion(model="gpt-4", messages=messages, tools=tools)
    
    return ModelResponseConverter(response, converter="litellm")
```

---

## Extension Points

### Custom Context Manager

Implement `BaseContextManager` for custom context handling:

```python
from agentflow.state.base_context import BaseContextManager

class SummarizingContextManager(BaseContextManager):
    async def trim_context(self, state: AgentState) -> AgentState:
        if len(state.context) > 30:
            # Summarize old messages
            summary = await self.summarize(state.context[:-10])
            state.context_summary = summary
            state.context = state.context[-10:]
        return state
```

### Tool Node Integration

Agent class supports multiple tool integration patterns:

```python
# 1. Direct tools list
Agent(model="gpt-4", ..., tools=[func1, func2])

# 2. Existing ToolNode
tool_node = ToolNode([func1, func2])
Agent(model="gpt-4", ..., tools=tool_node)

# 3. Reference by name
graph.add_node("TOOL", ToolNode([func1, func2]))
Agent(model="gpt-4", ..., tool_node_name="TOOL")
```

### LLM Parameters

Pass any LiteLLM parameter through `**llm_kwargs`:

```python
Agent(
    model="gpt-4",
    system_prompt=[...],
    temperature=0.7,
    max_tokens=1000,
    top_p=0.9,
    presence_penalty=0.5,
    frequency_penalty=0.5,
    stop=["END"],
)
```

---

## Requirements

The Agent class requires LiteLLM:

```bash
pip install 10xscale-agentflow[litellm]
```

If LiteLLM is not installed, you'll get an `ImportError`:

```
ImportError: litellm is required for Agent class. 
Install it with: pip install 10xscale-agentflow[litellm]
```

---

## Related Concepts

- [StateGraph](index.md) - Graph building API
- [ToolNode](tools.md) - Tool registration and execution
- [Nodes](nodes.md) - Node function contracts
- [Control Flow](control_flow.md) - Conditional routing patterns
