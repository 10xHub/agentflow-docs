---
title: Prebuilt Agents and Tools
description: Ready-made AgentFlow graph patterns, common tools, and handoff helpers.
sidebar_position: 6
---

# Prebuilt agents and tools

AgentFlow includes prebuilt building blocks for common agent patterns. Use them when the default shape matches your workflow, and drop down to `StateGraph`, `Agent`, and `ToolNode` when you need custom control.

## Prebuilt agents

Stable prebuilt agents are exported from `agentflow.prebuilt.agent` and `agentflow.prebuilt`.

| Agent | Use case |
|---|---|
| `ReactAgent` | Standard model and tool loop. |
| `RouterAgent` | Route work to specialized agents or branches. |
| `RAGAgent` | Retrieval-augmented generation with retriever and synthesis steps. |

Some experimental modules may exist in source. Treat exported names as the stable public surface.

## Prebuilt tools

Common tools are exported from `agentflow.prebuilt.tools`.

| Tool | Use case |
|---|---|
| `safe_calculator` | Evaluate simple math expressions safely. |
| `fetch_url` | Fetch web content from a URL. |
| `file_read`, `file_write`, `file_search` | Work with files where enabled. |
| `google_web_search`, `vertex_ai_search` | Search integrations. |
| `memory_tool`, `make_user_memory_tool`, `make_agent_memory_tool` | Store or retrieve long-term memory. |
| `create_handoff_tool`, `is_handoff_tool` | Transfer control between graph agents. |

## Handoff tools

Handoff tools let the model transfer execution to another graph node by calling a tool with the `transfer_to_<agent>` convention.

```python
from agentflow.prebuilt.tools import create_handoff_tool
from agentflow.core import ToolNode

tools = ToolNode([
    create_handoff_tool(
        agent_name="RESEARCHER",
        description="Transfer to the research agent.",
    ),
])
```

Use handoff tools for agent-to-agent delegation. Use `Command(goto=...)` when routing should be explicit code rather than an LLM tool choice.

## Rules

| Rule | Why it matters |
|---|---|
| Prefer prebuilt agents for common patterns | They encode the standard AgentFlow graph shape. |
| Keep handoff targets aligned with node names | The graph jumps to the target node. |
| Use tools for capabilities, not routing policy | Routing policy often belongs in graph edges or `Command`. |
| Check reference docs for constructor details | Prebuilt surfaces evolve as new patterns stabilize. |

## Related docs

- [Agents and tools](./agents-and-tools.md)
- [Callbacks and Command](./callbacks-and-command.md)
- [Command and handoff reference](/docs/reference/python/command-handoff)
