---
title: Evaluation harness
seoTitle: "Evaluation harness API reference (Python)"
description: "Pytest helpers, data models, batch runners and reporters for evaluating 10xGraph agents."
section: Reference
group: "Python library"
order: 290
label: Evaluation harness
updated: "2026-10-08"
---

The evaluation harness is the set of pytest decorators, one-line runners, batch runners, reporters and result models in `tenxgraph.qa.evaluation` that put agent evaluations into unit tests and CI. Use this page for signatures, defaults and short examples of each helper.

- [Evaluation](/docs/reference/python/evaluation) covers `AgentEvaluator`, `EvalSet` and `EvalCase`.
- [Evaluation criteria](/docs/reference/python/evaluation-criteria) covers the criterion classes.

## Import paths

The main evaluation classes and helpers are exported from `tenxgraph.qa.evaluation` and re-exported from `tenxgraph.qa`:

```python
from tenxgraph.qa.evaluation import (
    EvaluationRunner,
    ReporterManager,
    ReporterOutput,
    EvalFixtures,
    EvalPlugin,
    EvalTestCase,
    EvalSummary,
    EventCollector,
    ExecutionResult,
    NodeResponseData,
    NodeDetail,
    TokenUsage,
    SessionInput,
    MessageContent,
    PublisherCallback,
    QuickEval,
    eval_test,
    parametrize_eval_cases,
    assert_eval_passed,
    assert_criterion_passed,
    create_eval_app,
    create_simple_eval_set,
    run_eval,
    print_report,
)
```

---

## Quick-start helpers

### `QuickEval`

Class with classmethods for rapid evaluation patterns without boilerplate. Each method takes a compiled graph and collector, runs evaluation with a preset or custom config, and returns an `EvalReport`. Every method accepts `print_results` (default `True`) to print the report to the console.

#### `check`: quick single-test check

```python
@classmethod
async def check(
    graph: CompiledGraph,
    collector: TrajectoryCollector,
    query: str,
    expected_response_contains: str | None = None,
    expected_response_equals: str | None = None,
    expected_tools: list[str] | None = None,
    threshold: float = 0.7,
    verbose: bool = True,
    print_results: bool = True,
) -> EvalReport
```

Evaluates a single query against expected response text and/or tools. `expected_response_equals` takes precedence over `expected_response_contains`; if neither is given, the expected response defaults to the placeholder `"response"`. `expected_tools` takes tool names only (arguments are not compared). With `expected_tools` the tool threshold is `1.0` and `threshold` is the response threshold; without it the `quick_check` preset is used. Returns `EvalReport`.

```python
from tenxgraph.qa.evaluation import QuickEval, create_eval_app

app, collector = create_eval_app(build_my_graph())
report = await QuickEval.check(
    app,
    collector,
    query="What is 2+2?",
    expected_response_contains="4",
    threshold=0.8,
)
```

#### `batch`: batch evaluation from query/response pairs

```python
@classmethod
async def batch(
    graph: CompiledGraph,
    collector: TrajectoryCollector,
    test_pairs: list[tuple[str, str]],
    threshold: float = 0.7,
    verbose: bool = True,
    print_results: bool = True,
) -> EvalReport
```

Runs multiple `(query, expected_response)` pairs. Each pair becomes one test case, scored with the `quick_check` preset where `threshold` is applied to the ROUGE match criterion.

#### `preset`: evaluation using a preset config

```python
@classmethod
async def preset(
    graph: CompiledGraph,
    collector: TrajectoryCollector,
    preset: EvalConfig,
    eval_set: EvalSet | str,
    verbose: bool = True,
    print_results: bool = True,
) -> EvalReport
```

Evaluates using a preset from `EvalPresets` (e.g. `EvalPresets.tool_usage()`) or a custom `EvalConfig`. `eval_set` may be an `EvalSet` object or a path to an eval set JSON file.

#### `tool_usage`: evaluate tool invocation patterns

```python
@classmethod
async def tool_usage(
    graph: CompiledGraph,
    collector: TrajectoryCollector,
    test_cases: list[tuple[str, str, list[str]]],
    strict: bool = True,
    verbose: bool = True,
    print_results: bool = True,
) -> EvalReport
```

