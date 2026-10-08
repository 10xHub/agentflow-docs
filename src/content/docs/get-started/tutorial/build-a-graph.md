---
title: Build a graph by hand
seoTitle: Build a 10xGraph agent with tools and routing
description: Learn how to build a graph with an agent node, tools, and conditional routing between them.
section: Get started
group: Tutorial
order: 62
label: Build a graph
updated: "2026-10-08"
---

In this step you will extend the agent from the previous tutorial with callable tools. You will build the graph by hand, adding nodes for the agent and tools, then conditional logic to route between them. Then you will see how `ReactAgent` does the same thing in one line and learn when to use each approach.

This step builds directly on the agent you created in the previous step, so your agent can now make decisions about when to use tools.

## What you build

A graph with an agent that can call a `get_weather` function. The agent decides when to use the tool, and the graph routes tool results back to the agent for interpretation.

## Prerequisites

- 10xGraph installed with the provider extra: `pip install "10xgraph[google-genai]"` (or `[openai]` or `[anthropic]`)
- A language model API key set in an environment variable
- The agent from the previous tutorial step

## Add a tool function

A tool is a regular Python function with a docstring. The docstring describes what the tool does, and 10xGraph converts it into a schema the model sees.

Create a file `agent_with_tools.py`:

```python
def get_weather(location: str) -> str:
    """Get the current weather for a specific location."""
    # In a real app, this would call a weather API
    return f"The weather in {location} is sunny and 22°C."
```

The function signature and docstring tell the model:
- Parameter name and type: `location: str`
- Description from the docstring: "Get the current weather for a specific location."

The model will call this tool when it needs weather information.

## Build the graph with tools

Add the graph construction to `agent_with_tools.py`:

```python
from tenxgraph.core.graph import Agent, StateGraph, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.utils import END

def get_weather(location: str) -> str:
    """Get the current weather for a specific location."""
    return f"The weather in {location} is sunny and 22°C."

# Create a ToolNode that wraps your functions
tool_node = ToolNode([get_weather])

# Create an agent that knows about the tool node
agent = Agent(
    model="gemini-2.5-flash",
    system_prompt=[
        {
            "role": "system",
            "content": "You are a helpful assistant. Use the get_weather tool when you need weather information.",
        }
    ],
    tool_node=tool_node,
)

# Define the routing function
def should_use_tools(state: AgentState) -> str:
    """Route to TOOL if the last message has tool calls, otherwise END."""
    if not state.context:
        return END
    
    last_message = state.context[-1]
    
    # If assistant message has tool calls, route to TOOL node
    if (
        last_message.role == "assistant"
        and hasattr(last_message, "tools_calls")
        and last_message.tools_calls
    ):
        return "TOOL"
    
    # If it's a tool result, go back to MAIN for the assistant to respond
    if last_message.role == "tool":
        return "MAIN"
    
    # Otherwise, we are done
    return END

# Build the graph
graph = StateGraph(AgentState)
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)

# Add conditional edges: from MAIN, check what to do next
graph.add_conditional_edges(
    "MAIN",
    should_use_tools,
    {"TOOL": "TOOL", END: END},
)

# After tools execute, always return to MAIN so the agent can respond
graph.add_edge("TOOL", "MAIN")

# Start at MAIN
graph.set_entry_point("MAIN")

# Compile the graph for execution
app = graph.compile()
```

## Understand the graph structure

The graph has two nodes and conditional routing:

1. **MAIN node**: The `Agent` that sends messages to the language model.
2. **TOOL node**: The `ToolNode` that executes functions the model requests.

The routing function `should_use_tools` examines the last message:
- If it is an assistant message with tool calls, route to "TOOL"
- If it is a tool result, route back to "MAIN" (the assistant interprets the result)
- Otherwise, return END (the conversation is done)

This loop continues until the assistant decides no more tools are needed.

## Run it and see the messages

Add this code to invoke the graph:

