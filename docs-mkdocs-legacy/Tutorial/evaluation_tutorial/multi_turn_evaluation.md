# Multi-Turn Evaluation Tutorial

This tutorial covers evaluating multi-turn conversations — scenarios where the agent handles a sequence of user messages across multiple turns, each with its own expected response and tool calls.

---

## When to Use Multi-Turn Evaluation

Use multi-turn evaluation when your agent:

- Maintains context across conversation turns
- Calls different tools at different conversation stages
- Needs to handle follow-up questions and clarifications
- Must achieve goals over a multi-step interaction

---

## 1. Define Multi-Turn Test Cases

### Using `EvalCase.multi_turn()`

The simplest way to create a multi-turn case:

```python
from agentflow.evaluation.dataset import EvalCase, ToolCall

case = EvalCase.multi_turn(
    eval_id="weather_conversation",
    conversation=[
        ("What is the weather in London?", "It is sunny in London"),
        ("And the forecast?", "Rain expected tomorrow"),
        ("Thanks!", "You're welcome!"),
    ],
    expected_tools=[ToolCall(name="get_weather")],
    name="Weather Conversation Flow",
)
```

**Behavior:** `expected_tools` is attached to the **first invocation only**. Each tuple is `(user_query, expected_response)`.

### Using Manual Invocations

For per-turn tool expectations, build each `Invocation` explicitly:

```python
from agentflow.evaluation.dataset import EvalCase, Invocation, ToolCall

case = EvalCase(
    eval_id="multi_city_weather",
    name="Multi-City Weather Chat",
    conversation=[
        # Turn 1: User asks about London
        Invocation.simple(
            user_query="What is the weather in London?",
            expected_response="It is sunny in London, 22°C",
            expected_tools=[
                ToolCall(name="get_weather", args={"city": "london"}),
            ],
        ),
        # Turn 2: User asks about Tokyo
        Invocation.simple(
            user_query="What about Tokyo?",
            expected_response="It is cloudy in Tokyo, 18°C",
            expected_tools=[
                ToolCall(name="get_weather", args={"city": "tokyo"}),
            ],
        ),
        # Turn 3: User asks for comparison (no tool call expected)
        Invocation.simple(
            user_query="Which city is warmer?",
            expected_response="London is warmer at 22°C compared to Tokyo at 18°C",
        ),
    ],
)
```

### Using Full Invocation Objects

For maximum control, including intermediate responses:

```python
from agentflow.evaluation.dataset import Invocation, MessageContent, ToolCall

turn = Invocation(
    user_content=MessageContent.user("Search for flights to Paris"),
    expected_tool_trajectory=[
        ToolCall(name="search_flights", args={"destination": "paris"}),
    ],
    expected_intermediate_responses=[
        MessageContent.assistant("Searching for flights to Paris..."),
    ],
    expected_final_response=MessageContent.assistant(
        "Found 3 flights to Paris starting from $299"
    ),
)
```

---

## 2. Set Up and Run

```python
from agentflow.evaluation import (
    AgentEvaluator,
    EvalConfig,
    CriterionConfig,
    MatchType,
    create_eval_app,
)
from agentflow.evaluation.dataset import EvalSet

# Compile once — reuse for all evaluations
compiled, collector = create_eval_app(my_graph)

# Configure criteria
config = EvalConfig(criteria={
    "tool_name_match_score": CriterionConfig(threshold=1.0),
    "tool_trajectory_avg_score": CriterionConfig(
        threshold=1.0,
        match_type=MatchType.IN_ORDER,  # Recommended for multi-turn
    ),
    "response_match_score": CriterionConfig(threshold=0.7),
})

# Group cases into a set
eval_set = EvalSet(
    name="Multi-Turn Tests",
    eval_cases=[case_1, case_2],
)

# Run
evaluator = AgentEvaluator(compiled, collector, config=config)
report = await evaluator.evaluate(eval_set, verbose=True)
```

> **Tip:** Use `MatchType.IN_ORDER` for multi-turn tests since the agent may invoke extra tools between your expected ones.

---

## 3. Using QuickEval for Multi-Turn

For quick multi-turn testing:

```python
from agentflow.evaluation import QuickEval

report = await QuickEval.conversation_flow(
    graph=compiled,
    collector=collector,
    conversation=[
        ("Hello", "Hi there!"),
        ("What is the weather?", "It is sunny."),
        ("Thanks!", "You're welcome!"),
    ],
    threshold=0.8,
)
```

---

## 4. Understanding Multi-Turn Criterion Evaluation

### How Criteria Process Multi-Turn Cases

When a multi-turn `EvalCase` is evaluated:

