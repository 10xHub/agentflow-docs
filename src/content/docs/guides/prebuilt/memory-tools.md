---
title: Memory Tools
seoTitle: "Memory tools for long-term agent memory"
description: memory_tool, user_memory_tool, and agent_memory_tool give agents long-term memory to store, search, update, and delete facts across conversations.
section: "Build agents"
group: "Tools and MCP"
order: 200
label: Memory Tools
updated: "2026-10-08"
---

10xGraph memory tools give agents the ability to build long-term memory — facts and preferences that persist across conversations and threads. Your agent can search what it has learned about users, store new observations, and reason about patterns over time. All three tools use semantic search, so the agent finds relevant information by meaning, not by keyword.

**Import path:** `tenxgraph.prebuilt.tools`

## Which tool to use

10xGraph provides three memory tools for different patterns. Choose based on how you want to wire memory into your agent.

| Tool | When to use | Wiring path | Operations |
|---|---|---|---|
| `memory_tool` | Manual control; custom graph; integrating with your own memory logic | Add directly to `ToolNode([memory_tool])` | search, store, update, delete |
| `user_memory_tool` | Agent-managed memory scoped to individual users | `Agent(memory=MemoryConfig(user_memory=...))` | search, remember |
| `agent_memory_tool` | Read-only, application-wide memory (e.g. knowledge base, policies) | `Agent(memory=MemoryConfig(agent_memory=...))` | search only |

All three tools require a configured vector store (e.g. Qdrant, Mem0) that supports semantic search. The store is injected through the dependency container or passed explicitly during compilation.

## How memory works

Write operations (store, update, delete) execute asynchronously in the background. When the agent calls any write tool, it returns `{"status": "scheduled"}` immediately, and the write happens later without blocking the conversation. Search operations flush any pending writes first, so results always reflect the latest data.

The `memory_key` field on `memory_tool` enables automatic deduplication. If you call store with the same key twice, the second call updates the first memory instead of creating a duplicate. This is useful for facts like "user_preference_language" that should have only one current value.

---

## `memory_tool` — full control

Use `memory_tool` when you want to manage memory in your own graph logic, or when the Agent-level memory config is too restrictive. You call it from a custom node or let the LLM use it as a tool.

### Operations

| Action | Required parameters | Description |
|---|---|---|
| `search` | `query` | Semantic search across all user memories. Returns up to `limit` results sorted by relevance. |
| `store` | `content`, `memory_key` | Save a new memory. If a memory with the same key exists, it updates that memory instead of duplicating it. Returns immediately; write is scheduled asynchronously. |
| `update` | `memory_id`, `content` | Overwrite a specific memory by ID. Respects the `write_mode` (merge or replace metadata). Returns immediately; write is scheduled asynchronously. |
| `delete` | `memory_id` | Remove a memory by ID. Returns immediately; deletion is scheduled asynchronously. |

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `action` | `str` | `"search"` | One of `search`, `store`, `update`, `delete`. Controls which operation to perform. |
| `query` | `str` | `""` | The search query. Required for `action="search"`. Supports natural language; matched semantically. |
| `content` | `str` | `""` | The text to store or update. Required for `action="store"` or `action="update"`. |
| `memory_key` | `str` | `""` | A short snake_case deduplication key (e.g. `"user_name"`, `"favorite_language"`). Used only with `action="store"`. If a memory with this key exists, it is updated instead of creating a duplicate. |
| `memory_id` | `str` | `""` | The ID of the memory to update or delete. Required for `action="update"` or `action="delete"`. |
| `memory_type` | `str` | `None` | Optional label for the memory type (e.g. `"episodic"` for events, `"semantic"` for facts). Defaults to `"episodic"`. Used for filtering and organization. |
| `category` | `str` | `None` | Optional category label for filtering (e.g. `"preferences"`, `"work_history"`). Defaults to `"general"`. |
| `metadata` | `dict` | `None` | Additional metadata attached to the memory. Merged or replaced based on `write_mode`. |
| `limit` | `int` | `5` | Maximum number of search results to return. |
| `score_threshold` | `float` | `None` | Minimum similarity score (0.0 to 1.0) required to include a result. If set, results below this score are filtered out. |
| `write_mode` | `str` | `"merge"` | How to handle metadata on update: `"merge"` combines old and new metadata, `"replace"` overwrites it entirely. |

