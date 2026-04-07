# Unit Testing Your ReAct Agent

When you build a ReAct agent with Agentflow, you write three kinds of code:

| Your Code | What It Does |
|-----------|-------------|
| **Tool functions** | Business logic — fetch data, call APIs |
| **Routing function** | Conditional logic — when to call tools, when to end |
| **Graph wiring** | Structure — how nodes connect |

The Agentflow framework itself is tested by the library. **You only need to test your code.**

This tutorial shows how to test each layer using Agentflow's built-in testing utilities — no API keys, no network calls, instant feedback.

---

## The Agent We're Testing

We'll use the `production_react/react_sync.py` example. It has two functions worth testing:

```python
# 1. A tool function
def get_weather(
    location: str,
    tool_call_id: str | None = None,  # injected by framework
    state: AgentState | None = None,  # injected by framework
) -> str:
    return f"The weather in {location} is sunny"


# 2. A routing function
def should_use_tools(state: AgentState) -> str:
    if not state.context or len(state.context) == 0:
        return "TOOL"

    last_message = state.context[-1]

    if (
        hasattr(last_message, "tools_calls")
        and last_message.tools_calls
        and len(last_message.tools_calls) > 0
        and last_message.role == "assistant"
    ):
        return "TOOL"

    if last_message.role == "tool":
        return "MAIN"

    return END
```

---

## Before You Start: One Structural Tip

`react_sync.py` runs the graph at the bottom of the file (`app.invoke(...)`). This means you **cannot import from it** without triggering a real LLM call.

The fix is simple — extract your functions into their own module:

```
production_react/
├── tools.py          ← get_weather and other tools
├── routing.py        ← should_use_tools
├── graph.py          ← graph wiring + compile
├── main.py           ← only entry point, calls app.invoke()
└── test_agent.py     ← imports from tools.py and routing.py
```

Your test file then imports cleanly:

```python
from tools import get_weather
from routing import should_use_tools
```

For this tutorial, the functions are defined directly in the test file to keep things self-contained.

---

## Testing Tools: `TestAgent` and `MockToolRegistry`

Agentflow ships a `testing` module with everything you need:

```python
from agentflow.testing import (
    TestAgent,          # Drop-in replacement for Agent — no LLM calls
    MockToolRegistry,   # Tracks which tools were called and with what args
    TestContext,        # Optional: isolated test environment
)
```

---

## 1. Testing Tool Functions

Tool functions are plain Python — test them like any other function.

```python
def test_returns_location_in_response():
    result = get_weather("New York City")
    assert "New York City" in result

def test_returns_weather_description():
    result = get_weather("London")
    assert "sunny" in result.lower()

def test_different_locations_give_different_responses():
    assert get_weather("Paris") != get_weather("Tokyo")
```

### Injectable Parameters Don't Affect Output

Agentflow automatically injects `tool_call_id` and `state` at runtime. Your tests should verify they are accepted but don't alter the return value:

```python
def test_injectable_params_do_not_change_output():
    state = AgentState()
    state.context = [Message.text_message("hello", role="user")]

    without = get_weather("Berlin")
    with_injected = get_weather("Berlin", tool_call_id="call_abc", state=state)

    assert without == with_injected
```

---

## 2. Testing the Routing Function

The routing function is pure logic — it takes a state and returns a string. No graph, no LLM needed.

```python
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END


def test_empty_context_routes_to_tool():
    """No messages yet — default to checking for tools."""
    state = AgentState()
    assert should_use_tools(state) == "TOOL"


def test_assistant_with_tool_calls_routes_to_tool():
    """Agent decided to call a tool — route to TOOL node."""
    state = AgentState()
    msg = Message.text_message("I'll check the weather", role="assistant")
    msg.tools_calls = [{"id": "call_1", "function": {"name": "get_weather"}}]
    state.context = [msg]

    assert should_use_tools(state) == "TOOL"


def test_assistant_without_tool_calls_ends():
    """Agent gave a final answer — conversation is done."""
    state = AgentState()
    msg = Message.text_message("The weather in NYC is sunny.", role="assistant")
    msg.tools_calls = []
    state.context = [msg]

    assert should_use_tools(state) == END


def test_tool_result_routes_back_to_main():
    """Tool ran and returned a result — go back to MAIN for final response."""
    state = AgentState()
    msg = Message.text_message("The weather in NYC is sunny", role="tool")
    state.context = [msg]

    assert should_use_tools(state) == "MAIN"
```

### Test the Full Multi-Turn Sequence

Routing bugs almost always appear at turn boundaries. Test the complete state sequence:

