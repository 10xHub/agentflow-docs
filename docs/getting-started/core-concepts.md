# Core Concepts

Everything in AgentFlow is built from a small set of composable primitives. Once you understand these, you can build anything.

---

## 1. Agent

**What it is:** A wrapper around an LLM that receives a conversation, decides what to do, and returns a response.

```python
from agentflow.graph import Agent

agent = Agent(
    model="google/gemini-2.5-flash",   # Which LLM to use
    system_prompt="You are a helpful assistant.",
    tool_node_name="TOOL",             # Optional: name of the tool node
)
```

The `Agent` class handles:

- Converting `AgentState` into the message format your LLM expects
- Sending the request to the LLM
- Parsing the response (content, tool calls, token usage)
- Routing back to the tool node if the LLM decided to call a tool

**Model string format:** `"provider/model-name"`

| Provider | Example model string |
|----------|---------------------|
| Google Gemini | `"google/gemini-2.5-flash"` |
| OpenAI | `"openai/gpt-4o"` |
| Anthropic | `"anthropic/claude-3-5-sonnet-20241022"` |

---

## 2. Tool & ToolNode

**What it is:** A Python function that the LLM can choose to call. `ToolNode` wraps one or more tools and handles execution.

```python
from agentflow.graph import ToolNode

# Define a tool — just a Python function with a clear docstring
def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny, 72°F"

def calculate(expression: str) -> str:
    """Evaluate a math expression and return the result."""
    return str(eval(expression))

# Wrap tools in a ToolNode
tool_node = ToolNode([get_weather, calculate])
```

**Rules for tools:**

- **Docstring is required** — the LLM reads it to decide when to call the tool
- **Type hints on all parameters** — AgentFlow uses these to generate the tool schema
- **Return a string** (or dict/list that can be serialized)

When the LLM wants to call `get_weather("Tokyo")`, AgentFlow:
1. Detects the tool call in the LLM response
2. Routes to the `ToolNode`
3. Executes `get_weather("Tokyo")`
4. Injects the result back into the conversation
5. Sends the conversation back to the Agent

---

## 3. StateGraph

**What it is:** The workflow engine. It holds your nodes, defines edges between them, and runs the whole thing.

```python
from agentflow.graph import StateGraph

graph = StateGraph()

# Add nodes
graph.add_node("MAIN", agent)     # Agent node
graph.add_node("TOOL", tool_node) # Tool node

# Define flow
graph.set_entry_point("MAIN")     # Where execution starts
```

`StateGraph` is the "director" — it decides the order of execution and passes state between nodes.

---

## 4. Edges

**What they are:** The connections between nodes that define what runs next.

### Fixed Edge

Always goes from A to B:

```python
graph.add_edge("TOOL", "MAIN")  # After tools execute, always return to agent
```

### Conditional Edge

A function decides where to go next:

```python
from agentflow.utils.constants import END

def route(state: AgentState) -> str:
    """Look at the last message and decide what happens next."""
    if not state.context:
        return END

    last = state.context[-1]

    # Agent called tools → go execute them
    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"

    # Tool just ran → go back to agent for final response
    if last.role == "tool":
        return "MAIN"

    # Agent gave a final text response → stop
    return END

graph.add_conditional_edges(
    "MAIN",          # From this node
    route,           # Call this function to decide
    {                # Map return values to node names
        "TOOL": "TOOL",
        END: END,
    }
)
```

---

## 5. END

**What it is:** A special constant that tells the graph to stop execution and return the final state.

```python
from agentflow.utils.constants import END

graph.add_edge("agent", END)          # Fixed: always stop after agent
# or
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
```

Execution stops when a routing function returns `END` or an edge points to `END`.

---

## 6. AgentState & Message

**AgentState** is the data container that flows through every node:

```python
from agentflow.state import AgentState, Message

# Create initial state
state = {
    "messages": [
        Message.text_message("What's the weather in Tokyo?", "user")
    ]
}
```

Every node receives the current state and can update it.

**Message** is a single unit of communication:

```python
# User sends a message
Message.text_message("Hello!", "user")

# Assistant responds
Message.text_message("Hi! How can I help?", "assistant")
```

Every Message has:
- `content` — what was said
- `role` — `"user"`, `"assistant"`, or `"tool"`
- `tools_calls` — list of tool calls if the LLM decided to use tools

---

## 7. Checkpointer

**What it is:** A persistence layer that saves conversation state between turns, enabling multi-turn memory.

Without a checkpointer, each `app.invoke()` call is stateless — the agent forgets everything.

