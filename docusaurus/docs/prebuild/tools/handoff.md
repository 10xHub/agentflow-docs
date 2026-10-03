---
title: Handoff Tools — Prebuilt tools
sidebar_label: Handoff Tools
description: create_handoff_tool and is_handoff_tool build and detect transfer_to_X tools used to route control between agents in a swarm.
keywords:
  - handoff tools
  - create_handoff_tool
  - is_handoff_tool
  - agent transfer tool
  - swarm handoff
---

# Handoff Tools

Utilities for creating agent-to-agent transfer tools used in multi-agent swarm patterns.

**Import path:** `agentflow.prebuilt.tools.handoff`

Handoff tools are special tools that tell an LLM it can transfer control to another agent. When the LLM calls a handoff tool, the **graph routing layer** intercepts the call and navigates to the target node directly — the tool function body never actually executes. This keeps the conversation history clean (no spurious tool-result messages).

---

## `create_handoff_tool`

Factory function that creates a `transfer_to_<agent_name>` tool.

### Concept

In a swarm or peer-to-peer multi-agent graph, each agent needs to know which other agents it can route to. `create_handoff_tool` creates one tool per target. The naming convention `transfer_to_<name>` is what the graph routing layer detects to perform the handoff.

```
Agent calls transfer_to_researcher
    ↓
Graph routing layer detects "transfer_to_" prefix
    ↓
Graph routes to the RESEARCHER node
    (tool body never runs)
```

### Signature

```python
def create_handoff_tool(
    agent_name: str,
    description: str | None = None,
) -> Callable
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `agent_name` | `str` | Name of the target agent/node. Must match a node name in the graph. |
| `description` | `str \| None` | LLM-visible description of when to use this handoff. Auto-generated if `None`. |

### Returns

A callable with `__name__ = "transfer_to_<agent_name>"` and two metadata attributes:
- `__handoff_tool__ = True`
- `__target_agent__ = agent_name`

### Usage

```python
from agentflow.prebuilt.tools.handoff import create_handoff_tool
from agentflow.core.graph import Agent, ToolNode

transfer_to_researcher = create_handoff_tool(
    agent_name="researcher",
    description="Transfer to the research specialist for web searches and fact finding.",
)
transfer_to_writer = create_handoff_tool(
    agent_name="writer",
    description="Transfer to the writer once all research is complete.",
)

triage_agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([transfer_to_researcher, transfer_to_writer]),
    system_prompt=[{
        "role": "system",
        "content": "Route the user's request to the right specialist.",
    }],
)
```

In practice, you rarely call `create_handoff_tool` directly. Use `SwarmAgent` instead — it generates and injects handoff tools automatically based on the `can_handoff_to` configuration.

---

## `is_handoff_tool`

Helper that checks whether a tool name follows the handoff naming convention.

### Signature

```python
def is_handoff_tool(tool_name: str) -> tuple[bool, str | None]
```

### Returns

`(is_handoff, target_agent_name)`:
- If `is_handoff` is `True`, `target_agent_name` contains the extracted target name.
- If `is_handoff` is `False`, `target_agent_name` is `None`.

### Examples

```python
from agentflow.prebuilt.tools.handoff import is_handoff_tool

is_handoff_tool("transfer_to_researcher")  # (True, "researcher")
is_handoff_tool("calculate")               # (False, None)
is_handoff_tool("transfer_to_")           # (False, None)  — empty target
```

This function is used internally by `SwarmAgent`'s routing functions to detect handoff calls inside `state.context[-1].tools_calls`. You can use it when building custom routing logic for manual multi-agent graphs.

---

## Manual multi-agent example

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.core.graph.state_graph import StateGraph
from agentflow.core.state.agent_state import AgentState
from agentflow.prebuilt.tools.handoff import create_handoff_tool, is_handoff_tool
from agentflow.utils.constants import END


def make_route(allowed: list[str]):
    def _route(state: AgentState) -> str:
        last = state.context[-1] if state.context else None
        if last and last.role == "assistant" and last.tools_calls:
            for tc in last.tools_calls:
                ok, target = is_handoff_tool(tc.get("name", ""))
                if ok and target and target.upper() in allowed:
                    return target.upper()
        return END
    return _route


transfer_to_writer = create_handoff_tool("writer", "Send to the writer when research is done.")

researcher = Agent(
    model="gpt-4o",
    tool_node=ToolNode([transfer_to_writer]),
)

writer = Agent(model="gpt-4o-mini")

graph = StateGraph()
graph.add_node("RESEARCHER", researcher)
graph.add_node("WRITER", writer)
graph.add_conditional_edges("RESEARCHER", make_route(["WRITER"]), {"WRITER": "WRITER", END: END})
graph.add_edge("WRITER", END)
graph.set_entry_point("RESEARCHER")

app = graph.compile()
```

For most use cases, use `SwarmAgent` rather than wiring handoffs manually.
