# Data Models

This page covers the core data structures used in the evaluation framework.

## EvalSet

An `EvalSet` is a collection of evaluation cases, typically stored in a JSON file.

```python
from agentflow.evaluation import EvalSet

class EvalSet(BaseModel):
    eval_set_id: str                 # Unique identifier
    name: str = ""                   # Human-readable name
    description: str = ""            # Description of what this tests
    eval_cases: list[EvalCase] = []  # List of test cases
    metadata: dict[str, Any] = {}    # Additional metadata
```

### Creating EvalSets

**From Python:**
```python
eval_set = EvalSet(
    eval_set_id="agent_tests_v1",
    name="Agent Integration Tests",
    description="Full suite of agent integration tests",
    eval_cases=[...],
    metadata={"version": "1.0", "author": "team"},
)
```

**From JSON:**
```python
# Load from file
eval_set = EvalSet.load("tests/fixtures/my_tests.evalset.json")

# Or parse from dict
data = json.load(open("tests/fixtures/my_tests.evalset.json"))
eval_set = EvalSet.model_validate(data)
```

**Save to JSON:**
```python
eval_set.save("tests/fixtures/my_tests.evalset.json")
```

## EvalCase

An `EvalCase` represents a single test scenario.

```python
from agentflow.evaluation import EvalCase

class EvalCase(BaseModel):
    eval_id: str                         # Unique identifier
    name: str = ""                       # Human-readable name
    conversation: list[Invocation] = []  # Conversation turns
    session_input: SessionInput = None   # Initial session config
    metadata: dict[str, Any] = {}        # Additional metadata
    tags: list[str] = []                 # Tags for filtering
```

### Example

```python
eval_case = EvalCase(
    eval_id="weather_test_001",
    name="Tokyo Weather Lookup",
    conversation=[
        Invocation(
            invocation_id="turn_1",
            user_content=MessageContent.user("What's the weather in Tokyo?"),
            expected_tool_trajectory=[
                ToolCall(name="get_weather", args={"city": "Tokyo"})
            ],
            expected_final_response=MessageContent.assistant(
                "The weather in Tokyo is 22°C with clear skies."
            ),
        )
    ],
    tags=["weather", "single-city", "integration"],
)
```

## Invocation

An `Invocation` represents a single turn in the conversation (user input + expected outcomes).

```python
from agentflow.evaluation import Invocation

class Invocation(BaseModel):
    invocation_id: str                            # Unique turn identifier
    user_content: MessageContent                  # User's message
    expected_tool_trajectory: list[ToolCall] = [] # Expected tool calls
    expected_intermediate_responses: list[MessageContent] = []
    expected_final_response: MessageContent | None = None
    metadata: dict[str, Any] = {}
```

### Multi-Turn Conversations

```python
eval_case = EvalCase(
    eval_id="multi_turn_test",
    name="Multi-turn Weather Conversation",
    conversation=[
        # Turn 1: Initial question
        Invocation(
            invocation_id="turn_1",
            user_content=MessageContent.user("What's the weather in Paris?"),
            expected_tool_trajectory=[
                ToolCall(name="get_weather", args={"city": "Paris"})
            ],
        ),
        # Turn 2: Follow-up question
        Invocation(
            invocation_id="turn_2",
            user_content=MessageContent.user("What about tomorrow?"),
            expected_tool_trajectory=[
                ToolCall(name="get_forecast", args={"city": "Paris", "days": 1})
            ],
        ),
        # Turn 3: Another follow-up
        Invocation(
            invocation_id="turn_3",
            user_content=MessageContent.user("Should I bring an umbrella?"),
            expected_final_response=MessageContent.assistant(
                "Based on the forecast, yes you should bring an umbrella."
            ),
        ),
    ],
)
```

## MessageContent

`MessageContent` represents the content of a message in a simplified format.

