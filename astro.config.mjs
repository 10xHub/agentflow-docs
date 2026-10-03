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

// Static output only. Canonical URLs have no trailing slash; pages build to /path.html,
// which static hosts (Cloudflare Pages, Netlify, Vercel, GitHub Pages) serve at /path.
export default defineConfig({
  site: 'https://10xgraph.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  // Old URLs from the Docusaurus site (and its retired blog) that moved. Docs pages kept their
  // URLs in the migration, so only these need a redirect.
  redirects: {
    '/docs/concept2': '/docs/concepts',
    '/docs/concept2/agents-tools-control': '/docs/concepts/agents-tools-control',
    '/docs/concept2/memory': '/docs/concepts/memory',
    '/docs/concept2/serving-agents': '/docs/concepts/serving-agents',
    '/docs/concept2/connecting-clients': '/docs/concepts/connecting-clients',
    '/docs/concept2/extensibility': '/docs/concepts/extensibility',
    '/docs/concept2/qa': '/docs/concepts/qa',
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
  },
  integrations: [
    mdx(),
    // Utility pages are noindex, so keep them out of the sitemap too.
    sitemap({ filter: (page) => !/\/(search|404)$/.test(new URL(page).pathname) }),
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
