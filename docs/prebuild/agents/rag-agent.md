---
title: RAGAgent — Prebuilt agents
sidebar_label: RAGAgent
description: RAGAgent retrieves documents with vector search, optionally reranks with CohereReranker or CrossEncoderReranker, then synthesizes an answer.
keywords:
  - rag agent
  - retrieval augmented generation
  - agentflow rag
  - reranker
  - vector search agent
---

# RAGAgent

A Retrieval-Augmented Generation agent that retrieves relevant documents from a knowledge base before generating an answer.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

A plain LLM only knows what it was trained on. RAG extends this by searching a vector store for documents relevant to the user's query, injecting them into the conversation as a `<context>` block, then letting the LLM answer from grounded content.

### Without reranker

```mermaid
flowchart LR
    START([START]) --> RETRIEVE["RETRIEVE\n(vector search)"]
    RETRIEVE --> SYNTHESIZE["SYNTHESIZE\n(inject docs + LLM call)"]
    SYNTHESIZE --> END_NODE([END])
```

### With reranker

```mermaid
flowchart LR
    START([START]) --> RETRIEVE["RETRIEVE\n(top_k candidates)"]
    RETRIEVE --> RERANK["RERANK\n(score and trim to top_n)"]
    RERANK --> SYNTHESIZE["SYNTHESIZE\n(inject docs + LLM call)"]
    SYNTHESIZE --> END_NODE([END])
```

### What each node does

**RETRIEVE** — finds the last `user` message in `state.context`, calls `store.asearch(query, limit=top_k)`, and stores the result texts in `state.execution_meta.internal_data["rag_docs"]`.

**RERANK** (optional) — takes the `rag_docs` list, calls `reranker.arerank(query, docs, top_n=top_n)`, and replaces the list with the re-ordered top-n results.

**SYNTHESIZE** — wraps the docs and original query into a single augmented user message:

```
<context>
[1] first retrieved chunk
[2] second retrieved chunk
</context>

original user query
```

It replaces the last user message in `state.context` with this augmented version, then calls `agent.execute(state, config)`. The agent's own `system_prompt` is never touched.

### Why use a reranker?

Vector similarity (`top_k=20`) retrieves by embedding distance, which does not always equal relevance. A cross-encoder reranker scores each `(query, document)` pair directly and surfaces better candidates. The pattern is: retrieve many (`top_k=20`), rerank and keep few (`top_n=5`).

### Reranker types

| Class | Backend | Install |
|---|---|---|
| `CohereReranker` | Cohere Rerank API (async) | `pip install cohere` |
| `CrossEncoderReranker` | Local sentence-transformers (CPU, runs in executor) | `pip install sentence-transformers` |
| Custom | Any class with `async arerank(query, docs, top_n) -> list[str]` | Implement `BaseReranker` protocol |

---

## Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `store` | `BaseStore` | required | Knowledge base vector store |
| `agent` | `BaseAgent` | required | Pre-built agent that generates the final answer |
| `reranker` | `BaseReranker \| None` | `None` | Optional reranker; enables the RERANK node |
| `top_k` | `int` | `5` | Candidates retrieved from the store |
| `top_n` | `int` | `3` | Candidates forwarded to the LLM after reranking (ignored without reranker) |
| `retrieval_strategy` | `RetrievalStrategy` | `SIMILARITY` | Vector search strategy |
| `score_threshold` | `float \| None` | `None` | Minimum similarity score cutoff |
| `store_config` | `dict \| None` | `None` | Extra config passed to every `store.asearch` call (e.g. `{"user_id": "u42"}`) |
| `state` | `AgentState \| None` | `None` | Optional custom state subclass |
| `publisher` | `BasePublisher \| None` | `None` | Event publisher for streaming |
| `container` | `InjectQ \| None` | `None` | Dependency injection container |

---

## `compile()` Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `checkpointer` | `BaseCheckpointer` | `None` | Persist and restore conversation state |
| `store` | `BaseStore` | `None` | Long-term agent-memory store (separate from the retrieval store) |
| `interrupt_before` | `list[str]` | `None` | Pause before the named nodes (`"RETRIEVE"`, `"RERANK"`, `"SYNTHESIZE"`) |
| `interrupt_after` | `list[str]` | `None` | Pause after the named nodes |
| `callback_manager` | `CallbackManager` | default | Lifecycle hooks |
| `media_store` | `BaseMediaStore` | `None` | Binary/media file storage |
| `shutdown_timeout` | `float` | `30.0` | Seconds to wait for clean shutdown |

