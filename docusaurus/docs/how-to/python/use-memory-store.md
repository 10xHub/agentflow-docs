---
title: How to use the memory store
sidebar_label: Memory store
description: Guide to using QdrantStore and Mem0Store for long-term vector memory, factory helpers, and enabling agent-level memory with MemoryConfig.
keywords:
  - agentflow memory store
  - qdrant store
  - mem0 store
  - vector memory
  - agent memory
  - agentflow
sidebar_position: 7
---

# How to use the memory store

AgentFlow's memory store provides long-term vector-based memory that persists across threads and sessions. There are two store implementations: `QdrantStore` (Qdrant vector database) and `Mem0Store` (Mem0 managed memory). Both implement `BaseStore`.

A memory store is separate from the checkpointer. The checkpointer preserves conversation history per thread; the store holds facts, user preferences, and knowledge that should be accessible across all threads.

---

## QdrantStore

### Install

```bash
pip install "10xscale-agentflow[qdrant]"
```

You also need an embedding service. Both OpenAI and Google embeddings are built in.

### Local Qdrant (file-backed)

```python
from agentflow.storage.store import (
    QdrantStore,
    OpenAIEmbedding,
    create_local_qdrant_store,
)

store = create_local_qdrant_store(
    path="./qdrant_data",
    embedding=OpenAIEmbedding(),       # uses OPENAI_API_KEY env var
    collection="my_agent_memory",
)
```

### Remote Qdrant server

```python
from agentflow.storage.store import create_remote_qdrant_store, OpenAIEmbedding

store = create_remote_qdrant_store(
    host="localhost",
    port=6333,
    embedding=OpenAIEmbedding(),
    collection="my_agent_memory",
)
```

### Qdrant Cloud

```python
from agentflow.storage.store import create_cloud_qdrant_store, GoogleEmbedding

store = create_cloud_qdrant_store(
    url="https://xyz.qdrant.io",
    api_key="your-qdrant-api-key",
    embedding=GoogleEmbedding(),       # uses GOOGLE_API_KEY env var
    collection="my_agent_memory",
)
```

### Factory reference

All three factories call `QdrantStore(...)` internally. Use them for clarity.

| Factory | When to use |
|---|---|
| `create_local_qdrant_store(path, embedding, ...)` | Local development, single machine |
| `create_remote_qdrant_store(host, port, embedding, ...)` | Self-hosted Qdrant server |
| `create_cloud_qdrant_store(url, api_key, embedding, ...)` | Qdrant Cloud |

### Direct QdrantStore construction

```python
from agentflow.storage.store import QdrantStore, OpenAIEmbedding, DistanceMetric

store = QdrantStore(
    embedding=OpenAIEmbedding(),
    path="./local_qdrant",          # local: provide path
    # host="localhost",             # remote: provide host + port
    # port=6333,
    # url="https://...",            # cloud: provide url + api_key
    # api_key="...",
    collection="custom_collection",
    distance_metric=DistanceMetric.COSINE,  # COSINE | EUCLIDEAN | DOT | MANHATTAN
)
```

---

## Mem0Store

```bash
pip install "10xscale-agentflow[mem0]"
```

```python
from agentflow.storage.store import Mem0Store, create_mem0_store, create_mem0_store_with_qdrant

# Default Mem0 cloud backend
store = create_mem0_store(api_key="your-mem0-api-key")

# Mem0 with your own Qdrant backend
store = create_mem0_store_with_qdrant(
    api_key="your-mem0-api-key",
    qdrant_url="https://xyz.qdrant.io",
    qdrant_api_key="your-qdrant-api-key",
    collection="mem0_collection",
)
```

---

## Use a store with the graph

Pass the store to `compile()`. From within node functions it is accessible via the `BaseStore` dependency injection binding.

```python
app = graph.compile(
    checkpointer=checkpointer,
    store=store,
)
```

---

## Embedding options

| Class | Provider | Env var required |
|---|---|---|
| `OpenAIEmbedding` | OpenAI `text-embedding-3-small` | `OPENAI_API_KEY` |
| `GoogleEmbedding` | Google `text-embedding-004` | `GOOGLE_API_KEY` |

```python
from agentflow.storage.store import OpenAIEmbedding, GoogleEmbedding

openai_embed = OpenAIEmbedding()
google_embed = GoogleEmbedding()
```

---

## Agent-level memory with MemoryConfig

`MemoryConfig` wires memory directly into an `Agent` node. The agent automatically retrieves relevant memories before each LLM call and can write new memories using injected memory tools.

### Minimal MemoryConfig

```python
from agentflow.storage.store import MemoryConfig
from agentflow.storage.store import create_local_qdrant_store, OpenAIEmbedding

store = create_local_qdrant_store("./qdrant_data", OpenAIEmbedding())

agent = Agent(
    model="gpt-4o",
    memory=MemoryConfig(store=store),
)
```

