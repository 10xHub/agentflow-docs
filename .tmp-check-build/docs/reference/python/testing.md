# Testing

> TestAgent, QuickTest, TestContext, QuickEval, and mocks for unit tests and evaluations without LLM API calls.

Source: https://10xgraph.com/docs/reference/python/testing
Last updated: 2026-10-08

The `tenxgraph.qa.testing` module lets you test graphs without calling an LLM. `TestAgent` replaces `Agent` with canned responses, `QuickTest` builds and runs a graph in one call, `TestContext` isolates setup, and the mocks stand in for MCP clients, tools and stores. `QuickEval` lives in `tenxgraph.qa.evaluation` and runs evaluations in one call.

For a walkthrough with a full test, see [Unit tests](/docs/testing/unit-tests). For evaluation concepts, see [Evaluation](/docs/testing/evaluation).

## Import paths

All testing classes come from one module. `QuickEval` comes from the evaluation package.

```python
from tenxgraph.qa.testing import (
    InMemoryStore,
    MockMCPClient,
    MockToolRegistry,
    QuickTest,
    TestAgent,
    TestContext,
    TestResult,
)

from tenxgraph.qa.evaluation import QuickEval
```

## TestAgent

`TestAgent` is a drop-in replacement for `Agent` that returns predefined responses and records every call. When the list runs out it cycles back to the start.

```python
from tenxgraph.qa.testing import TestAgent

agent = TestAgent(responses=["Hello from the test agent!", "How can I help?"])
```

### TestAgent constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | `"test-model"` | Model identifier. Kept for compatibility, never called. |
| `system_prompt` | `list[dict] \| None` | `None` | System prompt. Passed to message conversion only. |
| `responses` | `list[str] \| None` | `None` | Responses returned in order, cycling. An empty or missing list becomes `["Test response"]`. |
| `tools` | `list \| None` | `None` | Tools to simulate. When non-empty, the first call returns tool calls instead of a response. |
| `simulate_tool_calls` | `bool` | `False` | Force tool-call simulation on the first call. Needs `tools`. |
| `**kwargs` | any | none | Other `Agent` keyword arguments, passed to the base class. |

### TestAgent attributes and methods

| Member | Returns | Description |
|---|---|---|
| `call_count` | `int` | Number of calls so far. |
| `call_history` | `list[dict]` | One dict per call with keys `messages`, `tools` and `kwargs`. |
| `assert_called()` | `None` | Fails if the agent was never called. |
| `assert_called_times(n)` | `None` | Fails unless the call count equals `n`. |
| `assert_not_called()` | `None` | Fails if the agent was called. |
| `get_last_messages()` | `list[dict]` | Messages of the latest call, or `[]`. |
| `get_last_tools()` | `list \| None` | Tool specs of the latest call, or `None`. |
| `reset()` | `None` | Clears the call count and history. |

### Run a TestAgent in a graph

```python
# Run a one-node graph with a TestAgent instead of a real model.
import asyncio

from tenxgraph.core.graph import StateGraph
from tenxgraph.core.state import Message
from tenxgraph.qa.testing import TestAgent
from tenxgraph.utils import END

async def main() -> None:
    test_agent = TestAgent(responses=["Hello!"])

    graph = StateGraph()
    graph.add_node("MAIN", test_agent)
    graph.set_entry_point("MAIN")
    graph.add_edge("MAIN", END)

    app = graph.compile()
    result = await app.ainvoke({"messages": [Message.text_message("Hi")]})
    print(result["messages"][-1].text())
    test_agent.assert_called_times(1)

asyncio.run(main())
```

To swap a real agent for a `TestAgent` in an existing graph, call `graph.override_node("MAIN", test_agent)` before compiling.

### Simulate a tool call

Pass `tools` to make the first call return a tool call for each tool, with the arguments `{"query": "test query"}`. Later calls return your responses. Use it with a `ToolNode` and conditional edges, or let `QuickTest.with_tools` build that graph for you.

