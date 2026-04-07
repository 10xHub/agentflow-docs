# Testing Utilities

AgentFlow provides comprehensive testing utilities to make unit and integration testing of agents fast, predictable, and easy.

## Why Special Testing Utilities?

Testing AI agents presents unique challenges:

- **LLM API calls are slow and expensive** - You don't want to call real LLMs in every test
- **Responses are non-deterministic** - Same input can produce different outputs
- **Complex setup** - Graphs, nodes, tools, state management requires boilerplate
- **Tool integration testing** - Need to mock MCP servers, external APIs

AgentFlow's testing module solves these problems with:

1. **TestAgent** - Mock agent that returns predefined responses (no API calls)
2. **QuickTest** - One-liner tests for common patterns
3. **TestContext** - Isolated test environments with automatic cleanup
4. **Mock Tools** - MockToolRegistry, MockMCPClient for tool testing
5. **TestResult** - Chainable assertions for fluent test writing

---

## Quick Start

### Simple Unit Test

```python
from agentflow.testing import TestAgent, QuickTest

# Test a single interaction
result = await QuickTest.single_turn(
    agent_response="Hello! How can I help you today?",
    user_message="Hi there",
)

# Chain assertions
result.assert_contains("help").assert_not_contains("error")
```

### Test Your Graph

```python
from agentflow.testing import TestAgent, TestContext
from agentflow.utils.constants import END

# Use TestContext for isolated setup
with TestContext() as ctx:
    # Create graph
    graph = ctx.create_graph()

    # Add test agent (no real LLM calls!)
    test_agent = ctx.create_test_agent(
        responses=["Hi! I'm a weather assistant."]
    )
    graph.add_node("MAIN", test_agent)
    graph.set_entry_point("MAIN")
    graph.add_edge("MAIN", END)

    # Compile and test
    compiled = graph.compile()
    result = await compiled.ainvoke({"messages": [...]})

    # Assertions
    test_agent.assert_called()
    assert "weather assistant" in result["messages"][-1].text()
```

---

## Core Components

### TestAgent

Mock agent that returns predefined responses without calling LLMs:

```python
from agentflow.testing import TestAgent

# Create test agent
test_agent = TestAgent(
    model="test-model",  # For compatibility
    responses=["Response 1", "Response 2", "Response 3"],  # Cycles through
)

# Use in graph (drop-in replacement for Agent)
graph.add_node("MAIN", test_agent)

# After running
test_agent.assert_called()
test_agent.assert_called_times(3)
assert "Response 1" in test_agent.get_last_messages()
```

**Features:**
- Returns predefined responses (cycles through list)
- Tracks call count and call history
- Built-in assertion helpers
- Compatible with Agent interface

[Learn more →](test-agent.md)

### QuickTest

One-liner tests for common patterns:

```python
from agentflow.testing import QuickTest

# Single turn
result = await QuickTest.single_turn(
    agent_response="Hello!",
    user_message="Hi",
)
result.assert_contains("Hello!")

# Multi-turn conversation
result = await QuickTest.multi_turn(
    [
        ("Hello", "Hi there!"),
        ("How are you?", "Great!"),
    ]
)

# With tools
result = await QuickTest.with_tools(
    query="Weather in NYC?",
    response="It's sunny!",
    tools=["get_weather"],
)
result.assert_tool_called("get_weather")
```

[Learn more →](quick-test.md)

### TestContext

Isolated test environment with automatic cleanup:

```python
from agentflow.testing import TestContext

with TestContext() as ctx:
    # Get isolated container and store
    graph = ctx.create_graph()
    agent = ctx.create_test_agent(responses=["Test response"])

    # Register mock tools
    ctx.register_mock_tool("get_weather", lambda city: f"Sunny in {city}")

    # ... run tests

# Automatic cleanup when exiting context
```

[Learn more →](test-context.md)

### TestResult

Chainable assertion interface for fluent test writing:

```python
result = await QuickTest.single_turn(
    agent_response="The weather in NYC is sunny, 72°F",
    user_message="Weather in NYC?",
)

# Chain assertions
(result
    .assert_contains("sunny")
    .assert_contains("NYC")
    .assert_not_contains("error")
    .assert_no_errors())
```

**Available assertions:**
- `assert_contains(text)` - Response contains text
- `assert_not_contains(text)` - Response doesn't contain text
- `assert_equals(expected)` - Exact match
- `assert_tool_called(name, **args)` - Tool was called
- `assert_tool_not_called(name)` - Tool was NOT called
- `assert_message_count(n)` - Number of messages
- `assert_no_errors()` - No error messages

