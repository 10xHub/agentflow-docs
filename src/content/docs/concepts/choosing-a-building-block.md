---
title: Choosing a building block
description: Decide between prebuilt agents, the Agent class, and custom nodes based on your pattern and flexibility needs.
section: Concepts
group: Foundations
order: 50
label: Choosing a building block
updated: "2026-10-08"
faq:
  - q: When should I use a prebuilt agent vs. building my own?
    a: Use a prebuilt when your workflow matches a standard pattern (react loop, RAG, supervisor, swarm) and you do not need custom nodes or topology changes. Use Agent in a custom graph when you need pre- or post-processing nodes, multiple agents, or non-standard routing.
  - q: Can I mix prebuilt agents, Agent nodes, and custom functions in one graph?
    a: Yes, they are fully composable. A realistic production graph often chains custom nodes for data loading, an Agent node for LLM calls, and tool nodes for parallel execution, all within one StateGraph.
  - q: What is the performance impact of each building block?
    a: Prebuilt agents are compiled once and run efficiently. Agent nodes in a graph have the same overhead as manually wiring the same LLM calls. Custom function nodes have minimal overhead and are ideal for non-LLM logic.
---

When you build an agent in 10xGraph, you have three levels of abstraction to choose from. Each trades flexibility for convenience. Understand the trade-offs to pick the right tool for your use case.

## Why this choice matters

Starting with the right building block saves you from refactoring later. A choice that is too high-level may force you to throw it away when you need custom routing. A choice that is too low-level costs time you could spend on business logic. The key is matching your pattern to the abstraction level that fits it.

## Quick comparison

| Dimension | Prebuilt | `Agent` + graph | Custom function |
|---|---|---|---|
| **Setup time** | 5 lines | ~30 lines | As much as needed |
| **LLM integration** | Handled | Handled | You own it |
| **Graph shape** | Fixed | You define it | You define it |
| **Routing control** | None | Full | Full |
| **Custom state** | Limited | Yes | Yes |
| **Dependency injection** | No | No | Yes, via `Inject[T]` |
| **Best for** | Standard patterns, demos | Most production agents | Non-LLM logic, custom providers |

---

## Prebuilt agents: ready-made patterns

Prebuilt agents are complete, compiled graphs. One constructor call returns a runnable `CompiledGraph`. No `StateGraph`, no edges, no `compile()` step.

10xGraph ships with seven prebuilt agents and a set of reranker classes for RAG-specific use cases.

### Available agents

| Agent | Pattern | When to use |
|---|---|---|
| `ReactAgent` | Standard agentic loop: think, act, observe | Single agent answering questions with tools |
| `PlanActReflectAgent` | Plan before acting, then reflect on results | Complex tasks requiring structured reasoning |
| `RAGAgent` | Retrieval-augmented generation with synthesis | Knowledge-base question answering with sources |
| `StructuredOutputAgent` | Forces final output to a schema | Needing structured JSON from the model |
| `SupervisorTeamAgent` | Supervisor routes tasks to specialist workers | Multi-agent systems with a single coordinator |
| `SwarmAgent` | Peer agents hand control to each other | Multi-agent systems with decentralized control |
| `AudioAgent` | Realtime audio-to-audio over a live connection | Voice conversations with low latency |

The `RAGAgent` includes reranking support via base classes:

- `BaseReranker`: Interface for custom document reranking logic
- `CohereReranker`: Rerank using Cohere's reranking API
- `CrossEncoderReranker`: Rerank using a local cross-encoder model

### How to use a prebuilt

```python
from tenxgraph.prebuilt import ReactAgent
from tenxgraph.core.state import Message

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

### When to use a prebuilt agent

- The pattern matches one of the seven agents exactly.
- You are prototyping, building a demo, or shipping an MVP where the default topology is sufficient.
- All the configuration you need is available in the agent's constructor.
- You do not need custom nodes before, after, or alongside the agent.

### When not to use a prebuilt agent

- You need a custom graph topology: extra nodes, non-standard edges, or nodes that wrap the agent.
- You need to inject framework services (`Inject[T]` dependencies) into graph nodes.
- You need multiple agents in a single graph with custom routing between them.
- You need to preprocess input or postprocess output at the graph level.

---

## Agent class in a custom graph: high control

`Agent` is a single node, not a complete graph. You embed it inside a `StateGraph` alongside other nodes and define the edges. This is the most common pattern for production systems.

The `Agent` class owns the entire LLM interaction: message conversion, provider detection, tool call parsing, retry logic, context trimming, reasoning configuration, and multimodal handling. You provide the graph structure.

### How to use Agent in a graph

```python
from tenxgraph.core.graph import StateGraph, Agent, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.utils import END

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
    if last and last.role == "assistant" and getattr(last, "tool_calls", None):
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

### When to use Agent in a custom graph

- You are calling an LLM on a standard provider (OpenAI, Google, or OpenAI-compatible API).
- You need built-in features like tool call detection, retry logic, fallback models, or reasoning configuration.
- You want to add preprocessing nodes (e.g., load context), postprocessing nodes (e.g., validate output), or routing nodes around the LLM call.
- You have multiple agents in a single graph (supervisor, swarm, or pipeline patterns).
- You need fine-grained control over message handling or state updates.

