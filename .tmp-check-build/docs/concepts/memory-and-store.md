# Long-term Memory

> How to build agents that learn and remember across conversations using semantic memory storage and retrieval.

Source: https://10xgraph.com/docs/concepts/memory-and-store
Last updated: 2026-10-08

Your agent needs to remember facts across conversations: a user's preferences, resolved questions, learned skills. The **memory store** makes this possible by providing a semantic, searchable database of memories that persists independently of the thread. It works alongside the checkpointer to create a two-level recall system: fast thread-specific state and cross-thread semantic knowledge.

## Why long-term memory matters

As an agent serves multiple users and conversations, it accumulates context that is too specific or expensive to carry in every message:

- A user mentioned their timezone once; future conversations should know it.
- You discovered an error-handling workaround; later conversations should learn from it.
- You extracted a fact from a document; it should be available without re-uploading.

The checkpointer solves this within a thread (conversation continuity), but it cannot share knowledge across threads. The memory store adds that cross-thread layer, enabling agents to learn from experience and personalize behavior over time.

## How it works: memory store vs checkpointer

The **checkpointer** saves your full agent state (messages, context, custom fields) to resume a thread. The **memory store** saves individual semantic memories you want to recall across threads. They solve different problems:

| Aspect | Checkpointer | Memory store |
| --- | --- | --- |
| Scope | One thread | Cross-thread, cross-user |
| Content | Full `AgentState` snapshot | Individual semantic records |
| Lifetime | Until thread is deleted | Until explicitly deleted |
| Access | By `thread_id` | By semantic similarity |
| Use case | Conversation continuity | Facts, preferences, knowledge |

For example, if a user says "I'm in UTC-5", the checkpointer remembers it for that thread. The memory store lets you *save* it (to find later) and *retrieve* it in any future thread when the agent asks "What timezone is the user in?"

## How the agent uses memory

The LLM doesn't passively receive memories; it **calls a tool** to work with them. The `memory_tool` function is a special tool that the framework exposes, giving the LLM three actions:

| Action | Behaviour |
|---|---|
| `action="store"` | Save a new memory or update an existing one by `memory_key` |
| `action="search"` | Recall the top-N memories matching a query (semantic similarity) |
| `action="delete"` | Remove a memory by its `memory_id` |

The LLM decides when to use each action:

```
LLM thinks: "I should remember this timezone"
       ↓
Calls: memory_tool(action="store", content="User is in UTC-5", memory_key="user_timezone", ...)
       ↓
Result: Memory saved and deduplicated in the store
       ↓
Future thread: LLM asks "What's the user's timezone?"
       ↓
Calls: memory_tool(action="search", query="user timezone")
       ↓
Result: "User is in UTC-5" (retrieved by semantic match, not keyword lookup)
```

**Automatic deduplication:** if you call `store` with the same `memory_key`, the old record is updated rather than duplicated. Similarity-based deduplication (≥ 0.95 match) also prevents near-duplicate memories.

**Non-blocking writes:** all memory writes run asynchronously in the background via `BackgroundTaskManager`, so they never delay the agent's response to the user.

## Retrieval modes: when do memories reach the LLM?

The framework supports three strategies for when the LLM sees memories. Choose based on how much memory context you want injected, and whether you prefer the agent to drive retrieval:

### No retrieval (default)

The LLM **cannot read** past memories but **can write** them.

**When to use:** Your agent is mostly stateless, or memories are only for logging/analytics. The agent can store context it learned, but doesn't need to recall it.

| Pros | Cons |
|---|---|
| Fast; no store queries | No cross-conversation learning |
| Simple; minimal overhead | Agent can't retrieve past context |

### Preload

Relevant memories are **retrieved automatically** and injected as a system message **before** the LLM runs.

**How it works:** 
1. A hidden preload node runs first, extracting the user's latest message as a search query.
2. Memories matching that query (by semantic similarity) are fetched.
3. They are injected as a system message: "Here is context relevant to your request: [memories]".
4. The LLM then sees the full conversation with these memories in context.

**When to use:** Your agent should proactively use past knowledge. Ideal for retrieval-augmented generation (RAG), customer support, or personalization where the agent should *always* have relevant context available.

| Pros | Cons |
|---|---|
| Agent sees memories by default | Extra latency (preload query) |
| Good for RAG patterns | More tokens injected per message |
| Transparent to agent | Noisy if memories are not well-curated |

### Postload

The LLM **decides when to retrieve** memories by calling `memory_tool(action="search", ...)` itself.

**How it works:** The `memory_tool` is offered alongside your other tools. When the agent wants to check past context, it calls the tool with a query, receives results, and decides what to do with them.

**When to use:** Your agent should *selectively* retrieve memories only when needed. Ideal for conversational agents that can ask "Do I know about this user?" or agents that are memory-efficient and don't need context injected automatically.

