# RAG (Retrieval-Augmented Generation) with  Agentflow

Retrieval-Augmented Generation pairs document (or memory) retrieval with LLM synthesis.  Agentflow provides a concise prebuilt [`rag.py`](agentflow/prebuilt/agent/rag.py) RAG agent plus composable building blocks to extend from “single fetch + answer” to multi-stage hybrid pipelines.

## 🎯 Goals

- Minimal single-pass RAG (retrieve → synthesize → END)
- Hybrid retrieval (multiple retrievers + merge + rerank + compression)
- Clean follow-up control (optional loops)
- Easy integration with vector stores (`QdrantStore`, `Mem0Store`) or custom retrievers

## 🧩 Core Abstractions

| Concept | Purpose |
|--------|---------|
| `RAGAgent.compile` | Simple 2-node pipeline: RETRIEVE → SYNTHESIZE (+ optional loop) |
| `RAGAgent.compile_advanced` | Multi-stage hybrid pipeline with optional query planning, merging, reranking, compression |
| Retriever Node | Callable or `ToolNode` that enriches `AgentState.context` |
| Synthesize Node | Produces final answer (LLM call or heuristic) |
| Follow-up Condition | Returns name of a retriever (loop) or `END` |
| Store Integration | Add semantic search by injecting a `BaseStore` (e.g. Qdrant / Mem0) |

## 📁 Example Files

| Example | Description |
|---------|-------------|
| `basic_rag.py` | Minimal single-pass RAG |
| `advanced_rag.py` | Hybrid multi-stage pipeline |

Run:
```bash
python examples/rag/basic_rag.py
python examples/rag/advanced_rag.py
```

Environment:
```bash
export OPENAI_API_KEY=your_key          # or provider key
export RAG_MODEL=gpt-4o-mini            # optional override
```

## 1. Minimal RAG Flow

The basic pattern (retrieve → synthesize → END) is implemented in `basic_rag.py`.

Key elements:
- A naive in-memory keyword retriever
- A synthesis node using LiteLLM’s `completion` (falls back to local string mode)
- Immediate termination via a follow-up condition returning `END`

Skeleton:

```python
# (excerpt) simplified retriever
def simple_retriever(state: AgentState) -> AgentState:
    query = latest_user_text(state)
    docs = search_docs(query)  # your logic
    state.context.append(Message.text_message(f"[retrieval]\\n{docs}", role="assistant"))
    return state

def synthesize_answer(state: AgentState) -> AgentState:
    ctx = extract_retrieval(state)
    answer = llm_answer(query=last_user(state), context=ctx)
    state.context.append(Message.text_message(answer, role="assistant"))
    return state

rag = RAGAgent[AgentState](state=AgentState())
app = rag.compile(
    retriever_node=simple_retriever,
    synthesize_node=synthesize_answer,
)
result = app.invoke({"messages": [Message.text_message("Explain RAG", role="user")]})
```

### When to Use
Use the minimal pattern for:
- Demos / smoke tests
- Deterministic evaluation scaffolds
- Single-hop factual Q&A

## 2. Advanced Hybrid Pipeline

`advanced_rag.py` demonstrates an extensible chain:

```
QUERY_PLAN → RETRIEVE_1 → (MERGE) → RETRIEVE_2 → (MERGE) → (RERANK) → (COMPRESS) → SYNTHESIZE → END
```

All intermediate stages are optional. You pass them via `options` to `compile_advanced`.

```python
compiled = rag.compile_advanced(
    retriever_nodes=[dense_retriever, sparse_retriever],
    synthesize_node=synthesize,
    options={
        "query_plan": query_plan,
        "merge": merge_stage,
        "rerank": rerank_stage,
        "compress": compress_stage,
        "followup_condition": end_condition,
    },
)
```

### Stage Purposes

| Stage | Role | Replace With (Prod) |
|-------|------|---------------------|
| QUERY_PLAN | Reformulate / decompose query | LLM planning, schema mapping |
| RETRIEVE_n | Gather candidates | Dense (vector), sparse (BM25), metadata, self-query |
| MERGE | Deduplicate & fuse | Score fusion (RRF, weighted, reciprocal) |
| RERANK | Precision ordering | Cross-encoder, LLM judging |
| COMPRESS | Token budget reduction | Hierarchical summarization, map-reduce |
| SYNTHESIZE | Final answer | Prompt-engineered LLM, citation formatting |

You can omit any unused stage—`RAGAgent` only wires what you provide.

## 3. Adding Real Retrieval (Qdrant)

