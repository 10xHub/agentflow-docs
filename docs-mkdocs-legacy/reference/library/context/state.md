# Agent State: The Mind of Your Agent

In Agentflow, the `AgentState` is far more than just a data container—it's the **cognitive foundation** that gives your agent the ability to think, remember, and reason across interactions. Understanding how state works is crucial for building agents that can maintain coherent, contextual conversations.

## The State as Living Memory

Think of `AgentState` as your agent's working memory—the mental workspace where it holds current thoughts, maintains conversation flow, and tracks its own decision-making process.

```python
from agentflow.state import AgentState
from agentflow.utils import Message

# The agent's mind in action
state = AgentState()

# As the conversation unfolds, the state evolves
state.context.append(Message.text_message("What's the weather?", role="user"))
state.context.append(Message.text_message("Let me check that.", role="assistant"))
```

### The Core Elements of Agent Mind

Every `AgentState` contains three fundamental components that mirror how intelligent systems maintain awareness:

#### 1. **Context: The Conversation Thread**
```python
state.context: List[Message]  # The ongoing dialogue history
```

This is where the agent maintains its **conversational awareness**—every user message, assistant response, tool call, and result forms a continuous thread of thought.

#### 2. **Context Summary: Compressed Understanding**
```python
state.context_summary: Optional[str]  # Distilled essence of past interactions
```

When conversations grow long, the summary holds the **distilled wisdom** of previous interactions—key insights, decisions, and context that inform future responses without overwhelming current thinking.

#### 3. **Execution Metadata: Self-Awareness**
```python
state.execution_meta: ExecMeta  # Internal state tracking
```

This gives the agent **self-awareness** about its own execution—where it is in the process, whether it's running or interrupted, and how it's progressing through its decision tree.

## The Dynamic Nature of State

What makes `AgentState` powerful is its **dynamic, evolving nature**. State isn't just read and written—it flows, transforms, and adapts throughout the agent's thinking process.

### State Evolution Through Graph Execution

```python
# Initial state: fresh conversation
state = AgentState()

# User interaction updates context
state.context.append(user_message)

# Agent processing adds responses
state.context.append(assistant_message)

# Tool usage expands the context
state.context.extend([tool_call_message, tool_result_message])

# Final response completes the thought cycle
state.context.append(final_response)
```

### The Context Growth Challenge

As conversations progress, a critical challenge emerges: **cognitive overload**. Just like human working memory, agent context has practical limits. Raw conversation history can overwhelm the agent's ability to focus on what's currently relevant.

```python
# A growing conversation might look like this:
state.context = [
    # 50+ messages of previous conversation
    Message.text_message("Actually, let's talk about something else", role="user")
]

# The agent struggles to focus on the current topic
# amid all the historical noise
```

This is where **context management** becomes essential—the art of maintaining relevant awareness while gracefully handling information overflow.

## Context Management: The Art of Forgetting

Context management in  Agentflow is a sophisticated process that mirrors how humans manage their working memory—keeping what's relevant, summarizing what's important, and gracefully forgetting what's no longer needed.

### The BaseContextManager Philosophy

```python
from agentflow.state import BaseContextManager


class MyContextManager(BaseContextManager):
    async def atrim_context(self, state: AgentState) -> AgentState:
        # This is where the magic happens - intelligent forgetting
        if len(state.context) > self.max_context_length:
            # Strategy: Keep recent context, summarize the rest
            recent_context = state.context[-20:]  # Last 20 messages
            older_context = state.context[:-20]  # Everything before

            # Create a summary of older interactions
            summary = await self.create_summary(older_context)

            # Update state with compressed memory
            state.context_summary = self.merge_summaries(
                state.context_summary,
                summary
            )
            state.context = recent_context

        return state
```

### Context Management Strategies

Different applications call for different forgetting strategies:

#### **Recency-Based Trimming**
Keep the most recent interactions, assuming current context matters most:

```python
class RecentContextManager(BaseContextManager):
    def __init__(self, max_messages=30):
        self.max_messages = max_messages

    async def atrim_context(self, state):
        if len(state.context) > self.max_messages:
            # Keep only recent messages
            state.context = state.context[-self.max_messages:]
        return state
```

