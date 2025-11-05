# Agent Handoff Tutorial

## What is Agent Handoff?

Agent Handoff is a coordination mechanism that allows one agent to transfer control and delegate work to another agent in a multi-agent system. Think of it like a relay race where each runner (agent) completes their leg and then passes the baton to the next runner.

In AgentFlow, handoff enables:
- **Dynamic Delegation**: Agents can decide at runtime which specialist to invoke
- **Seamless Transitions**: Control flows naturally between agents without manual intervention
- **Collaborative Workflows**: Multiple agents work together, each contributing their expertise

The handoff system uses a simple naming convention: tools named `transfer_to_<agent_name>` are automatically detected as handoff tools. When an LLM calls such a tool, the framework intercepts it and navigates the graph to the target agent.

## Benefits and When to Use

### Benefits

**1. Separation of Concerns**
Each agent focuses on what it does best. A research agent gathers information, a writing agent creates content, and a coordinator orchestrates the workflow.

**2. Modularity and Reusability**
Agents are independent modules that can be:
- Developed and tested separately
- Reused across different workflows
- Modified without affecting other agents

**3. Clear Workflow Structure**
Handoffs make agent collaboration explicit:
- Easy to trace which agent handled what
- Obvious delegation points in the workflow
- Self-documenting agent interactions

**4. Flexibility**
- Add new specialist agents without restructuring existing code
- Change routing logic without modifying agent implementations
- Adapt workflows dynamically based on context

### When to Use Handoff

**Complex Multi-Step Workflows**
```
User Request → Coordinator → Researcher → Analyst → Writer → Coordinator → User
```

**Task Specialization**
- Different agents have different tools and expertise
- Tasks naturally decompose into specialized subtasks
- Quality improves when experts handle their domain

**Conditional Routing**
- Route to different agents based on request type
- Escalate to specialized agents when needed
- Return to coordinator for final synthesis

## Code Example Walkthrough

Let's break down the complete example from `handoff_multi_agent.py` to understand how to build a multi-agent handoff system.

## Code Example Walkthrough

Let's break down the complete example from `handoff_multi_agent.py` to understand how to build a multi-agent handoff system.

### Part 1: Setup and Imports

```python
from dotenv import load_dotenv
from litellm import completion

from agentflow.adapters.llm.model_response_converter import ModelResponseConverter
from agentflow.checkpointer import InMemoryCheckpointer
from agentflow.graph import StateGraph, ToolNode
from agentflow.prebuilt.tools import create_handoff_tool
from agentflow.state import AgentState, Message
from agentflow.utils.constants import END
from agentflow.utils.converter import convert_messages

load_dotenv()
checkpointer = InMemoryCheckpointer()
```

**What's happening:**
- Import necessary modules for building the multi-agent system
- Load environment variables (API keys for LLM)
- Initialize an in-memory checkpointer for state persistence

The `create_handoff_tool` is the key import that enables agent-to-agent transfers.

### Part 2: Define Regular Tools

```python
def get_weather(
    location: str,
    tool_call_id: str | None = None,
    state: AgentState | None = None,
) -> str:
    """Get the current weather for a specific location."""
    return f"The weather in {location} is sunny, 25°C"

def search_web(query: str, tool_call_id: str | None = None) -> str:
    """Search the web for information."""
    return f"Search results for '{query}': Found relevant information"

def write_document(content: str, title: str, tool_call_id: str | None = None) -> str:
    """Write a document with the given content and title."""
    return f"Document '{title}' written successfully"
```

**What's happening:**
- Define regular tools that agents will use for their work
- `get_weather`: Provides weather information
- `search_web`: Simulates web search functionality
- `write_document`: Creates documents

Note the optional parameters `tool_call_id` and `state` - these are automatically injected by the framework when needed (dependency injection feature).

### Part 3: Create Tool Nodes with Handoff Tools

```python
# Coordinator has access to handoff tools for delegation
coordinator_tools = ToolNode([
    create_handoff_tool("researcher", "Transfer to research specialist"),
    create_handoff_tool("writer", "Transfer to writing specialist"),
    get_weather,  # Also has regular tools
])

# Researcher can search and handoff to writer or coordinator
researcher_tools = ToolNode([
    search_web,
    create_handoff_tool("coordinator", "Transfer back to coordinator"),
    create_handoff_tool("writer", "Transfer to writer with findings"),
])

# Writer can create documents and handoff back to coordinator
writer_tools = ToolNode([
    write_document,
    create_handoff_tool("coordinator", "Transfer back to coordinator"),
])
```

