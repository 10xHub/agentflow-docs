---
title: Testing
description: TestAgent, QuickTest, TestResult, MockMCPClient — test agentflow graphs without making LLM API calls.
sidebar_position: 11
---

# Testing

## When to use this

Use the testing utilities to write fast, deterministic unit and integration tests for your graphs. `TestAgent` replaces `Agent` with a mock that returns pre-defined responses, so your tests never hit the LLM API.

## Import paths

```python
from agentflow.qa.testing import (
    TestAgent,
    QuickTest,
    TestResult,
    MockMCPClient,
    MockToolRegistry,
    InMemoryStore,
)
```

---

## `TestAgent`

A drop-in replacement for `Agent` that returns predefined responses in order.

```python
from agentflow.qa.testing import TestAgent

agent = TestAgent(
    model="test-model",
    responses=["Hello from the test agent!", "How can I help?"],
)
```

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | `"test-model"` | Model identifier string (unused — for API compatibility only). |
| `responses` | `list[str \| dict]` | `[]` | Predefined responses returned in sequence. Each invocation consumes the next item. |
| `system_prompt` | `list[dict] \| None` | `None` | Accepted for API compatibility. Not used. |
| `**kwargs` | any | — | All other `Agent` constructor kwargs are accepted and silently ignored. |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `call_count` | `int` | Number of times the agent was invoked. |
| `call_history` | `list[dict]` | Details of each invocation (state, config). |

### Tool call simulation

Pass raw tool call dicts in the responses list to simulate the agent calling a tool:

```python
agent = TestAgent(
    responses=[
        {
            "content": "",
            "tools_calls": [{
                "id": "call_abc",
                "function": {
                    "name": "get_weather",
                    "arguments": {"location": "London"},
                },
            }],
        },
        "The weather in London is sunny and 22°C.",
    ]
)
```

### Using in a graph

```python
from agentflow.core.graph import StateGraph, ToolNode
from agentflow.qa.testing import TestAgent
from agentflow.utils import START, END

test_agent = TestAgent(responses=["Hello!"])

graph = StateGraph()
graph.add_node("MAIN", test_agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

app = graph.compile()
result = await app.ainvoke({"messages": [Message.text_message("Hi")]})
```

---

## `QuickTest`

High-level helper that builds, compiles, and runs a graph in one call. Reduces test boilerplate from 20 lines to 3.

```python
from agentflow.qa.testing import QuickTest

result = await QuickTest.single_turn(
    agent_response="Hello! How can I help?",
    user_message="Hi there",
)
result.assert_contains("Hello")
```

### `QuickTest.single_turn`

```python
result = await QuickTest.single_turn(
    agent_response="The capital is Paris.",
    user_message="What is the capital of France?",
    model="test-model",
    config={"thread_id": "test-1"},
)
```

Builds a one-node `TestAgent → END` graph and runs one turn. Returns `TestResult`.

### `QuickTest.multi_turn`

```python
result = await QuickTest.multi_turn(
    conversation=[
        ("Hello", "Hi there!"),
        ("What can you do?", "I can answer questions."),
        ("Tell me a joke", "Why did the chicken cross the road?"),
    ],
)
result.assert_contains("chicken")
```

Builds a one-node graph and replays each turn in sequence, accumulating messages in state. Returns the `TestResult` from the final turn.

### `QuickTest.with_tools`

```python
result = await QuickTest.with_tools(
    query="What's the weather in Paris?",
    response="It's sunny and 22°C in Paris.",
    tools=["get_weather"],
)
result.assert_tool_called("get_weather")
```

Builds a `TestAgent → ToolNode → TestAgent → END` pattern and verifies tools were invoked. Returns `TestResult`.

---

## `TestResult`

Returned by `QuickTest` and wraps the raw graph output with assertion helpers.

