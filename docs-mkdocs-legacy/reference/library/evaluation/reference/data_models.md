# Data Models Reference

This page documents all data models used by the evaluation module. These are Pydantic `BaseModel` classes that define the structure of test cases, tool calls, trajectories, execution results, and evaluation outcomes.

---

## Dataset Models

> `from agentflow.evaluation.dataset import ...`

### `EvalSet`

A collection of evaluation cases. The top-level container for all test data.

```python
class EvalSet(BaseModel):
    eval_set_id: str        # Auto-generated UUID
    name: str = ""
    description: str = ""
    eval_cases: list[EvalCase] = []
    metadata: dict[str, Any] = {}
```

**Methods:**

| Method | Signature | Description |
|---|---|---|
| `__len__` | `() → int` | Number of cases |
| `__iter__` | `() → Iterator[EvalCase]` | Iterate over cases |
| `add_case` | `(case: EvalCase) → None` | Append a case |
| `get_case` | `(eval_id: str) → EvalCase \| None` | Find case by ID |
| `filter_by_tags` | `(tags: list[str]) → list[EvalCase]` | Filter cases that have all specified tags |
| `from_file` | `@classmethod (path: str) → EvalSet` | Load from JSON file |
| `to_file` | `(path: str) → None` | Save to JSON file |
| `save` | `(path: str) → None` | Alias for `to_file()` |

**Example:**

```python
from agentflow.evaluation.dataset import EvalSet, EvalCase

eval_set = EvalSet(
    name="Weather Tests",
    eval_cases=[case_1, case_2],
)

# Load/save
eval_set = EvalSet.from_file("tests/weather.json")
eval_set.to_file("tests/weather.json")

# Query
case = eval_set.get_case("london_weather")
tagged = eval_set.filter_by_tags(["smoke", "weather"])
```

---

### `EvalCase`

A single test scenario with one or more conversation turns.

```python
class EvalCase(BaseModel):
    eval_id: str            # Auto-generated UUID
    name: str = ""
    description: str = ""
    conversation: list[Invocation] = []
    session_input: SessionInput = SessionInput()
    tags: list[str] = []
    metadata: dict[str, Any] = {}
```

**Factory Methods:**

| Method | Signature | Description |
|---|---|---|
| `single_turn` | `@classmethod (eval_id, user_query, expected_response?, expected_tools?, expected_node_order?, name?, description?) → EvalCase` | Create a single-turn case |
| `multi_turn` | `@classmethod (eval_id, conversation: list[tuple[str, str]], expected_tools?, name?, description?) → EvalCase` | Create multi-turn case from `(query, response)` tuples. `expected_tools` attached to first turn only. |

**Example:**

```python
# Single turn
case = EvalCase.single_turn(
    eval_id="test_1",
    user_query="Hello",
    expected_response="Hi there!",
    expected_tools=[ToolCall(name="greet")],
)

# Multi-turn
case = EvalCase.multi_turn(
    eval_id="test_2",
    conversation=[
        ("Hello", "Hi!"),
        ("Weather?", "Sunny"),
    ],
    expected_tools=[ToolCall(name="get_weather")],
)

# Manual construction
case = EvalCase(
    eval_id="test_3",
    tags=["smoke", "weather"],
    conversation=[
        Invocation.simple("Hello", "Hi!"),
        Invocation.simple("Weather?", "Sunny", expected_tools=[ToolCall(name="get_weather")]),
    ],
)
```

---

### `Invocation`

A single turn in a conversation.

```python
class Invocation(BaseModel):
    invocation_id: str                                  # Auto-generated UUID
    user_content: MessageContent
    expected_tool_trajectory: list[ToolCall] = []
    expected_node_order: list[str] = []                 # Expected graph node visit order
    expected_intermediate_responses: list[MessageContent] = []
    expected_final_response: MessageContent | None = None
```

**Factory Methods:**

| Method | Signature | Description |
|---|---|---|
| `simple` | `@classmethod (user_query: str, expected_response?: str, expected_tools?: list[ToolCall], expected_node_order?: list[str]) → Invocation` | Quick construction from strings |

**Example:**

```python
# Simple form
inv = Invocation.simple(
    user_query="Weather in London?",
    expected_response="Sunny in London",
    expected_tools=[ToolCall(name="get_weather")],
)

# Full form
inv = Invocation(
    user_content=MessageContent.user("Weather in London?"),
    expected_final_response=MessageContent.assistant("Sunny in London"),
    expected_tool_trajectory=[ToolCall(name="get_weather", args={"city": "london"})],
    expected_intermediate_responses=[
        MessageContent.assistant("Looking up the weather..."),
    ],
)
```

---

### `MessageContent`

Content of a message (user or assistant).

```python
class MessageContent(BaseModel):
    role: str                              # "user" or "assistant"
    content: str | list[dict[str, Any]]    # Text or structured blocks
    metadata: dict[str, Any] = {}
```

**Factory Methods:**

