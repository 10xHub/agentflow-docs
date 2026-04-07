# Testing Quickstart

Get started with AgentFlow testing in 5 minutes.

## Install

```bash
pip install 10xscale-agentflow
```

## Your First Test (3 Lines!)

```python
from agentflow.testing import QuickTest

# Test a single user-agent interaction
result = await QuickTest.single_turn(
    agent_response="Hello! How can I help you today?",
    user_message="Hi there",
)

# Fluent assertions
result.assert_contains("help")
```

That's it! No graph setup, no LLM calls, just fast tests.

---

## Testing Your Agent Graph

### Step 1: Replace Agent with TestAgent

```python
from agentflow.testing import TestAgent
from agentflow.graph import StateGraph
from agentflow.utils.constants import END

# Create test agent (no real LLM calls!)
test_agent = TestAgent(
    model="test-model",
    responses=["I'm a helpful assistant!"],
)

# Build graph
graph = StateGraph()
graph.add_node("MAIN", test_agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

# Compile and test
compiled = graph.compile()
```

### Step 2: Run and Assert

```python
from agentflow.state import Message

result = await compiled.ainvoke({
    "messages": [Message.text_message("Hello")]
})

# Check response
assert "helpful assistant" in result["messages"][-1].text()

# Verify agent was called
test_agent.assert_called()
test_agent.assert_called_times(1)
```

---

## Common Test Patterns

### Test Multiple Responses

TestAgent cycles through a list of responses:

```python
test_agent = TestAgent(responses=[
    "First response",
    "Second response",
    "Third response",
])

# Each call gets the next response
result1 = await compiled.ainvoke(...)  # "First response"
result2 = await compiled.ainvoke(...)  # "Second response"
result3 = await compiled.ainvoke(...)  # "Third response"
result4 = await compiled.ainvoke(...)  # "First response" (cycles)
```

### Test Multi-Turn Conversations

```python
result = await QuickTest.multi_turn([
    ("Hello", "Hi! How can I help?"),
    ("What's the weather?", "Which city?"),
    ("Tokyo", "It's sunny in Tokyo!"),
])

result.assert_contains("sunny")
result.assert_message_count(6)  # 3 user + 3 assistant
```

### Test Tool Usage

```python
result = await QuickTest.with_tools(
    query="What's the weather in NYC?",
    response="It's sunny in NYC, 72°F",
    tools=["get_weather"],
)

result.assert_tool_called("get_weather")
result.assert_contains("sunny")
```

---

## Using TestContext (Recommended)

TestContext provides isolated test environments with automatic cleanup:

```python
from agentflow.testing import TestContext

def test_my_agent():
    with TestContext() as ctx:
        # Everything is isolated and auto-cleaned up
        graph = ctx.create_graph()
        agent = ctx.create_test_agent(responses=["Test response"])

        graph.add_node("MAIN", agent)
        graph.set_entry_point("MAIN")
        graph.add_edge("MAIN", END)

        compiled = graph.compile()
        result = await compiled.ainvoke({"messages": [...]})

        assert "Test response" in result["messages"][-1].text()

    # Automatic cleanup happens here
```

---

## Pytest Integration

### Basic Test

```python
import pytest
from agentflow.testing import TestAgent, QuickTest

@pytest.mark.asyncio
async def test_greeting():
    result = await QuickTest.single_turn(
        agent_response="Hello!",
        user_message="Hi",
    )
    result.assert_contains("Hello!")
```

### Fixture Pattern

```python
import pytest
from agentflow.testing import TestAgent, TestContext

@pytest.fixture
async def test_graph():
    with TestContext() as ctx:
        graph = ctx.create_graph()
        agent = ctx.create_test_agent(responses=["Test response"])
        graph.add_node("MAIN", agent)
        graph.set_entry_point("MAIN")
        graph.add_edge("MAIN", END)
        yield graph.compile()

@pytest.mark.asyncio
async def test_my_agent(test_graph):
    result = await test_graph.ainvoke({"messages": [...]})
    assert "Test response" in result["messages"][-1].text()
```

---

## Testing vs Evaluation

**Use Testing for:**
- ✅ Fast unit tests (no LLM calls)
- ✅ CI/CD pipelines
- ✅ Testing code logic and graph structure
- ✅ Development iterations

**Use Evaluation for:**
- ✅ Testing actual LLM behavior
- ✅ Regression testing with real APIs
- ✅ Quality benchmarking
- ✅ Multi-criteria assessment

```python
# Testing (fast, mocked)
from agentflow.testing import QuickTest
result = await QuickTest.single_turn(...)

# Evaluation (slower, real LLMs)
from agentflow.evaluation import QuickEval
report = await QuickEval.check(graph=compiled_graph, ...)
```

---

## Real Example from AgentFlow Codebase

From `pyagenity/examples/evaluation/quick_eval_example.py`:

```python
from agentflow.testing import TestAgent
from agentflow.graph import StateGraph
from agentflow.utils.constants import END

def create_test_graph():
    """Create a simple test graph for examples."""
    agent = TestAgent(
        model="test-model",
        responses=[
            "Hi there! How can I help?",
            "The weather is sunny and 72°F",
            "You're welcome!",
        ],
    )

    graph = StateGraph()
    graph.add_node("MAIN", agent)
    graph.set_entry_point("MAIN")
    graph.add_edge("MAIN", END)

    return graph.compile()

# Use in tests
compiled = create_test_graph()
result = await compiled.ainvoke({"messages": [...]})
```

---

## Next Steps

- Learn about [TestAgent](test-agent.md) in detail
- Explore [QuickTest patterns](quick-test.md)
- Set up [TestContext](test-context.md) for isolation
- Use [Mock Tools](mock-tools.md) for integration testing
- Combine with [Evaluation](../evaluation/index.md) for full coverage