### Response format

All operations return JSON:

- **Search:** `{"results": [{"id": "...", "content": "...", "score": 0.95, "type": "...", ...}]}` (array of results, highest score first)
- **Write operations:** `{"status": "scheduled", "action": "store|update|delete"}` (returns immediately; operation runs in the background)
- **Errors:** `{"error": "..."}` (e.g. "no memory store configured", "query is required for search")

### Complete example

```python
from tenxgraph.prebuilt.tools.memory import memory_tool
from tenxgraph.core.graph import Agent, ToolNode, StateGraph, START, END
from tenxgraph.core.state import AgentState
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding
import json

# Set up the memory store with OpenAI embeddings
store = create_local_qdrant_store(
    path="./memory_db",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

# Create an agent with the memory tool
agent = Agent(
    model="gpt-4o-mini",
    tools=[memory_tool],
    system_prompt=[{
        "role": "system",
        "content": (
            "You are a helpful customer service agent with long-term memory. "
            "At the start of each conversation, search your memory for any previous "
            "interactions with this user. Store important facts about the user, "
            "their preferences, and previous issues they have had."
        ),
    }],
)

# Compile and run
app = agent.compile(store=store)

# The agent will have access to memory_tool and can call it with any action
result = await app.ainvoke(
    {"messages": [{"role": "user", "content": "Hello, I'm back!"}]},
    config={"thread_id": "t1", "user_id": "customer_42"},
)

# The agent may have called memory_tool automatically to search for past interactions
print(result["messages"][-1]["content"])
```

---

## `user_memory_tool` — user-scoped memory via Agent config

When you enable user memory in an Agent, the `user_memory_tool` is registered automatically. You do not need to instantiate it yourself. This tool is simpler than `memory_tool` because it enforces a specific scope (one user) and permission model (the LLM can search and write, but not delete).

### Operations

| Action | Required parameters | Description |
|---|---|---|
| `search` | `text` | Search for user-scoped memories. Returns up to `limit` results. |
| `remember` | `text` | Save a new user fact or preference. Cannot duplicate; each call creates a new memory (unlike `memory_tool` which deduplicates by key). |

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `action` | `str` | `"search"` | One of `search` or `remember`. |
| `text` | `str` | required | For `search`, the query text. For `remember`, the text to save. Supports natural language. |
| `memory_type` | `str` | inherited | Override the configured memory type (e.g. `"episodic"`, `"semantic"`). If not set, uses the type from `UserMemoryConfig`. |
| `category` | `str` | inherited | Override the configured category. If not set, uses the category from `UserMemoryConfig`. |
| `limit` | `int` | inherited | Override the configured result limit. If not set, uses the limit from `UserMemoryConfig`. |

### Setup

Enable user memory in an Agent by passing a `MemoryConfig` with `user_memory` enabled:

```python
from tenxgraph.core.graph import Agent
from tenxgraph.storage.store.memory_config import MemoryConfig, UserMemoryConfig
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./memory_db",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

agent = Agent(
    model="gpt-4o-mini",
    memory=MemoryConfig(
        store=store,
        user_memory=UserMemoryConfig(
            enabled=True,
            memory_type="semantic",  # e.g. facts and preferences
            category="user_profile",
            limit=10,  # return up to 10 results per search
        ),
    ),
    system_prompt=[{
        "role": "system",
        "content": "You remember details about each user. Use user_memory_tool to search and remember key facts.",
    }],
)

app = agent.compile(store=store)
```