Replace placeholder retrieval with a vector store powered by `QdrantStore` (see `qdrant_store.md`):

```python
from agentflow.store import QdrantStore
from agentflow.store.qdrant_store import OpenAIEmbeddingService
from agentflow.store.store_schema import MemoryType

embedding = OpenAIEmbeddingService(api_key="...", model="text-embedding-3-small")
store = QdrantStore(embedding_service=embedding, path="./qdrant_data")
await store.asetup()


async def dense_retriever(state: AgentState) -> AgentState:
    query = last_user_text(state)
    results = await store.asearch(
        config={"user_id": "u1"},
        query=query,
        limit=4,
        memory_type=MemoryType.SEMANTIC,
    )
    docs = "\n".join(f"- {r.content}" for r in results) or "No results."
    state.context.append(Message.text_message(f"[dense]\n{docs}", role="assistant"))
    return state
```

For sparse retrieval, you could maintain a keyword index or use another store instance with lexical scoring.

## 4. Using Mem0Store for Conversational Memory

When long-term personalization or session continuity is needed, integrate `Mem0Store`:

```python
from agentflow.store import create_mem0_store

mem_store = create_mem0_store(user_id="user-1")


async def memory_retriever(state: AgentState) -> AgentState:
    query = last_user_text(state)
    memories = await mem_store.asearch({"user_id": "user-1"}, query=query, limit=3)
    enriched = "\n".join(f"- {m.content}" for m in memories) or "No prior memories."
    state.context.append(Message.text_message(f"[memory]\n{enriched}", role="assistant"))
    return state
```

Combine memory-based recall with knowledge-base retrieval before synthesis.

## 5. Follow-up Loops

By default both examples terminate after synthesis. To enable iterative refinement:

```python
def followup_condition(state: AgentState) -> str:
    if need_more_context(state):
        return "RETRIEVE_1"  # or the first retriever name
    return END

app = rag.compile(
    retriever_node=simple_retriever,
    synthesize_node=synthesize_answer,
    followup_condition=followup_condition,
)
```

Loop exit criteria can consider:
- Confidence signals (logit bias, heuristic)
- Coverage checks (missing entities)
- Answer length / quality scores

## 6. Prompt & Context Strategy

Recommended prompt skeleton:

```
System: Role + style + answer policy
Context Section(s): Retrieved passages / Memory summaries
User Question: Original or reformulated
Instructions: Cite sources, abstain if uncertain, etc.
```

Keep retrieval markers (`[dense]`, `[sparse]`, `[merge]`, `[memory]`) to enable deterministic parsing or dynamic prompt shaping.

## 7. Quality Techniques

| Technique | Benefit |
|-----------|---------|
| Weighted Fusion | Balances heterogeneous retrievers |
| Cross-Encoder Reranking | Precision top-K selection |
| Adaptive Query Reformulation | Reduces drift / broadens coverage |
| Multi-step Compression | Fit more evidence in constrained models |
| Memory Filtering / Aging | Prevents prompt bloat |
| Citation Emission | Transparency & auditable responses |

## 8. Error Handling & Robustness

- Wrap model calls; provide fallback text if API fails
- Timebox retrievers; degrade gracefully (skip stage if timeout)
- Validate that each stage appended something; log empties for monitoring
- Include tracing via `CallbackManager` if deeper observability is required

## 9. Benchmarking

Track these metrics:
- Retrieval Recall@K
- Post-rerank MRR / nDCG
- Token footprint (pre/post compression)
- Latency breakdown per stage
- Final answer groundedness (manual or LLM judge)

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty retrieval context | Query mismatch / no overlap | Add embedding retrieval / query expansion |
| Hallucinated answer | Missing context injection | Ensure retrieval messages are in final prompt |
| High latency | Sequential retrievers | Parallelize independent retrievers, cache embeddings |
| Truncated citation context | No compression strategy | Add summarization or selective sentence extraction |

## 11. Extending Further

- Add **Guard Rails** before synthesis (policy check)
- Emit **Structured JSON** with answer + sources
- Integrate **Feedback Loop** (judge node evaluating answer adequacy)
- Build **Multi-Hop** retrieval by chaining follow-up loops

## 12. Next Steps

Explore:
- `qdrant_store.md` for production vector search
- `long_term_memory.md` for Mem0-based persistence
- Advanced orchestration patterns in `misc/advanced_patterns.md`

RAG scalability depends on disciplined stage isolation— Agentflow’s node + conditional edge model keeps each concern explicit and testable.

---

Efficient, composable, and production-oriented—adapt these patterns to your domain data and governance requirements.
