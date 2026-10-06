---
title: Memory stores
seoTitle: "Memory stores API reference (Python)"
description: BaseStore, QdrantStore, Mem0Store — long-term semantic memory for agents.
section: Reference
group: Python library
order: 1500
label: Memory stores
updated: "2026-07-21"
---

## When to use this

Use a memory store when you need the agent to remember facts, preferences, or past interactions **across different conversation threads**. A checkpointer stores state within a thread; a store persists memories across all threads for a user or agent.

## Import paths

```python
from tenxgraph.storage.store import BaseStore
from tenxgraph.storage.store.store_schema import (
    MemoryType, RetrievalStrategy, DistanceMetric,
    MemorySearchResult, MemoryRecord,
)

# Optional backends
from tenxgraph.storage.store import QdrantStore    # requires qdrant-client
from tenxgraph.storage.store import Mem0Store      # requires mem0ai
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
| `astore` | `async (config, content, memory_type=EPISODIC, category="general", metadata=None, **kwargs) -> str` | Add a memory. Returns the memory ID. |
| `asearch` | `async (config, query, memory_type=None, category=None, limit=10, score_threshold=None, filters=None, retrieval_strategy=SIMILARITY, distance_metric=COSINE, max_tokens=4000, **kwargs) -> list[MemorySearchResult]` | Search memories by query. |
| `aget` | `async (config, memory_id, **kwargs) -> MemorySearchResult \| None` | Fetch a memory by ID. |
| `aget_all` | `async (config, limit=100, **kwargs) -> list[MemorySearchResult]` | List memories in the config's scope. |
| `aupdate` | `async (config, memory_id, content, metadata=None, **kwargs) -> Any` | Update a memory's content. |
| `adelete` | `async (config, memory_id, **kwargs) -> Any` | Delete a memory by ID. |
| `aforget_memory` | `async (config, **kwargs) -> Any` | Delete memories for a user or agent scope. Accepted keyword arguments are store-specific. |
| `arelease` | `async () -> None` | Release connections and cleanup (not abstract, default no-op). |

There is no bulk `abatch_store`; call `astore` in a loop or with `asyncio.gather`.

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

Returned by `asearch`, `aget` and `aget_all`. Each result represents a matching memory.

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

<aside class="callout callout-note" role="note"><p class="callout-title">Optional dependency</p>

```
pip install qdrant-client
```

</aside>

```python
from tenxgraph.storage.store import QdrantStore
from tenxgraph.storage.store.embedding import OpenAIEmbedding

# Local Qdrant (persisted to disk)
store = QdrantStore(
    embedding=OpenAIEmbedding(),
    path="./qdrant_data",
)

# Remote Qdrant
store = QdrantStore(
    embedding=OpenAIEmbedding(),
    host="localhost",
    port=6333,
)

# Qdrant Cloud
store = QdrantStore(
    embedding=OpenAIEmbedding(),
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
| `collection` | `str \| None` | Qdrant collection name. Defaults to `"agentflow_memories"`. |
| `distance_metric` | `DistanceMetric` | Distance metric for the collection. Default: `COSINE`. |

---

## `Mem0Store`

Managed long-term memory using the [mem0](https://mem0.ai) library. Delegates all vector storage and memory management to Mem0.

<aside class="callout callout-note" role="note"><p class="callout-title">Optional dependency</p>

```
pip install mem0ai
```

</aside>

```python
from tenxgraph.storage.store import Mem0Store

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
from tenxgraph.storage.store import MemoryConfig, QdrantStore, ReadMode

store = QdrantStore(embedding=OpenAIEmbedding(), path="./qdrant_data")

agent = Agent(
    model="gpt-4o",
    memory=MemoryConfig(
        store=store,
        retrieval_mode=ReadMode.POSTLOAD,
        limit=5,
        score_threshold=0.0,
    ),
)

app = graph.compile(store=store)
```

`MemoryConfig` fields: `store`, `retrieval_mode` (`ReadMode.NO_RETRIEVAL`, `PRELOAD` or `POSTLOAD`; default `POSTLOAD`), `limit` (default 5), `score_threshold` (default 0.0), `max_tokens`, `inject_system_prompt` (default `True`), `config`, `user_memory` and `agent_memory`.

---

## Direct store usage in nodes

Access the store directly inside a node via dependency injection:

```python
from tenxgraph.storage.store import BaseStore
from tenxgraph.storage.store.store_schema import MemoryType, RetrievalStrategy

async def remember_node(state: AgentState, config: dict, store: BaseStore) -> list:
    # Retrieve relevant memories
    memories = await store.asearch(
        config={"user_id": config.get("user_id")},
        query=state.context[-1].content[0].text,
        memory_type=MemoryType.EPISODIC,
        retrieval_strategy=RetrievalStrategy.SIMILARITY,
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
