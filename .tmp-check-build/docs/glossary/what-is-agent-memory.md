# What Is Agent Memory? Types and Python Implementation

> Agent memory is how an AI agent stores and retrieves information across turns, sessions, and restarts. See the three memory types and Python code.

Source: https://10xgraph.com/docs/glossary/what-is-agent-memory
Last updated: 2026-10-08

**Agent memory is the set of mechanisms by which an AI agent stores and retrieves information: the current conversation context, facts from past sessions, and long-term knowledge about the user.** Without memory, each agent invocation starts from scratch. There are three memory types, each with a different purpose and implementation: working, episodic and semantic.

## The three types of agent memory

Working memory lives in the model's context window, episodic memory is saved thread history, and semantic memory is a searchable long-term store. Most production agents use all three.

### 1. Working memory (in-context)

The messages in the current conversation window. This is what the LLM can "see" right now: the system prompt, user messages, assistant responses and tool results in the current session.

**Properties:**
- Fastest to access (already in the LLM input)
- Limited by the model's context window (from thousands to about a million tokens, depending on the model)
- Disappears when the session ends unless explicitly saved

**In 10xGraph:** the `AgentState.context` list is the working memory. It grows with each message exchange.

### 2. Episodic memory (thread history)

A persistent record of past conversations indexed by thread ID. When you invoke the agent again with the same thread ID, it can reload the conversation history.

**Properties:**
- Persists across server restarts (when you use a durable checkpointer such as Postgres + Redis)
- Enables multi-turn conversations that continue across sessions
- Indexed by thread ID, so each user/conversation gets their own thread

**In 10xGraph:** implemented via a checkpointer. `PgCheckpointer` writes graph state to Redis (hot layer) and Postgres (durable layer) after every step; `InMemoryCheckpointer` and `SqliteCheckpointer` also exist.

### 3. Semantic memory (vector store)

Long-term storage of facts, documents, or user preferences, retrieved by semantic similarity rather than exact key. Used when the relevant information cannot fit in the context window.

**Properties:**
- Unlimited storage (external vector database)
- Retrieved by similarity search ("what do I know about this user?")
- Requires embedding the information at write time

**In 10xGraph:** implemented via the store abstraction (`BaseStore`), with `QdrantStore` and `Mem0Store` as backends.

## Implementing episodic memory (thread persistence)

Compile the agent with a checkpointer and pass the same `thread_id` on every call. Install `10xgraph[google-genai,pg_checkpoint]`.

```python title="episodic_memory.py"
from tenxgraph.storage.checkpointer import PgCheckpointer
from tenxgraph.prebuilt.agent import ReactAgent
from tenxgraph.core.state import Message

def get_weather(city: str) -> str:
    """Get weather for a city."""
    return f"22°C, sunny in {city}"

agent = ReactAgent(
    model="google/gemini-2.5-flash",
    tools=[get_weather],
)

checkpointer = PgCheckpointer(
    postgres_dsn="postgresql://user:password@localhost/graph_db",
    redis_url="redis://localhost:6379/0",
)

app = agent.compile(checkpointer=checkpointer)

# First turn
result1 = app.invoke(
    {"messages": [Message.text_message("What's the weather in Tokyo?")]},
    config={"thread_id": "user-123"},  # thread_id scopes the memory
)

# Second turn: agent remembers the first question
result2 = app.invoke(
    {"messages": [Message.text_message("And in London?")]},
    config={"thread_id": "user-123"},  # same thread = same memory
)
```

The second invocation has full context of the first turn because both use `thread_id: "user-123"`. A different user gets a different thread ID and sees no cross-contamination.

## Implementing semantic memory (long-term store)

Give the agent a vector store through `MemoryConfig`. Install `10xgraph[google-genai,qdrant,openai]` and set `OPENAI_API_KEY` for the embeddings.

