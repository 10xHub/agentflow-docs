---
title: Memory and Store
description: How the memory store provides long-term, cross-thread storage for user and agent facts.
---

# Memory and store

The checkpointer covers per-thread short-term memory. The memory store covers long-term memory that can be shared across threads and users.

## Checkpointer vs store

| | Checkpointer | Memory store |
| --- | --- | --- |
| Scope | One thread | Cross-thread, cross-user |
| Content | Full `AgentState` | Structured memory records |
| Lifetime | Until thread expires | Until explicitly deleted |
| Retrieval | Exact key (thread_id) | Semantic similarity search |

Use the checkpointer when you need conversation continuity within a thread. Use the store when you want the agent to remember facts about a user, preferences, or knowledge across different conversations.

## Available store backends

| Class | Module | Backend |
| --- | --- | --- |
| `QdrantStore` | `agentflow.storage.store` | Qdrant vector database |
| `Mem0Store` | `agentflow.storage.store` | Mem0 managed memory |

Both backends support semantic similarity search — you can search for memories by meaning, not just exact match.

## Basic usage

```python
from agentflow.storage.store import create_local_qdrant_store

store = create_local_qdrant_store(collection="agent-memories")

# Store a memory
await store.add(
    content="User prefers concise responses.",
    user_id="user-123",
    metadata={"category": "preference"},
)

# Search for relevant memories
results = await store.search(
    query="How does this user like to communicate?",
    user_id="user-123",
    limit=3,
)

for record in results:
    print(record.content)
```

## Integrating memory into a graph

The typical pattern injects stored memories into the system prompt before each model call. AgentFlow provides a helper node for this:

```python
from agentflow.storage.store import create_memory_preload_node, get_memory_system_prompt

memory_node = create_memory_preload_node(store, user_id_field="user_id")
```

Add the memory node before the agent node so relevant memories are available in state:

```python
graph.add_node("MEMORY", memory_node)
graph.add_node("MAIN", agent)
graph.add_edge("MEMORY", "MAIN")
graph.set_entry_point("MEMORY")
```

The memory node retrieves relevant records and writes them into a field that the agent's system prompt can reference via `{memory_context}`.

## REST API for store

When the store is configured in `agentflow.json`, the API exposes memory endpoints:

```bash
POST /v1/store/memories       # store a memory
POST /v1/store/search         # search memories
GET  /v1/store/memories       # list memories
PUT  /v1/store/memories/{id}  # update a memory
DELETE /v1/store/memories/{id} # delete a memory
```

See [REST API: Memory store](../reference/rest-api/memory-store.md) for full details.

## Configuring the store in agentflow.json

```json
{
  "agent": "graph.react:app",
  "store": "graph.dependencies:my_store"
}
```

## What you learned

- The memory store provides cross-thread long-term memory, unlike the per-thread checkpointer.
- `QdrantStore` and `Mem0Store` are the built-in backends.
- `create_memory_preload_node` injects relevant memories into state before the model call.
- The store is configured in `agentflow.json` when using the API layer.

## Related concepts

- [Checkpointing and threads](./checkpointing-and-threads.md)
- [REST API: Memory store](../reference/rest-api/memory-store.md)
