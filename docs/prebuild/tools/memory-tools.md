# Memory Tools

Prebuilt tools that give an agent access to long-term memory — the ability to store, search, update, and delete facts across conversations.

**Import path:** `agentflow.prebuilt.tools`

There are three tools, each for a different memory integration path:

| Tool | Path | Operations |
|---|---|---|
| `memory_tool` | Manual / `MemoryIntegration` wiring | search, store, update, delete |
| `user_memory_tool` | `Agent(memory=MemoryConfig(...))` | search, remember |
| `agent_memory_tool` | `Agent(memory=MemoryConfig(...))` | search (read-only) |

All three tools require a configured `BaseStore` (e.g. a Qdrant-backed store) injected through the DI container or passed explicitly.

---

## `memory_tool`

The general-purpose LLM-callable memory tool. Use this when wiring memory manually or through `MemoryIntegration`.

### Operations

| `action` | Required fields | Description |
|---|---|---|
| `search` | `query` | Semantic search across all memories for the current user |
| `store` | `content`, `memory_key` | Save a new memory (auto-updates if `memory_key` already exists) |
| `update` | `memory_id`, `content` | Overwrite a specific memory by ID |
| `delete` | `memory_id` | Remove a specific memory by ID |

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `action` | `str` | `"search"` | One of `search`, `store`, `update`, `delete` |
| `content` | `str` | `""` | Text to store or update |
| `memory_key` | `str` | `""` | Short snake_case key used for dedup (e.g. `"user_name"`) |
| `memory_id` | `str` | `""` | ID of the memory to update or delete |
| `query` | `str` | `""` | Search query |
| `memory_type` | `str` | `None` | Memory type (`"episodic"`, `"semantic"`, etc.) |
| `category` | `str` | `None` | Category label for filtering |
| `limit` | `int` | `5` | Maximum number of search results |
| `score_threshold` | `float` | `None` | Minimum similarity score for search |
| `write_mode` | `str` | `"merge"` | `"merge"` or `"replace"` on update |

### Notes

- Write operations (`store`, `update`, `delete`) are scheduled as background tasks and return `{"status": "scheduled"}` immediately.
- Search flushes pending writes first so results are always up to date.
- The `memory_key` field enables automatic deduplication: if a memory with the same key exists it is updated rather than duplicated.

### Usage

```python
from agentflow.prebuilt.tools.memory import memory_tool
from agentflow.core.graph import Agent, ToolNode
from agentflow.storage import QdrantStore  # or any BaseStore subclass

store = QdrantStore(...)

agent = Agent(
    model="gpt-4o-mini",
    tool_node=ToolNode([memory_tool]),
    system_prompt=[{
        "role": "system",
        "content": (
            "You have long-term memory. "
            "Always search memory at the start of a conversation. "
            "Store important facts about the user after each interaction."
        ),
    }],
)
app = agent.compile(store=store)
```

---

## `user_memory_tool` (factory)

Created via `make_user_memory_tool(memory_config)`. Used automatically by `Agent(memory=MemoryConfig(...))` — you do not normally need to instantiate it yourself.

### Operations

| `action` | Required fields | Description |
|---|---|---|
| `search` | `text` | Semantic search over user-scoped memories |
| `remember` | `text` | Save a user fact or preference |

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `action` | `str` | `"search"` | `"search"` or `"remember"` |
| `text` | `str` | required | Query text or text to remember |
| `memory_type` | `str` | `None` | Override the configured memory type |
| `category` | `str` | `None` | Override the configured category |
| `limit` | `int` | `None` | Override the configured result limit |

### Usage via `MemoryConfig`

```python
from agentflow.core.graph import Agent
from agentflow.storage.store.memory_config import MemoryConfig, UserMemoryConfig

agent = Agent(
    model="gpt-4o-mini",
    memory=MemoryConfig(
        store=store,
        user_memory=UserMemoryConfig(enabled=True),
    ),
)
# The user_memory_tool is registered automatically.
app = agent.compile(store=store)
```

---

## `agent_memory_tool` (factory)

Created via `make_agent_memory_tool(memory_config)`. Read-only — the LLM can search agent-scoped or app-scoped memories but cannot write them.

### Operations

| Parameter | Required | Description |
|---|---|---|
| `query` | required | Semantic search query |
| `memory_type` | `None` | Override configured memory type |
| `category` | `None` | Override configured category |
| `limit` | `None` | Override result limit |

### Usage via `MemoryConfig`

```python
from agentflow.storage.store.memory_config import MemoryConfig, AgentMemoryConfig

agent = Agent(
    model="gpt-4o-mini",
    memory=MemoryConfig(
        store=store,
        agent_memory=AgentMemoryConfig(
            enabled=True,
            agent_id="my-agent-v1",
        ),
    ),
)
app = agent.compile(store=store)
```

---

## Example: manual wiring with `memory_tool`

```python
from agentflow.prebuilt.tools.memory import memory_tool
from agentflow.prebuilt.agent import ReactAgent
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./memory_db",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

agent = ReactAgent(
    model="gpt-4o-mini",
    tools=[memory_tool],
    system_prompt=[{
        "role": "system",
        "content": (
            "You have persistent memory. At the start of every conversation, "
            "call memory_tool with action='search' to recall relevant context. "
            "After the conversation, store important new facts with action='store'."
        ),
    }],
)
app = agent.compile(store=store)

result = await app.ainvoke(
    {"message": "My name is Alice and I prefer Python."},
    config={"thread_id": "t1", "user_id": "alice"},
)
```