```python
from agentflow.checkpointer import InMemoryCheckpointer

# Attach checkpointer at compile time
app = graph.compile(checkpointer=InMemoryCheckpointer())

# Now use thread_id to maintain conversation continuity
config = {"thread_id": "user-123"}

# Turn 1
app.invoke({"messages": [Message.text_message("My name is Alex", "user")]}, config=config)

# Turn 2 — the agent remembers "My name is Alex"
app.invoke({"messages": [Message.text_message("What's my name?", "user")]}, config=config)
```

| Checkpointer | Use For |
|-------------|---------|
| `InMemoryCheckpointer` | Development, testing |
| `PostgresCheckpointer` | Production (requires `pg_checkpoint` extra) |

---

## 8. compile() and invoke()

### compile()

Validates your graph and returns a runnable `app`:

```python
app = graph.compile()
# or with checkpointer:
app = graph.compile(checkpointer=InMemoryCheckpointer())
```

### invoke()

Runs the graph synchronously and returns the final state:

```python
result = app.invoke(
    {"messages": [Message.text_message("Hello!", "user")]},
    config={"thread_id": "abc", "recursion_limit": 10}
)

# Get the last message
print(result["messages"][-1].content)
```

### stream()

Returns events as the graph runs — useful for real-time responses:

```python
for event in app.stream(
    {"messages": [Message.text_message("Hello!", "user")]},
    config={"thread_id": "abc"}
):
    print(event)
```

---

## How Everything Fits Together

Here is the complete picture — all 8 concepts working as one:

```python
from dotenv import load_dotenv
from agentflow.graph import Agent, StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.utils.constants import END

load_dotenv()

# 1. Define a tool
def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"Sunny, 72°F in {location}"

# 2. Wrap in ToolNode
tool_node = ToolNode([get_weather])

# 3. Create Agent connected to the tool node
agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt="You are a helpful assistant.",
    tool_node_name="TOOL",
)

# 4. Build the StateGraph
graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

# 5. Define routing (conditional edge)
def route(state: AgentState) -> str:
    if not state.context:
        return END
    last = state.context[-1]
    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"
    if last.role == "tool":
        return "MAIN"
    return END

graph.set_entry_point("MAIN")
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")   # Fixed edge: after tools, back to agent

# 6. Compile with a checkpointer (enables memory)
app = graph.compile(checkpointer=InMemoryCheckpointer())

# 7. invoke() — run the graph
config = {"thread_id": "session-1", "recursion_limit": 10}
result = app.invoke(
    {"messages": [Message.text_message("What's the weather in Tokyo?", "user")]},
    config=config,
)

print(result["messages"][-1].content)
```

### Execution Flow

```
invoke() called
    ↓
MAIN node (Agent)   → LLM decides to call get_weather("Tokyo")
    ↓ (route → "TOOL")
TOOL node           → get_weather("Tokyo") executes, returns "Sunny, 72°F"
    ↓ (fixed edge → "MAIN")
MAIN node (Agent)   → LLM sees result, generates: "It's sunny and 72°F in Tokyo!"
    ↓ (route → END)
END                 → graph stops, returns final state
```

---

## Quick Reference

| Concept | Class / Import | Role |
|---------|---------------|------|
| `Agent` | `from agentflow.graph import Agent` | LLM wrapper, handles reasoning |
| `ToolNode` | `from agentflow.graph import ToolNode` | Executes Python function tools |
| `StateGraph` | `from agentflow.graph import StateGraph` | Workflow engine |
| Fixed edge | `graph.add_edge(A, B)` | Always goes A → B |
| Conditional edge | `graph.add_conditional_edges(A, fn, map)` | Routing function decides next node |
| `END` | `from agentflow.utils.constants import END` | Stops execution |
| `AgentState` | `from agentflow.state import AgentState` | State flowing through the graph |
| `Message` | `from agentflow.state import Message` | Single conversation message |
| `InMemoryCheckpointer` | `from agentflow.checkpointer import InMemoryCheckpointer` | In-memory conversation memory |
| `compile()` | `graph.compile(checkpointer=...)` | Builds the runnable app |
| `invoke()` | `app.invoke(state, config=...)` | Runs the graph, returns final state |

---

## What's Next?

You now understand every building block. Here's what to explore next:

- **[Beginner Tutorials](../Tutorial/beginner/index.md)** — Build real agents step by step
- **[Agent Class Reference](../reference/library/graph/agent-class.md)** — Full Agent API docs
- **[Tools Reference](../reference/library/graph/tools.md)** — Advanced tool patterns
- **[Checkpointer Reference](../reference/library/context/checkpointer.md)** — Production persistence