#### **Summary-Based Compression**
Transform older context into summaries while preserving recent detail:

```python
class SummaryContextManager(BaseContextManager):
    async def atrim_context(self, state):
        if len(state.context) > 40:
            # Summarize older messages, keep recent ones
            summary = await self.llm_summarize(state.context[:20])
            state.context_summary = summary
            state.context = state.context[20:]
        return state
```

#### **Importance-Based Retention**
Keep messages based on their semantic importance rather than recency:

```python
class ImportanceContextManager(BaseContextManager):
    async def atrim_context(self, state):
        if len(state.context) > 50:
            # Score messages by importance
            scored_messages = await self.score_importance(state.context)
            # Keep the most important messages
            important_messages = self.select_top_messages(scored_messages, 30)
            state.context = important_messages
        return state
```

### When Context Management Happens

Context management is **automatic and seamless**—it occurs after each graph execution cycle, ensuring your agent never gets overwhelmed:

```python
# Create graph with context management
graph = StateGraph(context_manager=SummaryContextManager())

# Context is automatically managed after each execution
result = await compiled_graph.ainvoke(input_data, config)
# ↑ Context was automatically trimmed if needed
```

## State Extension: Building Specialized Agents

One of  Agentflow's most powerful features is **state extensibility**—the ability to create custom state classes that capture domain-specific information while maintaining compatibility with the framework.

### Custom State Classes

```python
from agentflow.state import AgentState
from pydantic import Field


class CustomerServiceState(AgentState):
    """Specialized state for customer service agents."""

    customer_id: str | None = None
    issue_category: str = "general"
    escalation_level: int = 1
    customer_sentiment: float = 0.0  # -1 to 1 scale
    resolved_issues: List[str] = Field(default_factory=list)

    def escalate_issue(self):
        """Domain-specific behavior."""
        self.escalation_level = min(self.escalation_level + 1, 3)

    def is_high_priority(self) -> bool:
        """Business logic embedded in state."""
        return self.escalation_level >= 2 or self.customer_sentiment < -0.5
```

### Using Custom States

```python
# Create a graph with specialized state
graph = StateGraph[CustomerServiceState]()

async def customer_service_agent(
    state: CustomerServiceState,  # Type-safe access to custom fields
    config: dict,
) -> CustomerServiceState:

    # Access custom state information
    if state.is_high_priority():
        response = "I'll prioritize your issue immediately."
    else:
        response = "Thanks for contacting us."

    # Update domain-specific state
    state.customer_sentiment = await analyze_sentiment(state.context)

    # Add response to context
    state.context.append(Message.text_message(response, role="assistant"))

    return state
```

### State Design Patterns

When designing custom states, consider these patterns:

#### **Domain Entity State**
Capture the core entities your agent works with:

```python
class ECommerceState(AgentState):
    current_cart: List[dict] = Field(default_factory=list)
    customer_preferences: dict = Field(default_factory=dict)
    order_history: List[str] = Field(default_factory=list)
```

#### **Process Tracking State**
Track multi-step workflows and processes:

```python
class OnboardingState(AgentState):
    current_step: str = "welcome"
    completed_steps: Set[str] = Field(default_factory=set)
    user_profile: dict = Field(default_factory=dict)

    def advance_to_step(self, step: str):
        self.completed_steps.add(self.current_step)
        self.current_step = step
```

#### **Analytics State**
Embed metrics and analytics directly in state:

```python
class AnalyticsState(AgentState):
    interaction_count: int = 0
    topic_distribution: dict = Field(default_factory=dict)
    user_satisfaction: float = 0.0

    def record_interaction(self, topic: str):
        self.interaction_count += 1
        self.topic_distribution[topic] = (
            self.topic_distribution.get(topic, 0) + 1
        )
```

## State Transitions and Graph Flow

Understanding how state flows through your agent graph is crucial for building predictable, maintainable agents.

### The State Flow Cycle