The `user_memory_tool` is now available to the LLM. It is scoped to the `user_id` from the config at invocation:

```python
result = await app.ainvoke(
    {"messages": [{"role": "user", "content": "What do you know about my preferences?"}]},
    config={"thread_id": "t1", "user_id": "alice"},  # user_id determines memory scope
)
```

---

## `agent_memory_tool` — read-only application-wide memory

Agent memory is read-only and scoped to the agent or the entire application. Use it for policies, knowledge bases, or shared context that many users should be able to read but not modify.

### Operations

| Action | Parameters | Description |
|---|---|---|
| `search` | `query`, optional overrides | Semantic search over agent-scoped or app-scoped memories. Read-only; the LLM cannot write, update, or delete. |

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | required | The search query. Supports natural language. |
| `memory_type` | `str` | inherited | Override the configured memory type. |
| `category` | `str` | inherited | Override the configured category. |
| `limit` | `int` | inherited | Override the configured result limit. |

### Setup

Enable agent memory in an Agent by passing a `MemoryConfig` with `agent_memory` enabled. Specify either `agent_id` (memories shared across all instances of this agent) or `app_id` (memories shared across the entire application):

```python
from tenxgraph.core.graph import Agent
from tenxgraph.storage.store.memory_config import MemoryConfig, AgentMemoryConfig
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./memory_db",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

agent = Agent(
    model="gpt-4o-mini",
    memory=MemoryConfig(
        store=store,
        agent_memory=AgentMemoryConfig(
            enabled=True,
            agent_id="customer-support-v2",  # all instances of this agent share this memory
            memory_type="semantic",
            category="policies",
            limit=5,
        ),
    ),
    system_prompt=[{
        "role": "system",
        "content": "You have access to company policies. Use agent_memory_tool to look them up when answering customer questions.",
    }],
)

app = agent.compile(store=store)
```

The `agent_memory_tool` is now available to the LLM in read-only form. It searches across all users for the specified agent, independent of the `user_id`:

```python
result = await app.ainvoke(
    {"messages": [{"role": "user", "content": "What is your return policy?"}]},
    config={"thread_id": "t1", "user_id": "alice"},
)
# The agent can search agent memory (policies) but cannot modify it
```

---

## Setting up a vector store

All memory tools require a vector store that supports semantic search. 10xGraph supports several backends.

**Qdrant (local or cloud):**

```python
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./memory_db",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)
```

Qdrant is fast and works offline. For production, you can use Qdrant Cloud (configure via `url` and `api_key`).

**Mem0 (enterprise multi-agent memory):**

```python
from tenxgraph.storage.store.mem0_store import Mem0Store

store = Mem0Store(api_key="your-mem0-api-key")
```

Mem0 is a managed service that handles memory and embeddings for you.

Choose the embedding model based on your provider and token budget. `text-embedding-3-small` is fast and cheap. `text-embedding-3-large` or `text-embedding-ada-002` are more accurate but slower.

---

## Design patterns

**Search before write:** Your system prompt should encourage the agent to search memory at the start of a conversation and write important facts at the end. This gives continuity across threads and threads.

**Keep `memory_key` consistent:** If you use `memory_tool` with `memory_key`, use the same key format everywhere (e.g. always `user_name`, never `name` or `username`). Inconsistent keys defeat deduplication.

**Scope memory by use case:** User memory (personal preferences, history) is separate from agent memory (policies, FAQs). Mix them when both types are relevant.

**Background writes don't block:** Write operations return immediately. If the agent asks "did you save that?", you can safely say yes; the actual persistence happens asynchronously. Your system prompt can reinforce this behavior.

---

## Related pages

- **Concept:** Long-term memory and how it complements thread checkpoints — see `/docs/concepts/memory-and-store`
- **Setup guide:** Choose and configure a vector store — see `/docs/guides/use-memory-store`
- **Reference:** Full API for `MemoryConfig` and store classes — see `/docs/reference/python/memory-stores`
