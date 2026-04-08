---
title: Memory stores
description: BaseStore, QdrantStore, Mem0Store — long-term semantic memory for agents.
sidebar_position: 8
---

# Memory stores

## When to use this

Use a memory store when you need the agent to remember facts, preferences, or past interactions **across different conversation threads**. A checkpointer stores state within a thread; a store persists memories across all threads for a user or agent.

## Import paths

```python
from agentflow.storage.store import BaseStore
from agentflow.storage.store.store_schema import (
    MemoryType, RetrievalStrategy, DistanceMetric,
    MemorySearchResult, MemoryRecord,
)

# Optional backends
from agentflow.storage.store import QdrantStore    # requires qdrant-client
from agentflow.storage.store import Mem0Store      # requires mem0ai
```

---

## Enums

### `MemoryType`

| Value | Use case |
|---|---|
| `EPISODIC` | Conversation memories — what happened in a past chat. |
| `SEMANTIC` | Facts and general knowledge — "the user prefers dark mode". |
| `PROCEDURAL` | How-to knowledge — "to reset the password, go to Settings > Security". |
| `ENTITY` | Named entities and their attributes. |
| `RELATIONSHIP` | Connections between entities. |
| `DECLARATIVE` | Explicit facts and events stated by the user. |
| `CUSTOM` | Application-defined memory categories. |

### `RetrievalStrategy`

| Value | Description |
|---|---|
| `SIMILARITY` | Cosine / vector similarity search. Default for most queries. |
| `TEMPORAL` | Time-ordered retrieval — most recent memories first. |
| `RELEVANCE` | Relevance scoring combining recency and similarity. |
| `HYBRID` | Combines similarity and temporal signals. |
| `GRAPH_TRAVERSAL` | Navigates a knowledge graph to find connected memories. |

### `DistanceMetric`

| Value | Description |
|---|---|
| `COSINE` | Cosine similarity. Best for normalised embeddings. |
| `EUCLIDEAN` | Euclidean (L2) distance. Sensitive to vector magnitude. |
| `DOT_PRODUCT` | Inner product. Fast; requires normalisation to equal cosine. |
| `MANHATTAN` | L1 distance. Robust to outliers. |

---

## `BaseStore`

Abstract base class. All store backends implement this interface.

### Core async methods

| Method | Signature | Description |
|---|---|---|
| `astore` | `async (config, content, memory_type, category, metadata) -> str` | Add a memory. Returns the memory ID. |
| `abatch_store` | `async (config, contents, memory_type, category, metadata) -> list[str]` | Bulk add multiple memories. |
| `asearch` | `async (config, query, memory_type, strategy, limit, distance_metric, filter) -> list[MemorySearchResult]` | Search memories by query. |
| `aget` | `async (config, memory_id) -> MemoryRecord \| None` | Fetch a memory by ID. |
| `aupdate` | `async (config, memory_id, content, metadata) -> bool` | Update a memory's content. |
| `adelete` | `async (config, memory_id) -> bool` | Delete a memory by ID. |
| `aforget_memory` | `async (config, query) -> int` | Delete memories that semantically match a query. Returns count deleted. |
| `arelease` | `async () -> None` | Release connections and cleanup. |

### Sync wrappers

```python
store.store(config, content)
store.search(config, query)
```

All async methods have a sync wrapper that calls `asyncio.run()` internally. Use the async variants in async code.

### Config dictionary

```python
config = {
    "user_id": "alice",      # user scope
    "agent_id": "my_agent",  # agent scope (optional)
}
```

---

## `MemorySearchResult`

Returned by `asearch`. Each result represents a matching memory.

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Memory ID. |
| `content` | `str` | The memory text. |
| `score` | `float` | Similarity/relevance score (0.0–1.0). |
| `memory_type` | `MemoryType` | Categorisation. |
| `metadata` | `dict` | Application-defined metadata. |
| `vector` | `list[float] \| None` | Embedding vector (if returned by backend). |
| `user_id` | `str \| None` | User scope. |
| `thread_id` | `str \| None` | Thread where this memory was created. |
| `timestamp` | `datetime \| None` | Creation time. |

---

## `QdrantStore`