Tests `(query, expected_response, expected_tools)` triples. Uses `EvalPresets.tool_usage(strict=strict)`. With `strict=True` the trajectory match type is `EXACT`; with `False` it is `IN_ORDER`, which allows extra tool calls between the expected ones.

#### `conversation_flow`: evaluate a multi-turn conversation

```python
@classmethod
async def conversation_flow(
    graph: CompiledGraph,
    collector: TrajectoryCollector,
    conversation: list[tuple[str, str]],
    threshold: float = 0.8,
    verbose: bool = True,
    print_results: bool = True,
) -> EvalReport
```

Builds one multi-turn case from `(user_query, expected_response)` pairs and scores it with `EvalPresets.conversation_flow(threshold=threshold)`.

#### `from_builder`: evaluate an `EvalSetBuilder`

```python
@classmethod
async def from_builder(
    graph: CompiledGraph,
    collector: TrajectoryCollector,
    builder: EvalSetBuilder,
    config: EvalConfig | None = None,
    verbose: bool = True,
    print_results: bool = True,
) -> EvalReport
```

Calls `builder.build()` and evaluates the result. `config` defaults to `EvalPresets.quick_check()`.

#### `run_sync`: synchronous wrapper

```python
@classmethod
def run_sync(
    graph: CompiledGraph,
    collector: TrajectoryCollector,
    eval_set: EvalSet | str,
    config: EvalConfig | None = None,
    verbose: bool = True,
    print_results: bool = True,
) -> EvalReport
```

Runs the evaluation with `asyncio.run`, so it cannot be called from inside a running event loop. `config` defaults to `EvalPresets.quick_check()`.

---

## Test-authoring helpers

### `create_eval_app`

```python
def create_eval_app(graph, *, capture_all_events: bool = True) -> tuple[Any, Any]
```

Compiles an uncompiled `StateGraph` with an `InMemoryCheckpointer` and `TrajectoryCollector` already wired in. Returns `(compiled_app, collector)`, the pair `AgentEvaluator` expects. This is the shortest way to set up evaluation.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `graph` | `StateGraph` | required | Uncompiled graph. Passing an already-compiled graph will fail. |
| `capture_all_events` | `bool` (keyword-only) | `True` | Forwarded to `TrajectoryCollector`. |

```python
import pytest

from tenxgraph.qa.evaluation import create_eval_app

@pytest.fixture(scope="session")
def trajectory_app():
    return create_eval_app(build_my_graph())
```

### `create_simple_eval_set`

```python
def create_simple_eval_set(
    eval_set_id: str,
    cases: list[tuple[str, str, str | None]],
) -> EvalSet
```

Builds an `EvalSet` from `(user_query, expected_response, name)` tuples. Each case gets id `case_{index}`; a `None` name becomes `"Case {index}"`.

```python
from tenxgraph.qa.evaluation import create_simple_eval_set

eval_set = create_simple_eval_set(
    "basic_tests",
    [
        ("Hello", "Hi there!", "greeting"),
        ("What is 2+2?", "4", "math"),
    ],
)
```

### `run_eval`

```python
async def run_eval(
    graph,
    collector,
    eval_set_path: str,
    config: EvalConfig | None = None,
    verbose: bool = False,
) -> EvalReport
```

Constructs an `AgentEvaluator` and runs one eval set file. `config` defaults to `EvalConfig.default()`. `eval_set_path` is a path to an eval set JSON file.

```python
from tenxgraph.qa.evaluation import create_eval_app, run_eval

async def test_agent():
    app, collector = create_eval_app(build_my_graph())
    report = await run_eval(app, collector, "tests/fixtures/my_agent.evalset.json")
    assert report.summary.pass_rate == 1.0
```

### `eval_test`

```python
def eval_test(
    eval_file: str | None = None,
    config: EvalConfig | None = None,
    threshold: float = 1.0,
) -> Callable
```

Decorator for an **async** test function. The decorated function must return a `(graph, collector)` tuple; the decorator then runs the eval set and calls `pytest.fail()` when `report.summary.pass_rate` is below `threshold`, listing every failed case.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `eval_file` | `str \| None` | `None` | Eval set JSON path. When `None`, the decorator strips the `test_` prefix from the function name and probes `tests/fixtures/{name}.evalset.json`, `tests/eval/{name}.evalset.json` and `eval/{name}.evalset.json`. |
| `config` | `EvalConfig \| None` | `None` | Defaults to `EvalConfig.default()`. |
| `threshold` | `float` | `1.0` | Required pass rate. |