```python
def test_full_turn_last_is_tool_result():
    """user → assistant(tool call) → tool result → routes MAIN."""
    state = AgentState()

    user_msg = Message.text_message("Weather in NYC?", role="user")

    assistant_msg = Message.text_message("Let me check", role="assistant")
    assistant_msg.tools_calls = [{"id": "call_1", "function": {"name": "get_weather"}}]

    tool_msg = Message.text_message("The weather in NYC is sunny", role="tool")

    state.context = [user_msg, assistant_msg, tool_msg]

    assert should_use_tools(state) == "MAIN"


def test_final_answer_after_tool_ends():
    """After tool result, agent gives final answer → END."""
    state = AgentState()

    user_msg = Message.text_message("Weather in NYC?", role="user")
    assistant_msg = Message.text_message("Let me check", role="assistant")
    assistant_msg.tools_calls = [{"id": "call_1", "function": {"name": "get_weather"}}]
    tool_msg = Message.text_message("Sunny", role="tool")
    final_msg = Message.text_message("The weather is sunny!", role="assistant")
    final_msg.tools_calls = []

    state.context = [user_msg, assistant_msg, tool_msg, final_msg]

    assert should_use_tools(state) == END
```

---

## 3. Testing the Graph (End-to-End, No LLM)

Use `TestAgent` to replace the real `Agent`. It returns predefined responses and tracks every call.

```python
import pytest
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.state import AgentState, Message
from agentflow.testing import TestAgent, MockToolRegistry
from agentflow.utils.constants import END


@pytest.mark.asyncio
async def test_graph_executes_and_returns_messages():
    """Graph compiles, runs, and returns a messages dict."""
    mock_tools = MockToolRegistry()
    mock_tools.register(
        "get_weather",
        lambda location, **_: f"The weather in {location} is sunny",
    )
    tool_node = ToolNode(mock_tools.get_tool_list())

    # TestAgent returns a plain text response (no tool calls),
    # so the graph routes to END after one turn.
    test_agent = TestAgent(responses=["The weather in New York City is sunny."])

    graph = StateGraph()
    graph.add_node("MAIN", test_agent)
    graph.add_node("TOOL", tool_node)
    graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
    graph.add_edge("TOOL", "MAIN")
    graph.set_entry_point("MAIN")

    app = graph.compile(checkpointer=InMemoryCheckpointer())
    result = await app.ainvoke(
        {"messages": [Message.text_message("What is the weather in New York City?")]},
        config={"thread_id": "test-001"},
    )

    assert "messages" in result
    assert len(result["messages"]) > 0
    test_agent.assert_called()
```

### Verify Tool Calls via MockToolRegistry

`MockToolRegistry` wraps your functions to track every call:

```python
@pytest.mark.asyncio
async def test_get_weather_callable_through_tool_node():
    """Verify the tool is registered and callable through ToolNode."""
    mock_tools = MockToolRegistry()
    mock_tools.register(
        "get_weather",
        lambda location, **_: get_weather(location),
    )

    tool_node = ToolNode(mock_tools.get_tool_list())
    result = await tool_node.invoke(
        name="get_weather",
        args={"location": "New York City"},
        tool_call_id="call_test_123",
        config={},
        state=AgentState(),
    )

    # Assert the tool was called
    mock_tools.assert_called("get_weather")

    # Assert it was called with the right argument
    mock_tools.assert_called_with("get_weather", location="New York City")

    # Assert the return value is correct
    assert "New York City" in result.text()
    assert "sunny" in result.text().lower()
```

---

## Complete Test File

The full test file lives alongside the example at
`examples/production_react/test_react_sync.py`.

