# SEO Plan — AgentFlow Documentation

## Context

AgentFlow is a Python-first framework for building production-grade multi-agent systems with built-in orchestration, state, memory, API serving, CLI, hosted playground, and a TypeScript client. The docs site is built with Docusaurus 3.8.1 and currently deploys (or will deploy) to **agentflow.10xscale.ai** — a subdomain of `10xscale.ai`.

The site has minimal SEO today: a homepage `<title>` and `description`, an SVG social card, no analytics, no structured data, no blog, no comparison pages, no canonical custom domain wired up. Search traffic is effectively zero.

The goal of this plan is to capture three classes of high-intent search traffic:

1. **Comparison / alternative intent** — `langgraph alternative`, `crewai vs langgraph`, `best agent framework python`, `google adk alternative`
2. **Problem / how-to intent** — `python ai agent framework`, `multi-agent orchestration python`, `build ai agent in python`, `ai agent with memory and tools`
3. **Long-tail tutorial intent** — `python agent with checkpointing`, `streaming responses langgraph`, `react agent with tool calls`, `multi-agent handoff python`

Outcome target (90 days): 3–5k organic monthly visitors, top-10 ranking for `langgraph alternative` and `python multi agent framework`, and at least 50 indexed pages with valid structured data.

---

## Part A — Technical SEO Foundation (Week 1)

### A1. Domain & canonical setup

- Point `agentflow.10xscale.ai` DNS (CNAME) at GitHub Pages and add a `static/CNAME` file containing `agentflow.10xscale.ai`.
- In the GH Actions workflow, set `SITE_URL=https://agentflow.10xscale.ai` and `BASE_URL=/` (drop the `/agentflow-docs/` subpath — it kills link equity).
- In [docusaurus.config.ts](docusaurus.config.ts), add `noIndex: false` (default), `trailingSlash: false` (already set), and confirm `url`/`baseUrl` resolve to the apex of the subdomain in production.
- Subdomain caveat: `agentflow.10xscale.ai` is treated by Google as semi-separate from `10xscale.ai`. If the parent site has authority, prefer `10xscale.ai/agentflow` as a path. If the parent has no SEO, the subdomain is fine.

### A2. Sitemap + robots

- Docusaurus auto-generates `sitemap.xml` via `@docusaurus/plugin-sitemap` (bundled with the classic preset). Configure it explicitly in `presets[0][1].sitemap` with `changefreq: 'weekly'`, `priority: 0.5`, and `filename: 'sitemap.xml'`.
- Add `static/robots.txt`:
  ```
  User-agent: *
  Allow: /
  Sitemap: https://agentflow.10xscale.ai/sitemap.xml
  ```
- Submit the sitemap to Google Search Console and Bing Webmaster Tools.

### A3. Analytics & Search Console

- Add Google Analytics 4 via `@docusaurus/plugin-google-gtag` (set `trackingID` in plugin config; do **not** hard-code in `index.tsx`).
- Add Microsoft Clarity for free heatmaps/session replay (1 line script in `clientModules`).
- Verify ownership in Google Search Console (DNS TXT record on `10xscale.ai`) and Bing Webmaster Tools.

### A4. Open Graph / Twitter cards