Returning `None` from the function skips the test; returning anything that is not a 2-tuple fails it.

```python
from tenxgraph.qa.evaluation import create_eval_app, eval_test

@eval_test("tests/fixtures/weather_agent.evalset.json", threshold=0.9)
async def test_weather_agent():
    return create_eval_app(build_weather_graph())
```

The decorator always runs the evaluation with `verbose=True`.

### `parametrize_eval_cases`

```python
def parametrize_eval_cases(eval_file: str) -> Callable
```

Loads the eval set at decoration time and returns `pytest.mark.parametrize("eval_case", cases, ids=[...])`, one parameter per `EvalCase`, with `eval_id` used as the test id. The file must exist during test collection.

```python
from tenxgraph.qa.evaluation import AgentEvaluator, parametrize_eval_cases

@parametrize_eval_cases("tests/fixtures/weather_agent.evalset.json")
async def test_single_case(eval_case, trajectory_app):
    app, collector = trajectory_app
    evaluator = AgentEvaluator(app, collector)
    result = await evaluator.evaluate_case(eval_case)
    assert result.passed
```

### `assert_eval_passed`

```python
def assert_eval_passed(report: EvalReport, min_pass_rate: float = 1.0) -> None
```

Raises `AssertionError` when `report.summary.pass_rate < min_pass_rate`. The message lists the name (or id) of every failed case.

### `assert_criterion_passed`

```python
def assert_criterion_passed(
    report: EvalReport,
    criterion: str,
    min_score: float = 0.0,
) -> None
```

Looks `criterion` up in `report.summary.criterion_stats` and asserts its `avg_score` is at least `min_score`. Raises `AssertionError` if the criterion is absent from the report. `criterion` is the criterion's `name` attribute, for example `"tool_trajectory_avg_score"` or `"hallucinations_v1"`.

```python
from tenxgraph.qa.evaluation import assert_criterion_passed, assert_eval_passed

assert_eval_passed(report, min_pass_rate=0.9)
assert_criterion_passed(report, "tool_trajectory_avg_score", min_score=0.95)
```

### `EvalTestCase`

Lightweight descriptor for a case in a pytest suite. It carries metadata only; it does not run anything and is not the same type as `EvalCase`.

| Parameter | Type | Default |
|---|---|---|
| `eval_id` | `str` | required |
| `name` | `str` | `""` |
| `description` | `str` | `""` |

### `EvalFixtures`

Container for pytest fixtures, intended for `conftest.py`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default_config` | `EvalConfig \| None` | `None` | Config used when the factory is called without one. |

`evaluator_factory()` returns a callable `factory(graph, collector, config=None) -> AgentEvaluator`, falling back to `default_config` and then to `EvalConfig.default()`.

```python
# conftest.py
import pytest

from tenxgraph.qa.evaluation import EvalFixtures

@pytest.fixture
def make_evaluator():
    return EvalFixtures().evaluator_factory()
```

### `EvalPlugin`

Pytest plugin scaffold with `pytest_configure` and `pytest_collection_modifyitems` hooks. Both hooks are currently no-ops; subclass it if you need custom collection behaviour.

---

## Batch running

### `EvaluationRunner`

Runs several `(graph, collector, eval_set)` triples in sequence and keeps every report.

```python
class EvaluationRunner:
    def __init__(self, default_config: EvalConfig | None = None)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `default_config` | `EvalConfig \| None` | `None` | Applied to every run that does not override it. Defaults to `EvalConfig.default()`. |

| Member | Kind | Description |
|---|---|---|
| `results` | `dict[str, EvalReport]` | Reports keyed by `eval_set_id`, accumulated across `run()` calls. |
| `run` | **async** | Runs the evaluations, then invokes the reporters. |
| `summary` | property `dict[str, Any]` | `total_evaluations`, `total_cases`, `passed_cases`, `overall_pass_rate`. Returns `{"total_evaluations": 0}` when nothing has run. |

```python
async def run(
    evaluations: list[tuple[CompiledGraph, TrajectoryCollector, EvalSet | str]],
    config: EvalConfig | None = None,
    verbose: bool = False,
) -> dict[str, EvalReport]
```