### Full MemoryConfig reference

```python
from agentflow.storage.store import MemoryConfig, UserMemoryConfig, AgentMemoryConfig, ReadMode

memory = MemoryConfig(
    store=store,                             # required: BaseStore instance
    retrieval_mode=ReadMode.POSTLOAD,        # POSTLOAD (default) | PRELOAD
    limit=5,                                 # max memories to retrieve
    score_threshold=0.0,                     # minimum similarity score (0.0–1.0)
    max_tokens=None,                         # cap total tokens across all memories
    inject_system_prompt=True,               # prepend memories to system prompt

    user_memory=UserMemoryConfig(
        enabled=True,
        memory_type="episodic",
        category="conversations",
        user_id=None,                        # override user_id; falls back to config["user_id"]
        limit=5,
        score_threshold=0.6,
    ),
    agent_memory=AgentMemoryConfig(
        enabled=False,                       # disabled by default
        memory_type="semantic",
        category="knowledge",
        agent_id="my-agent",
        app_id="my-app",
    ),
)

agent = Agent(model="gpt-4o", memory=memory)
```

### ReadMode

| Mode | Behaviour |
|---|---|
| `ReadMode.POSTLOAD` (default) | Memories are fetched on-demand via injected tools that the LLM can call. The agent decides when to retrieve and write. |
| `ReadMode.PRELOAD` | Memories are retrieved before the LLM call and injected into the system prompt automatically. |

---

## MemoryType and DistanceMetric

These enums are importable from `agentflow.storage.store`:

```python
from agentflow.storage.store import MemoryType, DistanceMetric

# MemoryType values
MemoryType.EPISODIC       # conversation events, session notes
MemoryType.SEMANTIC       # facts, user preferences
MemoryType.PROCEDURAL     # how-to workflows, step sequences
MemoryType.ENTITY         # information about people, places
MemoryType.RELATIONSHIP   # how entities relate
MemoryType.DECLARATIVE    # explicit stated facts
MemoryType.CUSTOM         # domain-specific

# DistanceMetric values
DistanceMetric.COSINE     # default; best for text embeddings
DistanceMetric.EUCLIDEAN  # absolute vector distances
DistanceMetric.DOT        # normalised vectors, high-dimensional spaces
DistanceMetric.MANHATTAN  # L1 distance
```

---

## Complete example: memory-aware agent

```python
import asyncio
from agentflow.core.graph import StateGraph, Agent
from agentflow.core.state import AgentState, Message
from agentflow.storage.checkpointer import InMemoryCheckpointer
from agentflow.storage.store import (
    MemoryConfig,
    UserMemoryConfig,
    create_local_qdrant_store,
    OpenAIEmbedding,
)
from agentflow.utils import END

# Set up store
store = create_local_qdrant_store("./qdrant_data", OpenAIEmbedding())

# Configure agent-level memory
memory = MemoryConfig(
    store=store,
    user_memory=UserMemoryConfig(
        enabled=True,
        memory_type="semantic",
        category="user_prefs",
        limit=5,
        score_threshold=0.6,
    ),
)

agent = Agent(
    model="gpt-4o",
    system_prompt=[{"role": "system", "content": "You are a personalized assistant."}],
    memory=memory,
)

graph = StateGraph()
graph.add_node("MAIN", agent)
graph.set_entry_point("MAIN")
graph.add_edge("MAIN", END)

app = graph.compile(checkpointer=InMemoryCheckpointer(), store=store)

async def main():
    # First session: share a preference
    await app.ainvoke(
        {"messages": [Message.text_message("I prefer concise answers, no more than 3 sentences.")]},
        config={"thread_id": "user-1-session-a", "user_id": "user-1"},
    )

    # New session, new thread_id: memory persists across threads
    result = await app.ainvoke(
        {"messages": [Message.text_message("How long should your replies be?")]},
        config={"thread_id": "user-1-session-b", "user_id": "user-1"},
    )
    print(result["messages"][-1].content)

asyncio.run(main())
```

---

## What you learned

- `QdrantStore` and `Mem0Store` both implement `BaseStore`.
- Use `create_local_qdrant_store`, `create_remote_qdrant_store`, or `create_cloud_qdrant_store` to create a `QdrantStore`.
- Pass `store=store` to `graph.compile()` to make the store available to the graph.
- `MemoryConfig` on `Agent(..., memory=...)` enables automatic retrieval and writing of per-user memories.
- `ReadMode.POSTLOAD` (default) lets the LLM decide when to use memory tools; `ReadMode.PRELOAD` injects memories before every LLM call.

## Next steps

- [Configure Agent](configure-agent.md) for the full `Agent` parameter reference.
- [Use prebuilt agents](use-prebuilt-agents.md) for ready-made agents that support `memory` out of the box.
