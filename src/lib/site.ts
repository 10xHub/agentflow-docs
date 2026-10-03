// Single source of truth for site-wide facts. Keep in sync with POSITIONING.md at the repo root.

export const SITE = {
  name: '10xGraph',
  url: 'https://10xgraph.com',
  tagline: '10xGraph by 10xScale: graph engineering for production AI agents.',
  description:
    'Open-source Python multi-agent framework that generates the production server: auth, per-tool permissions, rate limits, replay-safe tools, Docker and k8s. MIT.',
  // Current repo URLs. GitHub redirects these after the repos move to the 10xGraph org,
  // so they keep working; switch them once the transfer is done.
  github: 'https://github.com/10xHub/agentflow',
  docsRepo: 'https://github.com/10xHub/agentflow-docs',
  docsBranch: 'main',
  version: '0.9.2',
  locale: 'en_US',
  org: { name: '10xScale', url: 'https://10xscale.ai' },
  formerName: 'Agentflow',
} as const;

export const NAV = [
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
  { label: 'GitHub', href: SITE.github },
] as const;

// Docs sections, in reading-journey order (install, learn, build, look up, unblock, everything
// else). A doc picks its section with the `section` frontmatter field and, optionally, a `group`.
export const DOC_SECTIONS = [
  'Get started',
  'Beginner path',
  'Concepts',
  'Prebuilt',
  'How-to guides',
  'Testing and QA',
  'Tutorials',
  'Reference',
  'Troubleshooting',
  'Learn more',
  'Courses',
  'Project',
] as const;
export type DocSection = (typeof DOC_SECTIONS)[number];

// Section landing pages (/docs/<slug>). When a doc with id `<slug>/index` exists, its content
// is shown at the top of the landing page.
export const SECTION_INFO: Record<DocSection, { slug: string; blurb: string }> = {
  'Get started': { slug: 'get-started', blurb: 'Install 10xGraph, build a first agent with a tool, and learn what the production template generates.' },
  'Beginner path': { slug: 'beginner', blurb: 'A guided path from zero: the mental model, a first agent, tools, memory, the API server and a TypeScript client.' },
  Concepts: { slug: 'concepts', blurb: 'How 10xGraph works: graphs and state, tools, memory, serving, clients and the production runtime.' },
  Prebuilt: { slug: 'prebuild', blurb: 'Ready-made agents and tools you can use as they are or extend.' },
  'How-to guides': { slug: 'how-to', blurb: 'Task-focused recipes for the Python library, production, the CLI and the TypeScript client.' },
  'Testing and QA': { slug: 'qa', blurb: 'Unit tests, evaluation sets, simulated users and quality gates for agents.' },
  Tutorials: { slug: 'tutorials', blurb: 'End-to-end builds based on the examples in the repository.' },
  Reference: { slug: 'reference', blurb: 'Exact details: the Python library, the REST API, the CLI and configuration, and the TypeScript client.' },
  Troubleshooting: { slug: 'troubleshooting', blurb: 'Fixes for common problems with installation, providers, the server and deployments.' },
  'Learn more': { slug: 'learn-more', blurb: 'Use cases, integrations, providers, skills, a glossary of agent terms, and comparisons with other frameworks.' },
  Courses: { slug: 'courses', blurb: 'Free GenAI courses: shared foundations, a beginner track and an advanced track for agent systems.' },
  Project: { slug: 'project', blurb: 'Roadmap, security, upgrades, maintainers and how the project is run.' },
};

// Policy files in the main repo, linked from the footer.
export const POLICIES = [
  { label: 'License (MIT)', href: 'https://github.com/10xHub/agentflow/blob/main/LICENSE' },
  { label: 'Contributing', href: 'https://github.com/10xHub/agentflow/blob/main/CONTRIBUTING.md' },
  { label: 'Code of conduct', href: 'https://github.com/10xHub/agentflow/blob/main/CODE_OF_CONDUCT.md' },
  { label: 'Security policy', href: 'https://github.com/10xHub/agentflow/blob/main/SECURITY.md' },
] as const;

// Packages that publish releases, with the names they are published under today.
export const PACKAGES = {
  core: { label: 'Core framework', registry: 'PyPI', name: '10xscale-agentflow', url: 'https://pypi.org/project/10xscale-agentflow/' },
  api: { label: 'API server and CLI', registry: 'PyPI', name: '10xscale-agentflow-cli', url: 'https://pypi.org/project/10xscale-agentflow-cli/' },
  client: { label: 'TypeScript client', registry: 'npm', name: '@10xscale/agentflow-client', url: 'https://www.npmjs.com/package/@10xscale/agentflow-client' },
} as const;
export type PackageKey = keyof typeof PACKAGES;