```python
result = app.invoke(
    {"messages": [Message.text_message("What is the weather in London?")]},
    config={"thread_id": "graph-with-tools-demo"},
)

# Print the final response
for message in result["messages"]:
    print(f"{message.role}: {message.text()}")
```

Run the file:

```bash
python agent_with_tools.py
```

Expected output (exact words will vary):

```text
user: What is the weather in London?
assistant: I'll check the weather in London for you.
tool: The weather in London is sunny and 22°C.
assistant: The weather in London is sunny and 22°C.
```

The conversation shows each step:
1. User asks a question
2. Assistant recognizes it needs the `get_weather` tool
3. ToolNode executes the tool and returns a result
4. Assistant uses the result to form a final response

## Do the same with ReactAgent

10xGraph provides `ReactAgent`, a prebuilt agent that sets up this exact pattern. It builds the graph and handles routing automatically:

```python
from tenxgraph.prebuilt.agent import ReactAgent
from tenxgraph.core.state import Message

def get_weather(location: str) -> str:
    """Get the current weather for a specific location."""
    return f"The weather in {location} is sunny and 22°C."

# ReactAgent does everything in one call
app = ReactAgent(
    model="gemini-2.5-flash",
    system_prompt=[
        {
            "role": "system",
            "content": "You are a helpful assistant. Use the get_weather tool when you need weather information.",
        }
    ],
    tools=[get_weather],
).compile()

# Invoke it the same way
result = app.invoke(
    {"messages": [Message.text_message("What is the weather in London?")]},
    config={"thread_id": "react-agent-demo"},
)

for message in result["messages"]:
    print(f"{message.role}: {message.text()}")
```

Both produce the same output. ReactAgent builds the MAIN and TOOL nodes and the routing logic internally, so you don't write it by hand.

## When to use each approach

**Use ReactAgent when:**
- You want a simple agentic loop: agent decides when to use tools, tools execute, agent responds.
- You do not need custom state fields beyond the default `AgentState`.
- You do not need to customize the routing logic.
- You want less boilerplate.

**Build the graph by hand when:**
- You need custom routing logic (for example, always call tools, or call them conditionally based on a state field).
- You need custom state fields (for example, tracking user preferences or conversation metadata).
- You want to insert additional nodes in the flow (for example, a validation node between the agent and tools).
- You are building a multi-agent system with different agent types.

For most simple use cases, `ReactAgent` is sufficient. For production systems with domain-specific logic, you will build the graph by hand.

## Handle tool errors

Tools sometimes fail. By default, if a tool raises an exception, the exception is caught and returned as a tool result message. The model sees the error and can retry or handle it gracefully.

To see this in action, modify the tool to sometimes fail:

```python
import random

def get_weather(location: str) -> str:
    """Get the current weather for a specific location."""
    if random.random() < 0.3:  # 30% chance of failure
        raise Exception(f"Failed to fetch weather for {location}")
    return f"The weather in {location} is sunny and 22°C."
```

When a tool raises an exception, ToolNode automatically converts it to a tool result message with the error. The model receives this message and can decide to retry, use a fallback, or inform the user.

If you want to handle errors differently, subclass `ToolNode` and override the execution method. For most cases, the default behavior is sufficient: the model is robust and will handle tool failures appropriately.

## What you learned

- Tools are regular Python functions with docstrings that describe what they do.
- `ToolNode` wraps functions and executes them in parallel when the model requests several at once.
- A routing function in a `add_conditional_edges` call determines when to call tools and when to return control to the agent.
- The agent-tool loop continues until the agent has the information it needs and decides to stop calling tools.
- `ReactAgent` implements the standard agentic loop (Agent calls tools, tools execute, results go back to Agent) with no boilerplate.
- You build the graph by hand when you need custom logic or state beyond what ReactAgent provides.
- Tool errors are automatically caught and presented to the model, which can handle them gracefully.

## Next step

Preserve conversation state across multiple calls with [Add memory](/docs/get-started/tutorial/threads-and-memory).