**What's happening:**
- Each agent gets its own `ToolNode` containing both regular tools and handoff tools
- `create_handoff_tool("agent_name", "description")` creates a tool that transfers control to that agent
- The description helps the LLM understand when to use each handoff tool

**Key pattern:** Each agent has:
1. Regular tools for its specialized work
2. Handoff tools to delegate to other agents

### Part 4: Define Agent Functions

#### Coordinator Agent

```python
def coordinator_agent(state: AgentState):
    """Coordinator agent that delegates tasks to specialized agents."""
    prompts = """
        You are a coordinator agent. Your job is to:
        1. Understand user requests
        2. Delegate tasks to specialized agents:
           - Use transfer_to_researcher for investigation
           - Use transfer_to_writer for content creation
        3. You can also check weather using get_weather tool
        
        Always explain your decision to delegate.
    """

    messages = convert_messages(
        system_prompts=[{"role": "system", "content": prompts}],
        state=state,
    )

    # Check if last message is a tool result
    if state.context and len(state.context) > 0 and state.context[-1].role == "tool":
        # Final response without tools
        response = completion(model="gemini/gemini-2.0-flash-exp", messages=messages)
    else:
        # Regular response with tools available
        tools = coordinator_tools.all_tools_sync()
        response = completion(
            model="gemini/gemini-2.0-flash-exp",
            messages=messages,
            tools=tools
        )

    return ModelResponseConverter(response, converter="litellm")
```

**What's happening:**
1. **System Prompt**: Clearly defines the agent's role and available tools
2. **Convert Messages**: Prepares messages in the format expected by the LLM
3. **Conditional Tool Usage**: 
   - If last message is a tool result, make a final response without offering tools
   - Otherwise, provide tools so LLM can call them
4. **LLM Call**: Uses LiteLLM to call the model with tools
5. **Response Conversion**: Converts LLM response to AgentFlow format

**Pattern:** This structure is repeated for all agents with different prompts and tools.

#### Researcher Agent

```python
def researcher_agent(state: AgentState):
    """Researcher agent that performs detailed investigation."""
    prompts = """
        You are a research specialist. Your job is to:
        1. Investigate topics using the search_web tool
        2. Gather comprehensive information
        3. Transfer to writer agent if content needs creation
        4. Transfer back to coordinator if task is complete
        
        Be thorough in your research.
    """
    
    # ... (same structure as coordinator)
```

**What's happening:**
- Researcher focuses on investigation using `search_web` tool
- Can delegate to writer for content creation
- Can return to coordinator when research is complete

#### Writer Agent

```python
def writer_agent(state: AgentState):
    """Writer agent that creates content and documents."""
    prompts = """
        You are a writing specialist. Your job is to:
        1. Create clear, engaging content
        2. Use write_document tool to save content
        3. Transfer back to coordinator when complete
        
        Focus on clarity and structure.
    """
    
    # ... (same structure as coordinator)
```

**What's happening:**
- Writer specializes in content creation
- Uses `write_document` tool
- Returns to coordinator after completion

### Part 5: Define Routing Logic

```python
def should_continue_coordinator(state: AgentState) -> str:
    """Route from coordinator to tools or end."""
    if not state.context or len(state.context) == 0:
        return "coordinator_tools"

    last_message = state.context[-1]

    # If agent wants to call tools, route to tool node
    if (
        hasattr(last_message, "tools_calls")
        and last_message.tools_calls
        and len(last_message.tools_calls) > 0
        and last_message.role == "assistant"
    ):
        return "coordinator_tools"

    # If tool results came back, return to agent for processing
    if last_message.role == "tool":
        return "coordinator"

    # Otherwise, we're done
    return END
```

**What's happening:**
1. **Empty Context**: If no messages yet, go to tools
2. **Agent Called Tools**: If the agent made tool calls, route to the tool node for execution
3. **Tool Results Returned**: If tools executed, return to agent to process results
4. **No More Actions**: If agent didn't call tools and it's not processing results, we're done

**Pattern:** This same logic is used for all agents (`should_continue_researcher`, `should_continue_writer`).

**Critical insight:** The routing function creates the agent ↔ tools loop:
```
Agent → (calls tools) → Tool Node → (executes) → Agent → (processes results) → Done
```

### Part 6: Build the Graph

```python
graph = StateGraph()

# Add all nodes
graph.add_node("coordinator", coordinator_agent)
graph.add_node("coordinator_tools", coordinator_tools)
graph.add_node("researcher", researcher_agent)
graph.add_node("researcher_tools", researcher_tools)
graph.add_node("writer", writer_agent)
graph.add_node("writer_tools", writer_tools)

# Set entry point
graph.set_entry_point("coordinator")
```

