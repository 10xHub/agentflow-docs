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
  integrations: [
    mdx(),
    // Utility pages are noindex, so keep them out of the sitemap too.
    sitemap({ filter: (page) => !/\/(search|404)$/.test(new URL(page).pathname) }),
  ],
  markdown: {
    // Dual themes: colors switch with the site theme through CSS variables (see global.css).
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
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