```python
from tenxgraph.qa.testing import TestAgent

def get_weather(query: str) -> str:
    """Return a canned forecast."""
    return "sunny"

agent = TestAgent(responses=["It is sunny."], tools=[get_weather])
```

## QuickTest

`QuickTest` builds a graph around a `TestAgent`, runs it and returns a `TestResult`. All methods are async class methods.

| Method | Description |
|---|---|
| `single_turn(agent_response, user_message="Hello", model="test-model", config=None)` | One user message, one canned response. |
| `multi_turn(conversation, model="test-model", config=None)` | `conversation` is a list of `(user_message, agent_response)` tuples. Replays each turn and accumulates messages. Returns the result of the last turn. |
| `with_tools(query, response, tools, tool_responses=None, model="test-model", config=None)` | `tools` is a list of tool names or functions. Builds a `TestAgent`, `ToolNode`, `TestAgent` loop and records tool calls. `tool_responses` maps a tool name to its mock output. |
| `custom(agent, user_message, graph_setup=None, config=None)` | Runs any agent. `graph_setup` is a callable that receives the `StateGraph` and returns it, so you can add nodes or edges. |

Every method returns a `TestResult`. Only `with_tools` records tool calls; the others return an empty `tool_calls` list.

```python
# Run a single turn and a tool scenario.
import asyncio

from tenxgraph.qa.testing import QuickTest

async def main() -> None:
    result = await QuickTest.single_turn(
        agent_response="The capital is Paris.",
        user_message="What is the capital of France?",
    )
    result.assert_contains("Paris")

    result = await QuickTest.with_tools(
        query="What's the weather in Paris?",
        response="It's sunny in Paris.",
        tools=["get_weather"],
        tool_responses={"get_weather": "sunny"},
    )
    result.assert_tool_called("get_weather")

asyncio.run(main())
```

## TestResult

`TestResult` wraps the output of a `QuickTest` run and adds assertion helpers. Each assertion raises `AssertionError` on failure and returns `self`, so calls chain.

```python
result.assert_contains("Hello").assert_no_errors().assert_message_count(2)
```

### TestResult attributes

| Attribute | Type | Description |
|---|---|---|
| `final_response` | `str` | Text of the last response. |
| `messages` | `list` | All messages from the run. |
| `tool_calls` | `list[dict]` | Recorded calls, each with `name` and `args`. |
| `state` | `dict` | Raw output of `ainvoke()`. |
| `passed` | `bool` | Starts `True`. Truthiness of the result equals this value. |

### TestResult methods

| Method | Description |
|---|---|
| `assert_contains(text)` | `final_response` contains `text`. |
| `assert_not_contains(text)` | `final_response` does not contain `text`. |
| `assert_equals(expected)` | `final_response` equals `expected` exactly. |
| `assert_tool_called(tool_name, **expected_args)` | The tool was called. Extra keyword arguments must match the recorded `args`. |
| `assert_tool_not_called(tool_name)` | The tool was not called. |
| `assert_message_count(count)` | The number of messages equals `count`. |
| `assert_no_errors()` | No message has the role `"error"`. |

## MockMCPClient

`MockMCPClient` is a fake MCP client for testing nodes that use MCP tools. Register tools with `add_tool`, pass the client to `ToolNode`, then inspect the recorded calls.

```python
from tenxgraph.core.graph import ToolNode
from tenxgraph.qa.testing import MockMCPClient

mock_mcp = MockMCPClient()
mock_mcp.add_tool(
    name="search_docs",
    description="Search the documentation",
    parameters={"query": {"type": "string", "description": "Search query"}},
    handler=lambda query: f"Found results for: {query}",
)

tool_node = ToolNode([], client=mock_mcp)
```

