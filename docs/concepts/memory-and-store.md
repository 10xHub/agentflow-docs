---
title: Memory and Store — AgentFlow Python AI Agent Framework
sidebar_label: Memory and Store
description: How long-term memory works in AgentFlow — memory_tool, retrieval modes, MemoryIntegration, and MemoryConfig.
keywords:
  - agentflow concepts
  - agent architecture
  - multi-agent orchestration
  - agentflow
  - python ai agent framework
  - memory and store
---


# Memory and store

The **memory store** provides long-term, cross-thread memory. Unlike the checkpointer (which saves per-thread state), the memory store lets an agent remember facts about users and itself **across different conversations**.

## Checkpointer vs store

| | Checkpointer | Memory store |
| --- | --- | --- |
| Scope | One thread | Cross-thread, cross-user |
| Content | Full `AgentState` snapshot | Individual memory records |
| Lifetime | Until thread is deleted | Until explicitly deleted |
| Retrieval | Exact key — `thread_id` | Semantic similarity search |
| Primary use | Conversation continuity | User preferences, facts, knowledge |

---

## How the agent accesses memory: `memory_tool`

Memory is not injected passively — the LLM **calls a tool** to interact with it.  
`memory_tool` is an `@tool`-decorated async function exposed to the agent's `ToolNode`.

```
LLM decides to remember/recall
       ↓
  calls memory_tool(action="store"|"search"|"delete", ...)
       ↓
  memory_tool writes / searches BaseStore (Qdrant, Mem0, …)
       ↑
  returns result to LLM
```

The three supported actions:

| Action | When to use |
|---|---|
| `action="store"` | Save a new fact or update an existing one (by `memory_key`) |
| `action="search"` | Recall relevant memories matching a query |
| `action="delete"` | Remove an outdated memory by `memory_id` |

**Deduplication** is automatic: if you call `store` with a `memory_key` that already exists (e.g. `"user_name"`), the existing record is *updated* rather than duplicated. As a fallback, near-identical text (similarity ≥ 0.95) is also deduplicated.

**Writes are asynchronous** — they run in the background via `BackgroundTaskManager` and never block the LLM's response.

---

## Retrieval modes

Control *when* memories flow into the LLM context:

| Mode | Behaviour |
|---|---|
| `"no_retrieval"` (default) | LLM cannot read past memories but CAN write new ones via `memory_tool` |
| `"preload"` | Relevant memories are retrieved and injected as a `system` message **before** the LLM call |
| `"postload"` | LLM retrieves memories on-demand by calling `memory_tool(action="search", ...)` |

---

## Available store backends

| Class | Module | Backend |
|---|---|---|
| `QdrantStore` | `agentflow.storage.store` | Qdrant vector database (local or cloud) |
| `Mem0Store` | `agentflow.storage.store` | Mem0 managed memory service |

Both backends support semantic similarity search via embeddings.

### Creating a local Qdrant store

```python
from agentflow.storage.store import QdrantStore, create_local_qdrant_store, OpenAIEmbedding

# Convenience factory (persistent on disk)
store = create_local_qdrant_store(
    collection="agent-memories",
    path="./memory_data",
    embedding=OpenAIEmbedding(),
)

# Or directly
store = QdrantStore(
    embedding=OpenAIEmbedding(),
    path="./memory_data",
    collection="agent-memories",
)
```

---

## Option A: Using `MemoryConfig` with `Agent`

This is the recommended approach when you build an agent with the high-level `Agent` class.

```python
from agentflow.core.graph import Agent, ToolNode
from agentflow.storage.store import (
    QdrantStore, MemoryConfig, OpenAIEmbedding,
    create_local_qdrant_store,
)

store = create_local_qdrant_store(
    collection="user-memories",
    path="./memory_data",
    embedding=OpenAIEmbedding(),
)

# Tool for the agent's regular work
@tool
def search_web(query: str) -> str:
    ...

tool_node = ToolNode([search_web])

agent = Agent(
    model="gemini/gemini-2.5-flash",
    tools=tool_node,
    memory=MemoryConfig(
        store=store,
        retrieval_mode="postload",   # LLM calls memory_tool to search
    ),
)
```

`Agent.__init__` calls `_setup_memory()` internally, which:

1. Appends a system prompt fragment (instructions about how to use memory) to the agent.
2. Registers `memory_tool` (and scope-specific tools) onto the existing `ToolNode`.

You **must** pass a `ToolNode` to `Agent` when memory tools are enabled; the framework will raise a `RuntimeError` otherwise.

### MemoryConfig fields

```python
from agentflow.storage.store import MemoryConfig, UserMemoryConfig, AgentMemoryConfig

MemoryConfig(
    store=store,                    # default store used if scope stores are not set
    retrieval_mode="postload",      # "no_retrieval" | "preload" | "postload"
    limit=5,                        # max memories to retrieve
    score_threshold=0.0,            # min similarity score (0.0 = all results)
    max_tokens=None,                # optional token budget for retrieved context
    inject_system_prompt=True,      # auto-add memory instructions to system prompt
    user_memory=UserMemoryConfig(   # user-scoped memory the LLM can search & write
        enabled=True,
        store=store,                # can override the top-level store
        user_id="user-42",          # if None, injected at runtime from config
        memory_type="episodic",
        category="general",
        limit=5,
    ),
    agent_memory=AgentMemoryConfig( # agent/app-scoped memory the LLM can only search
        enabled=False,
        store=store,
        agent_id="my-agent",
        memory_type="semantic",
    ),
)
```