| Pros | Cons |
|---|---|
| Agent controls memory use | More tool calls (latency) |
| Avoids injecting irrelevant context | Requires the agent to know to retrieve |
| Efficient | Agent might forget to retrieve |

### Trade-off table

| Aspect | No retrieval | Preload | Postload |
|---|---|---|---|
| Memory injection | Never | Automatic (every message) | On-demand (agent calls tool) |
| Latency | Lowest | Higher (one search per message) | Variable (depends on agent) |
| Best for | Stateless agents | RAG, personalization | Selective retrieval |
| Token cost | Lowest | Highest (if many memories match) | Variable |

## Memory scoping: user vs agent memory

You can partition memories into **scopes** so different agents or users see different memories:

| Scope | Who can access | Use case |
|---|---|---|
| **User memory** | The LLM can read and write | Facts about a specific user (timezone, preferences, history) |
| **Agent memory** | The LLM can read but not write | Shared knowledge the agent learned (domain facts, workarounds, decisions) |

**Example:** A customer support agent remembers the customer's billing cycle (user memory) and also stores a workaround it discovered for a common error (agent memory). Both memories persist across conversations, but user memory is scoped per user, while agent memory is shared across all users.

Both scopes use the same backing store and retrieval mechanism, but are queried separately with their own memory records.

## Choosing: memory tools (postload) vs preload

The most important decision is **how the agent accesses memory**. This determines your latency, token usage, and agent behavior.

**Use postload (memory tools) if:**
- The agent should decide when to recall, not every message.
- You want to minimize token overhead and latency.
- Your agent is sophisticated enough to know when to ask "Do I have context on this?"
- Example: A conversational assistant that occasionally checks past notes, but doesn't need proactive context.

**Use preload if:**
- Memories should always be available without the agent asking.
- You're building RAG and expect relevant memories to match most queries.
- You want the simplest behavior: the agent always sees relevant context.
- Token cost is secondary to ensuring the agent has context.
- Example: A customer support bot that needs a user's history for every message.

**Use no_retrieval if:**
- You don't need cross-conversation memory at all, only in-thread state.
- Memories are for analytics or audit, not agent behavior.
- You want the fastest, simplest setup.

---

## Available store backends

The two main options are **Qdrant** (vector database you host) and **Mem0** (managed service):

| Store | Hosting | Embeddings | Good for |
|---|---|---|---|
| `QdrantStore` | Local or cloud Qdrant | Your choice (OpenAI, Google, custom) | Full control, self-hosted |
| `Mem0Store` | Mem0 managed service | Mem0-provided | Low ops, Mem0 handles scaling |

Both use semantic similarity search, so searches match meaning, not keywords. A query like "What's my timezone?" will find a memory "I'm UTC-5" even though the words are different.

### Setting up Qdrant locally

```python
from tenxgraph.storage.store import (
    create_local_qdrant_store,
    OpenAIEmbedding
)

store = create_local_qdrant_store(
    collection="agent-memories",
    path="./memory_data",
    embedding=OpenAIEmbedding(),  # requires OPENAI_API_KEY
)
```

This creates a persistent database on disk. For production, use `create_cloud_qdrant_store` (cloud-hosted Qdrant) instead.

## Implementation patterns

### Pattern 1: With the high-level `Agent` class

This is the simplest approach. Pass `memory` to `Agent` and the framework wires everything:

```python
from tenxgraph.core.graph import Agent, ToolNode
from tenxgraph.storage.store import (
    MemoryConfig,
    create_local_qdrant_store,
    OpenAIEmbedding,
)
from tenxgraph.utils import tool

store = create_local_qdrant_store(
    collection="user-memories",
    path="./memory_data",
    embedding=OpenAIEmbedding(),
)

# Define your agent's tools
@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    # implementation
    pass

tool_node = ToolNode([search_web])

# Create the agent with memory enabled
agent = Agent(
    model="gemini/gemini-2.5-flash",
    tools=tool_node,
    memory=MemoryConfig(
        store=store,
        retrieval_mode="postload",  # Agent calls memory_tool when needed
        limit=5,                     # max memories to retrieve per search
    ),
)

# Use it like any agent
state = {"messages": [{"role": "user", "content": "What's my timezone?"}]}
result = agent.invoke(state, config={"user_id": "user-42"})
```

The `Agent` class automatically:
1. Adds memory tool instructions to the system prompt.
2. Registers `memory_tool` on the `ToolNode`.
3. Scopes memories by `user_id` from the config.

You **must** pass a `ToolNode` when enabling memory; the framework raises `RuntimeError` otherwise.

### Pattern 2: With `StateGraph` and `MemoryIntegration`

For more control (custom routing, multiple nodes), use `MemoryIntegration` with `StateGraph`:

