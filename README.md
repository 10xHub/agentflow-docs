# 10xgraph-docs

Docs and blog for 10xGraph. Static Astro site, custom design, built for search engines and AI answer engines. Replaces `agentflow-docs/` (Docusaurus) once the content is migrated.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (Node 22.12+) |
| `npm run dev` | Dev server at http://localhost:4321 |
| `npm run build` | Static build to `dist/`, then the Pagefind search index |
| `npm run preview` | Serve `dist/` locally (search works here, not in dev) |
| `npm run check` | Type-check `.astro` and `.ts` files |

## Structure

```
src/
  content.config.ts        Collection schemas (docs, blog). Frontmatter is validated at build time.
  content/docs/            Docs, .md or .mdx. Folder path = URL path.
  content/blog/            Blog posts, .md or .mdx.
  lib/site.ts              Site facts, nav, docs sections. Keep in sync with POSITIONING.md.
  lib/content.ts           Collection helpers, URLs, markdown export.
  layouts/BaseLayout.astro All SEO head tags, JSON-LD, theme script, header and footer.
  layouts/DocsLayout.astro Sidebar, breadcrumb, table of contents, prev/next, TechArticle JSON-LD.
  layouts/BlogLayout.astro Post header, reading time, BlogPosting JSON-LD.
  components/              Header, Footer, ThemeToggle, AiActions, Callout.
  pages/                   Routes (see below).
  styles/global.css        Design tokens (dark default, full light theme) and all styles.
```

## Routes

| URL | Source | For |
|---|---|---|
| `/` | `pages/index.astro` + `styles/home.css` | Homepage (animated code-to-production hero, moat sections, FAQ) |
| `/docs`, `/docs/<id>` | `pages/docs/[...slug].astro` | Docs |
| `/docs/<id>.md` | `pages/docs/[...slug].md.ts` | Plain-markdown copy of each doc, for AI agents |
| `/blog`, `/blog/<id>` | `pages/blog/` | Blog |
| `/blog/<id>.md` | `pages/blog/[...slug].md.ts` | Plain-markdown copy of each post |
| `/llms.txt` | `pages/llms.txt.ts` | LLM index of the site ([llmstxt.org](https://llmstxt.org)) |
| `/llms-full.txt` | `pages/llms-full.txt.ts` | All docs and posts in one file |
| `/rss.xml` | `pages/rss.xml.ts` | Blog feed |
| `/sitemap-index.xml` | `@astrojs/sitemap` | Sitemap (excludes noindex pages) |
| `/robots.txt` | `pages/robots.txt.ts` | Allows search and AI crawlers, points to the sitemap |
| `/search` | `pages/search.astro` | Pagefind search (noindex) |

## SEO and AI-readability built in

- Canonical URL, Open Graph and Twitter tags on every page; canonical paths have no `.html` or trailing slash.
- JSON-LD: Organization, WebSite and SoftwareApplication on the homepage; TechArticle + BreadcrumbList on docs; BlogPosting + BreadcrumbList on posts; Blog on the blog index.
- Each doc and post links its markdown copy with `<link rel="alternate" type="text/markdown">` and shows "View as Markdown" / "Copy page as Markdown" buttons.
- `description` frontmatter is required (50-170 characters). It becomes the meta description and the summary in `llms.txt`.
- Static HTML with no client JS except the theme toggle, copy button and search.

## Writing content

Docs frontmatter:

```yaml
---
title: Replay-safe tools
description: 50-170 characters. Used for search results and llms.txt.
section: Concepts        # one of: Get started, Concepts, How-to guides, Reference
order: 1                 # position within the section
updated: 2026-10-03      # optional; shown on the page and in JSON-LD
draft: false             # optional
---
```

Blog frontmatter: `title`, `description`, `date`, `author`, optional `updated`, `tags`, `draft`.

In `.mdx`, import components from `src/components/`, for example:

```mdx
import Callout from '../../components/Callout.astro';

<Callout type="tip">Text</Callout>
```

Callout types: `note`, `tip`, `warning`, `danger`.

## Before launch

- Set the final domain in `astro.config.mjs` (`site`) and `src/lib/site.ts`.
- Add an Open Graph image and a favicon (waiting on the logo).
- Migrate content from `agentflow-docs/docs/` and add redirects for old URLs in `astro.config.mjs`.
