# User Simulation

User simulation enables dynamic conversation testing by using an LLM to simulate realistic user behavior. This is useful when fixed prompts aren't practical or when you want to test agent robustness.

## Why User Simulation?

Static eval sets have limitations:

- Fixed prompts don't test edge cases
- Multi-turn conversations are tedious to write manually
- User behavior varies in real-world usage
- You can't predict all possible user inputs

User simulation solves this by:

- **Dynamically generating** user messages based on context
- **Following conversation plans** to test specific scenarios
- **Checking goal completion** to validate outcomes
- **Creating diverse test cases** automatically

## Core Concepts

### ConversationScenario

A scenario defines what the simulated user is trying to accomplish:

```python
from agentflow.evaluation import ConversationScenario

scenario = ConversationScenario(
    scenario_id="travel_planning",
    description="User planning a trip to Japan",
    starting_prompt="I'm thinking about visiting Japan next month",
    conversation_plan="""
    1. Ask about weather conditions
    2. Inquire about recommended destinations
    3. Ask about visa requirements
    4. Request packing suggestions
    """,
    goals=[
        "Get weather information",
        "Receive destination recommendations",
        "Learn about visa requirements",
    ],
    max_turns=8,
)
```

### UserSimulator

The simulator runs conversations against your agent:

```python
from agentflow.evaluation import UserSimulator

simulator = UserSimulator(
    model="gpt-4o-mini",  # LLM for generating user messages
    temperature=0.7,       # Creativity in responses
    max_turns=10,          # Default turn limit
)
```

### SimulationResult

The result contains the full conversation and goal tracking:

```python
result = await simulator.run(graph, scenario)

print(f"Turns: {result.turns}")
print(f"Completed: {result.completed}")
print(f"Goals achieved: {result.goals_achieved}")
print(f"Conversation: {result.conversation}")
```

---

## Quick Start

```python
import asyncio
from agentflow.evaluation import UserSimulator, ConversationScenario

async def main():
    # Create your compiled graph
    graph = await create_travel_agent_graph()
    
    # Create simulator
    simulator = UserSimulator(model="gpt-4o-mini")
    
    # Define scenario
    scenario = ConversationScenario(
        scenario_id="simple_weather",
        description="User wants to know the weather",
        starting_prompt="What's the weather like in Tokyo?",
        goals=["Get current temperature"],
        max_turns=4,
    )
    
    # Run simulation
    result = await simulator.run(graph, scenario)
    
    # Check results
    print(f"Completed: {result.completed}")
    print(f"Turns: {result.turns}")
    print(f"Goals achieved: {result.goals_achieved}")
    
    # Print conversation
    for msg in result.conversation:
        print(f"{msg['role'].upper()}: {msg['content'][:100]}...")

asyncio.run(main())
```

---

## Creating Scenarios

### Basic Scenario

```python
scenario = ConversationScenario(
    scenario_id="greeting",
    description="Basic greeting interaction",
    starting_prompt="Hello!",
    goals=["Receive a friendly greeting back"],
    max_turns=2,
)
```

### Multi-Step Scenario

```python
scenario = ConversationScenario(
    scenario_id="flight_booking",
    description="User wants to book a flight from NYC to London",
    starting_prompt="I need to book a flight to London",
    conversation_plan="""
    1. Provide departure city (New York)
    2. Specify travel dates (next Friday)
    3. Indicate passenger count (2 adults)
    4. Select flight preference (morning, direct)
    5. Confirm booking
    """,
    goals=[
        "Search for flights",
        "View flight options",
        "Complete booking",
    ],
    max_turns=10,
)
```

### Edge Case Scenario

```python
scenario = ConversationScenario(
    scenario_id="error_recovery",
    description="User makes mistakes and needs to correct them",
    starting_prompt="Book me a flight to Londno",  # Typo
    conversation_plan="""
    1. Make typo in city name
    2. Correct when prompted
    3. Provide incomplete info
    4. Complete booking successfully
    """,
    goals=[
        "Handle typo gracefully",
        "Complete booking despite errors",
    ],
    max_turns=8,
    metadata={"test_type": "error_handling"},
)
```

### Adversarial Scenario

```python
scenario = ConversationScenario(
    scenario_id="off_topic",
    description="User tries to go off-topic",
    starting_prompt="Can you help me with travel?",
    conversation_plan="""
    1. Start with valid travel question
    2. Try to discuss unrelated topics
    3. Return to travel planning
    """,
    goals=[
        "Agent stays focused on travel",
        "Agent politely redirects",
    ],
    max_turns=6,
)
```

---

## Running Simulations

### Single Scenario

```python
simulator = UserSimulator(model="gpt-4o-mini")
result = await simulator.run(graph, scenario)
```

### With Configuration

```python
from agentflow.evaluation import UserSimulatorConfig

config = UserSimulatorConfig(
    model="gpt-4o",          # More capable model
    temperature=0.5,         # Less random responses
    max_invocations=12,      # Higher turn limit
    timeout_seconds=60,      # Per-turn timeout
)

simulator = UserSimulator(config=config)
result = await simulator.run(graph, scenario)
```