### When not to use Agent

- The node does not call an LLM at all. Use a custom function node instead.
- You are using a custom or unsupported LLM provider. Use a custom function node and call the provider directly.
- You need full control over the prompt format. Use a custom function node instead.

---

## Custom function nodes: maximum flexibility

A custom function node is a plain Python function, sync or async, registered as a graph node. The framework automatically injects `state` and `config` by name; other dependencies come via dependency injection with `Inject[T]`.

Custom nodes are ideal for non-LLM logic: data loading, validation, logging, external API calls, or calculations. They can also wrap custom LLM providers.

### How to write a custom node

```python
from injectq import Inject
from tenxgraph.core.state import AgentState
from tenxgraph.storage.store import BaseStore

async def load_user_context(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore],
) -> dict:
    """Load user context from the store before the agent runs."""
    user_id = config.get("user_id")
    if not user_id:
        return {}
    
    profile = await store.aget(
        namespace=("users", user_id),
        key="profile",
    )
    return {"user_context": profile.value if profile else {}}
```

Return types can be `str`, `Message`, `list[Message]`, `AgentState`, or `Command`.

### When to use custom function nodes

- The node does not call an LLM: loading data, logging, validation, routing, external API calls, or calculations.
- You need to run logic before or after an `Agent` node (e.g., context loading, output validation).
- You are using a custom or unsupported LLM provider and want to call it directly.
- You need dynamic routing that depends on side effects inside the node. Return `Command(goto=...)` to jump to a specific node.
- You need direct access to framework services like the checkpointer, store, or event publisher via `Inject[T]`.

---

## Decision flowchart

Use this flowchart to pick the right building block:

```
Does your workflow match a standard pattern?
(react loop, RAG, supervisor, swarm, etc.)
│
├── Yes, and the default shape is enough  →  Use a prebuilt agent
│
└── No, or you need customization
    │
    ├── Does the node call an LLM?
    │   │
    │   ├── Yes, on OpenAI / Google / compatible  →  Use Agent in a graph
    │   │
    │   └── No, or custom provider  →  Use a custom function node
    │
    └── Do you need non-LLM nodes (loading, routing, validation)?
        └── Yes  →  Mix custom nodes + Agent in a graph
```

---

## Mixing all three: a realistic example

Prebuilt agents, `Agent` nodes, and custom functions are fully composable. Most production systems chain them together.

```python
from tenxgraph.core.graph import StateGraph, Agent, ToolNode
from tenxgraph.core.state import AgentState
from tenxgraph.utils import END
from injectq import Inject
from tenxgraph.storage.store import BaseStore

# Custom node 1: Load context before the agent
async def load_user_context(
    state: AgentState,
    config: dict,
    store: BaseStore = Inject[BaseStore],
) -> dict:
    user_id = config.get("user_id")
    context = await store.aget(("users", user_id), "context")
    return {"user_context": context.value if context else {}}

# Agent node: Handle LLM calls and tool coordination
agent = Agent(
    model="gpt-4o",
    tool_node=ToolNode([search_web, get_weather]),
    retry_config=True,
)

# Custom node 2: Validate and log after the agent
def audit_response(state: AgentState, config: dict) -> dict:
    last_msg = state.context[-1] if state.context else None
    print(f"[{config['thread_id']}] Agent response: {last_msg}")
    return {}

# Build the graph
graph = StateGraph()
graph.add_node("LOAD", load_user_context)
graph.add_node("AGENT", agent)
graph.add_node("AUDIT", audit_response)

graph.set_entry_point("LOAD")
graph.add_edge("LOAD", "AGENT")
graph.add_edge("AGENT", "AUDIT")
graph.add_edge("AUDIT", END)

app = graph.compile()
```

This example chains a data-loading node, an LLM node, and a validation node. Each uses the abstraction level that fits its purpose.

---

## Prebuilt tools and helpers

Beyond agents, 10xGraph includes prebuilt tools and helper functions to save common implementation work:

- **Tool helpers**: `safe_calculator` (math), `fetch_url` (web), `file_read` / `file_write` / `file_search` (filesystem), `google_web_search` / `vertex_ai_search` (search integrations).
- **Memory tools**: `memory_tool`, `make_user_memory_tool`, `make_agent_memory_tool` for building memory-aware agents.
- **Handoff tools**: `create_handoff_tool` and `is_handoff_tool` for multi-agent control flow.

See the [Prebuilt agents and tools](/docs/guides/prebuilt-agents) guide for the full list and how to use each.

---

## Related pages

- [Prebuilt agents and tools](/docs/guides/prebuilt-agents): Guide to all available prebuilts, their parameters, and examples.
- [Build a graph](/docs/guides/build-a-graph): How to construct and run a custom StateGraph.
- [Configure Agent](/docs/guides/configure-agent): Deep dive into Agent constructor parameters and capabilities.
- [Use custom nodes](/docs/guides/use-custom-nodes): Detailed guide to writing and integrating custom function nodes.
- [Agents and tools](/docs/concepts/agents-and-tools): Conceptual overview of how agents and tools work together.