| Method | Returns | Description |
|---|---|---|
| `add_tool(name, description="", parameters=None, handler=None)` | `MockMCPClient` | Register a tool. `parameters` is a dict of JSON schema properties, and every key is marked required. Without `handler`, calls return `"Mock result for <name>"`. Sync and async handlers both work. |
| `list_tools()` | `list[dict]` | Async. Tool definitions in MCP format. |
| `call_tool(name, arguments)` | `Any` | Async. Runs the handler and records the call. Raises `ValueError` for an unknown tool. |
| `was_called(name)` | `bool` | Whether the tool was called. |
| `call_count(name)` | `int` | Number of calls. |
| `get_calls(name)` | `list[dict]` | Call records, each with `arguments`. |
| `get_last_call(name)` | `dict \| None` | The latest record. |
| `assert_called(name)` | `None` | Fails if never called. |
| `assert_called_with(name, **expected_args)` | `None` | Checks the latest call's arguments. |
| `reset()` | `None` | Clears call history, keeps tools. |
| `clear()` | `None` | Clears tools and call history. |

## MockToolRegistry

`MockToolRegistry` registers plain functions as tools and records every call with its arguments. Use it to assert tool behavior in graph tests.

```python
from tenxgraph.core.graph import ToolNode
from tenxgraph.qa.testing import MockToolRegistry

registry = MockToolRegistry()
registry.register("get_weather", lambda location: f"Sunny in {location}")

tools = ToolNode(registry.get_tool_list())

# ... run the graph ...

assert registry.was_called("get_weather")
assert registry.call_count("get_weather") == 1
assert registry.get_last_call("get_weather")["kwargs"]["location"] == "London"
```

| Method | Returns | Description |
|---|---|---|
| `register(name, mock_func, description=None)` | `MockToolRegistry` | Wrap a function so calls are recorded. The wrapper takes the registered name. `description` becomes its docstring. |
| `register_async(name, mock_func, description=None)` | `MockToolRegistry` | Same for an async function. |
| `get_tool_list()` | `list[Callable]` | Wrapped functions, ready for `ToolNode`. |
| `was_called(name)` | `bool` | Whether the tool was called. |
| `call_count(name)` | `int` | Number of calls. |
| `get_calls(name)` | `list[dict]` | Call records, each with `args` and `kwargs`. |
| `get_last_call(name)` | `dict \| None` | The latest record. |
| `assert_called(name)` | `None` | Fails if never called. |
| `assert_called_with(name, **expected_kwargs)` | `None` | Checks the keyword arguments of the latest call. |
| `assert_call_count(name, expected)` | `None` | Fails unless the call count equals `expected`. |
| `reset()` | `None` | Clears call history, keeps functions. |
| `clear()` | `None` | Clears functions and call history. |

The `functions` and `calls` dicts are public attributes.

## InMemoryStore

`InMemoryStore` is a `BaseStore` that keeps memories in a dict, so tests need no vector database or embeddings. Search is a case-insensitive substring match on content, unless you preset results.

```python
from tenxgraph.core.graph import StateGraph
from tenxgraph.qa.testing import InMemoryStore

store = InMemoryStore()
# store.set_search_results([...]) makes every search return those results.

graph = StateGraph()
# ... add nodes ...
# app = graph.compile(store=store)
```

| Member | Description |
|---|---|
| `memories` | Dict of stored `MemorySearchResult` objects by id. |
| `set_search_results(results)` | Preset results that `asearch` returns (cut to `limit`) instead of searching. |
| `clear()` | Removes all memories and preset results. |

It implements the async `BaseStore` methods: `asetup`, `astore`, `asearch`, `aget`, `aget_all`, `aupdate`, `adelete`, `aforget_memory` and `arelease`. See [Memory stores reference](/docs/reference/python/memory-stores) for their signatures.

## TestContext

`TestContext` creates an isolated dependency container, an `InMemoryStore` and a `MockToolRegistry`, plus factory methods for graphs and test agents. It is optional, and useful when tests should not share state.

