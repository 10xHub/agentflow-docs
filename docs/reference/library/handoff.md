# Agent Handoff

## What is Handoff

Handoff is a mechanism that enables agents in a multi-agent system to transfer control and delegate tasks to other specialized agents. When an agent determines that another agent is better suited to handle a particular task, it can use a handoff tool to seamlessly pass execution control to that agent.

The handoff system uses a naming convention where tools named `transfer_to_<agent_name>` are automatically detected as handoff tools. When called, these tools return a navigation command that redirects the graph execution to the target agent, allowing for dynamic agent collaboration.

## When to Use

### Task Specialization
Use handoff when you have multiple agents with different specializations:
- A coordinator agent that delegates to specialist agents
- A research agent that hands off to a writing agent
- An analysis agent that transfers to a visualization agent

### Complex Workflows
Handoff is ideal for workflows that require:
- Sequential processing by different experts
- Conditional routing based on task type
- Dynamic delegation based on context

### Collaborative Systems
Use handoff when building systems where:
- Agents need to work together on complex tasks
- Different agents handle different phases of a workflow
- Control needs to flow dynamically between agents

## Benefits of Handoff

### Modularity
- **Separation of Concerns**: Each agent focuses on its specific domain
- **Easier Maintenance**: Modify individual agents without affecting others
- **Reusable Components**: Agents can be reused across different workflows

### Flexibility
- **Dynamic Routing**: Agents decide at runtime which specialist to invoke
- **Adaptive Workflows**: Flow changes based on task requirements
- **Extensibility**: Add new specialist agents without restructuring the graph

### Clarity
- **Clear Responsibilities**: Each agent has a well-defined role
- **Traceable Flow**: Easy to understand which agent handles what
- **Explicit Transitions**: Handoffs make delegation explicit and intentional

### Scalability
- **Horizontal Scaling**: Add more specialist agents as needed
- **Parallel Capabilities**: Different agents can have different tool sets
- **Resource Optimization**: Route tasks to the most appropriate agent

## Prompt Guide

### System Prompts for Agents

**Coordinator Agent Prompt:**
```
You are a coordinator agent responsible for understanding user requests and delegating 
tasks to specialized agents.

Available agents:
- researcher: Use transfer_to_researcher for investigation and data gathering
- writer: Use transfer_to_writer for content creation and documentation
- analyst: Use transfer_to_analyst for data analysis and insights

Always explain why you're delegating to a specific agent.
```

**Specialist Agent Prompt:**
```
You are a [ROLE] specialist. Your responsibilities:
1. Perform [SPECIFIC TASK] using available tools
2. Complete your work thoroughly
3. Transfer to [NEXT AGENT] when your part is done, or
4. Transfer back to coordinator when the task is complete

Use transfer_to_[agent_name] to hand off control.
```

### Best Practices for Prompts

1. **Clearly Define Roles**: Each agent should understand its specific function
2. **List Available Agents**: Tell agents which other agents they can transfer to
3. **Explain When to Transfer**: Provide guidance on when to hand off vs. continue
4. **Include Transfer Instructions**: Explicitly mention the handoff tools available

## Minimal Example

### Step 1: Create Handoff Tools

```python
from agentflow.prebuilt.tools import create_handoff_tool

# Create handoff tools for each agent
transfer_to_researcher = create_handoff_tool(
    "researcher",
    "Transfer to researcher for investigation"
)

transfer_to_writer = create_handoff_tool(
    "writer", 
    "Transfer to writer for content creation"
)
```

### Step 2: Define Agents with Tools

```python
from agentflow.graph import ToolNode
from litellm import completion

# Coordinator with handoff tools
coordinator_tools = ToolNode([
    transfer_to_researcher,
    transfer_to_writer
])

def coordinator_agent(state):
    """Delegates tasks to specialists."""
    tools = coordinator_tools.all_tools_sync()
    response = completion(
        model="gpt-4",
        messages=state.context,
        tools=tools
    )
    return {"messages": [response]}

# Researcher with handoff back to coordinator
researcher_tools = ToolNode([
    search_tool,
    transfer_to_coordinator
])

def researcher_agent(state):
    """Performs research tasks."""
    tools = researcher_tools.all_tools_sync()
    response = completion(
        model="gpt-4",
        messages=state.context,
        tools=tools
    )
    return {"messages": [response]}
```

### Step 3: Build the Graph

```python
from agentflow.graph import StateGraph
from agentflow.utils import END

graph = StateGraph()

# Add nodes
graph.add_node("coordinator", coordinator_agent)
graph.add_node("coordinator_tools", coordinator_tools)
graph.add_node("researcher", researcher_agent)
graph.add_node("researcher_tools", researcher_tools)

# Set entry point
graph.set_entry_point("coordinator")

# Add routing logic
def route_coordinator(state):
    last_msg = state.context[-1]
    if last_msg.has_tool_calls():
        return "coordinator_tools"
    return END

graph.add_conditional_edges(
    "coordinator",
    route_coordinator,
    {
        "coordinator_tools": "coordinator_tools",
        END: END
    }
)

# Compile and run
app = graph.compile()
result = app.invoke({"messages": ["Research quantum computing"]})
```

### How It Works

1. **User sends request** → Coordinator agent receives it
2. **Coordinator decides** → Calls `transfer_to_researcher` tool
3. **Handoff detected** → Graph navigates to researcher agent
4. **Researcher executes** → Performs research with tools
5. **Researcher completes** → Calls `transfer_to_coordinator`
6. **Back to coordinator** → Provides final response

The handoff tools automatically handle the navigation between agents, making the multi-agent collaboration seamless and intuitive.

## Pattern Matching

The handoff system uses simple pattern matching:
- **Pattern**: `transfer_to_<agent_name>`
- **Detection**: Automatic during tool execution
- **Navigation**: Returns `Command(goto=agent_name)`
- **No Parameters**: Handoff tools take no arguments

This convention makes handoffs:
- Easy for LLMs to understand and call
- Simple to implement and maintain
- Explicit in intent and behavior
- Traceable in execution logs

## See Also

- [Command](./Command.md) - Understanding navigation commands
- [Tool Nodes](./graph/tools.md) - Working with tools in graphs
- [Control Flow](./graph/control_flow.md) - Graph routing and edges
- [Dependency Injection](./dependency-injection.md) - Injectable parameters in tools
