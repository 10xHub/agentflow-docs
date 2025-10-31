# Long-Term Memory with Mem0

Agentflow separates **short-term memory** (the evolving `AgentState` inside a graph
invocation) from **long-term memory** (durable memories persisted across runs).
This document shows how to enable long-term memory using the optional
[`mem0`](https://github.com/mem0ai/mem0) library.

> Install dependency:
>
> ```bash
> pip install mem0ai
> ```

## Concepts

- Short-term: `AgentState` / messages passed between nodes during a single graph
  execution; discarded unless explicitly persisted.
- Long-term: Stored via a `BaseStore` implementation. We provide `Mem0Store`
  which wraps Mem0's vector-backed memory layer (Qdrant / other backends
  configured through Mem0).

## Creating a Mem0Store

```python
from agentflow.store import create_mem0_store

mem_store = create_mem0_store(
    config={  # Optional Mem0 configuration; can be omitted for defaults
        "vector_store": {"provider": "qdrant", "config": {"url": "http://localhost:6333"}},
        "embedder": {"provider": "openai", "config": {"model": "text-embedding-3-small"}},
        "llm": {"provider": "openai", "config": {"model": "gpt-4o-mini"}},
    },
    user_id="user-123",  # default user scope
    thread_id="conversation-1",  # optional thread / agent scope
    app_id="demo-app",  # application scoping
)
```

Use the async API (recommended) — every method accepts a `config` dict allowing
per-call overrides of `user_id`, `thread_id`, `app_id`.

```python
memory_id = await mem_store.astore(
    config={"user_id": "user-123", "thread_id": "chat-42"},
    content="Alice lives in Berlin.",
)

results = await mem_store.asearch(
    config={"user_id": "user-123"},
    query="Where does Alice live?",
    limit=5,
)
```

Each stored item receives a framework UUID (`memory_id`) distinct from Mem0's
internal id. You use the framework id with `aget`, `aupdate`, and `adelete`.

## Integrating with a Graph

You can add a node that retrieves similar memories before tool / LLM reasoning.

```python
from agentflow.graph import StateGraph, Node
from agentflow.utils import Message


async def recall_node(state, config):
    query = state.latest_user_message().text()
    memories = await mem_store.asearch({"user_id": state.user_id}, query=query, limit=3)
    # Attach recalled facts to state metadata or messages
    state.context.memories = [m.content for m in memories]
    return state


graph = StateGraph(state_type=YourStateModel)
graph.add_node("recall", recall_node)
...  # other nodes
```

## Batch Store

```python
await mem_store.abatch_store(
    config={"user_id": "user-123"},
    content=["Bob likes cycling", "Carol works at Acme"],
)
```

## Updating & Deleting

```python
await mem_store.aupdate(
    config={"user_id": "user-123"},
    memory_id=memory_id,
    content="Alice lives in Munich.",
)

await mem_store.adelete({"user_id": "user-123"}, memory_id)
```

## Forgetting (User / Thread)

```python
await mem_store.aforget_memory({"user_id": "user-123", "thread_id": "chat-42"})
```

## When to Use Long-Term Memory

Use Mem0Store when you need persistence across sessions, personalization, or
context accumulation. Keep transient reasoning tokens in `AgentState` and only
persist distilled facts / stable user preferences to reduce noise.

## Troubleshooting

- Ensure `mem0ai` is installed; import errors mean the optional dependency is missing.
- If search returns empty results, confirm the same `user_id` / `thread_id` used
  for insertion is provided in `config` during search.
- For Qdrant backing verify the collection exists (Mem0 handles creation) and
  ensure the Qdrant service is reachable.

## Next Steps

- Add a retrieval augmentation node that merges recalled memories into the
  system prompt.
- Implement periodic pruning or summarization by iterating over stats from
  `get_stats`.

---
This feature is experimental; feedback & improvements welcome.