```python
from agentflow.evaluation import MessageContent

class MessageContent(BaseModel):
    role: str                              # "user", "assistant", "tool"
    content: str | list[dict[str, Any]]    # Text or structured content
    metadata: dict[str, Any] = {}
```

### Convenience Methods

```python
# Create user message
user_msg = MessageContent.user("Hello!")

# Create assistant message
assistant_msg = MessageContent.assistant("Hi! How can I help?")

# Get text content
text = user_msg.get_text()
```

## ToolCall

`ToolCall` represents an expected or actual tool/function call.

```python
from agentflow.evaluation import ToolCall

class ToolCall(BaseModel):
    name: str                      # Tool/function name
    args: dict[str, Any] = {}      # Arguments passed
    call_id: str | None = None     # Optional call identifier
    result: Any | None = None      # Optional tool result
```

### Matching Tool Calls

```python
expected = ToolCall(name="get_weather", args={"city": "Tokyo"})
actual = ToolCall(name="get_weather", args={"city": "Tokyo"})

# Check if they match
matches = expected.matches(
    actual,
    check_args=True,      # Compare arguments
    check_call_id=False,  # Ignore call IDs
)
```

## TrajectoryStep

`TrajectoryStep` represents a single step in the execution trajectory.

```python
from agentflow.evaluation import TrajectoryStep, StepType

class TrajectoryStep(BaseModel):
    step_type: StepType              # NODE, TOOL, MESSAGE, CONDITIONAL
    name: str                        # Name of the step
    args: dict[str, Any] = {}        # Arguments (for tool calls)
    timestamp: float | None = None   # When step occurred
    metadata: dict[str, Any] = {}    # Additional data
```

### Step Types

| StepType | Description |
|----------|-------------|
| `NODE` | A graph node was executed |
| `TOOL` | A tool was called |
| `MESSAGE` | A message was generated |
| `CONDITIONAL` | A conditional edge was evaluated |

### Factory Methods

```python
# Create node step
node_step = TrajectoryStep.node("agent_node", timestamp=1234567890.0)

# Create tool step
tool_step = TrajectoryStep.tool(
    "get_weather",
    args={"city": "Tokyo"},
    timestamp=1234567891.0,
)
```

## SessionInput

`SessionInput` defines initial session configuration.

```python
from agentflow.evaluation import SessionInput

class SessionInput(BaseModel):
    thread_id: str | None = None    # Session/thread identifier
    config: dict[str, Any] = {}     # Initial configuration
    initial_state: dict[str, Any] = {}  # Initial agent state
```

### Example with Session Input

```python
eval_case = EvalCase(
    eval_id="session_test",
    name="Test with session context",
    session_input=SessionInput(
        thread_id="session_123",
        config={"model": "gpt-4o", "temperature": 0.0},
        initial_state={"user_name": "John"},
    ),
    conversation=[...],
)
```

## EvalConfig

Configuration for evaluation criteria.

```python
from agentflow.evaluation import EvalConfig, CriterionConfig, MatchType

class EvalConfig(BaseModel):
    criteria: dict[str, CriterionConfig] = {}
    user_simulator_config: UserSimulatorConfig | None = None
```

### Default Configuration

```python
# Get default config with standard criteria
config = EvalConfig.default()

# Creates:
# - trajectory_match (threshold=0.8)
# - response_match (threshold=0.7)
# - llm_judge (threshold=0.7, model=gpt-4o-mini)
```

## CriterionConfig

Configuration for individual criteria.

```python
from agentflow.evaluation import CriterionConfig, MatchType, Rubric

class CriterionConfig(BaseModel):
    enabled: bool = True
    threshold: float = 0.8
    match_type: MatchType = MatchType.EXACT
    judge_model: str = "gpt-4o-mini"
    rubrics: list[Rubric] = []
```

### Match Types

```python
from agentflow.evaluation import MatchType

MatchType.EXACT      # Tools must match exactly in order
MatchType.IN_ORDER   # All expected tools present in order
MatchType.ANY_ORDER  # All expected tools present, any order
```

