# 10xgraph-docs

Docs and blog for 10xGraph. Static Astro site, custom design, built for search engines and AI answer engines.

This repository was the Docusaurus site for Agentflow. The old site now lives in `docusaurus/` (run it with `cd docusaurus && npm install && npm start`) and is deleted once its content is migrated into `src/content/`. The repository keeps its history and contributors; it moves to the 10xGraph org and is renamed later.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (Node 22.12+) |
| `npm run dev` | Builds the search index into `public/pagefind`, then starts the dev server at http://localhost:4321 |
| `npm run dev:fast` | Dev server without rebuilding the search index (search shows the last indexed content) |
| `npm run search:index` | Rebuild the search index for dev after adding or renaming pages |
| `npm run build` | Static build to `dist/`, then the Pagefind search index |
| `npm run preview` | Serve `dist/` locally |
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
  layouts/DocsLayout.astro Docs reader page (styles/docs.css, scripts/docs-reader.ts), TechArticle JSON-LD.
  components/docs/         DocsMap (pages as nodes, visited tracking), RunBar (lenses, section run, AI menu), NextEdges.
  layouts/BlogLayout.astro Post header, reading time, BlogPosting JSON-LD.
  components/              Header, Footer, ThemeToggle, SearchDialog, AiActions, Toc, Faq, PostList.
  components/mdx/          Components usable in any .mdx file without an import (see below).
  lib/code-frame.mjs       Shiki transformer: file-name header and copy button on every code block.
  lib/authors.ts           Blog author roles.
  scripts/search.ts        Search UI on the Pagefind JS API (header dialog, Ctrl/Cmd+K, and /search).
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
| `/blog/tags/<tag>` | `pages/blog/tags/[tag].astro` | Posts per topic |
| `/llms.txt` | `pages/llms.txt.ts` | LLM index of the site ([llmstxt.org](https://llmstxt.org)) |
| `/llms-full.txt` | `pages/llms-full.txt.ts` | All docs and posts in one file |
| `/rss.xml` | `pages/rss.xml.ts` | Blog feed |
| `/sitemap-index.xml` | `@astrojs/sitemap` | Sitemap (excludes noindex pages) |
| `/robots.txt` | `pages/robots.txt.ts` | Allows search and AI crawlers, points to the sitemap |
| `/search` | `pages/search.astro` | Full-page search, supports `?q=` (noindex). The header search opens a modal instead. |

## Docs reader

Reading a doc is a graph run, matching the product:

- **Docs map** (left): pages as nodes on each section's line. Only the current section is open; closed sections show progress dots. Pages you have opened are filled in (stored in localStorage) with an "N of M explored" counter.
- **Run bar** (sticky): the page's H2 sections as nodes that fill as you scroll; click a node to jump. It also holds the reading lenses and the "For AI" menu (Markdown, copy, llms.txt).
- **Lenses**: Read (everything), Skim (headings, first paragraphs, callouts, tables), Code (headings and code only). Remembered per reader. Pure CSS over the full HTML, so search engines always see everything.
- **Numbered sections**: each H2 is a numbered node on a spine; it lights up once reached.
- **Outgoing edges**: the page ends with the next page plus branches into other sections ("if to understand", "if to ship").
- **Keys**: `[` and `]` previous and next page, `1` `2` `3` lenses, Ctrl/Cmd+K or `/` search.

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
section: Concepts        # one of DOC_SECTIONS in src/lib/site.ts (13; Glossary, Compare and Project are hidden from the docs map)
group: In depth          # optional sub-group shown as a heading in the docs map
label: Replay safety     # optional short name for the docs map
order: 1                 # position within the section (migrated pages use steps of 10)
updated: 2026-10-03      # optional; shown on the page and in JSON-LD
faq:                     # optional; rendered at the end and as FAQPage JSON-LD
  - q: Does this need Redis?
    a: Plain-text answer, one to three sentences.
draft: false             # optional
---
```

Blog frontmatter: `title`, `description`, `date`, `author`, optional `updated`, `tags`, `featured` (pins the post to the top of /blog), `faq`, `draft`.

Moved pages keep working through `src/redirects.json` (old URL to new URL), which `astro.config.mjs` turns into redirect pages. Add an entry whenever you move or rename a doc.

A doc at `<folder>/index.md` takes the folder URL (`concepts/index.md` is `/docs/concepts`). When the folder is a section's slug, that page becomes the intro of the section landing page.

Diagrams: write ```` ```mermaid ```` blocks. They are drawn in the browser (Mermaid loads only on pages that have one) and follow the light and dark themes.

Start each page with a 40-60 word paragraph that answers the page's question on its own. AI answer engines quote it.

### Components

Available in every `.mdx` file without an import. Put opening and closing tags on their own lines, with a blank line inside, so the markdown twins convert them cleanly.

| Component | Use |
|---|---|
| `<Callout type="note\|tip\|warning\|danger" title="...">` | Aside. Becomes a blockquote in the markdown twin. |
| `<Tabs syncKey="pkg">` + `<TabItem label="pip">` | Alternatives (pip/uv, Python/TypeScript). Tabs with the same `syncKey` switch together and are remembered. |
| `<Steps>` around an ordered list | Numbered procedure with a connecting line. |
| `<CardGrid>` + `<LinkCard title href description eyebrow />` | "Where to next" links. |
| `<FileTree>` around a nested list | Project layout. Names ending in `/` are folders; **bold** marks the file in focus. |

### Code blocks

````md
```python title="graph/agent.py" {3}
from tenxgraph.core.graph import StateGraph
graph = StateGraph()
graph.add_node("agent", agent)       # [!code highlight]
graph.add_node("tools", tool_node)   # [!code ++]
```
````

- `title="..."` puts a file name in the header; without it the header shows the language, or "Terminal" for shell.
- `{3}` or `{2,4-6}` highlights lines. Comments `[!code highlight]`, `[!code ++]`, `[!code --]` and `[!code focus]` mark lines too; they are removed from the rendered code and from the markdown twins.
- Every block gets a copy button. Removed diff lines are not copied.

## Before launch

- Set the final domain in `astro.config.mjs` (`site`) and `src/lib/site.ts`.
- Add an Open Graph image and a favicon (waiting on the logo).
- The Docusaurus content is migrated (Oct 2026) with the same URLs. Delete `docusaurus/` once you have checked the migrated pages.
