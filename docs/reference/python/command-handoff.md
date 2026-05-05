---
title: "Command & Handoff — AgentFlow Python AI Agent Framework"
sidebar_label: "Command & Handoff"
description: Command and create_handoff_tool — control graph routing from inside nodes and transfer execution between agents.
keywords:
  - agentflow python reference
  - agent api reference
  - python agent library
  - agentflow
  - python ai agent framework
  - "command & handoff"
sidebar_position: 17
---


# Command & Handoff

## When to use this

Use `Command` when a node needs to decide the next destination at runtime and also update state in the same step. Use `create_handoff_tool` when you want the *LLM itself* to decide to route to another agent by calling a tool.

## Import paths

```python
from agentflow.utils import Command
from agentflow.prebuilt.tools import create_handoff_tool, is_handoff_tool
```

---

## `Command`

A return value from a node function that combines a state update with an explicit routing decision.

```python
from agentflow.utils import Command, END

def router_node(state, config: dict) -> Command:
    last = state.context[-1].text() if state.context else ""

    if "research" in last.lower():
        return Command(goto="RESEARCHER")
    elif "write" in last.lower():
        return Command(goto="WRITER")
    else:
        return Command(goto=END)
```

### Constructor

```python
Command(
    update=None,
    goto=None,
    graph=None,
    state=None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `update` | `StateT \| Message \| str \| BaseConverter \| None` | `None` | State patch to apply before navigating. Merged into the current state by the graph runner. |
| `goto` | `str \| None` | `None` | Name of the next node to execute, or `END` to terminate. |
| `graph` | `str \| None` | `None` | `None` for the current graph; `Command.PARENT` to return to the calling (parent) graph. |
| `state` | `StateT \| None` | `None` | Full state object to attach. Used for passing state across subgraph boundaries. |

### Constants

| Constant | Value | Description |
|---|---|---|
| `Command.PARENT` | `"PARENT"` | Pass as `graph=Command.PARENT` to hand off to the parent graph. |

### Examples

**Navigate and update state in one step:**

```python
from agentflow.core.state import Message

def classify_node(state, config) -> Command:
    user_state = state  # could be a custom subclass
    user_state.category = "billing"   # update a custom field
    return Command(
        update=user_state,
        goto="BILLING_AGENT",
    )
```

**Return to parent graph from a subgraph:**

```python
def subgraph_final_node(state, config) -> Command:
    return Command(goto=END, graph=Command.PARENT)
```

**Pass a message as the update:**

```python
return Command(
    update=Message.text_message("Routing to specialist..."),
    goto="SPECIALIST",
)
```

---

## `create_handoff_tool`

Factory that creates an LLM-callable tool. When the LLM calls it, the graph detects the `transfer_to_<agent>` naming pattern and navigates directly to that node — without actually executing the function body.

```python
from agentflow.prebuilt.tools import create_handoff_tool
from agentflow.core import ToolNode

transfer_to_researcher = create_handoff_tool(
    agent_name="RESEARCHER",
    description="Transfer to the research agent for detailed investigation.",
)

tools = ToolNode([transfer_to_researcher, other_tool])
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `agent_name` | `str` | **required** | Must match an existing node name in the graph exactly. |
| `description` | `str \| None` | `None` | Description shown to the LLM in its tool list. Defaults to `"Transfer control to <agent_name> agent"`. |

### Returns

A callable with:
- `__name__` = `f"transfer_to_{agent_name}"`
- `__doc__` = the description string
- `__handoff_tool__` = `True`
- `__target_agent__` = `agent_name`

### How the interception works

```
Agent produces a ToolCallBlock with name = "transfer_to_RESEARCHER"
  │
  └── invoke_node_handler / stream_node_handler
        └── is_handoff_tool("transfer_to_RESEARCHER")
              → (True, "RESEARCHER")
        └── Redirect graph execution to node "RESEARCHER"
            (tool function body is NEVER called)
```

---

## `is_handoff_tool`

Utility to check whether a tool name follows the handoff convention.

```python
from agentflow.prebuilt.tools import is_handoff_tool

is_handoff, target = is_handoff_tool("transfer_to_researcher")
# is_handoff = True, target = "researcher"

is_handoff, target = is_handoff_tool("get_weather")
# is_handoff = False, target = None
```

Returns `(bool, str | None)`.

---

## Full multi-agent example

```python
from agentflow.core import Agent, StateGraph, ToolNode
from agentflow.prebuilt.tools import create_handoff_tool
from agentflow.core.state import AgentState
from agentflow.utils import END

# ── Tool nodes ───────────────────────────────────────────────────────────────
coord_tools = ToolNode([
    create_handoff_tool("RESEARCH", "Delegate research tasks"),
    create_handoff_tool("WRITE",    "Delegate writing tasks"),
])

research_tools = ToolNode([
    create_handoff_tool("COORD", "Return with findings"),
])

# ── Agents ───────────────────────────────────────────────────────────────────
def _has_tool_call(state: AgentState) -> bool:
    last = state.context[-1] if state.context else None
    return bool(last and getattr(last, "tools_calls", None))

coord   = Agent(model="gemini-2.5-flash", provider="google",
                 tool_node="COORD_TOOLS", trim_context=True,
                 system_prompt=[{"role": "system", "content": "Coordinate tasks."}])
research = Agent(model="gemini-2.5-flash", provider="google",
                  tool_node="RESEARCH_TOOLS", trim_context=True,
                  system_prompt=[{"role": "system", "content": "Research thoroughly."}])

# ── Graph ────────────────────────────────────────────────────────────────────
graph = StateGraph()
graph.add_node("COORD",          coord)
graph.add_node("COORD_TOOLS",    coord_tools)
graph.add_node("RESEARCH",       research)
graph.add_node("RESEARCH_TOOLS", research_tools)

graph.set_entry_point("COORD")

graph.add_conditional_edges(
    "COORD",
    lambda s: "COORD_TOOLS" if _has_tool_call(s) else END,
    {"COORD_TOOLS": "COORD_TOOLS", END: END},
)
graph.add_edge("COORD_TOOLS",    "COORD")

graph.add_conditional_edges(
    "RESEARCH",
    lambda s: "RESEARCH_TOOLS" if _has_tool_call(s) else "COORD",
    {"RESEARCH_TOOLS": "RESEARCH_TOOLS", "COORD": "COORD"},
)
graph.add_edge("RESEARCH_TOOLS", "RESEARCH")

app = graph.compile()
```

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `"should have been intercepted"` in logs | Handoff tool actually executed. | Check that `invoke_node_handler` / `stream_node_handler` is the active handler (use standard `Agent`/`ToolNode`, not custom handlers). |
| LLM doesn't choose handoff tools | Tool description is unclear. | Improve `description=` to be action-oriented. |
| `Command.goto` is ignored | Returned from inside an `Agent` node (not a custom node). | `Command` is only honoured when returned from a plain node function, not from `Agent`. |
| Infinite handoff loop | No `END` condition in any routing function. | Add at least one `goto=END` path. |
| `ValueError` from `create_handoff_tool` | `agent_name` is empty or not a string. | Validate `agent_name` before calling; must be a non-empty string. |