- The current social card is `agentflow-social-card.svg`. **SVG is rejected by Twitter/LinkedIn/Slack scrapers.** Replace with a 1200×630 PNG at `static/img/agentflow-social-card.png` and update [docusaurus.config.ts:56](docusaurus.config.ts#L56).
- In `themeConfig`, add a `metadata` array with `og:type=website`, `og:site_name=AgentFlow`, `twitter:card=summary_large_image`, `twitter:site=@<handle>`.
- For each major doc page, set front matter `image:` so per-page OG images can be customized later.

### A5. Per-page metadata audit

- Sweep all 153 markdown files under [docs/](docs/) and ensure every file has front matter:
  ```yaml
  ---
  title: <50-60 char title with primary keyword>
  description: <140-160 char description, action-oriented>
  keywords: [primary, secondary, long-tail]
  ---
  ```
- Today most pages rely on auto-generated `<title>` from the H1, which often lacks keywords ("Installation" → should be "Install AgentFlow — Python AI Agent Framework").
- Build a small script (`scripts/audit-frontmatter.mjs`) that reports missing/oversized titles & descriptions; run it in CI.

### A6. Structured data (JSON-LD)

Add a Docusaurus swizzle of `@theme/Root` (or a custom plugin) that injects JSON-LD on:

- **Homepage** — `SoftwareApplication` schema (name: AgentFlow, applicationCategory: DeveloperApplication, operatingSystem: Cross-platform, programmingLanguage: Python, offers: free).
- **All doc pages** — `TechArticle` + `BreadcrumbList`.
- **FAQ blocks** on landing pages — `FAQPage` schema.
- **Tutorials** — `HowTo` schema with steps.

Critical files to create/modify:
- [src/theme/Root.tsx](src/theme/Root.tsx) — JSON-LD injector
- [src/plugins/json-ld/index.ts](src/plugins/json-ld/index.ts) — page-type detector

### A7. Performance & Core Web Vitals

- Run Lighthouse on the deployed site after domain switch. Target LCP < 2.5s, CLS < 0.1, INP < 200ms.
- The hero `<pre><code>` block in [src/pages/index.tsx:99-109](src/pages/index.tsx#L99-L109) is rendered as raw text, not Prism — fine for performance, but ensure the font is preloaded if using a webfont.
- Compress the social PNG with `oxipng`/`squoosh` (target < 80 KB).
- Defer non-critical fonts; use `font-display: swap`.

---

## Part B — On-Page SEO & Information Architecture (Week 2)

### B1. Rewrite the homepage `<title>` and H1 for keyword targeting

Current homepage `<title>` ([src/pages/index.tsx:66](src/pages/index.tsx#L66)) is decent but the H1 ("Production-ready AI agents in seconds.") has no keyword. Proposed:

- `<title>`: **"AgentFlow — Open-Source Python Framework for Production AI Agents"** (60 chars)
- H1: **"Build production-ready AI agents in Python — in minutes, not weeks."**
- Add an H2 above the fold containing "multi-agent orchestration" and "alternative to LangGraph".

### B2. Internal linking

- Every doc page must link to ≥ 3 sibling pages and ≥ 1 cornerstone page.
- Add a "Related" section component (`src/components/RelatedDocs.tsx`) used in MDX as `<RelatedDocs ids={['concepts/state-graphs','how-to/checkpointing']} />`.
- Cross-link comparison pages (Part C) heavily from concept pages — e.g., the "State Graphs" concept page links to "AgentFlow vs LangGraph" because LangGraph users search for state graph migration.

### B3. URL hygiene

- Lowercase, hyphen-separated slugs (already enforced by Docusaurus).
- Avoid stop-word stuffing. Keep slugs ≤ 5 words.
- Add 301 redirects for any URL changes via `@docusaurus/plugin-client-redirects`.

---

## Part C — Comparison & Alternative Landing Pages (Week 2-3)

This is the **highest-intent traffic** AgentFlow can capture today. Each page targets a specific competitor query and converts via "Start with AgentFlow" CTA.

Create these as MDX pages under `docs/compare/`:

| Slug | Target query | Primary keyword |
|---|---|---|
| `docs/compare/agentflow-vs-langgraph` | langgraph alternative, agentflow vs langgraph | "LangGraph alternative" |
| `docs/compare/agentflow-vs-crewai` | crewai alternative, crewai vs agentflow | "CrewAI alternative" |
| `docs/compare/agentflow-vs-autogen` | autogen alternative, microsoft autogen alternative | "AutoGen alternative" |
| `docs/compare/agentflow-vs-llamaindex-agents` | llamaindex agents alternative | "LlamaIndex Agents alternative" |
| `docs/compare/agentflow-vs-google-adk` | google adk alternative, google agent development kit alternative | "Google ADK alternative" |
| `docs/compare/best-python-agent-framework-2026` | best python agent framework, top ai agent frameworks | roundup post |

Each page follows this structure (writeable in ~600-900 words):

1. **H1**: "AgentFlow vs LangGraph: A Production-Ready Alternative for Python Agents" (include both brand names + "alternative")
2. **TL;DR table** comparing key dimensions: state model, memory, API serving, TypeScript client, learning curve, license.
3. **Why teams switch** — 3–4 bullet points (avoid trash-talking the competitor; focus on AgentFlow's differentiators).
4. **Code-side-by-side** — same use case (e.g., ReAct agent with one tool) implemented in both frameworks.
5. **Migration guide** — how to port from competitor X → AgentFlow.
6. **FAQ block** with `FAQPage` JSON-LD (5–7 questions: "Is AgentFlow free?", "Can I migrate my LangGraph state?", etc.).
7. **CTA** → `/docs/get-started`.

Be factually accurate and link to competitor docs where appropriate. Google penalizes thin/spammy comparison pages.

---

## Part D — Content Engine (Blog + Tutorials) (Week 3-8)

### D1. Enable the Docusaurus blog

Currently `blog: false` in [docusaurus.config.ts:45](docusaurus.config.ts#L45). Enable with:
- Path: `/blog`
- Authors file: `blog/authors.yml`
- RSS + Atom feeds enabled (default).
- Tag pages enabled.

### D2. Cornerstone content (publish 1/week, 10 total)

Long-form (1500–2500 words), each targeting a high-volume keyword cluster:

1. **"How to build an AI agent in Python (2026 guide)"** — beginner intent, 2k+ words.
2. **"Multi-agent orchestration in Python: 7 patterns that actually work"** — concept-heavy, links to concept docs.
3. **"LangGraph alternatives: 5 frameworks to ship agents faster"** — own the alternatives query (links to compare pages).
4. **"AI agent memory: short-term, long-term, and checkpointing in Python"** — captures memory queries.
5. **"Streaming agent responses with FastAPI and SSE"** — captures streaming queries; ships runnable code.
6. **"Production AI agents: observability, retries, and graceful shutdown"** — captures production-readiness queries.
7. **"Agent + tool: how to build a ReAct agent that calls real APIs"** — captures ReAct queries.
8. **"How to deploy an AI agent to production (Docker + AWS)"** — captures deployment queries.
9. **"From LangGraph to AgentFlow: a migration walkthrough"** — captures migration intent.
10. **"AI agents vs workflows: when to use each"** — captures conceptual queries.

Each post gets:
- Custom OG image (Figma template, 1200×630 PNG).
- `BlogPosting` + `Author` JSON-LD.
- Internal links to ≥ 5 doc pages.
- Closing CTA to `/docs/get-started`.

### D3. Programmatic SEO landing pages

Generate templated, high-quality pages from a data file:

- `docs/providers/<provider>` already exists for OpenAI, Anthropic, Google, etc. — extend each with a section "Build a `<provider>` agent in Python with AgentFlow" and ensure the front-matter title is "AgentFlow + <Provider> — Python Agent Framework with <Model> Support".
- New folder `docs/use-cases/`: pages like `customer-support-agent`, `data-extraction-agent`, `coding-agent`, `research-agent`, `rag-agent`. Each ~600 words with code, links to relevant tutorials.
- New folder `docs/integrations/`: pages for popular tools/SDKs (`agentflow-with-fastapi`, `agentflow-with-nextjs`, `agentflow-with-postgres`).

Build a generator script (`scripts/generate-landing.mjs`) that reads `data/use-cases.json` and emits MDX skeletons. Hand-edit each before publishing — pure-template pages get penalized by Google's helpful-content update.

---

## Part E — Off-Page & Distribution (ongoing)

- **GitHub README** at `10xscale/agentflow` — top of file should target "Python AI agent framework" with badges + a clear H1. README ranks for brand queries and pulls authority.
- **Submit to** awesome-lists: `awesome-langchain`, `awesome-llm`, `awesome-python`, `awesome-ai-agents`. Each is a high-DR backlink.
- **Show HN / r/LocalLLaMA / r/LangChain launch posts** — only after Part A-C is shipped (else bounce rate kills traction).
- **Dev.to / Hashnode cross-posts** of cornerstone blog articles with `canonical` pointing back to docs site.
- **Comparison-page outreach**: when ranking for "X alternative", reach out to authors of "best agent framework" listicles.
- **Hugging Face Space** demoing AgentFlow + a popular HF model — backlink from huggingface.co (DR 92).

---

## Part F — Measurement & Iteration

Track in GA4 + Search Console:

- **North-star metric**: organic sessions to `/docs/*` and `/blog/*` per week.
- **Secondary**: top-10 keyword count, average CTR on Search Console, time-on-page for compare pages.
- **Conversion proxy**: clicks on "Start building" CTA, GitHub stars, npm/pip downloads.

Set up a weekly Looker Studio dashboard pulling Search Console + GA4. Review query report monthly, expand pages that rank #4-#15 (low-hanging fruit).

---

## Critical Files to Create or Modify

**Config:**
- [docusaurus.config.ts](docusaurus.config.ts) — sitemap plugin, gtag plugin, metadata, social card PNG, enable blog
- [static/CNAME](static/CNAME) — custom domain
- [static/robots.txt](static/robots.txt) — bot directives
- [static/img/agentflow-social-card.png](static/img/agentflow-social-card.png) — 1200×630 OG image (replaces SVG)
- `.github/workflows/deploy.yml` — set `SITE_URL`, `BASE_URL`

**Components:**
- [src/theme/Root.tsx](src/theme/Root.tsx) — JSON-LD injector
- [src/components/RelatedDocs.tsx](src/components/RelatedDocs.tsx) — internal-link component
- [src/components/CompareTable.tsx](src/components/CompareTable.tsx) — used on `/docs/compare/*`
- [src/pages/index.tsx](src/pages/index.tsx) — rewrite `<title>`, H1, add H2 with keywords

**Content (new):**
- `docs/compare/*.md` (6 pages)
- `docs/use-cases/*.md` (5+ pages)
- `docs/integrations/*.md` (3+ pages)
- `blog/*.md` (10 cornerstone posts)

**Scripts:**
- `scripts/audit-frontmatter.mjs` — front-matter linter
- `scripts/generate-landing.mjs` — programmatic page scaffold

---

## Verification Plan

After each phase, verify end-to-end:

1. **Phase A**: `pnpm build && pnpm serve` — confirm `/sitemap.xml`, `/robots.txt`, valid Open Graph (test with [opengraph.xyz](https://www.opengraph.xyz/)), GA4 fires (Realtime view), JSON-LD validates ([Rich Results Test](https://search.google.com/test/rich-results)). Lighthouse SEO score = 100.
2. **Phase B**: Run `scripts/audit-frontmatter.mjs` — every doc has title (50–60 char) and description (140–160 char). Manual spot-check 10 pages.
3. **Phase C**: Each `/docs/compare/*` page has unique TL;DR table, code blocks, FAQ JSON-LD validates, ≥ 800 words, ≥ 5 internal links.
4. **Phase D**: Blog index renders, RSS feed valid (`/blog/rss.xml`), each post has OG image and `BlogPosting` JSON-LD.
5. **Ongoing**: Weekly Search Console check — index coverage, indexed pages count growing, no manual actions.

---

## Suggested Sequencing

| Week | Deliverable |
|---|---|
| 1 | Part A (technical foundation) — domain, sitemap, robots, analytics, OG PNG, JSON-LD |
| 2 | Part B (on-page) + start Part C (3 compare pages: LangGraph, CrewAI, Google ADK) |
| 3 | Finish Part C (AutoGen, LlamaIndex, roundup) + enable blog + cornerstone post #1 |
| 4-8 | Cornerstone posts #2–#10 (1/week) + 5 use-case pages |
| 9+ | Distribution (Part E) + monthly iteration on Search Console data |

Total expected effort: ~40–60 hours across 8 weeks. Most leverage is in Part A (1 day) + Part C (1 week) + first 3 cornerstone posts.