**What's happening:**
- Create a `StateGraph` instance
- Add each agent and its corresponding tool node
- Set the coordinator as the entry point (first agent to handle requests)

**Pattern:** For each agent, we add two nodes:
- The agent node (runs the LLM)
- The tool node (executes tools)

**Pattern:** For each agent, we add two nodes:
- The agent node (runs the LLM)
- The tool node (executes tools)

### Part 7: Add Conditional Edges

```python
# Add edges for coordinator
graph.add_conditional_edges(
    "coordinator",
    should_continue_coordinator,
    {
        "coordinator_tools": "coordinator_tools",
        END: END,
    },
)

# Add edges for researcher
graph.add_conditional_edges(
    "researcher",
    should_continue_researcher,
    {
        "researcher_tools": "researcher_tools",
        END: END,
    },
)

# Add edges for writer
graph.add_conditional_edges(
    "writer",
    should_continue_writer,
    {
        "writer_tools": "writer_tools",
        END: END,
    },
)
```

**What's happening:**
- `add_conditional_edges` defines routing logic from each agent
- The routing function (e.g., `should_continue_coordinator`) returns a key
- The path map (dictionary) determines where to go next
- Each agent can either:
  - Go to its tool node to execute tools
  - Go to END when done

**Critical note:** Notice we DON'T add explicit edges from tool nodes back to agents! 

Why? Because handoff tools automatically handle navigation:
- Regular tools → return results → routing function routes back to agent
- Handoff tools → return `Command(goto=target_agent)` → graph navigates to that agent

This is the magic of handoff: when `transfer_to_researcher` is called, the framework automatically navigates to the researcher agent without needing explicit edges.

### Part 8: Compile and Run

```python
# Compile the graph
app = graph.compile(checkpointer=checkpointer)

# Run the example
if __name__ == "__main__":
    # Create input message
    inp = {
        "messages": [
            Message.text_message(
                "Please research quantum computing and write a brief article about it."
            )
        ]
    }
    
    # Configure execution
    config = {
        "thread_id": "handoff-demo-001",
        "recursion_limit": 15
    }
    
    # Invoke the graph
    result = app.invoke(inp, config=config)
    
    # Display results
    for msg in result["messages"]:
        print(f"[{msg.role}] {msg.text()[:200]}...")
```

**What's happening:**
1. **Compile**: Converts the graph definition into an executable workflow
2. **Create Input**: Wrap user message in the expected format
3. **Configure**: Set thread ID for state persistence and recursion limit
4. **Invoke**: Execute the graph synchronously
5. **Display**: Show the conversation history

**Expected Flow:**
```
1. User → "Research quantum computing and write about it"
2. Coordinator → Analyzes request → Calls transfer_to_researcher
3. [HANDOFF] → Graph navigates to researcher agent
4. Researcher → Calls search_web → Processes results → Calls transfer_to_writer
5. [HANDOFF] → Graph navigates to writer agent
6. Writer → Calls write_document → Creates content → Calls transfer_to_coordinator
7. [HANDOFF] → Graph navigates back to coordinator
8. Coordinator → Provides final summary → Done
```

## Understanding the Execution Flow

### 1. Initial Request Processing

```
User Request → Coordinator Agent
```
- User sends: "Research quantum computing and write about it"
- Graph starts at entry point (coordinator)
- Coordinator receives the request

### 2. Coordinator Decision

```
Coordinator → Analyzes → Calls transfer_to_researcher tool
```
- Coordinator's LLM analyzes the request
- Determines research is needed
- Calls `transfer_to_researcher` tool

### 3. Handoff Detection

```
Tool Node → Detects "transfer_to_researcher" → Returns Command(goto="researcher")
```
- Tool node receives the tool call
- Pattern matching detects `transfer_to_*` prefix
- Instead of executing, returns a navigation command
- Graph automatically routes to researcher agent

### 4. Researcher Execution

```
Researcher Agent → Calls search_web → Processes → Calls transfer_to_writer
```
- Researcher agent now has control
- Uses `search_web` tool to gather information
- Processes the search results
- Calls `transfer_to_writer` to delegate content creation

### 5. Second Handoff

```
Tool Node → Detects "transfer_to_writer" → Returns Command(goto="writer")
```
- Another handoff is detected
- Graph navigates to writer agent
- Context and state are preserved

### 6. Writer Execution

```
Writer Agent → Calls write_document → Calls transfer_to_coordinator
```
- Writer creates content using `write_document` tool
- After completion, transfers back to coordinator
- Another handoff navigation occurs

### 7. Final Response

```
Coordinator Agent → Synthesizes → Returns final answer → END
```
- Coordinator receives control again
- Synthesizes the work done by specialists
- Provides final response to user
- No more tool calls, so routing goes to END

