# Hacker News — Show HN draft

## Title (80 char limit, lower-case "Show HN" is correct format)

```
Show HN: AgentFlow – Python framework for production AI agents (LangGraph alt)
```

Alternates if the first feels too "alt"-y:

- `Show HN: AgentFlow – Python AI agent framework with built-in API and TS client`
- `Show HN: AgentFlow – open-source Python runtime for multi-agent systems`

## URL field

```
https://agentflow.10xscale.ai
```

## Text (optional — HN's "text" field for Show HNs)

> Hi HN — I've been building **AgentFlow**, an open-source Python framework for production AI agents.
>
> Most "agent framework" tutorials stop at a `while` loop calling an LLM. The hard part is the next 200 days: persistent threads, streaming to a frontend, retries, observability, deploying behind a real load balancer. AgentFlow ships those defaults.
>
> What you get out of the box:
>
> - **Typed `StateGraph`** with conditional edges, sub-graphs, recursion limits — the same mental model as LangGraph.
> - **`PgCheckpointer`** (Postgres + Redis) for durable threads, resumable runs, and replay.
> - **`agentflow api`** — a REST + SSE server you run anywhere. No required SaaS account.
> - **Typed TypeScript client** (`@10xscale/agentflow-client`) for invoking + streaming from a Next.js or React frontend.
> - **Multi-provider** — OpenAI, Anthropic, Google (Gemini + Vertex AI), and others. One-line provider swap.
>
> Why this vs LangGraph / CrewAI / AutoGen / LlamaIndex Agents / Google ADK: AgentFlow is the only one that ships the runtime + API + TS client in one MIT-licensed project. The rest do parts of this, often with a paid hosted tier filling the gaps.
>
> Honest tradeoffs: smaller community, no LangSmith-equivalent yet (use OpenTelemetry), and if your stack is already deep in LangChain runnables you'll feel that pull.
>
> The docs site has framework-by-framework comparisons, 10 cornerstone posts (multi-agent patterns, streaming with SSE, deployment to AWS, etc.), and reference architectures for customer support / RAG / coding agents. Migration guide from LangGraph: https://agentflow.10xscale.ai/blog/langgraph-to-agentflow-migration
>
> Happy to answer questions and would love feedback on the API surface and the docs.

---

## Comment-thread prep

Likely first questions and short answers to keep ready:

**Q: How is this different from LangGraph?**
> Same graph mental model. AgentFlow ships the production server + TS client and skips the LangChain dependency. Honest comparison: https://agentflow.10xscale.ai/docs/compare/agentflow-vs-langgraph

**Q: Why another framework?**
> Most teams ship Python backend + JS frontend. The "where do I put the API and the typed client" question kept costing us a week per project. AgentFlow is what fell out.

**Q: Does it support [model X / vendor Y]?**
> First-party: OpenAI, Anthropic, Google (Gemini + Vertex AI). Custom providers are a small adapter. Listed at https://agentflow.10xscale.ai/docs/providers

**Q: Is it stable? Production-ready?**
> Used internally for [N months] in [context]. Public release; APIs may evolve. Pin versions; we'll keep migration notes in CHANGELOG.

**Q: What about AutoGen / CrewAI / LlamaIndex / ADK?**
> Linked compare pages cover each: https://agentflow.10xscale.ai/docs/compare

**Q: Show me the code.**
> Quickstart: https://agentflow.10xscale.ai/docs/get-started — working agent in five minutes.

---

## Timing

- **Best window**: Tuesday–Thursday, 6:30–8:30 AM PT (HN morning peak in US).
- **Avoid**: Mondays (resets fewer eyeballs), Fridays (worse front-page persistence), holidays.
- Have 2–3 demo links and the GitHub repo polished BEFORE posting. First 30 minutes of comments are decisive.

## After posting

- Reply to every top-level comment within an hour. HN values author engagement.
- Do NOT ask for upvotes. Do NOT post the link in Slack/Discord asking people to upvote — HN downranks coordinated voting.
- Once it gains traction, post the Reddit threads (`r/LocalLLaMA`, `r/LangChain`) so they don't compete for the same audience window.