[Learn more →](test-result.md)

### Mock Tools

Test tool integrations without real APIs:

```python
from agentflow.testing import MockToolRegistry, MockMCPClient

# Mock tool registry
tools = MockToolRegistry()
tools.register("get_weather", lambda city: f"Sunny in {city}")

# After test
assert tools.was_called("get_weather")
assert tools.call_count("get_weather") == 2
args = tools.last_call_args("get_weather")

# Mock MCP client
mock_mcp = MockMCPClient()
mock_mcp.add_tool(
    name="mcp_weather",
    description="Get weather",
    parameters={"city": {"type": "string"}},
    handler=lambda city: f"Weather in {city}: Sunny",
)

# Use in ToolNode
from agentflow.graph import ToolNode
tool_node = ToolNode([], client=mock_mcp)
```

[Learn more →](mock-tools.md)

---

## Common Patterns

### Testing Agent Responses

```python
from agentflow.testing import TestAgent
from agentflow.graph import StateGraph
from agentflow.utils.constants import END

# Create test agent with multiple responses
agent = TestAgent(responses=["Response 1", "Response 2"])

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

compiled = graph.compile()

# First call
result1 = await compiled.ainvoke({"messages": [...]})
assert "Response 1" in result1["messages"][-1].text()

# Second call (cycles to next response)
result2 = await compiled.ainvoke({"messages": [...]})
assert "Response 2" in result2["messages"][-1].text()

# Verify call count
agent.assert_called_times(2)
```

### Testing Tool Integration

```python
from agentflow.testing import QuickTest

result = await QuickTest.with_tools(
    query="What's the weather in Tokyo?",
    response="It's sunny in Tokyo, 72°F",
    tools=["get_weather"],
    tool_responses={"get_weather": "Sunny, 72°F"},
)

result.assert_tool_called("get_weather")
result.assert_contains("sunny")
```

### Testing Multi-Agent Systems

```python
from agentflow.testing import TestAgent, TestContext
from agentflow.graph import StateGraph
from agentflow.utils.constants import END

with TestContext() as ctx:
    graph = ctx.create_graph()

    # Create multiple test agents
    agent1 = ctx.create_test_agent(responses=["Response from Agent 1"])
    agent2 = ctx.create_test_agent(responses=["Response from Agent 2"])

    graph.add_node("AGENT1", agent1)
    graph.add_node("AGENT2", agent2)
    graph.set_entry_point("AGENT1")
    graph.add_edge("AGENT1", "AGENT2")
    graph.add_edge("AGENT2", END)

    compiled = graph.compile()
    result = await compiled.ainvoke({"messages": [...]})

    # Verify both agents were called
    agent1.assert_called()
    agent2.assert_called()
```

---

## Testing vs Evaluation

| Feature | Testing Module | Evaluation Module |
|---------|---------------|-------------------|
| **Purpose** | Unit/integration tests | Quality assurance |
| **Speed** | Fast (mocked LLMs) | Slower (real LLM calls) |
| **Use Case** | Development, CI/CD | Regression testing, validation |
| **Tools** | TestAgent, QuickTest | AgentEvaluator, QuickEval |
| **Output** | Pass/fail assertions | Detailed reports with scores |

**Use testing for:**
- Fast unit tests during development
- CI/CD pipelines
- Testing code logic and graph structure
- Mocking external dependencies

**Use evaluation for:**
- Testing actual LLM behavior
- Regression testing with real APIs
- Quality benchmarking
- Multi-criteria assessment

---

## Installation

Testing utilities are included in the core AgentFlow package:

```bash
pip install 10xscale-agentflow
```

---

## Documentation Guide

| Topic | Description |
|-------|-------------|
| [TestAgent](test-agent.md) | Mock agent for predictable testing |
| [QuickTest](quick-test.md) | One-liner test patterns |
| [TestContext](test-context.md) | Isolated test environments |
| [TestResult](test-result.md) | Chainable assertions |
| [Mock Tools](mock-tools.md) | Mocking tool integrations |

---

## Next Steps

- Start with [TestAgent Guide](test-agent.md)
- Learn [QuickTest Patterns](quick-test.md)
- Combine with [Agent Evaluation](../evaluation/index.md) for comprehensive testing