### Batch Simulation

Run multiple scenarios:

```python
from agentflow.evaluation import BatchSimulator

# Create scenarios
scenarios = [
    ConversationScenario(
        scenario_id="weather",
        starting_prompt="What's the weather?",
        goals=["Get weather info"],
        max_turns=4,
    ),
    ConversationScenario(
        scenario_id="booking",
        starting_prompt="Book a hotel",
        goals=["Complete booking"],
        max_turns=6,
    ),
    ConversationScenario(
        scenario_id="support",
        starting_prompt="I have a problem",
        goals=["Issue resolved"],
        max_turns=8,
    ),
]

# Run all scenarios
batch_simulator = BatchSimulator(model="gpt-4o-mini")
results = await batch_simulator.run_all(graph, scenarios)

# Analyze results
for result in results:
    print(f"{result.scenario_id}: {'✓' if result.completed else '✗'}")
    print(f"  Goals: {result.goals_achieved}")
```

### Parallel Batch Simulation

```python
results = await batch_simulator.run_all(
    graph,
    scenarios,
    parallel=True,
    max_concurrency=4,
)
```

---

## Goal Checking

Goals are checked against the conversation history to determine if objectives were met.

### Simple Keyword Goals

```python
scenario = ConversationScenario(
    scenario_id="weather",
    starting_prompt="What's the weather in Paris?",
    goals=[
        "temperature",   # Response should mention temperature
        "Paris",         # Response should mention Paris
        "weather",       # Response should discuss weather
    ],
)
```

### Complex Goal Patterns

For more sophisticated goal checking, subclass `UserSimulator`:

```python
class CustomSimulator(UserSimulator):
    def _check_goals(
        self,
        scenario: ConversationScenario,
        conversation: list[dict],
    ) -> list[str]:
        achieved = []
        full_text = " ".join(m["content"] for m in conversation)
        
        for goal in scenario.goals:
            # Custom logic per goal type
            if goal.startswith("TOOL:"):
                tool_name = goal.replace("TOOL:", "")
                if self._tool_was_called(tool_name):
                    achieved.append(goal)
            elif goal.startswith("CONTAINS:"):
                keyword = goal.replace("CONTAINS:", "")
                if keyword.lower() in full_text.lower():
                    achieved.append(goal)
            else:
                # Default: keyword matching
                if goal.lower() in full_text.lower():
                    achieved.append(goal)
        
        return achieved
```

---

## Integration with Evaluation

### Combining with EvalSet

Generate dynamic eval cases from simulations:

```python
from agentflow.evaluation import EvalSet, EvalCase, Invocation, MessageContent

async def generate_eval_cases(graph, scenarios):
    """Run simulations and convert to eval cases."""
    simulator = UserSimulator(model="gpt-4o-mini")
    cases = []
    
    for scenario in scenarios:
        result = await simulator.run(graph, scenario)
        
        if result.completed:
            # Convert successful simulation to eval case
            invocations = [
                Invocation(
                    invocation_id=f"turn_{i}",
                    user_content=MessageContent.user(msg["content"]),
                )
                for i, msg in enumerate(result.conversation)
                if msg["role"] == "user"
            ]
            
            case = EvalCase(
                eval_id=scenario.scenario_id,
                name=scenario.description,
                conversation=invocations,
                metadata={"generated_by": "simulation"},
            )
            cases.append(case)
    
    return EvalSet(
        eval_set_id="generated",
        name="Generated from simulations",
        eval_cases=cases,
    )
```

### Quality Evaluation of Simulations

```python
async def evaluate_simulation_quality(result: SimulationResult):
    """Evaluate the quality of a simulation run."""
    from agentflow.evaluation import HallucinationCriterion, SafetyCriterion
    
    # Extract assistant responses
    assistant_msgs = [
        m["content"] for m in result.conversation
        if m["role"] == "assistant"
    ]
    
    # Check safety
    safety = SafetyCriterion()
    # ... evaluate responses
    
    return {
        "turns": result.turns,
        "goals_achieved": len(result.goals_achieved),
        "completion": result.completed,
    }
```

---

## Advanced Usage

### Custom User Personas

```python
PERSONA_PROMPT = """You are simulating a user with this persona:

PERSONA:
{persona}

Stay in character throughout the conversation.
"""

class PersonaSimulator(UserSimulator):
    def __init__(self, persona: str, **kwargs):
        super().__init__(**kwargs)
        self.persona = persona
    
    def _build_prompt(self, scenario, conversation):
        base_prompt = super()._build_prompt(scenario, conversation)
        return PERSONA_PROMPT.format(persona=self.persona) + base_prompt

# Usage
impatient_user = PersonaSimulator(
    persona="An impatient user who wants quick answers and gets frustrated with long responses",
    model="gpt-4o-mini",
)

tech_savvy = PersonaSimulator(
    persona="A technically proficient user who understands APIs and wants detailed information",
    model="gpt-4o-mini",
)
```

### Conditional Behavior

