---
title: "Test and evaluate"
description: "Write unit tests with mocked models and run evaluations against your agent without live API calls."
updated: "2026-10-08"
order: 110
group: "Tutorial"
section: "Get started"
---

Before deploying an agent to production, you need confidence in its behavior across different inputs and edge cases. Unlike traditional software, agent behavior can be unpredictable because it depends on the LLM's responses. 10xGraph provides two complementary testing approaches: **unit tests** that verify behavior with mocked LLM responses, and **evaluations** that assess your agent on curated datasets. Unit tests let you catch graph logic errors and routing issues quickly without API calls. Evaluations measure how well your agent performs on real-world scenarios and help you catch regressions when you update the prompt or agent logic. In this step, you will write a unit test for the agent from the previous steps and run a small evaluation set to measure its quality.

## Unit tests with a mocked model

In unit tests, you replace the real LLM with a `TestAgent` that returns predetermined responses. This lets you test your graph logic, tool calls, and routing without making API calls.

### Write a unit test

Create a test file in your project directory:

```python
# test_agent.py
import pytest
from tenxgraph.core.graph import StateGraph
from tenxgraph.core.state import Message
from tenxgraph.qa.testing import TestAgent
from tenxgraph.utils.constants import END


@pytest.mark.asyncio
async def test_agent_responds():
    """Test that the agent can respond to a simple message."""
    # Create a TestAgent with predefined responses
    test_agent = TestAgent(
        model="test-model",
        responses=["Hello! I'm ready to help you get the weather."]
    )

    # Build a simple graph with the test agent
    graph = StateGraph()
    graph.add_node("MAIN", test_agent)
    graph.set_entry_point("MAIN")
    graph.add_edge("MAIN", END)

    # Compile and run
    compiled = graph.compile()
    result = await compiled.ainvoke(
        {"messages": [Message.text_message("Say hello")]},
        config={}
    )

    # Assert the response contains expected text
    messages = result.get("messages", [])
    last_message = messages[-1] if messages else None
    response_text = last_message.text() if hasattr(last_message, "text") else ""
    assert "Hello" in response_text
```

Run the test:

```bash
pytest test_agent.py -v
```

**Expected output:**

```
test_agent.py::test_agent_responds PASSED
```

### Use QuickTest for rapid testing

For common patterns, the `QuickTest` class provides simplified one-liner assertions:

```python
# test_agent.py (expanded)
from tenxgraph.qa.testing import QuickTest


@pytest.mark.asyncio
async def test_single_turn():
    """Test a single user-agent turn."""
    result = await QuickTest.single_turn(
        user_message="What's the weather?",
        agent_response="I'll check the weather for you."
    )
    result.assert_contains("weather")
    result.assert_message_count(1)


@pytest.mark.asyncio
async def test_multi_turn():
    """Test a multi-turn conversation."""
    result = await QuickTest.multi_turn(
        conversation=[
            ("Hi", "Hello there!"),
            ("How are you?", "I'm doing great!"),
        ]
    )
    result.assert_contains("great")
```

Run all tests:

```bash
pytest test_agent.py -v
```

**Expected output:**

```
test_agent.py::test_single_turn PASSED
test_agent.py::test_multi_turn PASSED
```

### Test tool calls

If your agent calls tools, use `QuickTest.with_tools` to mock tool execution:

```python
@pytest.mark.asyncio
async def test_tool_call():
    """Test that the agent calls a tool."""
    result = await QuickTest.with_tools(
        query="What's the weather in NYC?",
        response="It's sunny in New York today.",
        tools=["get_weather"],
        tool_responses={"get_weather": "Sunny, 72°F"}
    )
    result.assert_tool_called("get_weather")
    result.assert_contains("sunny")
```

### TestAgent in your own graph

You can also swap out a real Agent node with a TestAgent in an existing graph to isolate the parts you're testing:

```python
from tenxgraph.qa.testing import TestAgent, TestContext

@pytest.mark.asyncio
async def test_with_context():
    """Test using TestContext for setup."""
    with TestContext() as ctx:
        # Create a test agent
        test_agent = ctx.create_test_agent(
            responses=["Test response from agent"]
        )

        # Build a graph
        graph = ctx.create_graph()
        graph.add_node("MAIN", test_agent)
        graph.set_entry_point("MAIN")
        graph.add_edge("MAIN", END)

        # Run and assert
        compiled = graph.compile()
        result = await compiled.ainvoke(
            {"messages": [Message.text_message("Test")]},
            config={}
        )

        # Verify the agent was called
        test_agent.assert_called()
        assert test_agent.call_count == 1
```

## Evaluate on a dataset

Unit tests verify individual behaviors with predefined LLM responses. **Evaluations** assess your agent across a curated dataset of inputs with expected outcomes, using real or mocked LLM calls. Evaluations measure quality metrics like response accuracy, tool usage correctness, and semantic similarity to expected answers. This helps you catch regressions, measure improvements, and set quality thresholds before deploying changes.

### Create an evaluation file

Evaluations in 10xGraph are defined in Python files ending with `_eval.py`. Create a new file:

```python
# weather_agent_eval.py
from tenxgraph.qa.evaluation import (
    EvalCase,
    EvalConfig,
    EvalSet,
    CriterionConfig,
    ToolCall,
)


# Define a few test cases using the factory methods
eval_cases = [
    EvalCase.single_turn(
        eval_id="weather-1",
        user_query="Weather in NYC",
        expected_response="New York",
        description="Should mention the city name"
    ),
    EvalCase.single_turn(
        eval_id="weather-2",
        user_query="Is it raining?",
        expected_response="weather",
        expected_tools=[ToolCall(name="get_weather")],
        description="Should call weather tool"
    ),
    EvalCase.single_turn(
        eval_id="weather-3",
        user_query="Hello",
        expected_response="hi",
        description="Should respond to a greeting"
    ),
]


# Create an evaluation set
eval_set = EvalSet(
    eval_set_id="weather-agent-basic",
    name="Basic Weather Agent Tests",
    description="Simple tests for weather querying",
    eval_cases=eval_cases
)


# Optionally define evaluation configuration
def eval_config() -> EvalConfig:
    """Configure how the evaluation runs."""
    return EvalConfig(
        criteria=[
            CriterionConfig(
                name="response_match",
                weight=0.7
            ),
            CriterionConfig(
                name="tool_name_match",
                weight=0.3
            )
        ]
    )
```

### Run the evaluation

Use the `10xgraph eval` command to discover and run all `*_eval.py` files in your project:

```bash
10xgraph eval
```

**Expected output:**

```
Discovering evaluations...
Found 1 evaluation set: weather-agent-basic (3 cases)
Running weather-agent-basic...
  weather-1: PASS (0.95)
  weather-2: PASS (0.88)
  weather-3: PASS (1.0)

Results: 3/3 passed (average score: 0.94)
Report: eval_reports/weather_agent_eval.html
```

Each case is scored 0 to 1, with higher scores meaning better matches to expected outputs. The scoring depends on the criteria you defined: `response_match` checks if the response is semantically similar to the expected answer, `tool_name_match` verifies the agent called the right tools. A score of 1.0 means perfect match, 0.9+ is excellent, and 0.8+ is generally acceptable for production.

An HTML report is generated in `eval_reports/` with detailed results, including the full agent conversation, tool calls made, scores per criterion, and which cases failed. Open it in a browser to review and debug failures.

### Evaluation in pytest

You can also run evaluations inside pytest using the `eval_test` decorator:

```python
# test_eval.py (same directory)
import pytest
from tenxgraph.qa.evaluation import AgentEvaluator, EvalConfig
from tenxgraph.qa.evaluation.collectors.trajectory_collector import (
    TrajectoryCollector,
    make_trajectory_callback,
)


@pytest.mark.asyncio
async def test_eval_weather_agent():
    """Run evaluation as a pytest test."""
    from weather_agent_eval import eval_set, eval_criteria

    # Build your graph
    from main import app  # Your compiled graph
    graph = app  # The compiled graph

    # Set up trajectory collection
    collector = TrajectoryCollector()
    callback_manager, _ = make_trajectory_callback(collector)

    # Compile with callback
    compiled = graph.compile(callback_manager=callback_manager)

    # Run evaluator
    evaluator = AgentEvaluator()
    results = await evaluator.evaluate(
        graph=compiled,
        eval_set=eval_set,
        config=eval_criteria()
    )

    # Assert all cases passed
    assert all(r.passed for r in results.case_results)
    assert results.score >= 0.8  # Average score above 80%
```

Run with pytest:

```bash
pytest test_eval.py -v
```

## When to use each approach

**Use unit tests** to:
- Verify graph structure and routing (conditional edges, tool calls, node ordering)
- Test error handling and edge cases
- Catch regressions in graph logic when you refactor
- Run fast CI checks without external dependencies

**Use evaluations** to:
- Measure response quality on real-world scenarios
- Track improvements when you update prompts or tools
- Set quality gates before deploying changes
- Identify failing patterns across your agent's behavior

Both are complementary: unit tests ensure your graph works correctly, evaluations ensure your agent produces good results.

## What you learned

You now know:

- **Unit testing** with `TestAgent` and `QuickTest` lets you test graph logic without API calls
- **TestResult** provides chainable assertions: `result.assert_contains()`, `assert_tool_called()`, etc.
- **TestContext** simplifies setup of isolated test environments with mock tools and stores
- **Evaluations** measure agent behavior across a curated dataset using `EvalCase` and `EvalSet`
- **10xgraph eval** discovers and runs all `*_eval.py` files, generating HTML reports
- **Eval criteria** define how to score responses (tool matching, semantic similarity, custom rubrics)
- **Scoring** ranges from 0 to 1, where 0.8+ is generally acceptable for production quality

## Next steps

Now that your agent is tested, you are ready to:

- Read the full [Testing](/docs/testing) section for detailed patterns, criteria definitions, and reporting
- Learn how to [run the agent on a server](/docs/server/run-the-server) with `10xgraph api` and `10xgraph play`
- Explore [prebuilt agents](/docs/guides/prebuilt-agents) and [advanced agent patterns](/docs/concepts)