| Method | Signature | Description |
|---|---|---|
| `user` | `@classmethod (text: str) → MessageContent` | Create a user message |
| `assistant` | `@classmethod (text: str) → MessageContent` | Create an assistant message |

**Methods:**

| Method | Signature | Description |
|---|---|---|
| `get_text` | `() → str` | Extract plain text from content (handles both string and block formats) |

**Example:**

```python
msg = MessageContent.user("What is the weather?")
print(msg.role)       # "user"
print(msg.get_text()) # "What is the weather?"
```

---

### `ToolCall`

Represents a tool call (expected or actual).

```python
class ToolCall(BaseModel):
    name: str
    args: dict[str, Any] = {}
    call_id: str | None = None
    result: Any | None = None
```

**Methods:**

| Method | Signature | Description |
|---|---|---|
| `matches` | `(other: ToolCall, check_args: bool = True, check_call_id: bool = False) → bool` | Compare two tool calls |
| `__eq__` | `(other) → bool` | Equality check (name + args) |

**Example:**

```python
tc1 = ToolCall(name="get_weather", args={"city": "london"})
tc2 = ToolCall(name="get_weather", args={"city": "london"})
tc3 = ToolCall(name="get_weather", args={"city": "tokyo"})

tc1.matches(tc2)                    # True
tc1.matches(tc3, check_args=True)   # False
tc1.matches(tc3, check_args=False)  # True (names match)
```

---

### `TrajectoryStep`

A single step in an execution trajectory.

```python
class TrajectoryStep(BaseModel):
    step_type: StepType
    name: str
    args: dict[str, Any] = {}
    timestamp: float | None = None
    metadata: dict[str, Any] = {}
```

**Factory Methods:**

| Method | Signature | Description |
|---|---|---|
| `node` | `@classmethod (name, timestamp?, **metadata) → TrajectoryStep` | Create a NODE step |
| `tool` | `@classmethod (name, args?, timestamp?, **metadata) → TrajectoryStep` | Create a TOOL step |

**Example:**

```python
step1 = TrajectoryStep.node("MAIN")
step2 = TrajectoryStep.tool("get_weather", args={"city": "london"})
```

---

### `StepType`

Enum for trajectory step types.

```python
class StepType(str, Enum):
    NODE = "node"
    TOOL = "tool"
    MESSAGE = "message"
    CONDITIONAL = "conditional"
```

---

### `SessionInput`

Initial session configuration for evaluation.

```python
class SessionInput(BaseModel):
    app_name: str = ""
    user_id: str = "test_user"
    state: dict[str, Any] = {}
    config: dict[str, Any] = {}
```

---

## Execution Models

### `ExecutionResult`

Container holding the captured execution data from a graph run.

> `from agentflow.evaluation import ExecutionResult`

```python
class ExecutionResult(BaseModel):
    tool_calls: list[ToolCall] = []
    trajectory: list[TrajectoryStep] = []
    messages: list[dict[str, Any]] = []
    actual_response: str = ""
    node_responses: list[NodeResponseData] = []
    node_visits: list[str] = []
    duration_seconds: float = 0.0
```

**Properties & Methods:**

| Member | Type | Description |
|---|---|---|
| `tool_trajectory` | `@property → list[TrajectoryStep]` | Only TOOL steps from trajectory |
| `get_tool_names` | `() → list[str]` | Tool names in call order |
| `model_dump` | `() → dict` | Pydantic serialization |

---

### `NodeResponseData`

Snapshot of a single AI-node invocation.

```python
class NodeResponseData(BaseModel):
    node_name: str = ""
    input_messages: list[dict[str, Any]] = []
    response_text: str = ""
    has_tool_calls: bool = False
    tool_call_names: list[str] = []
    is_final: bool = False
    timestamp: float = 0.0
```

---

## Result Models

> `from agentflow.evaluation import CriterionResult, EvalCaseResult, EvalReport, EvalSummary`

### `CriterionResult`

Result from evaluating a single criterion.

```python
class CriterionResult(BaseModel):
    criterion: str
    score: float           # 0.0 to 1.0
    passed: bool
    threshold: float = 0.0
    details: dict[str, Any] = {}
    error: str | None = None
```

**Factory Methods:**

| Method | Signature | Description |
|---|---|---|
| `success` | `@classmethod (criterion, score, threshold, details?) → CriterionResult` | Create a successful result |
| `failure` | `@classmethod (criterion, error, threshold?) → CriterionResult` | Create a failure due to error |

**Properties:**

| Property | Type | Description |
|---|---|---|
| `reason` | `str \| None` | Extract "reason" from details dict |
| `is_error` | `bool` | Whether this result is an error |

---

### `EvalCaseResult`

Result from evaluating a single test case.

