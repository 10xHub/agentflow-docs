# Custom ReAct — Advanced

This tutorial shows how to build a ReAct agent using **custom async functions** instead of the Agent class. Use this approach when you need full control over the LLM call — for example, to use a provider not supported by the Agent class, or to chain multiple LLM calls within one node.

!!! tip "Already done the basics?"
    If you haven't read [ReAct with Agent Class](00-agent-class-react.md), start there. The Agent class covers 95% of use cases in far fewer lines of code.

---

## When to Use Custom Functions

| Use Custom Functions When... | Use Agent Class When... |
|-----------------------------|------------------------|
| You need a provider not in `"openai"` or `"google"` | Standard OpenAI or Google Gemini |
| Multiple LLM calls in one node | Single LLM call per node |
| Custom message preprocessing | Standard message flow |
| Non-standard response parsing | Standard text/tool output |

---

## How Custom Functions Work

A custom node function is an `async def` that:

1. Receives `state: AgentState` and `config: dict`
2. Manually calls `convert_messages()` to build the message list
3. Calls the LLM SDK directly
4. Returns `ModelResponseConverter(response, converter="openai")` — the graph engine processes this automatically

```python
from agentflow.utils.converter import convert_messages
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter


async def my_agent(state: AgentState, config: dict) -> ModelResponseConverter:
    messages = convert_messages(
        system_prompts=[{"role": "system", "content": "You are a helpful assistant."}],
        state=state,
    )
    # Call your LLM here...
    response = await client.chat.completions.create(model="gpt-4o", messages=messages)
    return ModelResponseConverter(response, converter="openai")
```

---

## Complete Example: Weather Agent with Custom Functions

### Step 1: Imports and Setup

```python
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

from agentflow.graph import StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.utils.converter import convert_messages
from agentflow.utils.constants import END

load_dotenv()

client = AsyncOpenAI()  # Reads OPENAI_API_KEY from environment
```

### Step 2: Define Tools

```python
def get_weather(location: str) -> str:
    """
    Get the current weather for a location.

    Args:
        location: City name (e.g., "London", "Tokyo")

    Returns:
        Weather information as a string
    """
    # In production: call a real weather API
    return f"The weather in {location} is sunny, 72°F"


def get_forecast(location: str, days: int = 3) -> str:
    """
    Get the weather forecast for the next N days.

    Args:
        location: City name
        days: Number of days to forecast (1-7)

    Returns:
        Forecast summary
    """
    return f"{days}-day forecast for {location}: Mostly sunny with highs around 70°F"


tool_node = ToolNode([get_weather, get_forecast])
```

### Step 3: Custom Agent Function

```python
SYSTEM_PROMPT = [{"role": "system", "content": """You are a helpful weather assistant.
When users ask about weather, use the available tools to provide accurate information.
If asked about a forecast, use get_forecast. For current conditions, use get_weather."""}]


async def main_agent(state: AgentState, config: dict) -> ModelResponseConverter:
    """Custom reasoning node — calls the LLM directly."""

    # Build the message list from state
    messages = convert_messages(
        system_prompts=SYSTEM_PROMPT,
        state=state,
    )

    # If we just received tool results, respond without offering tools again
    if state.context and state.context[-1].role == "tool":
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
        )
    else:
        # First call — offer tools to the LLM
        tools = await tool_node.all_tools()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            temperature=0.7,
        )

    return ModelResponseConverter(response, converter="openai")
```

!!! note "converter= value"
    Use `converter="openai"` for OpenAI-compatible responses, `converter="google"` for Google GenAI responses.

### Step 4: Routing Function

```python
def route(state: AgentState) -> str:
    """Decide what runs next based on the last message."""
    if not state.context:
        return END

    last = state.context[-1]

    # Agent requested tool calls → run tools
    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"

    # Default → done
    return END
```

### Step 5: Build and Compile the Graph

```python
graph = StateGraph()
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)

graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")   # Fixed edge: after tools, back to agent
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())
```

### Step 6: Run It

```python
async def main():
    queries = [
        "What's the weather in Tokyo right now?",
        "Give me a 5-day forecast for Paris.",
    ]

    for i, query in enumerate(queries):
        print(f"\n--- Query {i + 1}: {query}")
        result = await app.ainvoke(
            {"messages": [Message.text_message(query, "user")]},
            config={"thread_id": f"session-{i}", "recursion_limit": 10},
        )
        print(f"Answer: {result['messages'][-1].content}")


if __name__ == "__main__":
    asyncio.run(main())
```

---

## Using Google Gemini with Custom Functions

```python
from google import genai
from google.genai import types
import os

google_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


async def gemini_agent(state: AgentState, config: dict) -> ModelResponseConverter:
    """Custom agent node using Google Gemini directly."""

    messages = convert_messages(
        system_prompts=SYSTEM_PROMPT,
        state=state,
    )

    # Separate system message from conversation messages
    system_instruction = None
    contents = []
    for msg in messages:
        if msg["role"] == "system":
            system_instruction = msg["content"]
        else:
            contents.append(msg["content"])

    google_config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.7,
    )

    response = await google_client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=google_config,
    )

    return ModelResponseConverter(response, converter="google")
```

---

## Routing with Loop Prevention

For complex agents that might call many tools, add loop detection:

```python
def safe_route(state: AgentState) -> str:
    """Routing with loop prevention."""
    if not state.context:
        return END

    # Prevent infinite loops: stop after too many tool calls
    tool_call_count = sum(1 for msg in state.context if msg.role == "tool")
    if tool_call_count >= 5:
        return END  # Force stop

    last = state.context[-1]
    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"

    return END
```

---

## Complete Working Code

```python
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

from agentflow.graph import StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.utils.converter import convert_messages
from agentflow.utils.constants import END

load_dotenv()

client = AsyncOpenAI()


def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny, 72°F"


def get_forecast(location: str, days: int = 3) -> str:
    """Get the weather forecast for the next N days."""
    return f"{days}-day forecast for {location}: Mostly sunny, highs around 70°F"


tool_node = ToolNode([get_weather, get_forecast])

SYSTEM_PROMPT = [{"role": "system", "content": (
    "You are a helpful weather assistant. "
    "Use get_weather for current conditions and get_forecast for upcoming days."
)}]


async def main_agent(state: AgentState, config: dict) -> ModelResponseConverter:
    messages = convert_messages(system_prompts=SYSTEM_PROMPT, state=state)

    if state.context and state.context[-1].role == "tool":
        response = await client.chat.completions.create(
            model="gpt-4o", messages=messages
        )
    else:
        tools = await tool_node.all_tools()
        response = await client.chat.completions.create(
            model="gpt-4o", messages=messages, tools=tools
        )

    return ModelResponseConverter(response, converter="openai")


def route(state: AgentState) -> str:
    if not state.context:
        return END
    last = state.context[-1]
    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"
    return END


graph = StateGraph()
graph.add_node("MAIN", main_agent)
graph.add_node("TOOL", tool_node)
graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")
graph.set_entry_point("MAIN")

app = graph.compile(checkpointer=InMemoryCheckpointer())


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("What's the weather in Tokyo?", "user")]},
        config={"thread_id": "demo", "recursion_limit": 10},
    )
    print(result["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main())
```

---

## Next Steps

- **[Dependency Injection](02-dependency-injection.md)** — Inject services and config into node functions with InjectQ
- **[MCP Integration](03-mcp-integration.md)** — Connect to Model Context Protocol servers
- **[Streaming](04-streaming.md)** — Stream tokens in real-time
- **[Unit Testing](05-unit-testing.md)** — Test agents without real LLM calls
