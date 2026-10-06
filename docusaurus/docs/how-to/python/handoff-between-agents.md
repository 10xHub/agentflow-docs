---
title: Route between agents with handoff
sidebar_label: Route between agents with handoff
description: How to use create_handoff_tool and Command to transfer control between agents in a multi-agent graph.
keywords:
  - agentflow python
  - python ai agent guide
  - multi-agent python
  - agentflow
  - python ai agent framework
  - route between agents with handoff
---


# Route between agents with handoff

In a multi-agent graph, one agent often needs to delegate a task to a specialist. Agentflow's handoff mechanism lets the LLM decide which agent to call next by choosing a tool whose name follows the `transfer_to_<agent>` convention. The graph intercepts the tool call and navigates to the target node without executing any tool function.

## Prerequisites

You have a graph with at least two agent nodes. The agents share a `StateGraph` and can see each other's node names.

## Quick start

```python
from agentflow.core import Agent, StateGraph, ToolNode
from agentflow.prebuilt.tools import create_handoff_tool
from agentflow.utils import END

# ── Tools ────────────────────────────────────────────────────────────────────
coordinator_tools = ToolNode([
    create_handoff_tool("researcher", "Research a topic in depth"),
    create_handoff_tool("writer",     "Draft content from provided notes"),
])

researcher_tools = ToolNode([
    create_handoff_tool("writer",      "Hand off research findings to writer"),
    create_handoff_tool("coordinator", "Return to coordinator when done"),
])

# ── Agents ────────────────────────────────────────────────────────────────────
coordinator = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "Delegate tasks to researcher or writer."}],
    tool_node="COORDINATOR_TOOLS",
    trim_context=True,
)

researcher = Agent(
    model="gemini-2.5-flash",
    provider="google",
    system_prompt=[{"role": "system", "content": "Use search tools to research. Then hand off."}],
    tool_node="RESEARCHER_TOOLS",
    trim_context=True,
)

# ── Graph ────────────────────────────────────────────────────────────────────
graph = StateGraph()
graph.add_node("COORDINATOR",       coordinator)
graph.add_node("COORDINATOR_TOOLS", coordinator_tools)
graph.add_node("RESEARCHER",        researcher)
graph.add_node("RESEARCHER_TOOLS",  researcher_tools)

graph.set_entry_point("COORDINATOR")
graph.add_edge("COORDINATOR_TOOLS", "COORDINATOR")
graph.add_edge("RESEARCHER_TOOLS",  "RESEARCHER")

# Coordinator decides to call a tool, go to tool node, or end
graph.add_conditional_edges(
    "COORDINATOR",
    lambda state: "COORDINATOR_TOOLS" if _has_tool_call(state) else END,
    {"COORDINATOR_TOOLS": "COORDINATOR_TOOLS", END: END},
)

graph.add_conditional_edges(
    "RESEARCHER",
    lambda state: "RESEARCHER_TOOLS" if _has_tool_call(state) else "COORDINATOR",
    {"RESEARCHER_TOOLS": "RESEARCHER_TOOLS", "COORDINATOR": "COORDINATOR"},
)

app = graph.compile()
```

When the coordinator LLM calls `transfer_to_researcher`, the graph navigates directly to the `RESEARCHER` node. The tool function body is never executed.

## How it works

1. `create_handoff_tool("researcher")` creates a function named `transfer_to_researcher` with `__handoff_tool__ = True` and `__target_agent__ = "researcher"`.
2. When the agent produces a tool call whose name starts with `transfer_to_`, the node handler calls `is_handoff_tool(name)` before executing the tool.
3. If a handoff is detected, the handler redirects graph execution to the target node and skips the tool call completely, keeping the message history clean.

## Use `Command` for explicit routing

If you prefer to control routing in a regular node function without the `transfer_to_` naming convention, return a `Command`:

```python
from agentflow.utils import Command, END
from agentflow.core.state import AgentState

def router_node(state: AgentState, config: dict) -> Command:
    last_msg = state.context[-1].text() if state.context else ""

    if "research" in last_msg.lower():
        return Command(goto="RESEARCHER")
    elif "write" in last_msg.lower():
        return Command(goto="WRITER")
    else:
        return Command(goto=END)

graph.add_node("ROUTER", router_node)
```

`Command` fields:

| Field | Type | Description |
|---|---|---|
| `goto` | `str \| None` | Name of the next node, or `END`. |
| `update` | `StateT \| Message \| str \| None` | State update to apply before navigating. |
| `graph` | `str \| None` | `None` for current graph; `Command.PARENT` to return to a parent graph. |
| `state` | `StateT \| None` | Optional full state to attach. |

## Return to parent graph

In a nested graph, return `Command(goto=END, graph=Command.PARENT)` to hand execution back to the parent:

```python
return Command(goto=END, graph=Command.PARENT)
```

## Common errors

| Error | Cause | Fix |
|---|---|---|
| Agent keeps calling `transfer_to_X` but never moves | Target node name doesn't exist in the graph. | Verify `agent_name` matches an `add_node` call exactly. |
| Handoff tool is actually *executed* (logs show "should have been intercepted") | Node handler is not the framework's built-in handler. | Use `Agent`/`ToolNode` — don't replace the node execution logic. |
| Routing loop (agents keep handing off to each other) | No base-case conditional edge to `END`. | Add a final `END` condition on at least one agent's routing function. |
| `Command.goto` is ignored | Returned from a plain `Agent` node instead of a custom node. | Only return `Command` from custom node functions, not from `Agent` instances. |
