# RAGAgent

> RAGAgent retrieves relevant documents from a knowledge base, optionally reranks them, then answers questions grounded in that context.

Source: https://10xgraph.com/docs/guides/prebuilt/rag-agent
Last updated: 2026-10-08

RAGAgent implements Retrieval-Augmented Generation: it retrieves relevant documents from a knowledge base, optionally reranks them by relevance, and synthesizes the LLM's answer grounded in that context. Use it for question-answering over custom documents, long documents, or knowledge bases that grow over time.

**Import path:** `tenxgraph.prebuilt.agent`

---

## Why RAGAgent

A language model's answers are limited to its training data, which is static and quickly becomes outdated. RAGAgent solves this by injecting retrieval into the flow: the LLM no longer guesses, it reads. This makes answers more accurate, traceable, and verifiable because every answer cites the documents behind it.

The pattern is especially effective for:

- **Support tickets**: Answer questions using your knowledge base, API docs, or FAQ.
- **Research**: Ground claims in papers, reports, or research documents.
- **Legal/compliance**: Ensure decisions reference actual policy documents, not memorized rules.
- **Customer data**: Answer questions about specific customers' historical interactions or documents.

You retain full control: the LLM's system prompt, the retrieval strategy, how documents are formatted, and whether to rerank are all configurable.

---

## How it works

RAGAgent runs a three-phase pipeline (or two phases if you skip reranking):

```mermaid
flowchart LR
    START([START]) --> RETRIEVE["RETRIEVE\n(vector search)"]
    RETRIEVE --> RERANK["RERANK\n(optional: score and trim)"]
    RERANK --> SYNTHESIZE["SYNTHESIZE\n(inject docs + call LLM)"]
    SYNTHESIZE --> END_NODE([END])
```

**RETRIEVE**, The agent extracts the user's latest question from the conversation and searches the vector store for the top `k` most similar documents. These are stored internally so subsequent nodes can access them.

**RERANK** (optional), If you provide a reranker, it re-scores the candidates using a cross-encoder or other ranking function. This filters out false positives from vector similarity and returns only the top `n` most relevant results. Skipped if no reranker is configured.

**SYNTHESIZE**, The agent formats the retrieved documents into a `<context>` block and prepends it to the user's question. This augmented message is then passed to the underlying LLM (typically a faster or cheaper model), which generates the answer. The agent's own system prompt remains untouched.

The retrieved documents are always available in `state.execution_meta.internal_data["rag_docs"]` if you need to inspect or post-process them.

---

## When to use RAGAgent vs other building blocks

**Use RAGAgent when:**

- Your knowledge base is too large to fit in the system prompt or context window.
- Documents are added, updated, or deleted over time.
- You need trace-ability: every answer should cite sources.
- The user's question is about specific documents, not general reasoning.

**Use ReactAgent instead if:**

- You only need general reasoning or arithmetic, not document lookup.
- Your knowledge base is tiny (fits in the context window).
- The user's question is unlikely to match documents (e.g., creative brainstorming).

**Use a custom StateGraph if:**

- You need to combine RAG with tools (e.g., retrieve docs, then call an API).
- You want conditional retrieval (e.g., skip retrieval if the question is about current time).
- You need to chunk documents on-the-fly rather than indexing them upfront.

---

## Reranking: optional but powerful

Vector embeddings measure distance, not relevance. A query might match many documents at similar distances, but only a few are truly relevant. Reranking solves this using a cross-encoder that directly scores `(query, document)` pairs.

The typical workflow when using a reranker:

1. Retrieve many candidates with vector search (`top_k=20`): fast, cheap.
2. Rerank and keep the top few (`top_n=5`): slower, more accurate.
3. Synthesize with only the best candidates.

This two-stage approach gets you 80% of the benefit with 20% of the cost.

### Reranker options

| Name | Backend | Pros | Cons | Install |
|---|---|---|---|---|
| None (default) | Vector similarity only | Fastest, simplest, no API calls | May include irrelevant docs if embeddings are weak | (included) |
| `CohereReranker` | Cohere Rerank API | Highly accurate, supports any language, fast | Requires API key and network call | `pip install cohere` |
| `CrossEncoderReranker` | Local sentence-transformers | No API key, works offline, fully private | CPU-bound (runs in executor to avoid blocking), slower than API | `pip install sentence-transformers` |
| Custom | Your own class | Integrate your ranking logic | You maintain it | Implement `BaseReranker` protocol |

---

## Constructor parameters

When you create a RAGAgent, you configure both the retrieval behavior and the underlying graph infrastructure.

### Core retrieval parameters

