// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers';
import { codeFrame } from './src/lib/code-frame.mjs';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SITE_URL = 'https://10xgraph.com';

/** Every file under dir, recursively. */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

// Sitemap <lastmod>: the `updated` (or blog `date`) frontmatter of each content page, keyed by its
// URL. Pages without a date get no lastmod rather than a misleading build date.
function contentLastmod() {
  const map = new Map();
  for (const [dir, prefix] of [['src/content/docs', '/docs'], ['src/content/blog', '/blog'], ['src/content/build', '/build']]) {
    for (const file of walk(dir).filter((f) => /\.mdx?$/.test(f))) {
      const fm = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
      const date = fm && (fm[1].match(/^updated:\s*['"]?([0-9-]{10})/m) || fm[1].match(/^date:\s*['"]?([0-9-]{10})/m));
      if (!date) continue;
      const slug = relative(dir, file).replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
      map.set(`${SITE_URL}${prefix}${slug ? `/${slug}` : ''}`, new Date(date[1]).toISOString());
    }
  }
  return map;
}
const lastmod = contentLastmod();

// Post-build steps for static hosting:
// - _redirects (Netlify / Cloudflare Pages format) so old URLs get real 301s; the meta-refresh
//   pages Astro writes stay as the fallback for hosts that ignore the file.
// - Drop noindex pages (e.g. thin blog topic pages) from the sitemap, so the two never disagree.
// - Markdown tables often leave the first header cell empty (| | a | b |); screen readers then
//   announce nothing for that column, so it gets a visually hidden label.
const postBuild = {
  name: 'post-build-seo',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const out = dir.pathname;
      writeFileSync(join(out, '_redirects'), Object.entries(redirects).map(([from, to]) => `${from} ${to} 301`).join('\n') + '\n');
      const pages = walk(out).filter((f) => f.endsWith('.html') && !f.includes('/pagefind/'));
      for (const f of pages) {
        const html = readFileSync(f, 'utf8');
        const labelled = html.replace(/<th([^>]*)><\/th>/g, '<th$1><span class="sr-only">Item</span></th>');
        if (labelled !== html) writeFileSync(f, labelled);
      }
      const noindex = pages
        .filter((f) => /<meta name="robots" content="noindex"/.test(readFileSync(f, 'utf8')))
        .map((f) => `${SITE_URL}/${relative(out, f).replace(/\.html$/, '').replace(/(^|\/)index$/, '')}`.replace(/\/$/, ''));
      for (const f of readdirSync(out).filter((n) => /^sitemap-\d+\.xml$/.test(n))) {
        const path = join(out, f);
        const xml = readFileSync(path, 'utf8').replace(/<url><loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g, (m, loc) => (noindex.includes(loc) ? '' : m));
        writeFileSync(path, xml);
      }
    },
  },
};

// Old URLs from the Docusaurus site (and its retired blog) that moved. Docs pages kept their
// URLs in the migration, so only these need a redirect.
const redirects = {
  // Pages merged into others during the 2026-10 docs cleanup.
  '/docs/concepts/qa': '/docs/qa',
  '/docs/concepts/agents-tools-control': '/docs/concepts/agents-and-tools',
  '/docs/concepts/testing-and-evaluation': '/docs/qa',
  '/docs/concepts/providers-and-adapters': '/docs/providers',
  '/docs/concepts/publishers-and-runtime-protocols': '/docs/concepts/production-runtime',
  '/docs/troubleshooting/error-patterns': '/docs/troubleshooting/error-codes',
  '/docs/tutorials/from-examples/stream-sync': '/docs/tutorials/from-examples/react-streaming',
  '/docs/tutorials/from-examples/mcp-file-download': '/docs/tutorials/from-examples/github-mcp',
  '/docs/tutorials/from-examples/skills-chat': '/docs/tutorials/from-examples/skills',
  '/docs/tutorials/from-examples/qdrant-memory': '/docs/tutorials/from-examples/memory',
  '/docs/reference/client/tools': '/docs/how-to/client/register-remote-tools',
  '/docs/concept2': '/docs/concepts',
  '/docs/concept2/agents-tools-control': '/docs/concepts/agents-and-tools',
  '/docs/concept2/memory': '/docs/concepts/memory',
  '/docs/concept2/serving-agents': '/docs/concepts/serving-agents',
  '/docs/concept2/connecting-clients': '/docs/concepts/connecting-clients',
  '/docs/concept2/extensibility': '/docs/concepts/extensibility',
  '/docs/concept2/qa': '/docs/qa',
  '/docs/getting-started': '/docs/get-started',
  '/docs/getting-started/installation': '/docs/get-started/installation',
  '/docs/getting-started/hello-world': '/docs/get-started/first-agent',
  '/docs/getting-started/core-concepts': '/docs/concepts',
  '/docs/getting-started/what-is-agentflow': '/docs/concepts',
  '/docs/reference/library': '/docs/reference',
  '/docs/reference/client': '/docs/reference/client/agentflow-client',
  '/docs/reference/cli': '/docs/reference/api-cli/commands',
  '/docs/Tutorial': '/docs/tutorials',
  '/docs/faq': '/docs/troubleshooting/installation',
  '/docs/how-to/production/api-reference': '/docs/reference/rest-api/conventions',
  '/blog/langgraph-alternatives-5-frameworks': '/docs/compare/best-python-agent-framework-2026',
  '/blog/langgraph-to-agentflow-migration': '/docs/compare/agentflow-vs-langgraph',
  '/blog/multi-agent-orchestration-python-7-patterns': '/docs/glossary/what-is-multi-agent-orchestration',
  '/blog/react-agent-tools-real-apis': '/docs/glossary/what-is-a-react-agent',
  '/blog/ai-agents-vs-workflows': '/docs/glossary/what-is-an-ai-agent',
  '/blog/ai-agent-memory-checkpointing-python': '/docs/concepts/memory',
  '/blog/streaming-agent-responses-fastapi-sse': '/docs/concepts/streaming',
  '/blog/production-ai-agents-observability-retries': '/docs/concepts/production-runtime',
  '/blog/deploy-ai-agent-docker-aws': '/docs/how-to/production/deployment',
  '/blog/how-to-build-an-ai-agent-in-python': '/docs/get-started/first-agent',
  '/docs/project/changelog': '/changelog',
  };

// Static output only. Canonical URLs have no trailing slash; pages build to /path.html,
// which static hosts (Cloudflare Pages, Netlify, Vercel, GitHub Pages) serve at /path.
export default defineConfig({
  site: 'https://10xgraph.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  redirects,
  integrations: [
    mdx(),
    // Utility pages are noindex, so keep them out of the sitemap too.
    sitemap({
      filter: (page) => !/\/(search|404)$/.test(new URL(page).pathname),
      serialize: (item) => {
        const date = lastmod.get(item.url.replace(/\/$/, ''));
        return date ? { ...item, lastmod: date } : item;
      },
    }),
    postBuild,
  ],
  markdown: {
    // Mermaid blocks are left as plain code and drawn in the browser (scripts/mermaid.ts).
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid', 'math'] },
    // Dual themes: colors switch with the site theme through CSS variables (see global.css).
    shikiConfig: {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
      defaultColor: false,
      // Authors can mark lines: {2,4-5} in the fence meta, or "# [!code highlight]", "# [!code ++]",
      // "# [!code --]" and "# [!code focus]" comments. codeFrame() must run last: it wraps the <pre>.
      transformers: [
        transformerMetaHighlight(),
        transformerNotationHighlight(),
        transformerNotationDiff(),
        transformerNotationFocus(),
        codeFrame(),
      ],
    },
  },
});