Each tuple is `(compiled_graph, collector, eval_set_or_path)`, and each graph must have been compiled with its own collector's callback manager. After all runs, `run()` calls `ReporterManager.run_all()` once per report unless `config.reporter.enabled` is `False`; reporter failures are logged, never raised.

```python
from tenxgraph.qa.evaluation import EvaluationRunner, create_eval_app

app_a, collector_a = create_eval_app(build_graph_a())
app_b, collector_b = create_eval_app(build_graph_b())

runner = EvaluationRunner()
reports = await runner.run(
    [
        (app_a, collector_a, "tests/eval/a.evalset.json"),
        (app_b, collector_b, "tests/eval/b.evalset.json"),
    ],
)
print(runner.summary["overall_pass_rate"])
```

Reports sharing an `eval_set_id` overwrite each other in `results`.

---

## Reporting

### `print_report`

```python
def print_report(report: EvalReport, verbose: bool = False, use_color: bool = True) -> None
```

Convenience function to print a report to console. `verbose=True` shows detailed per-case output; `use_color=True` enables ANSI colors.

```python
from tenxgraph.qa.evaluation import print_report

print_report(report, verbose=True)
```

### `ReporterManager`

```python
from tenxgraph.qa.evaluation import ReporterManager, ReporterConfig

manager = ReporterManager(ReporterConfig())
output = manager.run_all(report)
print(output.generated_files)
```

| Parameter | Type | Description |
|---|---|---|
| `config` | `ReporterConfig` | Which reporters to run and where to write. Required. |

```python
def run_all(report: EvalReport, output_dir: str | None = None) -> ReporterOutput
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `report` | `EvalReport` | required | Report to render. |
| `output_dir` | `str \| None` | `None` | Overrides `config.output_dir`. Relative paths resolve against the current working directory. |

Behaviour worth knowing:

- Returns an empty `ReporterOutput()` immediately when `config.enabled` is `False`.
- Runs console, JSON, HTML and JUnit XML in that order. One reporter raising does not stop the others; the failure is appended to `ReporterOutput.errors`.
- Filenames are `{sanitised_eval_set_id}_{YYYYmmdd_HHMMSS}` when `config.timestamp_files` is `True` (the default), otherwise just the sanitised id. The JUnit file gets a `_junit.xml` suffix.

### `ReporterOutput`

Dataclass returned by `run_all()`.

| Attribute | Type | Default | Description |
|---|---|---|---|
| `json_path` | `str \| None` | `None` | Written JSON report path. |
| `html_path` | `str \| None` | `None` | Written HTML report path. |
| `junit_path` | `str \| None` | `None` | Written JUnit XML path. |
| `console_output` | `bool` | `False` | Whether the console reporter ran successfully. |
| `errors` | `list[tuple[str, str]]` | `[]` | `(reporter_name, message)` pairs. |

| Property | Type | Description |
|---|---|---|
| `has_errors` | `bool` | `True` when `errors` is non-empty. |
| `generated_files` | `list[str]` | The non-`None` output paths. |

---

## Result and token data models

### `ExecutionResult`

Pydantic model built from the collector after each case and handed to every criterion as the `actual` argument.

| Field / property | Type | Description |
|---|---|---|
| `tool_calls` | `list[ToolCall]` | Tool calls captured during the run. |
| `trajectory` | `list[TrajectoryStep]` | Ordered NODE and TOOL steps. |
| `messages` | `list[dict[str, Any]]` | De-duplicated flat message history. |
| `actual_response` | `str` | Final agent text. |
| `node_responses` | `list[NodeResponseData]` | Per-node input/output snapshots. |
| `node_visits` | `list[str]` | Node names in visit order. |
| `duration_seconds` | `float` | Graph wall-clock time, excluding criterion scoring. |
| `token_usage` | property `TokenUsage` | Sum over `node_responses`. |
| `tool_trajectory` | property `list[TrajectoryStep]` | Only the `StepType.TOOL` steps. |
| `get_tool_names()` | `list[str]` | Tool names in call order. |

### `TokenUsage`

Dataclass tracking token counts from a single LLM call or aggregated group of calls. Supports addition via `__add__` for summing across calls.

| Attribute | Type | Default | Description |
|---|---|---|---|
| `input_tokens` | `int` | `0` | Prompt / context tokens. |
| `output_tokens` | `int` | `0` | Completion tokens. |
| `cache_read_tokens` | `int` | `0` | Tokens read from prompt cache. |
| `cache_creation_tokens` | `int` | `0` | Tokens written to create cache. |

| Property / Method | Type | Description |
|---|---|---|
| `total_tokens` | `int` (property) | Sum of input and output tokens. |
| `__add__(other)` | `TokenUsage` | Combine two instances field-by-field. |
| `to_dict()` | `dict[str, int]` | Serialise all fields plus `total_tokens` to a plain dict. |

```python
from tenxgraph.qa.evaluation import TokenUsage

