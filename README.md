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

## Checks

```bash
npm run build              # fails on any broken internal link
npm run typecheck
npm run lint:frontmatter   # every page needs title, description, keywords
npm run lint:links         # every external URL must resolve
npm run verify:api         # documented symbols, routes, and commands must exist
npm run og-image           # regenerate the PNG social card from the SVG
```

`verify:api` checks the docs against the packages published to PyPI, which is
what readers actually install:

```bash
pip install 10xscale-agentflow 10xscale-agentflow-cli
npm run verify:api
```

All of these run in CI (`.github/workflows/ci.yml`).

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
  beginner/            # guided tutorial path
  concepts/            # mental models, with an "In depth" tier beneath
  prebuild/            # prebuilt agents and tools
  how-to/              # task-oriented guides (python, production, cli, client)
  qa/                  # unit testing and evaluation
  tutorials/           # from-examples deep dives
  reference/           # API reference (Python, REST, CLI, TS client)
  troubleshooting/
  use-cases/           # production reference architectures
  integrations/        # FastAPI / Next.js / Postgres
  providers/           # LLM provider configuration
  glossary/            # definition pages
  compare/             # framework comparisons (LangGraph, CrewAI, AutoGen, etc.)
  courses/             # GenAI beginner + advanced curriculum
  project/             # changelog, upgrade guide, roadmap, security, support

blog/                  # cornerstone posts, RSS at /blog/rss.xml
src/
  components/          # CompareTable, FAQ, RelatedDocs, BlogStructuredData
  pages/               # Homepage
  theme/               # MDXComponents, Root swizzles
static/                # CNAME, robots.txt, llms.txt, social card, favicon
scripts/               # front-matter, link, and API-drift checks
COURSE_STYLE_GUIDE.md  # authoring rules for docs/courses (not published)
```

Docs versions are cut only when a release line needs to stay available:

```bash
npm run docs:cut-version -- 1.0
```

That snapshots `docs/` into `versioned_docs/version-1.0`; the navbar version
dropdown then appears automatically.

## Contributing

PRs welcome. Before opening one, run the checks above.

Writing conventions, where a page belongs, and the release process are
documented on the site: [Contributing](https://agentflow.10xscale.ai/docs/project/contributing).

Two rules worth repeating here:

- **Verify before asserting.** Read the source for the signature, the default,
  and the error message. Documented APIs that never existed have shipped before;
  `npm run verify:api` exists to stop that.
- **Moving or renaming a page requires a redirect** in `docusaurus.config.ts`.

## Related repos

- [`10xHub/Agentflow`](https://github.com/10xHub/Agentflow) — the core Python framework (`10xscale-agentflow`)
- [`10xscale-agentflow-cli`](https://pypi.org/project/10xscale-agentflow-cli/) — FastAPI server + CLI
- [`@10xscale/agentflow-client`](https://www.npmjs.com/package/@10xscale/agentflow-client) — TypeScript/React client SDK
- Playground — visual React UI for testing agents (`agentflow play`)
- **Docs:** https://agentflow.10xscale.ai

## License

MIT.
