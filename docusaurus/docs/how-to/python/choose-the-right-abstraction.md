---
title: Choosing the right abstraction
sidebar_label: Choose the right abstraction
description: When to use prebuilt agents, the Agent class in a custom graph, or plain function nodes.
keywords:
  - agentflow prebuilt agent
  - agent class vs custom node
  - when to use prebuilt
  - agentflow python
sidebar_position: 2
---

# Choosing the right abstraction

AgentFlow gives you three levels to work at. Each one trades flexibility for convenience.

| | Prebuilt | `Agent` + graph | Custom function node |
|---|---|---|---|
| **Setup** | 5 lines | ~30 lines | As much as you need |
| **LLM call** | Handled | Handled | You write it (optional) |
| **Graph topology** | Fixed | You define it | You define it |
| **Control flow** | Not customizable | Full control | Full control |
| **Custom state fields** | Limited | Yes | Yes |
| **InjectQ services** | Not directly | Not directly | `Inject[T]` on any param |
| **Best for** | Standard patterns, prototypes | Most production agents | Non-LLM steps, custom providers, logic that wraps an Agent |

---

## Prebuilt agents

Prebuilt agents are complete, compiled graphs. One constructor call gives you a runnable `CompiledGraph` — no `StateGraph`, no edges, no `compile()`.

**Available prebuilts:**

| Class | Pattern |
|---|---|
| `ReactAgent` | Single agent with tool use (react loop) |
| `PlanActReflectAgent` | Plan → execute → reflect loop |
| `RagAgent` | Retrieval-augmented generation |
| `StructuredOutputAgent` | Forces structured JSON output |
| `SupervisorTeamAgent` | Supervisor routes tasks to specialist workers |
| `SwarmAgent` | Peer-to-peer handoff between agents |

```python
from agentflow.prebuilt.agent.react import ReactAgent

app = ReactAgent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tools=[get_weather, search_web],
).compile()

result = app.invoke(
    {"messages": [Message.text_message("What is the weather in Paris?")]},
    config={"thread_id": "t1"},
)
```

**Use a prebuilt when:**

- You need a well-known pattern (react loop, RAG, supervisor, swarm) and the default topology fits.
- You are prototyping or building a demo and do not want to wire a graph manually.
- The prebuilt's constructor arguments cover all the configuration you need.

**Do not use a prebuilt when:**

- You need a custom graph topology — extra nodes, non-standard edges, or a node before/after the agent.
- You need to inject custom services (`Inject[T]`) into graph nodes.
- You need to share a `ToolNode` across multiple agents in a single graph.

---

## `Agent` class in a custom graph

`Agent` is a node, not a full graph. You place it inside a `StateGraph` alongside other nodes and wire the edges yourself. This is the most common pattern for production agents.

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState, Message
from agentflow.utils import END

tool_node = ToolNode([get_weather, search_web])

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a helpful assistant."}],
    tool_node=tool_node,
    retry_config=True,
    trim_context=True,
)

def should_use_tools(state: AgentState) -> str:
    last = state.context[-1] if state.context else None
    if last and last.role == "assistant" and getattr(last, "tools_calls", None):
        return "TOOL"
    return END

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.add_node("TOOL", tool_node)
graph.set_entry_point("MAIN")
graph.add_conditional_edges("MAIN", should_use_tools, {"TOOL": "TOOL", END: END})
graph.add_edge("TOOL", "MAIN")

app = graph.compile()
```

`Agent` owns the LLM call. It handles message conversion, tool call detection, retries, context trimming, reasoning config, and multimodal output through constructor arguments.

**Use `Agent` in a graph when:**

- The node's job is to call an LLM on a standard provider (OpenAI, Google, or any OpenAI-compatible API).
- You need built-in tool call detection, retry logic, fallback models, or reasoning config.
- You want to add custom nodes around the LLM call (pre-processing, post-processing, routing) — something a prebuilt cannot do.
- You have multiple agents in one graph (supervisor, swarm, pipeline).

**Do not use `Agent` when:**

- The node does not call an LLM (use a custom function node instead).
- You are calling an unsupported LLM provider or need full control over the prompt (use a custom function node + `ModelResponseConverter`).

---

## Custom function node

A plain Python function — sync or async — registered as a graph node. The framework auto-injects `state` and `config` by name; everything else comes via `Inject[T]`.

```python
from injectq import Inject
from agentflow.core.state import AgentState, Message
from agentflow.storage.store import BaseStore

async def load_profile(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore],
) -> dict:
    profile = await store.aget(
        namespace=("profiles", config["user_id"]),
        key="data",
    )
    return {"profile": profile.value if profile else {}}
```

Return types: `str`, `Message`, `list[Message]`, `AgentState`, or `Command`.

**Use a custom function node when:**

- The node does not need an LLM — loading data, logging, routing, calling an external API, running a calculation.
- You need to run something before or after an `Agent` node in the graph.
- You are calling a custom or unsupported LLM provider — call it yourself and return a `str`, `Message`, or `ModelResponseConverter`.
- The routing logic is dynamic and depends on side effects inside the node — return `Command`.
- You need direct access to framework services (checkpointer, store, publisher) via `Inject[T]`.

---

## Decision guide

```
Do you need a standard pattern (react loop, RAG, supervisor, swarm)?
│
├── Yes, and the default topology is enough  →  Prebuilt
│
└── No, or you need to customize the graph
    │
    ├── Does the node call an LLM on OpenAI / Google / compatible API?
    │   │
    │   ├── Yes  →  Agent class in a custom graph
    │   │
    │   └── No (or exotic provider / full prompt control)  →  Custom function node
    │
    └── Do you need non-LLM nodes (pre-processing, logging, routing)?
        └── Yes  →  Custom function nodes alongside Agent nodes in a graph
```

---

## Mixing all three

Prebuilts, `Agent`, and custom function nodes are fully composable. A realistic production graph often looks like this:

```python
from agentflow.prebuilt.agent.react import ReactAgent
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.core.state import AgentState
from agentflow.utils import END
from injectq import Inject
from agentflow.storage.store import BaseStore

# Custom node: enriches state before the agent runs
async def load_profile(state: AgentState, config: dict, store: BaseStore = Inject[BaseStore]) -> dict:
    ...

# Agent node: handles the LLM call
agent = Agent(model="gpt-4o", tool_node=ToolNode([get_weather]))

# Custom node: logs after the agent responds
def audit(state: AgentState, config: dict) -> dict:
    print(f"[{config['thread_id']}] {len(state.context)} turns")
    return {}

graph = StateGraph()
graph.add_node("LOAD", load_profile)
graph.add_node("MAIN", agent)
graph.add_node("AUDIT", audit)

graph.set_entry_point("LOAD")
graph.add_edge("LOAD", "MAIN")
graph.add_edge("MAIN", "AUDIT")
graph.add_edge("AUDIT", END)

app = graph.compile()
```

---

## Related docs

- [Prebuilt agents](use-prebuilt-agents.md)
- [Configure Agent](configure-agent.md)
- [Custom nodes](use-custom-nodes.md)
- [Build a graph](build-a-graph.md)
