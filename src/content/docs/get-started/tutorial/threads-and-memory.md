---
title: Add Memory with Threads
seoTitle: "Add memory with checkpointers and thread IDs"
description: "Give your agent conversation memory with thread IDs and checkpointers, persist state across calls, and tell thread memory apart from long-term memory."
group: "Tutorial"
section: "Get started"
order: 70
label: Add Memory
updated: "2026-10-08"
---

A checkpointer saves your agent's state after each run so conversations persist across calls on the same thread. Without one, every `app.invoke` call starts fresh. In this step, you will add `InMemoryCheckpointer` to persist conversation history, test that memory works across turns, and learn when to upgrade to SQLite or Postgres+Redis for production.

## Understanding threads and checkpoints

A **thread** is a unique conversation identifier. When you invoke a graph with the same `thread_id` and a checkpointer is attached, the graph loads the previous state, processes the new message, and saves the updated state back. Each thread is completely isolated — different `thread_id` values get fresh starts.

Every call to `app.invoke` takes a `config` with a `thread_id`. The checkpointer persists state keyed by this ID. Without a checkpointer, the graph has no memory and history is lost between invocations.

```mermaid
sequenceDiagram
  participant App as app.invoke(thread_id="abc")
  participant Checkpointer as Checkpointer
  participant State as Agent State

  App->>Checkpointer: load state for "abc"
  Checkpointer-->>State: previous messages & state
  App->>State: append new message
  App->>State: run agent node
  App->>Checkpointer: save updated state for "abc"
```

The checkpointer reads before the first node runs and writes after the final node completes. This ensures the agent always has full context from previous turns.

## Add a checkpointer

`InMemoryCheckpointer` stores all state in process memory. It is ideal for development and testing because it requires no external infrastructure. State is lost when the process exits.

Edit your graph from the previous step to compile with a checkpointer:

```python
from tenxgraph.core.graph import Agent, StateGraph, ToolNode
from tenxgraph.core.state import AgentState, Message
from tenxgraph.storage.checkpointer import InMemoryCheckpointer
from tenxgraph.utils import END

checkpointer = InMemoryCheckpointer()

agent = Agent(
    model="google/gemini-2.5-flash",
    system_prompt=[
        {
            "role": "system",
            "content": "You are a helpful assistant.",
        }
    ],
)

graph = StateGraph(AgentState)
graph.add_node("assistant", agent)
graph.set_entry_point("assistant")
graph.add_edge("assistant", END)

# Pass the checkpointer when compiling
app = graph.compile(checkpointer=checkpointer)
```

## Test multi-turn conversation

Create `agent_with_memory.py` with the graph above, then add these calls:

```python
THREAD = "memory-demo-1"

# First turn
result = app.invoke(
    {"messages": [Message.text_message("My name is Alex.")]},
    config={"thread_id": THREAD},
)
print(result["messages"][-1].text())

# Second turn — same thread_id, agent remembers
result = app.invoke(
    {"messages": [Message.text_message("What is my name?")]},
    config={"thread_id": THREAD},
)
print(result["messages"][-1].text())
```

Run it:

```bash
python agent_with_memory.py
```

Expected output (exact wording varies):

```text
Nice to meet you, Alex!
Your name is Alex.
```

The agent remembered "Alex" from the first turn because both calls shared the same `thread_id`.

## Use a different thread

Each `thread_id` is an independent conversation. Using a different ID gives the agent a fresh start:

```python
# New thread — agent has no memory of "Alex"
result = app.invoke(
    {"messages": [Message.text_message("What is my name?")]},
    config={"thread_id": "memory-demo-2"},
)
print(result["messages"][-1].text())
```

Expected output:

```text
I don't know your name yet. Could you tell me?
```

## Choose a checkpointer for your use case

The example above uses `InMemoryCheckpointer`, which is fine for development. As you move toward production, choose a checkpointer based on your needs:

| Checkpointer | Storage | Durability | When to use | Extra required |
|---|---|---|---|---|
| `InMemoryCheckpointer` | RAM | Lost on process exit | Local development, tests, demos | None |
| `SqliteCheckpointer` | SQLite file | Survives restarts | Single-user or embedded agents, Tauri/Electron apps, CLI tools | `pip install 10xgraph[sqlite_checkpoint]` |
| `PgCheckpointer` | Postgres + Redis | Full durability & scale | Multi-user servers, production | `pip install 10xgraph[pg_checkpoint]` |

**InMemoryCheckpointer** is perfect for this tutorial because you are running locally. When you deploy, you'll upgrade to SQLite (for single-user scenarios) or Postgres+Redis (for shared services).

### Upgrade to SQLite

SQLite stores state in a local file. The checkpointer handles all table management. It survives process restarts and is ideal for agents embedded in desktop apps or running on a single machine:

```python
from tenxgraph.storage.checkpointer import SqliteCheckpointer

# Path defaults to ~/.10xgraph/default.db
checkpointer = SqliteCheckpointer(db_path="./my_agent.db")
app = graph.compile(checkpointer=checkpointer)
```

Install the extra: `pip install 10xgraph[sqlite_checkpoint]`

### Upgrade to Postgres+Redis

`PgCheckpointer` uses Postgres for durable state and Redis as a hot cache. It is the production choice for services that need to handle concurrent requests, scale horizontally, or offer high availability:

```python
from tenxgraph.storage.checkpointer import PgCheckpointer

checkpointer = PgCheckpointer(
    postgres_url="postgresql://user:pass@localhost/agentdb",
    redis_url="redis://localhost:6379"
)
app = graph.compile(checkpointer=checkpointer)
```

Install the extra: `pip install 10xgraph[pg_checkpoint]`

The checkpointer creates all required tables on first run. In production, ensure your Postgres instance is properly backed up and your Redis is configured for failover. See the [Checkpointing guide](/docs/guides/set-up-checkpointing) for detailed configuration.

## Thread memory vs long-term store

There are two distinct memory layers in 10xGraph:

**Thread memory** (checkpointer) is the short-term conversation context. It stores all messages, state, and execution history for a specific thread. When you invoke the graph with a `thread_id`, the checkpointer loads the full prior history so the agent has complete context. This is ideal for multi-turn conversations within a single thread, where the agent needs to recall everything said earlier in that thread.

**Long-term store** (Qdrant, Mem0) is for semantic memory that persists across threads and users. It is a vector database indexed by embedding, used for retrieval-augmented generation (RAG), user preference storage, or shared facts. You query the store with a natural language search, not a thread ID. Long-term store is optional and typically activated via memory tools like `memory_tool()` or a custom memory preload node.

In this tutorial, you are building thread memory. If your agent needs to remember facts about users or access shared knowledge across different conversations, you would integrate a long-term store separately. Most agents start with solid thread memory; long-term store is added when use cases demand it (e.g., "remember my preferences across all chats").

## What you learned

- A checkpointer persists state between invocations, keyed by `thread_id`.
- Each thread is an independent conversation; different thread IDs start fresh.
- `InMemoryCheckpointer` is fast for development; `SqliteCheckpointer` for single-user deployments; `PgCheckpointer` for production services.
- Thread memory (checkpointer) and long-term store (vector DB) serve different purposes: thread memory holds recent conversation context, while long-term store enables semantic search across threads.
- Attach the checkpointer during graph compilation: `graph.compile(checkpointer=...)`.
- State is loaded before the first node, updated by the graph, and saved after the final node completes.

## Next step

Serve the agent over HTTP with [Run with the API](/docs/get-started/tutorial/serve-and-inspect).