| Parameter | Type | Default | What it does |
|---|---|---|---|
| `store` | `BaseStore` | **required** | The vector store holding your knowledge base (e.g., `QdrantStore`). The RETRIEVE node calls `store.asearch()` to find similar documents. |
| `agent` | `BaseAgent` | **required** | The LLM that generates the final answer. Typically `Agent(model="gpt-4o-mini")` or similar. The SYNTHESIZE node calls `agent.execute()` after injecting documents. |
| `reranker` | `BaseReranker \| None` | `None` | Optional reranker (`CohereReranker`, `CrossEncoderReranker`, or your custom class). If provided, a RERANK node is inserted between RETRIEVE and SYNTHESIZE. |
| `top_k` | `int` | `5` | Number of candidates retrieved from the store. Increase to 15-20 if you use a reranker (it needs more candidates to filter). |
| `top_n` | `int` | `3` | Number of documents forwarded to the LLM after reranking. Ignored if no reranker is provided; all `top_k` docs go to the LLM instead. |
| `retrieval_strategy` | `RetrievalStrategy` | `SIMILARITY` | Vector search strategy (e.g., `RetrievalStrategy.SIMILARITY`). Passed to `store.asearch()`. |
| `score_threshold` | `float \| None` | `None` | Minimum similarity score. Documents below this are filtered out. Useful to exclude near-misses. |
| `store_config` | `dict \| None` | `None` | Extra key-value pairs passed to every `store.asearch()` call. Example: `{"user_id": "u42"}` to filter documents by user. |

### Graph infrastructure parameters

| Parameter | Type | Default | What it does |
|---|---|---|---|
| `state` | `AgentState \| None` | `None` | Optional custom state subclass. If you need extra fields beyond messages and context, subclass `AgentState` and pass it here. |
| `context_manager` | `BaseContextManager \| None` | `None` | Strategy for trimming or summarizing context when it grows too large. Link to `/docs/guides/use-context-manager`. |
| `publisher` | `BasePublisher \| None` | `None` | Event publisher for streaming or observability (e.g., `ConsolePublisher`). Can be a single publisher or a list of publishers. |
| `id_generator` | `BaseIDGenerator` | `DefaultIDGenerator()` | Generates run and message IDs. Replace to use UUIDs, Snowflake IDs, or custom formats. |
| `container` | `InjectQ \| None` | `None` | Dependency injection container. If your tools need injected parameters, pass the InjectQ container here. |

---

## Compile parameters

After constructing RAGAgent, you call `.compile(...)` to finalize the graph and get a runnable `CompiledGraph`.

| Parameter | Type | Default | What it does |
|---|---|---|---|
| `checkpointer` | `BaseCheckpointer \| None` | `None` | Persists conversation state to disk or database. Required for multi-turn conversations that survive restarts. Examples: `InMemoryCheckpointer()`, `PgCheckpointer()`. |
| `store` | `BaseStore \| None` | `None` | Long-term memory store for the agent (separate from the retrieval `store`). Used by memory tools to store facts across conversations. Link to `/docs/guides/use-memory-store`. |
| `interrupt_before` | `list[str] \| None` | `None` | Node names to pause before. Useful for human-in-the-loop: pause before RETRIEVE, review the query, then resume. Valid names: `"RETRIEVE"`, `"RERANK"`, `"SYNTHESIZE"`. |
| `interrupt_after` | `list[str] \| None` | `None` | Node names to pause after. Example: pause after RETRIEVE to inspect retrieved documents before the LLM sees them. |
| `callback_manager` | `CallbackManager` | `CallbackManager()` | Lifecycle hooks (before/after invoke, on error, etc.). Used for logging, monitoring, or side effects. |
| `media_store` | `BaseMediaStore \| None` | `None` | Storage for images, audio, or documents passed through the conversation. Required if your LLM calls see multimodal content. |
| `shutdown_timeout` | `float` | `30.0` | Seconds to wait for graceful shutdown. When the graph closes, it cancels in-flight tasks and waits this long before forcefully exiting. |

---

## Getting started: minimal example

The simplest RAGAgent only needs a store and an agent. Vector retrieval alone works well for most use cases.

```python
import asyncio
from tenxgraph.core.graph import Agent
from tenxgraph.prebuilt.agent import RAGAgent
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding
from tenxgraph.core.state import Message

# Set up the vector store with your knowledge base.
store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

# Create the agent.
rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o-mini",
        provider="openai",
        system_prompt="Answer using only the provided context. If not found, say so.",
    ),
    top_k=5,  # Retrieve 5 documents.
)

# Compile and run.
app = rag.compile()

async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("What is the refund policy?")]},
        config={"thread_id": "customer-1"},
    )
    print(result["context"][-1].text())

asyncio.run(main())
```

