# Commands: Combining State Updates with Control Flow

Commands in  Agentflow represent a powerful pattern that allows your agent nodes to simultaneously update the agent state and direct the graph's execution flow. Inspired by LangGraph's Command API, this approach enables more dynamic and expressive agent behaviors where a single node can both modify data and make routing decisions.

## The Command Pattern

Traditional graph nodes in  Agentflow return either updated state or a simple value that gets passed to the next node. Commands break this limitation by allowing nodes to return a `Command` object that encapsulates both:

- **State updates**: Modifications to the agent state
- **Control flow**: Instructions on where the graph should execute next
- **Graph navigation**: Ability to jump between different graphs in hierarchical setups

This pattern is particularly valuable for:
- **Dynamic routing** based on complex conditions
- **Hierarchical agent coordination** where supervisors need to delegate and resume
- **Error recovery** and retry logic with state preservation
- **Conditional branching** that depends on both state and external factors

## Command Structure

A `Command` object contains four key attributes:

| Attribute | Type | Purpose |
|-----------|------|---------|
| `update` | `StateT \| None \| Message \| str \| BaseConverter` | The state update to apply |
| `goto` | `str \| None` | Next node to execute (node name or `END`) |
| `graph` | `str \| None` | Target graph for navigation (`None` for current, `PARENT` for parent graph) |
| `state` | `StateT \| None` | Optional complete state to attach |

## Basic Usage

### Simple State Update with Routing

```python
from agentflow.utils import Command, END
from agentflow.state import AgentState


def process_request(state: AgentState, config: dict) -> Command[AgentState]:
    """Process a user request and route to appropriate handler."""

    # Analyze the request
    request_type = analyze_request(state.context[-1].text())

    # Update state with analysis
    state.analysis = request_type

    if request_type == "question":
        return Command(update=state, goto="answer_question")
    elif request_type == "task":
        return Command(update=state, goto="execute_task")
    else:
        return Command(update=state, goto=END)
```

### Conditional Routing with Dynamic State Updates

```python
async def intelligent_router(state: AgentState, config: dict) -> Command[AgentState]:
    """Route based on AI analysis of the current state."""

    # Use AI to determine next action
    analysis = await analyze_state_with_ai(state)

    # Update state with AI insights
    state.ai_insights = analysis

    # Route based on confidence and requirements
    if analysis.confidence > 0.8:
        return Command(update=state, goto="high_confidence_path")
    elif analysis.needs_clarification:
        return Command(update=state, goto="ask_for_clarification")
    else:
        return Command(update=state, goto="fallback_handler")
```

## Hierarchical Graph Navigation

Commands enable sophisticated hierarchical agent coordination where supervisors can delegate work to sub-graphs and resume control when appropriate.

### Supervisor-Worker Pattern

```python
def supervisor_node(state: SupervisorState, config: dict) -> Command[SupervisorState]:
    """Supervisor that delegates to specialized workers."""

    # Determine which worker should handle this
    worker_type = determine_worker_type(state.current_task)

    # Update supervisor state
    state.active_worker = worker_type
    state.delegation_time = datetime.utcnow()

    # Delegate to appropriate sub-graph
    return Command(
        update=state,
        goto="worker_entry",
        graph=worker_type  # Navigate to worker's graph
    )

async def worker_completion_handler(state: WorkerState, config: dict) -> Command[WorkerState]:
    """Worker signals completion back to supervisor."""

    # Mark task as completed
    state.task_completed = True
    state.completion_time = datetime.utcnow()

    # Return control to supervisor
    return Command(
        update=state,
        goto="supervisor_resume",
        graph=Command.PARENT  # Navigate back to parent graph
    )
```

## Advanced Patterns

### Error Recovery with State Preservation

```python
async def resilient_processor(state: AgentState, config: dict) -> Command[AgentState]:
    """Process with automatic retry on failure."""

    try:
        result = await process_with_external_service(state.data)
        state.result = result
        state.retry_count = 0
        return Command(update=state, goto="success_handler")

    except TemporaryFailureError as e:
        state.retry_count = getattr(state, 'retry_count', 0) + 1
        state.last_error = str(e)

        if state.retry_count < 3:
            # Retry with backoff
            await asyncio.sleep(2 ** state.retry_count)
            return Command(update=state, goto="resilient_processor")
        else:
            # Give up and route to error handler
            return Command(update=state, goto="error_handler")
```

### Dynamic Graph Construction

```python
def adaptive_planner(state: PlanningState, config: dict) -> Command[PlanningState]:
    """Dynamically build execution plan based on requirements."""

    # Analyze requirements
    requirements = analyze_requirements(state.user_request)

    # Build dynamic plan
    plan = []
    if requirements.needs_research:
        plan.append("research_phase")
    if requirements.needs_design:
        plan.append("design_phase")
    if requirements.needs_implementation:
        plan.append("implementation_phase")

    # Update state with plan
    state.execution_plan = plan
    state.current_phase = plan[0] if plan else None

    # Route to first phase or end if no work needed
    next_node = plan[0] if plan else END
    return Command(update=state, goto=next_node)
```

## Integration with State Graphs

Commands integrate seamlessly with Agentflow's state graph system. When a node returns a `Command`, the graph execution engine:

1. **Applies the state update** if `update` is provided
2. **Updates the execution pointer** based on `goto`
3. **Handles graph navigation** if `graph` specifies a different graph
4. **Preserves execution context** across graph boundaries

### Graph Configuration

```python
from agentflow.graph import StateGraph
from agentflow.utils import END

# Create graph with Command-supporting nodes
graph = StateGraph[AgentState]()

graph.add_node("supervisor", supervisor_node)
graph.add_node("worker_a", worker_a_node)
graph.add_node("worker_b", worker_b_node)
graph.add_node("coordinator", coordinator_node)

graph.set_entry_point("supervisor")

# Add conditional edges for complex routing
graph.add_conditional_edges(
    "supervisor",
    lambda state: state.next_action,
    {
        "delegate_a": "worker_a",
        "delegate_b": "worker_b",
        "coordinate": "coordinator",
        END: END
    }
)

# Compile the graph
app = graph.compile()
```

## Best Practices

### State Update Patterns

- **Prefer incremental updates**: Only modify the parts of state that actually changed
- **Preserve existing data**: Use `add_messages` for context updates to maintain history
- **Validate state consistency**: Ensure state remains valid after updates

### Control Flow Guidelines

- **Use meaningful node names**: Make routing decisions clear from the `goto` values
- **Handle edge cases**: Always provide fallback routing for unexpected conditions
- **Document routing logic**: Comment complex conditional routing decisions

### Performance Considerations

- **Minimize state size**: Large state objects can impact serialization performance
- **Batch updates**: Combine multiple small updates into single Command returns
- **Avoid deep recursion**: Use iterative approaches over deeply nested Command chains

## Comparison with Traditional Approaches

| Traditional Approach | Command-Based Approach |
|---------------------|----------------------|
| Separate state updates and routing | Combined in single return value |
| Static edge definitions | Dynamic routing at runtime |
| Limited to current graph | Cross-graph navigation support |
| Simple conditional logic | Complex multi-factor routing |

Commands represent a significant enhancement to  Agentflow's expressiveness, enabling agents that can adapt their behavior dynamically while maintaining clean, maintainable code architecture.