```python title="semantic_memory.py"
from tenxgraph.prebuilt.agent import ReactAgent
from tenxgraph.storage.store import (
    MemoryConfig,
    OpenAIEmbedding,
    create_local_qdrant_store,
)

# Local Qdrant store with OpenAI embeddings
store = create_local_qdrant_store("./qdrant_data", OpenAIEmbedding())

agent = ReactAgent(
    model="google/gemini-2.5-flash",
    memory=MemoryConfig(store=store),
)
app = agent.compile()
```

With `MemoryConfig`, the agent retrieves relevant memories before each model call and exposes memory tools so the model can save facts ("user prefers Python over JavaScript") and recall them in future sessions. User-scoped and agent-scoped memory are configured separately. See the memory store guide for the full options.

## Memory and the API server

When running via `10xgraph api`, memory is automatic once the graph is compiled with a checkpointer. The server uses the checkpointer the compiled graph carries:

```python title="graph/agent.py"
app = agent.compile(checkpointer=checkpointer)
```

```json title="10xgraph.json"
{
  "agent": "graph.agent:app"
}
```

The thread ID is passed in each API request:

```bash
curl -X POST http://localhost:8000/v1/graph/invoke \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": [{"type": "text", "text": "Hello"}]}], "config": {"thread_id": "user-123"}}'
```

## Context window management

Working memory grows with each turn, and long conversations eventually exceed the model's context limit. Set `trim_context=True` and register a context manager so 10xGraph trims old messages. `MessageContextManager` keeps the last `max_messages` messages (default 10):

```python title="trim_context.py"
from tenxgraph.prebuilt import MessageContextManager
from tenxgraph.prebuilt.agent import ReactAgent

agent = ReactAgent(
    model="google/gemini-2.5-flash",
    context_manager=MessageContextManager(max_messages=20),
    trim_context=True,  # trim old messages through the context manager
)
```

## Next steps

- [Checkpointing and threads](https://10xgraph.com/docs/concepts/checkpointing-and-threads): How 10xGraph's persistence layer works in detail.
- [Set up checkpointing](https://10xgraph.com/docs/guides/set-up-checkpointing): Configure Redis + Postgres dual-layer persistence for production.
- [Use the memory store](https://10xgraph.com/docs/guides/use-memory-store): Add long-term semantic memory to your agent.
- [Add memory to your agent](https://10xgraph.com/docs/get-started/tutorial/threads-and-memory): Beginner guide to memory and threads.

## Frequently asked questions

### What is the difference between agent memory and a database?

A database stores structured data retrieved by exact queries. Agent memory covers three types: in-context memory (the LLM's working context), episodic memory (conversation threads retrieved by thread ID), and semantic memory (facts retrieved by similarity, not exact match). All three can be backed by databases but serve different retrieval patterns.

### Does 10xGraph support persistent memory out of the box?

Yes. 10xGraph ships with InMemoryCheckpointer for development (state is lost when the process stops) and PgCheckpointer for production (dual-layer Redis + Postgres persistence). When running via 10xgraph api, the checkpointer the graph is compiled with is applied automatically to all requests.

### How does 10xGraph handle multiple users in the same agent?

Each conversation is scoped to a thread_id. Different users get different thread IDs and their memory is completely isolated. The checkpointer stores state keyed by thread_id, so threads do not share memory. The API server uses thread IDs from each request.

### What is checkpointing in the context of AI agents?

Checkpointing is the practice of saving the full graph state after each processing step to persistent storage. If the server crashes mid-conversation, the state can be restored from the checkpoint. 10xGraph's PgCheckpointer saves to Redis (fast, for active sessions) and Postgres (durable, for long-term history).

### Can I clear an agent's memory?

Yes. Delete the thread from storage to clear its episodic memory. Via the API: DELETE /v1/threads/{thread_id}. The next invocation with that thread_id will start fresh. For semantic memory stored in a vector store, delete the namespace or specific items.