usage = TokenUsage(input_tokens=100, output_tokens=50)
print(usage.total_tokens)  # 150
total = usage + TokenUsage(input_tokens=50, output_tokens=25)
print(total.to_dict())  # {'input_tokens': 150, 'output_tokens': 75, ...}
```

### `NodeResponseData`

One AI-node invocation snapshot stored inside `ExecutionResult.node_responses`.

| Field | Type | Default | Description |
|---|---|---|---|
| `node_name` | `str` | `""` | Node that ran. |
| `input_messages` | `list[dict[str, Any]]` | `[]` | History sent to the model. |
| `response_text` | `str` | `""` | Model text; empty on tool-call turns. |
| `has_tool_calls` | `bool` | `False` | Whether the model requested tools. |
| `tool_call_names` | `list[str]` | `[]` | Requested tool names. |
| `is_final` | `bool` | `False` | `True` when no further tool calls follow. |
| `timestamp` | `float` | `0.0` | Completion time. |
| `token_usage` | `TokenUsage` | empty | Tokens for this call. |

### `NodeDetail`

Per-node LLM I/O snapshot for transparent debugging and per-node token accounting. Captures exactly what was sent to the model and what it returned. It is a Pydantic model stored in the `node_details` list of `EvalCaseResult`; `token_usage` serialises through `TokenUsage.to_dict()`.

| Field | Type | Default | Description |
|---|---|---|---|
| `node_name` | `str` | `""` | Name of the graph node that ran. |
| `input_messages` | `list[dict[str, Any]]` | `[]` | Conversation history sent to the LLM. |
| `response_text` | `str` | `""` | LLM text output; empty on tool-call turns. |
| `token_usage` | `TokenUsage` | empty | Tokens consumed by this LLM call. |
| `timestamp` | `float` | `0.0` | Wall-clock time when invocation completed. |

### `EvalSummary`

Aggregate statistics on `EvalReport.summary`. Build one from case results with `EvalSummary.from_results(results)`.

| Field | Type | Description |
|---|---|---|
| `total_cases` | `int` | Cases evaluated. |
| `passed_cases` | `int` | Cases where `passed` is `True`. |
| `failed_cases` | `int` | Cases that failed a criterion without erroring. |
| `error_cases` | `int` | Cases that raised. |
| `pass_rate` | `float` | `passed_cases / total_cases`. |
| `avg_duration_seconds` | `float` | Mean per-case duration. |
| `total_duration_seconds` | `float` | Sum of case durations. |
| `criterion_stats` | `dict[str, dict[str, Any]]` | Per criterion `name`: `total`, `passed`, `failed`, `avg_score`, `pass_rate`. |
| `total_token_usage` | `TokenUsage` | Tokens across all cases. |
| `per_case_token_usage` | `dict[str, TokenUsage]` | Keyed by `eval_id`. |
| `avg_tokens_per_case` | `float` | Mean total tokens per case. |

The counting invariant is `total_cases == passed_cases + failed_cases + error_cases`; errored cases are never also counted as failed.

### `SessionInput`

Initial session configuration on `EvalCase.session_input`.

| Field | Type | Default |
|---|---|---|
| `app_name` | `str` | `""` |
| `user_id` | `str` | `"test_user"` |
| `state` | `dict[str, Any]` | `{}` |
| `config` | `dict[str, Any]` | `{}` |

### `MessageContent`

Simplified message used for the user turn and the expected response of an `Invocation`.

| Field | Type | Default |
|---|---|---|
| `role` | `str` | required |
| `content` | `str \| list[dict[str, Any]]` | required |
| `metadata` | `dict[str, Any]` | `{}` |

| Method | Description |
|---|---|
| `MessageContent.user(text)` | Classmethod; builds a `role="user"` message. |
| `MessageContent.assistant(text)` | Classmethod; builds a `role="assistant"` message. |
| `get_text()` | Flattens `content` to a string, joining text blocks with spaces. |

```python
from tenxgraph.qa.evaluation import MessageContent, SessionInput

