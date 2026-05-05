# AgentFlow Docs

Documentation site for [**AgentFlow**](https://github.com/10xHub/Agentflow) — the open-source Python framework for building production-grade multi-agent systems.

Built with [Docusaurus 3](https://docusaurus.io). Deployed to **agentflow.10xscale.ai** via GitHub Pages.

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

- [`10xHub/Agentflow`](https://github.com/10xHub/Agentflow) — the Python library
- [`@10xscale/agentflow-client`](https://www.npmjs.com/package/@10xscale/agentflow-client) — TypeScript client

## License

MIT.
