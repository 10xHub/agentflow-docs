# RAGAgent

A Retrieval-Augmented Generation agent that retrieves relevant documents from a knowledge base before generating an answer.

**Import path:** `agentflow.prebuilt.agent`

---

## Concept

A plain LLM only knows what it was trained on. RAG (Retrieval-Augmented Generation) extends this by:
1. Searching a vector store for documents relevant to the user's query
2. Injecting those documents into the user message as `<context>` blocks
3. Letting the LLM generate an answer grounded in the retrieved content

```
START → RETRIEVE → SYNTHESIZE → END

or with a reranker:

START → RETRIEVE → RERANK → SYNTHESIZE → END
```

Retrieved documents are stored in `state.execution_meta.internal_data["rag_docs"]` between nodes.

### Why add a reranker?

A vector similarity search (`top_k=20`) retrieves the 20 most similar chunks by embedding distance, but embedding similarity does not always equal relevance. A cross-encoder reranker scores each `(query, document)` pair directly and typically surfaces better results. Retrieve many candidates (`top_k=20`), then rerank and keep the best few (`top_n=5`).

---

## Code Explanation

### RETRIEVE node

```python
async def _retrieve(state, config):
    query = last user message text
    docs = await store.asearch(query, limit=top_k, score_threshold=score_threshold, ...)
    state.execution_meta.internal_data["rag_docs"] = [r.content for r in docs]
    return state
```

### RERANK node (optional)

```python
async def _rerank(state, config):
    docs = state.execution_meta.internal_data["rag_docs"]
    ranked = await reranker.arerank(query, docs, top_n=top_n)
    state.execution_meta.internal_data["rag_docs"] = ranked
    return state
```

### SYNTHESIZE node

```python
async def _synthesize(state, config):
    docs = state.execution_meta.internal_data["rag_docs"]
    augmented = "<context>\n[1] doc1\n[2] doc2\n</context>\n\noriginal query"
    # replaces the last user message in state.context with the augmented version
    return await agent.execute(state, config)
```

The agent's own `system_prompt` is left completely untouched — only the user message is modified.

### Reranker types

| Class | Backend | Requires |
|---|---|---|
| `CohereReranker` | Cohere Rerank API | `pip install cohere` |
| `CrossEncoderReranker` | Local sentence-transformers | `pip install sentence-transformers` |
| Custom | Any `arerank(query, docs, top_n)` method | Implement `BaseReranker` protocol |

---

## Full Code

### Minimal (no reranker)

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

result = await app.ainvoke(
    {"message": "What is the refund policy?"},
    config={"thread_id": "rag-1"},
)
print(result["context"][-1].text())
```

### With Cohere Reranker

```python
from agentflow.prebuilt.agent.rag import CohereReranker

rag = RAGAgent(
    store=store,
    agent=Agent(model="gpt-4o"),
    reranker=CohereReranker(api_key="cohere-api-key", model="rerank-v4.0-pro"),
    top_k=20,  # retrieve 20 candidates
    top_n=5,   # keep best 5 for the LLM
)
app = rag.compile()
```

### With CrossEncoder (fully local)

```python
from agentflow.prebuilt.agent.rag import CrossEncoderReranker

rag = RAGAgent(
    store=store,
    agent=Agent(model="gpt-4o-mini"),
    reranker=CrossEncoderReranker("cross-encoder/ms-marco-MiniLM-L-6-v2"),
    top_k=15,
    top_n=4,
)
app = rag.compile()
```

### Custom reranker

```python
from agentflow.prebuilt.agent.rag import BaseReranker

class MyReranker:
    async def arerank(self, query: str, documents: list[str], top_n: int) -> list[str]:
        # your ranking logic here
        return sorted(documents, key=lambda d: len(d))[:top_n]

rag = RAGAgent(store=store, agent=Agent(model="gpt-4o-mini"), reranker=MyReranker())
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

---

## Key Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `store` | `BaseStore` | required | Knowledge base vector store |
| `agent` | `BaseAgent` | required | Pre-built agent that generates the final answer |
| `reranker` | `BaseReranker \| None` | `None` | Optional reranker; enables RERANK node |
| `top_k` | `int` | `5` | Documents to retrieve from the store |
| `top_n` | `int` | `3` | Documents kept after reranking (ignored without reranker) |
| `retrieval_strategy` | `RetrievalStrategy` | `SIMILARITY` | Vector search strategy |
| `score_threshold` | `float \| None` | `None` | Minimum similarity score cutoff |
| `store_config` | `dict \| None` | `None` | Extra config passed to every `store.asearch` call |