Run this with:

```bash
pip install "10xgraph[openai]"
export OPENAI_API_KEY=sk-...
python script.py
```

---

## Using a reranker for higher accuracy

If your vector embeddings are noisy or you need to filter many candidates, add a reranker. Retrieve many, rerank to keep the best few, then answer.

### Option 1: Cohere Rerank (API-based)

Cohere's Rerank API is fast and highly accurate. You retrieve 20 candidates, rerank, and keep the top 5 for the LLM.

```python
import asyncio
from tenxgraph.core.graph import Agent
from tenxgraph.prebuilt.agent import RAGAgent
from tenxgraph.prebuilt.agent.rag import CohereReranker
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding
from tenxgraph.core.state import Message

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o",
        provider="openai",
        system_prompt="Use only the provided context.",
    ),
    reranker=CohereReranker(api_key="YOUR_COHERE_KEY", model="rerank-v4.0-pro"),
    top_k=20,  # Retrieve 20 candidates.
    top_n=5,   # Keep top 5 for the LLM.
)

app = rag.compile()

async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("Summarize the warranty terms.")]},
        config={"thread_id": "customer-2"},
    )
    print(result["context"][-1].text())

asyncio.run(main())
```

Install and run:

```bash
pip install "10xgraph[openai]" cohere
export OPENAI_API_KEY=sk-...
export COHERE_API_KEY=...
python script.py
```

### Option 2: CrossEncoder (local, no API key)

The `sentence-transformers` library provides local cross-encoder models. This runs on your machine, no API calls, suitable for private data.

```python
from tenxgraph.core.graph import Agent
from tenxgraph.prebuilt.agent import RAGAgent
from tenxgraph.prebuilt.agent.rag import CrossEncoderReranker
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding

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

Install:

```bash
pip install "10xgraph[openai]" sentence-transformers
```

---

## Persistent conversations with checkpointing

To support multi-turn conversations where the LLM remembers previous questions and answers, use a checkpointer.

```python
import asyncio
from tenxgraph.core.graph import Agent
from tenxgraph.prebuilt.agent import RAGAgent
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding
from tenxgraph.storage.checkpointer import PgCheckpointer
from tenxgraph.core.state import Message

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o-mini",
        provider="openai",
        system_prompt="Answer questions using only the provided context.",
    ),
    top_k=5,
)

# Persist state to Postgres + Redis.
checkpointer = PgCheckpointer(postgres_dsn="postgresql://user:pass@localhost/db")
app = rag.compile(checkpointer=checkpointer)

async def main():
    # First turn.
    result1 = await app.ainvoke(
        {"messages": [Message.text_message("What is the refund policy?")]},
        config={"thread_id": "customer-session-1"},
    )
    print("First answer:", result1["context"][-1].text())
    
    # Second turn in the same thread, the agent remembers the first exchange.
    result2 = await app.ainvoke(
        {"messages": [Message.text_message("Does it apply to digital products?")]},
        config={"thread_id": "customer-session-1"},
    )
    print("Follow-up answer:", result2["context"][-1].text())

asyncio.run(main())
```

Install and run:

```bash
pip install "10xgraph[openai,pg_checkpoint]"
export OPENAI_API_KEY=sk-...
export POSTGRES_DSN=postgresql://user:pass@localhost/db
python script.py
```

---

## Custom reranker

Implement the `BaseReranker` protocol to plug in your own ranking logic.

```python
from tenxgraph.core.graph import Agent
from tenxgraph.prebuilt.agent import RAGAgent

class MyCustomReranker:
    """Score documents by length (longest first)."""
    
    async def arerank(self, query: str, documents: list[str], top_n: int) -> list[str]:
        # Your ranking logic here.
        ranked = sorted(documents, key=len, reverse=True)
        return ranked[:top_n]

rag = RAGAgent(
    store=store,
    agent=Agent(model="gpt-4o-mini", provider="openai"),
    reranker=MyCustomReranker(),
    top_k=10,
    top_n=3,
)
```

---

## Running interactively with `10xgraph play`

The `10xgraph play` command starts a web-based playground where you can test your agent interactively.

Create these two files:

**`graph.py`**

```python
from tenxgraph.core.graph import Agent
from tenxgraph.prebuilt.agent import RAGAgent
from tenxgraph.storage import create_local_qdrant_store
from tenxgraph.storage.store.embedding import OpenAIEmbedding

store = create_local_qdrant_store(
    path="./knowledge_base",
    embedding=OpenAIEmbedding(model="text-embedding-3-small"),
)