```python
result.assert_contains("Hello")
result.assert_not_contains("Error")
result.assert_equals("Exact expected response")
result.assert_tool_called("get_weather")
result.assert_tool_called("search", query="weather")   # with arg check
result.assert_tool_not_called("send_email")
result.assert_message_count(3)
result.assert_no_errors()
```

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `final_response` | `str` | The last text response from the agent. |
| `messages` | `list[Message]` | All messages from the run. |
| `tool_calls` | `list[dict]` | All tool calls made during the run. |
| `state` | `dict` | Full output dict from `ainvoke()`. |
| `passed` | `bool` | `True` unless an assertion has failed. |

### Methods

| Method | Description |
|---|---|
| `assert_contains(text)` | `final_response` must contain `text`. |
| `assert_not_contains(text)` | `final_response` must NOT contain `text`. |
| `assert_equals(expected)` | `final_response` must equal `expected` exactly. |
| `assert_tool_called(name, **args)` | A tool with `name` must have been called. Pass `**args` to also check argument values. |
| `assert_tool_not_called(name)` | A tool with `name` must NOT have been called. |
| `assert_message_count(n)` | Total message count must equal `n`. |
| `assert_no_errors()` | No `ErrorBlock` in any message. |

All assertion methods return `self` for chaining.

---

## `MockMCPClient`

Fake MCP client for testing nodes that use MCP tools.

```python
from agentflow.qa.testing import MockMCPClient

mock_mcp = MockMCPClient()
mock_mcp.add_tool(
    name="search_docs",
    description="Search the documentation",
    parameters={"query": {"type": "string", "description": "Search query"}},
    handler=lambda query: f"Found results for: {query}",
)

tools = ToolNode(client=mock_mcp)
graph.add_node("TOOL", tools)
```

---

## `MockToolRegistry`

Tracks which tools were called and with what arguments. Useful for asserting tool behaviour in integration tests.

```python
from agentflow.qa.testing import MockToolRegistry

registry = MockToolRegistry()
registry.register("get_weather", lambda location: f"Sunny in {location}")
registry.register("search", lambda q: [{"title": "Result", "url": "http://..."}])

tools = ToolNode(list(registry.funcs.values()))

# ... run the graph ...

assert registry.was_called("get_weather")
assert registry.get_call_count("get_weather") == 1
args = registry.get_last_args("get_weather")
assert args["location"] == "London"
```

---

## `InMemoryStore` (testing)

A lightweight in-memory `BaseStore` for tests that need memory functionality without a real vector database.

```python
from agentflow.qa.testing import InMemoryStore

store = InMemoryStore()
app = graph.compile(store=store)
```

Stores memories in a Python dict. Similarity search returns all stored memories sorted by insertion order (no embeddings). For tests that only care about whether memories are stored and retrieved.

---

## Full test example

```python
import pytest
from agentflow.core.graph import StateGraph, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.qa.testing import TestAgent, TestResult, QuickTest
from agentflow.utils import END


@pytest.mark.asyncio
async def test_single_response():
    result = await QuickTest.single_turn(
        agent_response="The capital of France is Paris.",
        user_message="What is the capital of France?",
    )
    result.assert_contains("Paris")


@pytest.mark.asyncio
async def test_tool_call_path():
    """Verify the agent calls the weather tool."""
    result = await QuickTest.with_tools(
        query="What's the weather in Tokyo?",
        response="It's rainy and 18°C in Tokyo.",
        tools=["get_weather"],
    )
    result.assert_tool_called("get_weather")
    result.assert_contains("Tokyo")


@pytest.mark.asyncio
async def test_custom_state_preserved():
    """Verify custom state fields survive a round-trip."""
    from agentflow.utils import ResponseGranularity
    from pydantic import Field

    class CustomerState(AgentState):
        customer_id: str = ""

    agent = TestAgent(responses=["Done processing order."])
    graph = StateGraph(CustomerState(customer_id="CUST-001"))
    graph.add_node("MAIN", agent)
    graph.set_entry_point("MAIN")
    graph.add_edge("MAIN", END)

    app = graph.compile()
    result = await app.ainvoke(
        {"messages": [Message.text_message("Process my order")]},
        response_granularity=ResponseGranularity.FULL,
    )

    state: CustomerState = result["state"]
    assert state.customer_id == "CUST-001"
```