```python
scenario = ConversationScenario(
    scenario_id="conditional_flow",
    starting_prompt="I need help with my order",
    conversation_plan="""
    1. Ask about order status
    2. IF order is delayed: Express frustration
       ELSE: Thank the agent
    3. Request follow-up action
    """,
    goals=["Order status provided", "Issue resolved"],
)
```

### Stress Testing

```python
async def stress_test_agent(graph, num_simulations: int = 50):
    """Run many simulations to find edge cases."""
    scenarios = [
        generate_random_scenario(i)
        for i in range(num_simulations)
    ]
    
    simulator = BatchSimulator(model="gpt-4o-mini")
    results = await simulator.run_all(
        graph,
        scenarios,
        parallel=True,
        max_concurrency=10,
    )
    
    # Analyze failures
    failures = [r for r in results if not r.completed]
    print(f"Failure rate: {len(failures) / len(results) * 100:.1f}%")
    
    for failure in failures:
        print(f"\nFailed scenario: {failure.scenario_id}")
        print(f"Error: {failure.error}")
        print(f"Last message: {failure.conversation[-1] if failure.conversation else 'N/A'}")
    
    return results
```

---

## Configuration Reference

### UserSimulatorConfig

```python
from agentflow.evaluation import UserSimulatorConfig

config = UserSimulatorConfig(
    # LLM settings
    model="gpt-4o-mini",      # Model for user simulation
    temperature=0.7,          # Response creativity (0-1)
    
    # Limits
    max_invocations=10,       # Max conversation turns
    timeout_seconds=30,       # Per-turn timeout
    
    # Behavior
    retry_on_error=True,      # Retry failed LLM calls
    max_retries=3,            # Number of retries
)
```

### ConversationScenario Fields

| Field | Type | Description |
|-------|------|-------------|
| `scenario_id` | `str` | Unique identifier |
| `description` | `str` | Human-readable description |
| `starting_prompt` | `str` | First user message |
| `conversation_plan` | `str` | High-level conversation flow |
| `goals` | `list[str]` | Objectives to achieve |
| `max_turns` | `int` | Maximum conversation turns |
| `metadata` | `dict` | Additional data |

### SimulationResult Fields

| Field | Type | Description |
|-------|------|-------------|
| `scenario_id` | `str` | Scenario that was run |
| `turns` | `int` | Number of turns executed |
| `conversation` | `list[dict]` | Full conversation history |
| `goals_achieved` | `list[str]` | Goals that were met |
| `completed` | `bool` | Whether simulation completed |
| `error` | `str` | Error message if failed |

---

## Best Practices

### 1. Start Simple

```python
# Good: Start with basic scenarios
simple = ConversationScenario(
    scenario_id="simple",
    starting_prompt="Hello",
    goals=["greeting"],
    max_turns=2,
)

# Then add complexity
complex = ConversationScenario(
    scenario_id="complex",
    starting_prompt="I need help with multiple things...",
    conversation_plan="1. ... 2. ... 3. ...",
    goals=["goal1", "goal2", "goal3"],
    max_turns=10,
)
```

### 2. Define Clear Goals

```python
# Good: Specific, verifiable goals
goals=["temperature", "humidity", "forecast"]

# Bad: Vague goals
goals=["helpful", "good response"]
```

### 3. Use Conversation Plans

```python
# Good: Clear plan
conversation_plan="""
1. Ask about current weather
2. Ask about tomorrow's forecast  
3. Ask about packing recommendations
"""

# Bad: No structure
conversation_plan=""
```

### 4. Set Appropriate Turn Limits

```python
# Simple query: 2-4 turns
max_turns=4

# Multi-step task: 6-10 turns
max_turns=8

# Complex workflow: 10-15 turns
max_turns=12
```

### 5. Monitor Costs

```python
# Use cheaper model for bulk testing
simulator = UserSimulator(model="gpt-4o-mini")

# Use capable model for quality testing
simulator = UserSimulator(model="gpt-4o")
```

---

## Troubleshooting

### Simulation Doesn't Complete

1. **Increase max_turns**: Conversation may need more turns
2. **Simplify goals**: Goals may be too complex
3. **Check agent responses**: Agent may be stuck

### Goals Not Achieved

1. **Check goal keywords**: Ensure they match expected responses
2. **Review conversation**: Agent may not be providing expected info
3. **Adjust conversation plan**: Guide the simulated user better

### Inconsistent Results

1. **Lower temperature**: Reduce randomness
2. **Use more specific prompts**: Better guide the simulator
3. **Run multiple times**: Average results for reliability

```python
async def run_multiple_times(graph, scenario, n=5):
    """Run simulation multiple times for reliability."""
    simulator = UserSimulator(model="gpt-4o-mini")
    results = []
    
    for _ in range(n):
        result = await simulator.run(graph, scenario)
        results.append(result)
    
    # Calculate success rate
    success_rate = sum(r.completed for r in results) / n
    avg_goals = sum(len(r.goals_achieved) for r in results) / n
    
    return {
        "success_rate": success_rate,
        "avg_goals_achieved": avg_goals,
        "results": results,
    }
```