turn = MessageContent.user("What is the weather in Paris?")
session = SessionInput(user_id="alice", state={"locale": "fr"})
```

---

## Event capture

### `EventCollector`

Stores every raw `EventModel` fired during a run, including events `TrajectoryCollector` ignores. Use it for debugging, not for scoring.

| Member | Kind | Description |
|---|---|---|
| `events` | `list[EventModel]` | Everything captured so far. |
| `on_event(event)` | **async** | Append an event. |
| `on_event_sync(event)` | sync | Append an event. |
| `reset()` | sync | Clear the buffer. |
| `filter_by_event(event)` | `list[EventModel]` | Filter on `Event`. |
| `filter_by_event_type(event_type)` | `list[EventModel]` | Filter on `EventType`. |
| `filter_by_node(node_name)` | `list[EventModel]` | Filter on node name. |
| `len(collector)` | `int` | Event count. |

```python
from tenxgraph.qa.evaluation import EventCollector
from tenxgraph.runtime.publisher.events import Event

collector = EventCollector()
# register collector.on_event as a callback, run the graph, then:
node_events = collector.filter_by_event(Event.NODE_EXECUTION)
```

### `PublisherCallback`

Adapts any `BasePublisher` (typically a `TrajectoryCollector`) into an `AfterInvokeCallback`. It builds an `EventModel` per invocation and awaits `publisher.publish()` directly, avoiding the background-task race of the standard publish path. `create_eval_app` and `make_trajectory_callback` wire this up for you; use it directly only for custom callback setups.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `publisher` | `BasePublisher` | required | Destination for the built events. |
| `config` | `dict \| None` | `None` | Reads `thread_id` and `run_id`, stamped onto every event. |

Registered for `InvocationType.AI` it emits `Event.NODE_EXECUTION`; for `InvocationType.TOOL` and `InvocationType.MCP` it emits `Event.TOOL_EXECUTION`. Other invocation types produce no event.

```python
from tenxgraph.qa.evaluation import PublisherCallback, TrajectoryCollector
from tenxgraph.utils.callbacks import CallbackManager, InvocationType

collector = TrajectoryCollector()
callback = PublisherCallback(collector, config={"thread_id": "run-1"})

manager = CallbackManager()
manager.register_after_invoke(InvocationType.AI, callback)
manager.register_after_invoke(InvocationType.TOOL, callback)
```

---

## Common errors

| Error / symptom | Cause | Fix |
|---|---|---|
| `pytest.fail: eval_test decorated function must return (graph, collector) tuple` | The decorated function returned something else. | `return create_eval_app(build_graph())`. |
| `pytest.fail: Eval file not found` | No `eval_file` given and none of the probed paths exist. | Pass an explicit path to `eval_test`. |
| `FileNotFoundError` during test collection | `parametrize_eval_cases` reads the file at import time. | Ensure the path is correct relative to the pytest working directory. |
| `AssertionError: Criterion '...' not found in report` | The criterion name is not in `criterion_stats`. | Use the criterion's `name` (`"tool_trajectory_avg_score"`, not `"trajectory"`), and confirm it was enabled. |
| Empty `ExecutionResult.tool_calls` and `node_visits` | The graph was compiled without the collector's callback manager. | Build the pair with `create_eval_app`, or pass `make_trajectory_callback(collector)[1]` to `compile()`. |
| `AttributeError` on `create_eval_app` | An already-compiled graph was passed. | Pass the uncompiled `StateGraph`. |
| No report files written | `config.reporter.enabled` is `False`, or only the console reporter is on. | Enable `json_report` / `html` / `junit_xml` on `ReporterConfig`. |
| `ReporterOutput.has_errors` is `True` | One reporter raised; the others still ran. | Inspect `ReporterOutput.errors` and the `tenxgraph.evaluation.reporters` logger. |
