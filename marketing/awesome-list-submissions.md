# Awesome-list submission entries

Awesome-* lists are curated GitHub repos that rank well, have high domain authority, and pass clean dofollow links. A handful of accepted PRs is one of the highest-ROI backlink moves.

## Lists to target

| List | Repo | Best entry placement |
|---|---|---|
| awesome-langchain | hwchase17/awesome-langchain (or community alts) | Tools / Alternatives |
| awesome-llm | Hannibal046/Awesome-LLM | Frameworks |
| awesome-python | vinta/awesome-python | AI / Frameworks |
| awesome-ai-agents | e2b-dev/awesome-ai-agents | Frameworks (Python) |
| awesome-llmops | tensorchord/Awesome-LLMOps | Frameworks |
| awesome-generative-ai | steven2358/awesome-generative-ai | Code / Frameworks |
| awesome-agentic-llm | (search GitHub for active forks) | Multi-agent / Frameworks |

Always read the contributing guidelines first. Most lists require:

- Alphabetical ordering within sections
- A specific entry format (one line, hyphen, link, dash, description)
- A demo / docs link, not just a repo link
- Stars or substance — empty repos get rejected

## Standard entry (use as-is or adapt per list's format)

```markdown
- [AgentFlow](https://github.com/10xHub/Agentflow) - Open-source Python framework for production AI agents with built-in REST API, durable threads, and a typed TypeScript client. MIT-licensed alternative to LangGraph.
```

## Variants per list

### awesome-langchain

The list often groups by category — find "Tools" / "Alternatives to LangChain" / "Frameworks":

```markdown
- [AgentFlow](https://github.com/10xHub/Agentflow) - Graph-based Python agent runtime with built-in REST + SSE server and a typed TypeScript client. Same mental model as LangGraph; no LangChain dependency.
```

### awesome-llm

Likely under "Open Source LLM Frameworks" or "Agents":

```markdown
- [AgentFlow](https://github.com/10xHub/Agentflow) - Production-grade Python framework for building multi-agent AI systems with persistent threads, streaming, and a TypeScript client. [[docs](https://agentflow.10xscale.ai)]
```

### awesome-python

Strict alphabetical, very picky about quality and stars. Under **Machine Learning** or **AI**:

```markdown
- [AgentFlow](https://github.com/10xHub/Agentflow) - Python framework for building production AI agents with typed graphs, durable threads, and a built-in REST API.
```

### awesome-ai-agents

Likely under "Multi-Agent Frameworks" or "Python Frameworks":

```markdown
- [AgentFlow](https://github.com/10xHub/Agentflow) - Open-source Python framework for production-grade multi-agent systems. Typed StateGraph, Postgres-backed threads, REST + SSE server, TypeScript client. [[docs](https://agentflow.10xscale.ai)] [[compare](https://agentflow.10xscale.ai/docs/compare)]
```

### awesome-llmops

Under "Frameworks" or "Production":

```markdown
- [AgentFlow](https://github.com/10xHub/Agentflow) - Python agent framework with built-in production server, durable Postgres-backed threads, and OpenTelemetry-friendly observability. MIT licensed.
```

## PR description template

When opening the PR to add the entry:

```markdown
## What this adds

A new entry under **<section name>** for **AgentFlow**, an open-source MIT-licensed Python framework for production AI agents.

## Why it fits

- Active project with documentation, tests, and a release cadence
- Solves a common need (graph-based agents + production deployment) that fits this list's audience
- Distinguishes from existing entries (LangGraph, CrewAI, AutoGen) — see honest comparisons at https://agentflow.10xscale.ai/docs/compare

## Repo + Docs

- Repo: https://github.com/10xHub/Agentflow
- Docs: https://agentflow.10xscale.ai
- License: MIT
```

## Don't

- Don't submit before the repo has a polished README, badges, and a working quickstart. Maintainers reject thin entries fast.
- Don't add to multiple sections in the same PR. One entry per PR.
- Don't argue if rejected. Move on. (You can iterate the description and try again later.)

## Tracking

Keep a small CSV / table of submissions:

| Date | List | PR URL | Status | Notes |
|---|---|---|---|---|
| 2026-05-15 | awesome-langchain | #123 | Merged | … |
| 2026-05-15 | awesome-llm | #456 | Pending | … |