```python
"""Unit tests for the production_react ReAct agent.

Tests cover:
    1. get_weather()       — tool function (pure business logic)
    2. should_use_tools()  — routing / conditional-edge function
    3. Graph flow          — end-to-end wiring using TestAgent (no real LLM)
"""

import pytest

from agentflow.state import AgentState, Message
from agentflow.utils.constants import END


# ── Functions under test (copied from react_sync.py) ──────────────────────

def get_weather(location, tool_call_id=None, state=None):
    return f"The weather in {location} is sunny"


def should_use_tools(state):
    if not state.context or len(state.context) == 0:
        return "TOOL"
    last = state.context[-1]
    if hasattr(last, "tools_calls") and last.tools_calls and last.role == "assistant":
        return "TOOL"
    if last.role == "tool":
        return "MAIN"
    return END


# ── 1. Tool tests ──────────────────────────────────────────────────────────

class TestGetWeather:
    def test_returns_location_in_response(self):
        assert "New York City" in get_weather("New York City")

    def test_returns_weather_description(self):
        assert "sunny" in get_weather("London").lower()

    def test_injectable_params_do_not_change_output(self):
        state = AgentState()
        assert get_weather("Berlin") == get_weather("Berlin", tool_call_id="x", state=state)


# ── 2. Routing tests ───────────────────────────────────────────────────────

class TestShouldUseTools:
    def test_empty_context_routes_to_tool(self):
        assert should_use_tools(AgentState()) == "TOOL"

    def test_assistant_with_tool_calls_routes_to_tool(self):
        state = AgentState()
        msg = Message.text_message("checking", role="assistant")
        msg.tools_calls = [{"id": "c1", "function": {"name": "get_weather"}}]
        state.context = [msg]
        assert should_use_tools(state) == "TOOL"

    def test_assistant_without_tool_calls_ends(self):
        state = AgentState()
        msg = Message.text_message("done", role="assistant")
        msg.tools_calls = []
        state.context = [msg]
        assert should_use_tools(state) == END

    def test_tool_result_routes_back_to_main(self):
        state = AgentState()
        msg = Message.text_message("sunny", role="tool")
        state.context = [msg]
        assert should_use_tools(state) == "MAIN"

    def test_full_sequence_ends_after_final_answer(self):
        state = AgentState()
        u = Message.text_message("weather?", role="user")
        a = Message.text_message("checking", role="assistant")
        a.tools_calls = [{"id": "c1"}]
        t = Message.text_message("sunny", role="tool")
        f = Message.text_message("It is sunny!", role="assistant")
        f.tools_calls = []
        state.context = [u, a, t, f]
        assert should_use_tools(state) == END


# ── 3. Graph flow tests ────────────────────────────────────────────────────

class TestGraphFlow:
    @pytest.mark.asyncio
    async def test_graph_executes_and_returns_messages(self):
        from agentflow.checkpointer import InMemoryCheckpointer
        from agentflow.graph import StateGraph, ToolNode
        from agentflow.testing import TestAgent, MockToolRegistry

        mock_tools = MockToolRegistry()
        mock_tools.register("get_weather", lambda location, **_: get_weather(location))
        tool_node = ToolNode(mock_tools.get_tool_list())
        test_agent = TestAgent(responses=["The weather in NYC is sunny."])

        graph = StateGraph()
        graph.add_node("MAIN", test_agent)
        graph.add_node("TOOL", tool_node)
        graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
        graph.add_edge("TOOL", "MAIN")
        graph.set_entry_point("MAIN")

        app = graph.compile(checkpointer=InMemoryCheckpointer())
        result = await app.ainvoke(
            {"messages": [Message.text_message("Weather in NYC?")]},
            config={"thread_id": "t1"},
        )

        assert "messages" in result
        test_agent.assert_called()

    @pytest.mark.asyncio
    async def test_tool_callable_through_tool_node(self):
        from agentflow.graph import ToolNode
        from agentflow.testing import MockToolRegistry

        mock_tools = MockToolRegistry()
        mock_tools.register("get_weather", lambda location, **_: get_weather(location))
        tool_node = ToolNode(mock_tools.get_tool_list())

        result = await tool_node.invoke(
            name="get_weather",
            args={"location": "NYC"},
            tool_call_id="call_1",
            config={},
            state=AgentState(),
        )

        mock_tools.assert_called("get_weather")
        mock_tools.assert_called_with("get_weather", location="NYC")
        assert "NYC" in result.text()
```

---

## Running the Tests

```bash
# From PyAgenity root
pytest examples/production_react/test_react_sync.py -v

# Run only routing tests
pytest examples/production_react/test_react_sync.py::TestShouldUseTools -v

# Run only tool tests
pytest examples/production_react/test_react_sync.py::TestGetWeather -v
```

---

## What to Test vs. What Not to Test

| Code | Test? | Why |
|------|-------|-----|
| Your tool functions | Yes | Your business logic, most likely to break |
| Your routing function | Yes | Pure logic, easy to test, high bug surface |
| Your graph wiring | Yes, lightly | Catches misconfigured edges |
| `Agent`, `StateGraph`, `ToolNode` | No | Agentflow tests those |
| Real LLM responses | No | Use `TestAgent` — LLM output is non-deterministic |
| Real API calls in tools | No | Mock with `MockToolRegistry` |

---

## Key Testing Utilities

| Utility | Import | Use For |
|---------|--------|---------|
| `TestAgent` | `agentflow.testing` | Replace `Agent` — returns predefined responses |
| `MockToolRegistry` | `agentflow.testing` | Track tool calls and assert arguments |
| `TestContext` | `agentflow.testing` | Isolated graph + store environment |
| `InMemoryCheckpointer` | `agentflow.checkpointer` | Checkpointing without a database |
| `QuickTest` | `agentflow.testing` | One-liner test patterns for common scenarios |

---

## Next Steps

- [Dependency Injection](02-dependency-injection.md) — make your agents more testable with DI
- [MCP Integration](03-mcp-integration.md) — use `MockMCPClient` for MCP tool testing
- [Evaluation](../../Agentflow/evaluation/index.md) — LLM-based evaluation of agent trajectories