```python
# 1. Initial state creation
initial_state = AgentState()
initial_state.context = [user_message]

# 2. State flows through graph nodes
def processing_node(state: AgentState, config: dict) -> AgentState:
    # Node modifies state
    state.context.append(processing_message)
    return state

# 3. State continues to next node
def response_node(state: AgentState, config: dict) -> List[Message]:
    # Nodes can return different update types
    return [Message.text_message("Final response")]

# 4. Framework merges results back into state
# final_state.context now contains all messages
```

### State Update Patterns

Different node return types create different state update patterns:

```python
# Direct state modification
def modify_state_node(state: AgentState) -> AgentState:
    state.context.append(new_message)
    return state

# Message list updates (framework merges automatically)
def message_node(state: AgentState) -> List[Message]:
    return [response_message]

# Single message updates
def simple_node(state: AgentState) -> Message:
    return Message.text_message("Simple response")
```

### Conditional State Routing

State content can drive graph routing decisions:

```python
def routing_condition(state: AgentState) -> str:
    """Route based on state content."""

    if state.execution_meta.is_interrupted():
        return "handle_interruption"

    last_message = state.context[-1] if state.context else None

    if last_message and last_message.role == "user":
        if "urgent" in last_message.text().lower():
            return "urgent_handler"
        else:
            return "normal_handler"

    return "default_handler"
```

## State Persistence and Recovery

While `AgentState` represents working memory, understanding its relationship with persistence is important for building robust applications.

### State Serialization

```python
# State can be serialized to JSON for storage
state_dict = state.model_dump()

# And reconstructed from stored data
recovered_state = AgentState.model_validate(state_dict)
```

### Integration with Checkpointers

```python
# Checkpointers automatically handle state persistence
checkpointer = PgCheckpointer(...)

# State is automatically saved after graph execution
compiled_graph = graph.compile(checkpointer=checkpointer)

# State can be recovered for conversation continuation
config = {"thread_id": "conversation_123"}
previous_state = await checkpointer.aget_state(config)
```

## Best Practices for State Design

### **Keep State Focused**
Don't turn state into a kitchen sink. Each field should have a clear purpose in the agent's decision-making process.

```python
# Good: Focused, purposeful state
class TaskState(AgentState):
    current_task: str | None = None
    task_progress: float = 0.0

# Avoid: Kitchen sink state
class MegaState(AgentState):
    everything: dict = Field(default_factory=dict)  # Too generic
```

### **Use Type Hints Effectively**
Leverage Python's type system to make your state self-documenting:

```python
from typing import Literal, Optional
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class TypedState(AgentState):
    status: TaskStatus = TaskStatus.PENDING
    priority: Literal["low", "medium", "high"] = "medium"
    assigned_agent: Optional[str] = None
```

### **Design for Observability**
Include fields that help you understand what your agent is thinking:

```python
class ObservableState(AgentState):
    last_decision_rationale: str | None = None
    confidence_score: float = 1.0
    processing_time: float = 0.0

    def log_decision(self, rationale: str, confidence: float):
        self.last_decision_rationale = rationale
        self.confidence_score = confidence
```

### **Balance Stateful vs Stateless Operations**

Not everything needs to be in state. Consider what truly needs to persist across node executions:

```python
# Stateful: Information that persists and influences future decisions
class PersistentState(AgentState):
    user_preferences: dict = Field(default_factory=dict)  # Influences future responses
    conversation_topic: str | None = None  # Affects context management

# Stateless: Temporary computation that doesn't need persistence
def compute_sentiment(message: str) -> float:
    # This computation doesn't need to live in state
    return sentiment_analyzer.analyze(message)
```

## Conclusion: State as the Foundation of Intelligence

The `AgentState` is more than a technical necessity—it's the **foundation of your agent's intelligence**. By thoughtfully designing state structures, implementing intelligent context management, and understanding state flow patterns, you create agents that can:

- **Maintain coherent conversations** through context awareness
- **Scale to long interactions** through intelligent context management
- **Embed domain expertise** through custom state extensions
- **Provide observability** into agent decision-making processes

Remember: good state design is about creating the right **mental model** for your agent's cognitive processes. When state structure aligns with the agent's reasoning patterns, everything else—from debugging to feature extension—becomes significantly easier.
