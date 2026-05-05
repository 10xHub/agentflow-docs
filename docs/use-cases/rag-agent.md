---
title: "Build a RAG AI Agent in Python: Done Right"
description: How to build a RAG AI agent in Python that scales beyond chat-with-your-PDFs. Hybrid retrieval, reranking, citations, and AgentFlow code.
keywords:
  - rag ai agent python
  - chat with your docs
  - python rag framework
  - retrieval augmented generation
  - rag agent framework
sidebar_position: 6
---

# Build a RAG AI agent in Python: done right

"Chat with my docs" is the most-prototyped, often-shipped, frequently-broken AI use case. Most teams ship a single retrieve-and-generate call, hit quality limits, and stall.

This page shows the production-shaped pattern: agentic RAG with hybrid retrieval, reranking, and forced citations.

## Architecture at a glance

```
[ User question ]
       │
       ▼
[ Query understanding ] ── decompose into subqueries
       │
       ▼
[ Retrieval loop ]
   ├── hybrid_search (dense + keyword)
   ├── rerank (top-20 → top-5)
   └── enough?
       │
       ▼
[ Synthesize with citations ]
       │
       ▼
[ Validator: citations present, low hallucination ]
```

This is **agentic RAG**. The agent decides what to query, when to dig deeper, and when it has enough. It outperforms naive RAG on multi-hop questions and ambiguous queries.

## Why this shape, not naive RAG

Naive RAG looks like:

```python
context = vector_store.search(user_question)
response = llm.complete(f"Answer using context:\n{context}\n\nQ: {user_question}")
```

It works for "What does our pricing page say about enterprise?" It fails on:

- "Compare our pricing to AcmeCorp's". Needs two retrievals
- "What changed in our refund policy last quarter?". Needs filtering
- "Does our docs explain how to set up SSO with Okta specifically?". Needs follow-up retrieval

Agentic RAG handles all three.

## The retrieval tools

```python
def hybrid_search(query: str, filters: str = "") -> str:
    """Search the knowledge base using both semantic and keyword retrieval.

    Args:
        query: Natural-language search query.
        filters: Optional JSON object with metadata filters, e.g. '{"product": "billing"}'.
    """
    f = json.loads(filters) if filters else {}

    dense = vector_client.search(query, top_k=10, filters=f)
    sparse = bm25_client.search(query, top_k=10, filters=f)

    # Reciprocal rank fusion
    fused = fuse_results(dense, sparse, k=20)
    reranked = rerank_client.rerank(query, fused, top_k=5)

    return "\n\n".join(
        f"[doc-{h.id}] {h.title}\n{h.text[:400]}" for h in reranked
    ) or "No matching documents."

def fetch_doc(doc_id: str) -> str:
    """Fetch the full content of a document by ID. Use after hybrid_search to read deeply."""
    doc = doc_store.get(doc_id)
    return doc.full_text[:15_000] if doc else f"Doc {doc_id} not found."
```

Notes:

- **Hybrid > pure dense.** Dense retrieval misses exact-match queries; BM25 misses semantic queries. Combine.
- **Reranking is cheap and worth it.** Cohere Rerank or a small cross-encoder. Top-5 reranked beats top-20 raw.
- **Filters in the tool signature.** Lets the agent narrow by product, date, or audience.
- **Two-step retrieval.** Search first, fetch full content only for the most promising hits.

## The agent

```python
from agentflow.core.graph import Agent, StateGraph, ToolNode

tool_node = ToolNode([hybrid_search, fetch_doc])

rag_agent = Agent(
    model="anthropic/claude-3-5-sonnet",
    system_prompt=[{"role": "system", "content": (
        "You answer questions using the company knowledge base. "
        "ALWAYS use hybrid_search first. Use fetch_doc to read full content for key sources. "
        "If the question has multiple parts, search for each separately. "
        "Cite every fact with [doc-N] from the search results. "
        "If you cannot find the answer, say so. Do not invent details."
    )}],
    tool_node="TOOL",
)
```

## Indexing pipeline

The agent only works if the index is good. Quick checklist for indexing:

- **Chunk by structure**, not fixed size. Markdown headers, HTML sections, paragraph breaks. See [chunking and retrieval primitives](/docs/courses/shared/chunking-and-retrieval-primitives).
- **Add metadata.** Product, audience, last-modified date. Filters need them.
- **Both dense and sparse.** Index for vector + BM25 from day one.
- **Reindex on doc changes.** A daily diff is usually enough.

For an end-to-end indexing example with Qdrant, see the [qdrant-memory tutorial](/docs/tutorials/from-examples/qdrant-memory).

## When to call human

If the agent searches and finds nothing relevant, do not let it freelance an answer. Two patterns:

1. **Surface the gap to the user.** "I couldn't find this in our docs. You can ask in #support."
2. **Escalate to a human agent.** Especially for support flows. See [the customer support use case](/docs/use-cases/customer-support-agent).

## Operational notes

- **Cache by canonical query.** Multiple users asking the same thing should hit cache.
- **Per-tenant indexes** for multi-tenant SaaS. Filtering by `tenant_id` is fine for small tenants; separate indexes for large ones.
- **Freshness.** Stale docs are worse than no docs. Track last-indexed-at and warn when a doc is > 30 days old.
- **Cost.** Reranking adds latency and cost; budget about 100ms and $0.001 per query.

## Variants

- **Internal knowledge base**. Confluence, Notion, Slack archives
- **Customer-facing docs**. Your public documentation site
- **Support deflection**. Old tickets + KB articles
- **Research over a corpus**. Papers, contracts, reports

Same shape. Different documents and different filters.

## Metrics that matter

| Metric | Target |
|---|---|
| Recall@5 (manual eval) | > 80% |
| Citation coverage | > 95% of claims |
| Hallucination rate | < 3% |
| p95 latency | < 6 s |
| Cost per query | < $0.05 |

## Common mistakes

1. **One giant chunk.** Chunks > 1500 tokens lose specificity. Aim for 200–500 tokens with overlap.
2. **No reranking.** Top-5 from hybrid search is usually OK; top-5 from dense alone misses too much.
3. **No metadata filters.** Without `product`, `audience`, `tenant`, the index is a soup.
4. **Skipping the validator.** Citations are the firewall against hallucination. Enforce them.

## Further reading

- [Memory and store](/docs/concepts/memory-and-store)
- [Qdrant memory tutorial](/docs/tutorials/from-examples/qdrant-memory)
- [AI agent memory and checkpointing](/blog/ai-agent-memory-checkpointing-python)
- [Compare AgentFlow vs LlamaIndex Agents](/docs/compare/agentflow-vs-llamaindex-agents). When to pair them
- [Get started](/docs/get-started)