## Rubric

Custom rubric for LLM-judged evaluation.

```python
from agentflow.evaluation import Rubric

class Rubric(BaseModel):
    name: str                    # Rubric identifier
    description: str             # What to evaluate
    scoring_guide: str           # How to score (for LLM judge)
    weight: float = 1.0          # Weight in overall score
```

### Example Rubrics

```python
rubrics = [
    Rubric(
        name="helpfulness",
        description="How helpful is the response?",
        scoring_guide="5=Very helpful, 1=Not helpful at all",
        weight=2.0,  # Double weight
    ),
    Rubric(
        name="accuracy",
        description="Is the information accurate?",
        scoring_guide="5=Completely accurate, 1=Inaccurate",
        weight=1.5,
    ),
    Rubric(
        name="clarity",
        description="Is the response clear and easy to understand?",
        scoring_guide="5=Very clear, 1=Confusing",
        weight=1.0,
    ),
]

config = EvalConfig(
    criteria={
        "rubric_based": CriterionConfig(
            enabled=True,
            rubrics=rubrics,
        ),
    }
)
```

## Result Models

### EvalReport

The complete evaluation report.

```python
from agentflow.evaluation import EvalReport

class EvalReport(BaseModel):
    report_id: str
    eval_set_id: str
    eval_set_name: str | None
    results: list[EvalCaseResult]
    summary: EvalSummary
    config_used: dict[str, Any]
    created_at: datetime
    duration_seconds: float
```

### EvalSummary

Summary statistics.

```python
class EvalSummary(BaseModel):
    total_cases: int
    passed_cases: int
    failed_cases: int
    pass_rate: float
    avg_score: float
    criterion_stats: dict[str, CriterionStats]
```

### EvalCaseResult

Result for a single test case.

```python
class EvalCaseResult(BaseModel):
    eval_id: str
    name: str | None
    passed: bool
    criterion_results: list[CriterionResult]
    error: str | None
    duration_seconds: float
```

### CriterionResult

Result for a single criterion.

```python
class CriterionResult(BaseModel):
    criterion: str        # Criterion name
    score: float          # 0.0 to 1.0
    passed: bool          # Met threshold?
    threshold: float      # Required threshold
    details: dict[str, Any] = {}  # Additional info
```

## JSON File Conventions

### File Naming

- Use `.evalset.json` extension: `my_tests.evalset.json`
- Group by feature: `weather_agent.evalset.json`, `booking_agent.evalset.json`

### Directory Structure

```
tests/
├── fixtures/
│   ├── weather_agent.evalset.json
│   ├── booking_agent.evalset.json
│   └── multi_turn.evalset.json
└── eval/
    ├── integration/
    │   └── full_flow.evalset.json
    └── unit/
        └── tool_calls.evalset.json
```

### Complete JSON Example

```json
{
  "eval_set_id": "weather_agent_v1",
  "name": "Weather Agent Tests",
  "description": "Comprehensive tests for weather agent functionality",
  "metadata": {
    "version": "1.0.0",
    "created_by": "QA Team",
    "last_updated": "2024-01-15"
  },
  "eval_cases": [
    {
      "eval_id": "basic_weather",
      "name": "Basic Weather Query",
      "tags": ["weather", "basic"],
      "session_input": {
        "thread_id": null,
        "config": {"temperature": 0}
      },
      "conversation": [
        {
          "invocation_id": "turn_1",
          "user_content": {
            "role": "user",
            "content": "What's the weather in Tokyo?"
          },
          "expected_tool_trajectory": [
            {
              "name": "get_weather",
              "args": {"city": "Tokyo"}
            }
          ],
          "expected_final_response": {
            "role": "assistant",
            "content": "The current weather in Tokyo is 22°C and sunny."
          }
        }
      ]
    }
  ]
}
```
