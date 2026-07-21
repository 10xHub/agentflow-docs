---
title: Unit Testing — Testing and evaluation
sidebar_label: Unit Testing
description: How to unit-test AgentFlow agents without LLM API calls using TestAgent, QuickTest, MockToolRegistry, and the agentflow test CLI command.
keywords:
  - agentflow unit testing
  - TestAgent
  - QuickTest
  - MockToolRegistry
  - agentflow test
  - pytest agent
  - mock llm
  - python ai agent framework
---

# Unit Testing

Unit tests for AgentFlow agents verify that the **graph logic, routing, and tool selection** work correctly — without making any real LLM API calls. This keeps tests fast, deterministic, and free of external dependencies.

The `agentflow.qa.testing` module provides three building blocks:

| Class | Purpose |
|---|---|
| `TestAgent` | Drops into any graph node; returns predefined responses |
| `QuickTest` | One-liner factory methods for common test scenarios |
| `MockToolRegistry` | Registers mock tools and tracks every invocation |
| `TestResult` | Fluent assertions on the graph output |

The `agentflow test` CLI wraps pytest so you can run these tests with a single command.

---

## Installation

```bash
pip install pytest pytest-asyncio
```

`agentflow.qa` is included with `10xscale-agentflow` — no extra install needed.

---

## TestAgent

`TestAgent` is a drop-in replacement for `Agent`. It accepts the same constructor arguments but never calls an LLM. Instead it cycles through a list of predefined responses.

### Basic usage

```python
from agentflow.qa.testing import TestAgent
from agentflow.core.graph import StateGraph
from agentflow.utils.constants import END

test_agent = TestAgent(
    model="test-model",
    responses=["The weather in London is sunny."],
)

graph = StateGraph()
graph.add_node("MAIN", test_agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)
app = graph.compile()
```

### Override a node in an existing graph

```python
from agentflow.qa.testing import TestAgent

test_agent = TestAgent(responses=["Mocked response"])
graph.override_node("MAIN", test_agent)
app = graph.compile()
```

This is the pattern to use when you have a production graph in a separate module and want to swap out only the agent node.

### Multiple responses

When an agent is called more than once (for example in a ReAct loop), `TestAgent` cycles through the `responses` list:

```python
agent = TestAgent(responses=["Calling tool...", "Final answer here"])
# First invoke → "Calling tool..."
# Second invoke → "Final answer here"
# Third invoke → "Calling tool..." (wraps around)
```

### Simulating tool calls

Pass `simulate_tool_calls=True` together with a `tools` list. The first call returns a tool-call message; subsequent calls return the predefined responses.

```python
agent = TestAgent(
    responses=["It is 22°C in London."],
    tools=["get_weather"],
    simulate_tool_calls=True,
)
```

### Assertion helpers

```python
# Assert the agent was called at least once
agent.assert_called()

# Assert exact call count
agent.assert_called_times(2)

# Assert never called
agent.assert_not_called()

# Inspect the last prompt sent to the agent
messages = agent.get_last_messages()

# Reset between test cases
agent.reset()
```

---

## QuickTest

`QuickTest` removes the boilerplate of building a graph, compiling it, and invoking it. Every method returns a `TestResult`.

All `QuickTest` methods are async — use `pytest-asyncio` or `asyncio.run()`.

### Single-turn test

```python
import pytest
from agentflow.qa.testing import QuickTest


@pytest.mark.asyncio
async def test_greeting():
    result = await QuickTest.single_turn(
        agent_response="Hello! How can I help?",
        user_message="Hi",
    )
    result.assert_contains("Hello")
```

### Multi-turn conversation

```python
@pytest.mark.asyncio
async def test_conversation():
    result = await QuickTest.multi_turn(
        conversation=[
            ("Hello", "Hi there!"),
            ("What can you do?", "I can answer questions."),
        ]
    )
    result.assert_contains("answer questions")
```

### Test with tool calls

```python
@pytest.mark.asyncio
async def test_weather_tool():
    result = await QuickTest.with_tools(
        query="What is the weather in London?",
        response="It is 22°C in London.",
        tools=["get_weather"],
        tool_responses={"get_weather": "22°C"},
    )
    result.assert_tool_called("get_weather")
    result.assert_contains("22°C")
```

### Custom graph

```python
@pytest.mark.asyncio
async def test_custom_graph():
    from agentflow.qa.testing import TestAgent

    agent = TestAgent(responses=["Done"])
    result = await QuickTest.custom(
        agent=agent,
        user_message="Run the task",
    )
    result.assert_contains("Done")
    agent.assert_called_times(1)
```

---

## MockToolRegistry

Use `MockToolRegistry` when you want to verify tool calls with full control over the mock implementations.