```python
# Build and compile a graph inside an isolated test context.
from tenxgraph.qa.testing import TestContext
from tenxgraph.utils import END

with TestContext() as ctx:
    graph = ctx.create_graph()
    graph.add_node("MAIN", ctx.create_test_agent(responses=["Hello!"]))
    graph.set_entry_point("MAIN")
    graph.add_edge("MAIN", END)
    app = graph.compile(store=ctx.get_store())
```

The constructor takes no arguments. It sets the public attributes `container` (an `InjectQ`) and `store`. Entering the context activates the container. Leaving it clears the store and the mock tools.

| Method | Returns | Description |
|---|---|---|
| `create_graph(state=None)` | `StateGraph` | New graph bound to the isolated container. |
| `create_test_agent(responses=None, model="test-model", system_prompt=None)` | `TestAgent` | New `TestAgent`. |
| `get_store()` | `InMemoryStore` | The context's store. |
| `get_mock_tools()` | `MockToolRegistry` | The context's mock tool registry. |
| `register_mock_tool(name, func, description=None)` | `TestContext` | Register a mock tool and return `self`. |
| `reset()` | `None` | Clears the store and the mock tools. |

## QuickEval

`QuickEval` runs evaluations with a few lines. Each method is an async class method (except `run_sync`), builds an eval set and config, runs `AgentEvaluator` and returns an `EvalReport`. It needs a compiled graph and a `TrajectoryCollector` wired into it.

`create_eval_app(graph)` from `tenxgraph.qa.evaluation.testing` takes an uncompiled `StateGraph` and returns the compiled app and its collector.

```python
# Quick checks against a graph compiled with a collector.
import asyncio

from tenxgraph.qa.evaluation import QuickEval
from tenxgraph.qa.evaluation.testing import create_eval_app

async def run(graph) -> None:
    app, collector = create_eval_app(graph)  # graph is an uncompiled StateGraph

    await QuickEval.check(
        graph=app,
        collector=collector,
        query="What is 2+2?",
        expected_response_contains="4",
    )

    await QuickEval.batch(
        graph=app,
        collector=collector,
        test_pairs=[("Hello", "Hi there"), ("What can you do?", "I can help")],
    )

    await QuickEval.tool_usage(
        graph=app,
        collector=collector,
        test_cases=[("What's the weather?", "It's sunny", ["get_weather"])],
    )
```

### QuickEval methods

Every method takes `graph` and `collector` first, and ends with `verbose=True` and `print_results=True`. `verbose` logs progress, and `print_results` prints the report to the console.

| Method | Parameters before `verbose` | Description |
|---|---|---|
| `check` | `query`, `expected_response_contains=None`, `expected_response_equals=None`, `expected_tools=None`, `threshold=0.7` | One query. With `expected_tools` it uses a custom config (tool threshold 1.0), otherwise the `quick_check` preset. |
| `preset` | `preset` (an `EvalConfig`), `eval_set` (`EvalSet` or JSON path) | Run an eval set with a config from `EvalPresets`. |
| `batch` | `test_pairs` (`(query, expected_response)` tuples), `threshold=0.7` | Run many pairs with the `quick_check` preset and the ROUGE threshold you set. |
| `tool_usage` | `test_cases` (`(query, expected_response, expected_tools)` tuples), `strict=True` | Run with the `tool_usage` preset. |
| `conversation_flow` | `conversation` (`(query, expected_response)` tuples), `threshold=0.8` | One multi-turn case with the `conversation_flow` preset. |
| `from_builder` | `builder` (`EvalSetBuilder`), `config=None` | Build the set from a builder. Defaults to `quick_check`. |
| `run_sync` | `eval_set` (`EvalSet` or JSON path), `config=None` | Blocking version. It calls `asyncio.run`, so do not use it inside a running event loop. |

All methods return an `EvalReport`. For presets, criteria and reports, see [Evaluation reference](/docs/reference/python/evaluation) and [Presets](/docs/testing/presets).