---

## Full Code

### Minimal — no reranker

```python
import asyncio
from dotenv import load_dotenv
from agentflow.core.graph import Agent
from agentflow.prebuilt.agent import RAGAgent
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding
from agentflow.core.state import Message

load_dotenv()

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o-mini",
        provider="openai",
        system_prompt=[{
            "role": "system",
            "content": (
                "Answer questions using only the provided context. "
                "If the context does not contain the answer, say so."
            ),
        }],
    ),
    top_k=5,
)

app = rag.compile()


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("What is the refund policy?")]},
        config={"thread_id": "rag-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### With Cohere reranker

Retrieve 20 candidates, rerank and pass the best 5 to the LLM:

```python
import asyncio
from agentflow.core.graph import Agent
from agentflow.prebuilt.agent import RAGAgent
from agentflow.prebuilt.agent.rag import CohereReranker
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding
from agentflow.core.state import Message

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o",
        provider="openai",
        system_prompt=[{
            "role": "system",
            "content": "Answer using only the provided context.",
        }],
    ),
    reranker=CohereReranker(api_key="cohere-api-key", model="rerank-v4.0-pro"),
    top_k=20,
    top_n=5,
)

app = rag.compile()


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("Summarize the warranty terms.")]},
        config={"thread_id": "rag-rerank-1"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### With CrossEncoder (fully local, no API key)

```python
from agentflow.core.graph import Agent
from agentflow.prebuilt.agent import RAGAgent
from agentflow.prebuilt.agent.rag import CrossEncoderReranker
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(model="gpt-4o-mini", provider="openai"),
    reranker=CrossEncoderReranker("cross-encoder/ms-marco-MiniLM-L-6-v2"),
    top_k=15,
    top_n=4,
)

app = rag.compile()
```

### Custom reranker

Any class with an async `arerank` method satisfies the `BaseReranker` protocol:

```python
from agentflow.core.graph import Agent
from agentflow.prebuilt.agent import RAGAgent

class MyReranker:
    async def arerank(self, query: str, documents: list[str], top_n: int) -> list[str]:
        # your ranking logic here
        return sorted(documents, key=lambda d: len(d))[:top_n]

rag = RAGAgent(
    store=store,
    agent=Agent(model="gpt-4o-mini", provider="openai"),
    reranker=MyReranker(),
    top_k=10,
    top_n=3,
)
```

### With a checkpointer (persistent conversations)

```python
import asyncio
from agentflow.core.graph import Agent
from agentflow.prebuilt.agent import RAGAgent
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding
from agentflow.storage.checkpointer import PgCheckpointer
from agentflow.core.state import Message

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o-mini",
        provider="openai",
        system_prompt=[{
            "role": "system",
            "content": "Answer questions using only the provided context.",
        }],
    ),
    top_k=5,
)

checkpointer = PgCheckpointer(postgres_dsn="postgresql://user:pass@localhost/db")
app = rag.compile(checkpointer=checkpointer)


async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("What is the cancellation policy?")]},
        config={"thread_id": "user-55-support"},
    )
    print(result["context"][-1].text())


asyncio.run(main())
```

### Google Gemini

```python
from agentflow.core.graph import Agent
from agentflow.prebuilt.agent import RAGAgent
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="google/gemini-2.5-flash",
        provider="google",
        system_prompt=[{
            "role": "system",
            "content": "Answer questions using only the provided context.",
        }],
        trim_context=True,
    ),
    top_k=5,
)

app = rag.compile()
```

---

## Running with `agentflow play`

**`graph.py`**

```python
from agentflow.core.graph import Agent
from agentflow.prebuilt.agent import RAGAgent
from agentflow.storage import create_local_qdrant_store
from agentflow.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o-mini",
        provider="openai",
        system_prompt=[{
            "role": "system",
            "content": "Answer questions using the provided context only.",
        }],
    ),
    top_k=5,
)

app = rag.compile()
```

**`agentflow.json`**

```json
{
  "agent": "graph:app",
  "env": ".env",
  "auth": null,
  "checkpointer": null,
  "injectq": null,
  "store": null,
  "redis": null,
  "thread_name_generator": null
}
```

**`.env`**

```
OPENAI_API_KEY=sk-...
```

```bash
agentflow play
```