## Key Concepts Explained

### Handoff vs Regular Tool Calls

**Regular Tool:**
```python
def search_web(query: str) -> str:
    # Does actual work
    return "search results"

# When called:
Agent → calls search_web → Tool executes → Returns result → Agent processes result
```

**Handoff Tool:**
```python
transfer_to_researcher = create_handoff_tool("researcher")

# When called:
Agent → calls transfer_to_researcher → Handoff detected → Command(goto="researcher")
→ Graph navigates to researcher agent
```

### The Agent-Tool Loop

Each agent follows this loop:

```
1. Agent (LLM) thinks and decides what to do
2. If needs tools → calls tool(s)
3. Tool node executes tools
4. If regular tool → return result → back to agent (step 1)
5. If handoff tool → navigate to target agent
6. If no tools → END
```

### State Preservation

Throughout all handoffs, the state is preserved:
- All messages in the conversation history
- Context from previous agents
- Tool call results

This allows each agent to see what previous agents did and build upon their work.

## Common Patterns

### Pattern 1: Hub and Spoke

```
        Coordinator (Hub)
       /      |      \
      /       |       \
Research   Analysis  Writing
(Spokes)   (Spokes) (Spokes)
```

- Coordinator delegates to specialists
- Specialists work independently
- All return to coordinator for synthesis

### Pattern 2: Sequential Pipeline

```
Request → Agent A → Agent B → Agent C → Response
```

- Each agent does one step
- Passes result to next agent
- Linear workflow

### Pattern 3: Conditional Routing

```
Request → Router → [Complex: Expert A]
                 → [Simple: Expert B]
                 → [Urgent: Expert C]
```

- Router analyzes request
- Routes to appropriate specialist based on criteria
- Different paths for different request types

## Tips and Best Practices

### 1. Clear Agent Roles

Define clear responsibilities in system prompts:
```python
prompts = """
You are a researcher. Your ONLY job is:
- Investigate using search_web tool
- Gather comprehensive information
- Transfer to writer when done

Do NOT write content yourself - that's the writer's job.
"""
```

### 2. Explicit Handoff Instructions

Tell agents exactly when to hand off:
```python
prompts = """
After gathering information, ALWAYS transfer to the writer agent 
using transfer_to_writer. Do not try to write content yourself.
"""
```

### 3. Set Recursion Limits

Prevent infinite loops:
```python
config = {
    "recursion_limit": 20  # Max number of steps
}
```

### 4. Log Handoffs

Enable logging to see handoff flow:
```python
import logging
logging.basicConfig(level=logging.INFO)

# You'll see:
# INFO: Handoff detected: transfer_to_researcher -> researcher
```

### 5. Handle Edge Cases

Add error handling for when agents get stuck:
```python
def should_continue(state: AgentState) -> str:
    # Check if we've been here too many times
    if state.step_count > 10:
        return END
    # ... normal logic
```

## Troubleshooting

### Handoff Not Working

**Problem:** Agent calls handoff tool but nothing happens

**Solutions:**
1. Check tool name follows pattern: `transfer_to_<agent_name>`
2. Verify target agent exists in graph with exact name
3. Enable logging to see if handoff is detected
4. Check routing logic includes target agent in path map

### Agent Loops Forever

**Problem:** Agents keep handing off to each other

**Solutions:**
1. Set lower `recursion_limit` in config
2. Add termination conditions in routing functions
3. Review agent prompts - make completion criteria clear
4. Add state checks to detect loops

### Wrong Agent Receives Control

**Problem:** Handoff goes to unexpected agent

**Solutions:**
1. Verify tool name spelling matches agent node name exactly
2. Check `add_node("agent_name", ...)` uses same name
3. Review routing function logic
4. Enable debug logging to trace execution

## Summary

Agent Handoff enables building sophisticated multi-agent systems where:

1. **Agents specialize** in specific tasks
2. **Handoff tools** enable dynamic delegation
3. **Graph automatically routes** based on handoff calls
4. **State is preserved** across all transfers
5. **Workflow emerges** from agent decisions

The key insight: handoff tools don't execute - they navigate. This makes multi-agent collaboration feel natural and intuitive.

Start with the example in `examples/handoff/handoff_multi_agent.py`, modify the agents and tools for your use case, and build complex workflows with ease!

## See Also

- [Handoff Concept](../Concept/handoff.md) - Core concepts and minimal examples
- [Tool Nodes](../Concept/graph/tools.md) - Working with tools in graphs
- [Control Flow](../Concept/graph/control_flow.md) - Understanding graph routing
- [Command](../Concept/Command.md) - Navigation commands in graphs