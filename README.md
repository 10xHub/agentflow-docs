# AgentFlow Docs

> **Build multi-agent AI systems that actually ship.** Agentflow is the production-grade framework that takes you from prototype to production without rewriting your stack.

Most agent frameworks stop at a demo. Agentflow ships the whole thing — orchestration, memory, API, auth, SDK, and UI — so you spend your time on agents, not plumbing.

- 🧠 **Memory that remembers** — a 3-layer system: working state → Redis hot cache → Postgres durable → vector recall (Qdrant/Mem0). Your agents have short-term speed and long-term knowledge.
- 🔌 **Any model, no lock-in** — OpenAI, Google GenAI, Anthropic, or your own. Swap providers with a config change, not a rewrite.
- ⚡ **Live agents, real-time** — token-by-token streaming, live state inspection, and parallel tool execution by default.
- 🕸️ **Graph-based orchestration** — model complex, cyclic agent workflows with `StateGraph`. LangGraph power, far less ceremony.
- 🛠️ **Production from day one** — auto-generated FastAPI backend, JWT/RBAC auth, rate limiting, dual-layer checkpointing, and Docker/Kubernetes builds.
- 🤝 **MCP native** — plug into the Model Context Protocol ecosystem out of the box.
- 📦 **Batteries included** — backend, REST API + CLI, typed TypeScript SDK, and a visual React playground. One framework, end to end.

**From `pip install` to a streaming multi-agent API in minutes.**

This repo holds the documentation for that ecosystem.

📖 **Read the docs:** https://agentflow.10xscale.ai

Built with [Docusaurus 3](https://docusaurus.io). Deployed to **agentflow.10xscale.ai** via GitHub Pages.

## 🧩 The Agentflow Ecosystem

| Package | What it does | Install |
|---|---|---|
| **Core framework** (`10xscale-agentflow`) | Graph-based agent orchestration, 3-layer memory, parallel tools, MCP | `pip install 10xscale-agentflow` |
| **API + CLI** (`10xscale-agentflow-cli`) | FastAPI server auto-generated from your graph, auth, RBAC, rate limiting | `pip install 10xscale-agentflow-cli` |
| **Client SDK** (`@10xscale/agentflow-client`) | Typed TypeScript/React client with streaming hooks | `npm install @10xscale/agentflow-client` |
| **Playground** | Visual React UI to test agents against a local server | `agentflow play` |
| **Docs** (this repo) | Tutorials, how-to guides, reference, and concepts | https://agentflow.10xscale.ai |

## Local development

```bash
npm install
npm run start
```

Dev server: `http://localhost:3000`.

## Build

```bash
npm run build
npm run serve
```

Static output in `build/`.

> **Windows + Git Bash note:** if `npm run build` mangles `BASE_URL=/` (you'll see broken links resolving to `C:/Program Files/Git/...`), run from PowerShell with `$env:MSYS_NO_PATHCONV='1'`.

## SEO scripts

```bash
npm run seo:audit       # lint per-page front matter (title, description, keywords)
npm run seo:fix         # auto-fill missing/short SEO front matter (idempotent)
npm run seo:og-image    # convert SVG social card to PNG (requires `sharp`)
```

## Deploy

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to `main`.

Required GitHub repo secrets (optional but recommended):

- `GOOGLE_ANALYTICS_ID` — e.g. `G-XXXXXXXXXX`
- `MICROSOFT_CLARITY_ID` — for heatmaps / session replay

The site is configured for the custom domain **agentflow.10xscale.ai** (CNAME in `static/`).

## Repo layout

```text
docs/
  get-started/         # golden path, beginner-friendly
  concepts/            # mental models
  beginner/            # tutorial path
  tutorials/           # from-examples deep dives
  how-to/              # task-oriented guides
  reference/           # API reference (Python, REST, TS client)
  compare/             # framework comparisons (LangGraph, CrewAI, AutoGen, etc.)
  use-cases/           # production reference architectures
  integrations/        # FastAPI / Next.js / Postgres
  providers/           # LLM provider configuration
  troubleshooting/
  courses/             # GenAI beginner + advanced curriculum

blog/                  # 10 cornerstone posts, RSS at /blog/rss.xml
src/
  components/          # CompareTable, FAQ, RelatedDocs, BlogStructuredData
  pages/               # Homepage
  theme/               # MDXComponents, Root swizzles
static/                # CNAME, robots.txt, social card, favicon
scripts/               # SEO automation (audit, fix, og-image)
marketing/             # Launch kit (HN/Reddit/dev.to), measurement playbook
SEO_PLAN.md            # Full SEO plan (Parts A–F)
```

## Contributing

PRs welcome. Before opening:

1. `npm run typecheck`
2. `npm run build` (verify no broken links)
3. `npm run seo:audit` (verify SEO front-matter)

For new doc pages, follow the front-matter pattern enforced by `scripts/audit-frontmatter.mjs` (title 25–60 chars, description 100–160 chars, keywords array).

## Related repos

- [`10xHub/Agentflow`](https://github.com/10xHub/Agentflow) — the core Python framework (`10xscale-agentflow`)
- [`10xscale-agentflow-cli`](https://pypi.org/project/10xscale-agentflow-cli/) — FastAPI server + CLI
- [`@10xscale/agentflow-client`](https://www.npmjs.com/package/@10xscale/agentflow-client) — TypeScript/React client SDK
- Playground — visual React UI for testing agents (`agentflow play`)
- **Docs:** https://agentflow.10xscale.ai

## License

MIT.