```python
class EvalCaseResult(BaseModel):
    eval_id: str
    name: str = ""
    passed: bool
    criterion_results: list[CriterionResult] = []
    actual_trajectory: list[TrajectoryStep] = []
    actual_tool_calls: list[ToolCall] = []
    actual_response: str = ""
    messages: list[dict[str, Any]] = []
    node_responses: list[dict[str, Any]] = []
    node_visits: list[str] = []
    duration_seconds: float = 0.0
    error: str | None = None
    metadata: dict[str, Any] = {}
    turn_results: list[dict[str, Any]] = []
```

**Factory Methods:**

| Method | Signature | Description |
|---|---|---|
| `success` | `@classmethod (...) → EvalCaseResult` | Create successful result. `passed = all(r.passed for r in criterion_results)` |
| `failure` | `@classmethod (eval_id, error, ...) → EvalCaseResult` | Create error result |

**Properties:**

| Property | Type | Description |
|---|---|---|
| `is_error` | `bool` | Whether this result is an error |
| `failed_criteria` | `list[CriterionResult]` | Criteria that failed |
| `passed_criteria` | `list[CriterionResult]` | Criteria that passed |

**Methods:**

| Method | Signature | Description |
|---|---|---|
| `get_criterion_result` | `(name: str) → CriterionResult \| None` | Find result by criterion name |

---

### `EvalSummary`

Aggregate statistics across all evaluation cases.

```python
class EvalSummary(BaseModel):
    total_cases: int
    passed_cases: int
    failed_cases: int
    error_cases: int
    pass_rate: float
    avg_duration_seconds: float
    total_duration_seconds: float
    criterion_stats: dict[str, dict[str, Any]]
```

**Counting convention:**
- `passed_cases`: cases where `passed=True`
- `error_cases`: cases where `is_error=True` (also have `passed=False`)
- `failed_cases`: cases where `passed=False` AND `is_error=False`
- `total_cases = passed_cases + failed_cases + error_cases`

---

### `EvalReport`

Complete evaluation report.

```python
class EvalReport(BaseModel):
    eval_set_id: str
    eval_set_name: str = ""
    results: list[EvalCaseResult] = []
    summary: EvalSummary
    config_used: dict[str, Any] = {}
    timestamp: float                   # Unix epoch (time.time())
    metadata: dict[str, Any] = {}
```

**Factory Methods:**

| Method | Signature | Description |
|---|---|---|
| `create` | `@classmethod (eval_set_id, results, eval_set_name?, config_used?) → EvalReport` | Create report with auto-computed summary |

**Properties:**

| Property | Type | Description |
|---|---|---|
| `passed` | `bool` | Whether all cases passed (`pass_rate == 1.0`) |
| `failed_cases` | `list[EvalCaseResult]` | Cases that failed (includes errored) |
| `passed_cases` | `list[EvalCaseResult]` | Cases that passed |

**Methods:**

| Method | Signature | Description |
|---|---|---|
| `get_case_result` | `(eval_id: str) → EvalCaseResult \| None` | Find result by case ID |
| `to_file` | `(path: str) → None` | Save report to JSON file |
| `from_file` | `@classmethod (path: str) → EvalReport` | Load report from JSON file |
| `format_summary` | `() → str` | Human-readable summary string |

---

## Builder

### `EvalSetBuilder`

Fluent builder for creating `EvalSet` instances.

> `from agentflow.evaluation import EvalSetBuilder`

```python
builder = EvalSetBuilder(name="my_tests")
```

**Methods (all return `self` for chaining):**

| Method | Signature | Description |
|---|---|---|
| `add_case` | `(query, expected, case_id?, expected_tools?, expected_node_order?, name?, description?) → Self` | Add single-turn case |
| `add_multi_turn` | `(conversation: list[tuple[str,str]], case_id?, expected_tools?, **kwargs) → Self` | Add multi-turn case |
| `add_tool_test` | `(query, tool_name, tool_args?, expected_response?, case_id?) → Self` | Add tool-focused case |
| `build` | `() → EvalSet` | Build the final `EvalSet` |
| `save` | `(path: str) → EvalSet` | Build, save to JSON, return |

**Class Methods:**

| Method | Signature | Description |
|---|---|---|
| `quick` | `@classmethod (*test_pairs: tuple[str,str]) → EvalSet` | One-liner from `(query, expected)` tuples |
| `from_conversations` | `@classmethod (conversations, name?) → EvalSet` | Create from conversation log dicts |
| `from_file` | `@classmethod (path: str) → EvalSetBuilder` | Load existing eval set into builder |

**Example:**

```python
# Fluent builder
eval_set = (
    EvalSetBuilder("weather")
    .add_case("Weather?", "Sunny", expected_tools=["get_weather"])
    .add_tool_test("Forecast?", "get_forecast", tool_args={"days": 5})
    .build()
)

# One-liner
eval_set = EvalSetBuilder.quick(
    ("Hello", "Hi!"),
    ("Weather?", "Sunny"),
)
```

---

## Config Models

> `from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType, Rubric, ReporterConfig, UserSimulatorConfig`

See [Criteria Reference](criteria.md) for `CriterionConfig` factory methods and [Advanced](advanced.md) for `EvalConfig` details.