```python
from tenxgraph.core.graph import StateGraph, Agent, ToolNode
from tenxgraph.storage.store import (
    MemoryIntegration,
    create_local_qdrant_store,
    OpenAIEmbedding,
)
from tenxgraph.utils import END

store = create_local_qdrant_store(
    collection="agent-memories",
    path="./memory_data",
    embedding=OpenAIEmbedding(),
)

# Create the memory integration
memory = MemoryIntegration(
    store=store,
    retrieval_mode="preload",  # Auto-inject memories before LLM
    limit=5,
)

# Your tools
@tool
def search_web(query: str) -> str:
    pass

# Tool node includes both your tools and memory tools
tool_node = ToolNode([search_web, *memory.tools])

# Agent with memory system prompt
agent = Agent(
    model="gemini/gemini-2.5-flash",
    system_prompt=memory.system_prompt,
)

# Build the graph
graph = StateGraph()
graph.add_node("AGENT", agent)
graph.add_node("TOOLS", tool_node)
graph.add_edge("TOOLS", "AGENT")
graph.add_conditional_edges(
    "AGENT",
    lambda s: "TOOLS" if s.tool_calls else END,
)

# Wire memory (adds preload node in preload mode)
memory.wire(graph, entry_to="AGENT")

# Compile and use
app = graph.compile(store=store)
result = app.invoke(
    {"messages": [...]},
    config={"user_id": "user-42"},
)
```

Key differences from Pattern 1:
- You build the graph yourself, so you have full control over nodes and edges.
- `memory.tools` gives you the `memory_tool` function to add alongside your own tools.
- `memory.wire(graph, entry_to="AGENT")` sets the entry point and (in preload mode) inserts the preload node automatically.
- `memory.system_prompt` contains the LLM instructions for using memory.

### MemoryConfig options

If using Pattern 1, customize memory behavior:

```python
from tenxgraph.storage.store import (
    MemoryConfig,
    UserMemoryConfig,
    AgentMemoryConfig,
)

config = MemoryConfig(
    store=store,                       # The vector store
    retrieval_mode="postload",         # "no_retrieval" | "preload" | "postload"
    limit=5,                           # Max memories to retrieve per search
    score_threshold=0.0,               # Min similarity (0.0 = all results)
    max_tokens=None,                   # Optional: limit tokens in injected memories
    inject_system_prompt=True,         # Auto-add memory instructions
    user_memory=UserMemoryConfig(
        enabled=True,                  # User-scoped memories the LLM can read/write
        memory_type="episodic",        # Type of memory (for categorization)
        category="general",
        limit=5,
    ),
    agent_memory=AgentMemoryConfig(
        enabled=False,                 # Agent-scoped memories (shared across users)
        memory_type="semantic",        # The agent learns domain facts
        agent_id="my-agent",           # Scoped by agent ID
    ),
)
```

## How memories are written and retrieved

The LLM **writes** memories by calling `memory_tool`:

```python
# The agent decides to remember something:
memory_tool(
    action="store",
    content="User is in UTC-5 timezone",
    memory_key="user_timezone",          # Scoped key for deduplication
    memory_type="episodic",              # Episodic = specific to this user
    category="preferences",
)
# Result: Memory stored. If "user_timezone" already existed, it's updated.
```

The LLM **searches** memories (in postload mode only) by calling:

```python
memory_tool(
    action="search",
    query="What timezone is the user in?",
)
# Result: Top 5 memories by semantic similarity: 
# [{"memory_id": "...", "content": "User is in UTC-5 timezone", "score": 0.95}]
```

**In preload mode**, the framework does the search automatically and injects results as a system message. The agent sees: "Here is context relevant to your request: [memories]" and doesn't call the search tool directly.

## Accessing memory in the REST API

When a store is configured in `10xgraph.json`, the server exposes memory endpoints:

```bash
POST   /v1/store/memories        # Store a new memory
GET    /v1/store/memories        # List all memories for a user
POST   /v1/store/search          # Search memories by query
PUT    /v1/store/memories/{id}   # Update a memory
DELETE /v1/store/memories/{id}   # Delete a memory
```

See [REST API: Memory store](/docs/reference/rest-api/memory-store) for request/response schemas.

Memories are scoped by the request's `user_id` (from auth or config), so users cannot see each other's memories.

## Configuring memory in 10xgraph.json

Point the API server to a memory store:

```json
{
  "agent": "graph:app",
  "store": "graph.dependencies:my_memory_store"
}
```

The `store` key expects a module path pointing to a `BaseStore` instance. The server will use it for all memory operations on that agent.

---

## Next steps

- **To set up memory:** See the task guide [Use memory store](/docs/guides/use-memory-store).
- **To understand preload vs postload deeper:** See [Stream and approve](/docs/guides/stream-graph) (includes pattern examples).
- **For REST API details:** See [REST API: Memory store](/docs/reference/rest-api/memory-store).
- **To learn about thread memory:** See [Checkpointing and threads](/docs/concepts/checkpointing-and-threads) (in-thread state is different from long-term memory).
- **To understand scoping:** See [Authorization scopes](/docs/guides/authorization-scopes) (user isolation is handled by auth).