```python
from agentflow.qa.testing import MockToolRegistry
from agentflow.core.graph import ToolNode

tools = MockToolRegistry()

tools.register("get_weather", lambda city: f"22°C in {city}")
tools.register("send_email", lambda to, body: "Sent")

tool_node = ToolNode(tools.get_tool_list())
```

After running the graph:

```python
# Boolean check
assert tools.was_called("get_weather")

# Call count
assert tools.call_count("send_email") == 1

# Full call history
calls = tools.get_calls("get_weather")
assert calls[0]["kwargs"]["city"] == "London"

# Last call only
last = tools.get_last_call("get_weather")

# Fluent assertions
tools.assert_called("get_weather")
tools.assert_called_with("get_weather", city="London")
tools.assert_call_count("send_email", 1)
```

### Async tools

```python
tools.register_async("search_web", async_search_func)
```

### Reset between tests

```python
# Clear call history, keep registered functions
tools.reset()

# Full reset: clear functions and history
tools.clear()
```

---

## TestResult

Every `QuickTest` method returns a `TestResult`. Its methods all return `self` for chaining.

```python
result = await QuickTest.single_turn(
    agent_response="The capital of France is Paris.",
    user_message="What is the capital of France?",
)

(
    result
    .assert_contains("Paris")
    .assert_not_contains("London")
    .assert_no_errors()
)
```

| Method | What it checks |
|---|---|
| `assert_contains(text)` | Final response contains `text` |
| `assert_not_contains(text)` | Final response does not contain `text` |
| `assert_equals(expected)` | Final response equals `expected` exactly |
| `assert_tool_called(name, **kwargs)` | Tool `name` was called; optionally with specific kwargs |
| `assert_tool_not_called(name)` | Tool `name` was not called |
| `assert_message_count(n)` | Total messages in the conversation equals `n` |
| `assert_no_errors()` | No error messages in the conversation |

The `final_response`, `messages`, `tool_calls`, and `state` attributes are also available for custom assertions.

---

## agentflow test CLI

`agentflow test` is a thin pytest wrapper. It reads optional defaults from `agentflow.json` and forwards any extra arguments straight to pytest.

```bash
# Run all tests (pytest auto-discovery)
agentflow test

# Target a specific path
agentflow test tests/unit

# Run with coverage
agentflow test --coverage

# Open the HTML coverage report automatically
agentflow test --coverage --html

# Filter by keyword
agentflow test -k "weather"

# Pass raw pytest flags
agentflow test -- -m "not integration" --tb=short
```

### agentflow.json configuration

```json
{
  "agent": "graph.react:app",
  "test": {
    "path": "tests",
    "coverage": true,
    "coverage_threshold": 80
  }
}
```

| Field | Description |
|---|---|
| `path` | Default path when no `PATH` argument is given |
| `coverage` | Enable coverage on every run |
| `coverage_threshold` | Minimum coverage %; run fails if coverage drops below this |

A bare `agentflow test` with the above config is equivalent to:

```bash
agentflow test tests --coverage -- --cov-fail-under=80
```

### CI example

```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: agentflow test --coverage
```

Set `coverage_threshold` in `agentflow.json` — no extra flags needed in the workflow.

---

## Complete pytest example

```python
# tests/unit/test_weather_agent.py
import pytest
from agentflow.qa.testing import MockToolRegistry, QuickTest, TestAgent
from agentflow.core.graph import StateGraph, ToolNode
from agentflow.utils.constants import END


@pytest.mark.asyncio
async def test_weather_query_routes_to_tool():
    tools = MockToolRegistry()
    tools.register("get_weather", lambda city: "22°C")

    agent = TestAgent(
        responses=["The weather is 22°C."],
        tools=tools.get_tool_list(),
        simulate_tool_calls=True,
    )

    graph = StateGraph()
    graph.add_node("MAIN", agent)
    graph.add_node("TOOL", ToolNode(tools.get_tool_list()))
    graph.set_entry_point("MAIN")

    def route(state):
        last = state.context[-1] if state.context else None
        if last and getattr(last, "tools_calls", None):
            return "TOOL"
        return END

    graph.add_conditional_edges("MAIN", route, {"TOOL": "TOOL", END: END})
    graph.add_edge("TOOL", "MAIN")

    from agentflow.core.state import Message
    app = graph.compile()
    result = await app.ainvoke({"messages": [Message.text_message("Weather in London?")]})

    tools.assert_called("get_weather")
    agent.assert_called_times(2)  # once for tool call, once for final response


@pytest.mark.asyncio
async def test_single_turn_quick():
    result = await QuickTest.single_turn(
        agent_response="Paris is the capital of France.",
        user_message="Capital of France?",
    )
    result.assert_contains("Paris")
```

---

## Further reading

- [How to run tests with agentflow test](../../how-to/api-cli/run-tests.md)
- [Evaluation guide](../evaluation/index.md) — for scoring real agent behaviour
