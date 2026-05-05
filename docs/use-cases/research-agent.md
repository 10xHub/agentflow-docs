---
title: Build a Research AI Agent in Python
sidebar_label: Research
description: How to build a research AI agent in Python. Web search, source verification, synthesis, and citations. With AgentFlow code and production guardrails.
keywords:
  - research ai agent
  - ai research assistant
  - python research agent
  - web search agent
  - synthesis agent
sidebar_position: 5
---

# Build a research AI agent in Python

A research agent answers questions that need *external information*. Current events, technical references, deep web searches. The hard part is not the search; it is getting the agent to cite sources and avoid making things up.

Here is the production architecture.

## Architecture at a glance

```
[ User question ]
       │
       ▼
[ Plan: identify subqueries (LLM) ]
       │
       ▼
[ Search loop ]
   ├── web_search (Tavily / Perplexity / Bing)
   ├── fetch_url (full content for promising hits)
   ├── search_internal_docs (your vector store)
   └── done?
       │
       ▼
[ Synthesize with citations ]
       │
       ▼
[ Validator: every claim has [source-N] ]
```

This is an agent that loops on tool calls until satisfied, then runs a deterministic post-step to enforce citation discipline.

## Why this shape

- **Subquery decomposition** beats one giant search. "Compare X and Y on dimension Z" → three searches.
- **Forced citations** are the only reliable way to prevent hallucinated facts. The agent must include `[source-N]` markers; the validator strips out claims that don't have them.
- **Validator separation.** Citation enforcement is deterministic. A regex, not an LLM call.

## The tools

```python
import httpx

def web_search(query: str, max_results: int = 5) -> str:
    """Search the public web. Returns titles, URLs, and snippets for top results."""
    response = httpx.post(
        "https://api.tavily.com/search",
        json={"api_key": TAVILY_KEY, "query": query, "max_results": max_results},
        timeout=10.0,
    ).json()
    return "\n\n".join(
        f"[source-{i}] {r['title']}\n{r['url']}\n{r['content']}"
        for i, r in enumerate(response.get("results", []), start=1)
    ) or "No results."

def fetch_url(url: str) -> str:
    """Fetch the full text of a URL. Use after web_search to read promising sources."""
    try:
        text = httpx.get(url, timeout=15.0, follow_redirects=True).text
        return strip_html(text)[:20_000]  # cap to keep context manageable
    except Exception as e:
        return f"Error fetching {url}: {e}"

def search_internal_docs(query: str) -> str:
    """Search internal documentation (your private knowledge base)."""
    hits = vector_client.search(query, top_k=3)
    return "\n\n".join(f"[doc-{h.id}] {h.title}\n{h.text[:500]}" for h in hits)
```

Notes:

- **Source IDs are part of the tool output.** `[source-1]`, `[doc-42]`. These are what the agent cites in the final answer.
- **Caps everywhere.** A 1 MB scraped page eats your context.
- **`fetch_url` only after `web_search`.** Direct URL fetches without prior search are an attack vector.

## The agent

```python
from agentflow.core.graph import Agent, StateGraph, ToolNode

tool_node = ToolNode([web_search, fetch_url, search_internal_docs])

agent = Agent(
    model="anthropic/claude-3-5-sonnet",
    system_prompt=[{"role": "system", "content": (
        "You are a research assistant. "
        "Break the question into subqueries. Use web_search and fetch_url to gather sources. "
        "Use search_internal_docs for company-specific information. "
        "When you have enough information, write a clear answer. "
        "EVERY factual claim must include a citation marker like [source-1] or [doc-2] from the tool outputs. "
        "If you cannot find sources, say so explicitly. Do not invent facts."
    )}],
    tool_node="TOOL",
)
```

## The validator (post-step)

```python
import re

CITATION_RE = re.compile(r"\[(?:source|doc)-\d+\]")

def validate_citations(answer: str, max_uncited_sentences: int = 1) -> tuple[bool, str]:
    sentences = re.split(r"(?<=[.!?])\s+", answer)
    uncited = [s for s in sentences if not CITATION_RE.search(s)]
    if len(uncited) > max_uncited_sentences:
        return False, f"{len(uncited)} sentences without citations. Reject."
    return True, "OK"
```

If the answer fails validation, you can either retry the agent with feedback or downgrade the response with a "limited sources" disclaimer.

## Operational notes

- **Choose a search provider.** Tavily and Perplexity are LLM-friendly (return clean text). Bing API works but you do more parsing.
- **Cache aggressively.** Identical queries from different users should hit the same cache for a few hours.
- **Rate-limit per user.** A research agent can rack up a $5 API bill in 30 seconds if it loops.
- **Domain filters.** For trustworthy research, restrict to a curated allowlist (papers, official docs, news).
- **Time budget.** Cap total research time at 30–60 seconds. Past that, return what you have.

## Variants

- **Competitive research**. Research a list of competitors against a fixed dimensions matrix
- **Due diligence**. Research a company across financials, news, and reviews
- **Academic research**. Search arXiv + Semantic Scholar + Google Scholar with citation graphs
- **News briefing**. Daily digest with citations

Same shape; different search tools and validators.

## Metrics that matter

| Metric | Target |
|---|---|
| Citation coverage | > 95% of factual sentences |
| Source diversity per answer | ≥ 3 distinct sources |
| Hallucination rate (manual eval) | < 2% |
| p95 latency | < 30 s |
| Cost per query | $0.05–$0.50 depending on depth |

## Common mistakes

1. **No citation enforcement.** The model will summarize and forget where the facts came from.
2. **Trusting the search snippet.** Snippets are often misleading; use `fetch_url` for important claims.
3. **Single-source reliance.** Force the agent to gather ≥ 3 sources before synthesizing.
4. **No time / cost cap.** Researchy agents love to loop.

## Further reading

- [Multi-agent orchestration patterns](/blog/multi-agent-orchestration-python-7-patterns)
- [AI agent memory](/blog/ai-agent-memory-checkpointing-python). Long-term recall for repeat research
- [ReAct agent with real APIs](/blog/react-agent-tools-real-apis)
- [Get started](/docs/get-started)