rag = RAGAgent(
    store=store,
    agent=Agent(
        model="gpt-4o-mini",
        provider="openai",
        system_prompt="Answer questions using the provided context only.",
    ),
    top_k=5,
)

app = rag.compile()
```

**`10xgraph.json`**

```json
{
  "agent": "graph:app",
  "env": ".env"
}
```

**`.env`**

```
OPENAI_API_KEY=sk-...
```

Then run:

```bash
10xgraph play
```

The playground opens at `http://localhost:8080`. Type your question and see the answer plus retrieved documents in the inspector.

---

## Customization: tuning retrieval quality

RAGAgent retrieval quality depends on three factors: embeddings, `top_k`, and optional reranking.

### Improving embeddings

The quality of your vector store's embeddings directly affects recall. Good embeddings separate relevant documents from irrelevant ones in embedding space.

- Use a model matched to your domain. OpenAI's `text-embedding-3-small` is a solid default; try `text-embedding-3-large` if you have small, dense documents.
- Index documents at the right granularity: chunks of 200-400 tokens typically work well. Too small = missing context; too large = noise.
- Store document metadata (source, date, author) so you can filter or post-process results.

### Tuning top_k and top_n

- **Without reranker:** `top_k=5` or `top_k=10` retrieves just enough to answer the question. Increase if documents are repetitive or if your embedding model is weak.
- **With reranker:** `top_k=20, top_n=5` is a good starting point. The reranker filters out false positives from vector similarity.
- **Low-latency apps:** Minimize `top_k` (e.g., 3) and skip the reranker. Vector similarity alone is usually fast enough.
- **High-accuracy apps:** Increase `top_k` (20-30) and add a reranker. Spend the extra latency to get the best documents.

### Adding a score threshold

If your store supports `score_threshold`, use it to exclude low-confidence matches:

```python
rag = RAGAgent(
    store=store,
    agent=agent,
    top_k=10,
    score_threshold=0.7,  # Only docs with similarity >= 0.7
)
```

### Per-user or per-session filtering

Use `store_config` to pass extra parameters to retrieval, e.g., to restrict documents by user:

```python
rag = RAGAgent(
    store=store,
    agent=agent,
    store_config={"user_id": "u42"},  # Passed to every store.asearch() call
)
```

---

## Introspecting retrieved documents

The retrieved documents are always available in state if you need to inspect, log, or post-process them.

```python
async def main():
    result = await app.ainvoke(
        {"messages": [Message.text_message("What is the refund policy?")]},
        config={"thread_id": "customer-1"},
    )
    
    # Inspect the retrieved documents.
    docs = result["execution_meta"].internal_data.get("rag_docs", [])
    print(f"Retrieved {len(docs)} documents:")
    for i, doc in enumerate(docs, 1):
        print(f"[{i}] {doc[:100]}...")
    
    print(f"\nAnswer: {result['context'][-1].text()}")

asyncio.run(main())
```

---

## Common patterns

### RAG + tools

If you need to combine retrieval with tool calls (e.g., retrieve docs, then call an API), use a custom StateGraph instead. Link to `/docs/guides/build-a-graph`.

### RAG + long context

For very long documents, retrieve chunks and let the LLM synthesize. Avoid putting all documents in the system prompt upfront; RAG handles that dynamically.

### Multi-turn RAG

Each turn retrieves fresh documents based on the latest message. The checkpointer remembers the full conversation, so the LLM can refer back to earlier turns while always retrieving the most relevant documents for the current question.

### Evaluating RAG quality

Use evaluation sets to measure retrieval and generation quality. Link to `/docs/guides/testing` for setup.

---

## Related pages

- `/docs/guides/prebuilt-agents`: Overview of all prebuilt agents and when to use each.
- `/docs/concepts/choosing-a-building-block`: Decision guide: RAGAgent vs ReactAgent vs custom graph.
- `/docs/guides/use-memory-store`: Add long-term memory (separate from the retrieval store).
- `/docs/guides/set-up-checkpointing`: Configure persistence for multi-turn conversations.
- `/docs/reference/python/prebuilt-agents`: Full API reference for RAGAgent and all constructor/compile parameters.

## Frequently asked questions

### When should I use RAGAgent instead of a plain Agent?

Use RAGAgent when you need the LLM to answer questions based on a specific knowledge base rather than its training data. It ensures answers are grounded in your documents.

### What's the difference between top_k and top_n?

top_k is the number of candidates retrieved from the vector store; top_n is how many reach the LLM after reranking. Use top_k=20, top_n=5 to retrieve many, keep the best few.

### Do I need a reranker?

Only if retrieval accuracy matters more than speed. For most applications, good embeddings and tuned top_k work well. Add a reranker when you need to filter noisy candidates.