Vector store backed by [Qdrant](https://qdrant.tech). Production-ready for similarity search.

:::note Optional dependency
```
pip install qdrant-client
```
:::

```python
from agentflow.storage.store import QdrantStore
from agentflow.storage.store.embedding import OpenAIEmbeddingService

# Local Qdrant (persisted to disk)
store = QdrantStore(
    embedding=OpenAIEmbeddingService(),
    path="./qdrant_data",
)

# Remote Qdrant
store = QdrantStore(
    embedding=OpenAIEmbeddingService(),
    host="localhost",
    port=6333,
)

# Qdrant Cloud
store = QdrantStore(
    embedding=OpenAIEmbeddingService(),
    url="https://xyz.qdrant.io",
    api_key="your-api-key",
)

await store.asetup()
app = graph.compile(store=store)
```

### Constructor parameters

| Parameter | Type | Description |
|---|---|---|
| `embedding` | `BaseEmbedding` | Embedding service used to vectorise text before storage and search. |
| `path` | `str \| None` | Local path for embedded Qdrant server. |
| `host` | `str \| None` | Remote Qdrant host. |
| `port` | `int \| None` | Remote Qdrant port (default: `6333`). |
| `url` | `str \| None` | Qdrant Cloud URL. |
| `api_key` | `str \| None` | Qdrant Cloud API key. |
| `collection_name` | `str` | Qdrant collection name. Default: `"agentflow_memories"`. |

---

## `Mem0Store`

Managed long-term memory using the [mem0](https://mem0.ai) library. Delegates all vector storage and memory management to Mem0.

:::note Optional dependency
```
pip install mem0ai
```
:::

```python
from agentflow.storage.store import Mem0Store

store = Mem0Store(config={
    "llm": {"provider": "openai", "config": {"model": "gpt-4o-mini"}},
    "embedder": {"provider": "openai", "config": {"model": "text-embedding-3-small"}},
    "vector_store": {"provider": "qdrant", "config": {"host": "localhost", "port": 6333}},
})

await store.asetup()
app = graph.compile(store=store)
```

`Mem0Store` maps the `BaseStore` interface to Mem0's `add`, `search`, `get_all`, `update`, and `delete` methods. Since Mem0's API is synchronous, calls are offloaded to a thread executor to keep the interface awaitable.

---

## Wiring into Agent memory

Configure the `Agent` to automatically retrieve relevant memories before each LLM call:

```python
from agentflow.storage.store.memory_config import MemoryConfig

agent = Agent(
    model="gpt-4o",
    memory=MemoryConfig(
        enabled=True,
        top_k=5,
        memory_type=MemoryType.SEMANTIC,
        retrieval_strategy=RetrievalStrategy.SIMILARITY,
    ),
)

app = graph.compile(store=QdrantStore(...))
```

---

## Direct store usage in nodes

Access the store directly inside a node via dependency injection:

```python
from agentflow.storage.store import BaseStore
from agentflow.storage.store.store_schema import MemoryType, RetrievalStrategy

async def remember_node(state: AgentState, config: dict, store: BaseStore) -> list:
    # Retrieve relevant memories
    memories = await store.asearch(
        config={"user_id": config.get("user_id")},
        query=state.context[-1].content[0].text,
        memory_type=MemoryType.EPISODIC,
        strategy=RetrievalStrategy.SIMILARITY,
        limit=5,
    )
    context = "\n".join(m.content for m in memories)

    # Store the user's latest message as a memory
    await store.astore(
        config={"user_id": config.get("user_id")},
        content=state.context[-1].content[0].text,
        memory_type=MemoryType.EPISODIC,
    )

    return []   # no new messages; state enriched by memories above
```

The `store` parameter is injected automatically by the framework as long as you pass `store=` to `graph.compile()`.

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `ImportError: qdrant_client` | Using `QdrantStore` without `qdrant-client`. | `pip install qdrant-client`. |
| `ImportError: mem0` | Using `Mem0Store` without `mem0ai`. | `pip install mem0ai`. |
| Empty search results | Store not configured in `graph.compile()`. | Add `store=my_store` to `compile()`. |
| `RuntimeError: No store configured` | Node calls `store.asearch()` but no store is wired. | Ensure `graph.compile(store=...)` is called. |