1. **Tool criteria** (`ToolNameMatchCriterion`, `TrajectoryMatchCriterion`) aggregate expected tools from **all invocations** and compare against the full execution trajectory:

   ```python
   # Internally, criteria do:
   expected_tools = []
   for invocation in case.conversation:
       expected_tools.extend(invocation.expected_tool_trajectory)
   ```

2. **Response criteria** compare the agent's final response against the last invocation's `expected_final_response`.

3. **LLM criteria** receive the full conversation context for evaluation.

### Turn-Level Results

`EvalCaseResult.turn_results` contains per-turn details when available:

```python
result = await evaluator.evaluate_case(multi_turn_case)

for i, turn in enumerate(result.turn_results):
    print(f"Turn {i+1}: {turn}")
```

---

## 5. Multi-Turn Patterns

### Pattern: Escalation Flow

```python
escalation = EvalCase(
    eval_id="escalation_flow",
    name="Customer Support Escalation",
    conversation=[
        Invocation.simple(
            user_query="I have a billing issue",
            expected_response="I'd be happy to help with your billing issue.",
            expected_tools=[ToolCall(name="lookup_account")],
        ),
        Invocation.simple(
            user_query="My last charge was wrong",
            expected_response="I can see the charge. Let me investigate.",
            expected_tools=[ToolCall(name="get_transactions")],
        ),
        Invocation.simple(
            user_query="I want to speak to a manager",
            expected_response="I'll transfer you to a manager now.",
            expected_tools=[ToolCall(name="escalate_to_manager")],
        ),
    ],
)
```

### Pattern: Context Retention

```python
context_test = EvalCase(
    eval_id="context_retention",
    name="Agent Remembers Context",
    conversation=[
        Invocation.simple(
            user_query="My name is Alice",
            expected_response="Nice to meet you, Alice!",
        ),
        Invocation.simple(
            user_query="What is my name?",
            expected_response="Your name is Alice.",
        ),
    ],
)
```

### Pattern: No-Tool Turns

```python
mixed = EvalCase(
    eval_id="mixed_turns",
    conversation=[
        # Turn 1: Agent greets (no tools)
        Invocation.simple(
            user_query="Hello!",
            expected_response="Hi there!",
        ),
        # Turn 2: Agent uses tool
        Invocation.simple(
            user_query="Check the weather",
            expected_response="It is sunny today",
            expected_tools=[ToolCall(name="get_weather")],
        ),
        # Turn 3: Follow-up (no tools)
        Invocation.simple(
            user_query="Should I bring an umbrella?",
            expected_response="No, it should stay sunny",
        ),
    ],
)
```

---

## 6. Building from EvalSetBuilder

```python
from agentflow.evaluation import EvalSetBuilder

eval_set = (
    EvalSetBuilder("conversation_tests")
    .add_multi_turn(
        conversation=[
            ("Hello", "Hi there!"),
            ("Weather?", "Sunny today."),
        ],
        case_id="greeting_weather",
        expected_tools=["get_weather"],
    )
    .add_multi_turn(
        conversation=[
            ("Book a flight to Paris", "Searching for flights..."),
            ("The cheapest one", "Booked! Confirmation #12345"),
        ],
        case_id="book_flight",
        expected_tools=["search_flights"],
    )
    .build()
)
```

---

## 7. Pytest Example

```python
import pytest
from agentflow.evaluation import (
    AgentEvaluator,
    EvalPresets,
    assert_eval_passed,
)
from agentflow.evaluation.dataset import EvalCase, Invocation, ToolCall

CONVERSATION_CASES = [
    EvalCase(
        eval_id="support_flow",
        conversation=[
            Invocation.simple("I need help", "How can I assist you?"),
            Invocation.simple(
                "Check my order status",
                "Your order #123 is shipped",
                expected_tools=[ToolCall(name="check_order")],
            ),
        ],
    ),
    EvalCase(
        eval_id="weather_chat",
        conversation=[
            Invocation.simple(
                "Weather in London?",
                "Sunny, 22°C",
                expected_tools=[ToolCall(name="get_weather")],
            ),
            Invocation.simple("Thanks!", "You're welcome!"),
        ],
    ),
]

@pytest.mark.asyncio
@pytest.mark.parametrize("case", CONVERSATION_CASES, ids=lambda c: c.eval_id)
async def test_conversation(evaluator, case):
    result = await evaluator.evaluate_case(case)
    assert result.passed, f"Failed: {[c.criterion for c in result.failed_criteria]}"
```

---

## Next Steps

- [Trajectory Matching](trajectory_matching.md) — Deep-dive into EXACT / IN_ORDER / ANY_ORDER modes
- [User Simulation](user_simulation.md) — Dynamic multi-turn testing with AI
- [Criteria Reference](../reference/criteria.md) — Full criteria API