---

## Option B: Using `MemoryIntegration` with `StateGraph`

For lower-level graph control, use `MemoryIntegration` directly.

```python
from agentflow.core.graph import StateGraph, Agent, ToolNode
from agentflow.storage.store import (
    MemoryIntegration,
    QdrantStore, OpenAIEmbedding,
    create_local_qdrant_store,
)
from agentflow.utils import END

store = create_local_qdrant_store(
    collection="agent-memories",
    path="./memory_data",
    embedding=OpenAIEmbedding(),
)

memory = MemoryIntegration(store=store, retrieval_mode="preload")

tool_node = ToolNode([search_web, *memory.tools])  # include memory_tool
agent = Agent(model="gemini/gemini-2.5-flash", system_prompt=memory.system_prompt)

graph = StateGraph()
graph.add_node("AGENT", agent)
graph.add_node("TOOLS", tool_node)
graph.add_edge("TOOLS", "AGENT")
graph.add_conditional_edges("AGENT", lambda s: "TOOLS" if s.tool_calls else END)

# wire() sets the entry point and (for preload mode) inserts the preload node
memory.wire(graph, entry_to="AGENT")

app = graph.compile(store=store)
```

### `MemoryIntegration` properties

| Property | Type | Description |
|---|---|---|
| `memory.tools` | `list[Callable]` | Contains `memory_tool` — add to your `ToolNode` |
| `memory.system_prompt` | `str` | System prompt fragment — pass to your LLM node |
| `memory.preload_node` | `Callable \| None` | Async node function; only set in `preload` mode |
| `memory.retrieval_mode` | `ReadMode` | The configured mode |
| `memory.store` | `BaseStore` | The underlying store instance |

### `wire()` method

```python
memory.wire(
    graph,
    entry_to="AGENT",           # the node to run after memory retrieval
    preload_node_name="memory_preload",  # name for the auto-added preload node
)
```

- **preload mode**: adds a `memory_preload` node, sets it as the graph entry point, edges it to `entry_to`.
- **no_retrieval / postload**: just calls `graph.set_entry_point(entry_to)`.

---

## System prompt fragments

`get_memory_system_prompt(mode)` returns the correct instructions for the LLM depending on the retrieval mode:

```python
from agentflow.storage.store import get_memory_system_prompt

print(get_memory_system_prompt("no_retrieval"))
# → "You do NOT have access to read or search long-term memories. ..."
#   + write instructions (memory_tool store/update/delete)

print(get_memory_system_prompt("preload"))
# → "You have been provided with long-term memory context ..."
#   + write instructions

print(get_memory_system_prompt("postload"))
# → "You have access to a memory_tool that can search, store, and delete ..."
#   (full read + write instructions)
```

All modes include **write instructions** — the LLM can always decide to persist new information.

---

## Writing memories: important rules

The system prompt instructs the LLM to:

- Use `action="store"` with a short `memory_key` (e.g. `"user_name"`, `"favorite_language"`).
- The framework handles deduplication — if the same `memory_key` exists it updates the old record.
- Use `action="delete"` only with an explicit `memory_id` returned from a prior search.
- **Never** use `action="update"` unless you have a specific `memory_id`.

```python
# The LLM internally calls something like:
memory_tool(
    action="store",
    content="User's name is Shudipto",
    memory_key="user_name",
    memory_type="semantic",
)
```

---

## Preload node

In `preload` mode the `_preload_node` function:

1. Extracts the latest user message as the search query.
2. Searches the store for the top-`limit` memories by similarity (cross-thread — `thread_id` is stripped).
3. Flushes any in-flight background writes first to avoid stale reads.
4. Returns a `[Message.text_message(..., role="system")]` list injected into state before the LLM sees the conversation.

You can customise the query extractor:

```python
from agentflow.storage.store import create_memory_preload_node

def my_query_builder(state):
    return state.context[-1].text() if state.context else ""

preload = create_memory_preload_node(
    store=store,
    query_builder=my_query_builder,
    limit=5,
    score_threshold=0.3,
)
graph.add_node("memory_preload", preload)
```

---

## REST API for the store

When a store is configured in `agentflow.json`, the API exposes memory CRUD endpoints:

```bash
POST   /v1/store/memories        # store a memory
POST   /v1/store/search          # search memories by query
GET    /v1/store/memories        # list memories
PUT    /v1/store/memories/{id}   # update a memory
DELETE /v1/store/memories/{id}   # delete a memory
```

See [REST API: Memory store](../reference/rest-api/memory-store.md) for schemas.

## Configuring via agentflow.json

```json
{
  "agent": "graph.react:app",
  "store": "graph.dependencies:my_store"
}
```

---

## Related concepts

- [Checkpointing and threads](./checkpointing-and-threads.md)
- [Agents and tools](./agents-and-tools.md)
- [REST API: Memory store](../reference/rest-api/memory-store.md)
