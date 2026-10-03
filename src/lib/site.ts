// Single source of truth for site-wide facts. Keep in sync with POSITIONING.md at the repo root.

export const SITE = {
  name: '10xGraph',
  url: 'https://10xgraph.com',
  tagline: '10xGraph by 10xScale: graph engineering for production AI agents.',
  description:
    'Open-source Python multi-agent framework that generates the production server: auth, per-tool permissions, rate limits, replay-safe tools, Docker and k8s. MIT.',
  github: 'https://github.com/10xGraph/10xgraph',
  version: '0.9.2',
  locale: 'en_US',
  org: { name: '10xScale', url: 'https://10xscale.ai' },
  formerName: 'Agentflow',
} as const;

export const NAV = [
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
  { label: 'Search', href: '/search' },
  { label: 'GitHub', href: SITE.github },
] as const;

// Docs sidebar groups, in display order. A doc picks its group with the `section` frontmatter field.
export const DOC_SECTIONS = ['Get started', 'Concepts', 'How-to guides', 'Reference'] as const;
export type DocSection = (typeof DOC_SECTIONS)[number];
