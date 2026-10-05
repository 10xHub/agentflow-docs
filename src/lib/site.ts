// Single source of truth for site-wide facts. Keep in sync with POSITIONING.md at the repo root.

export const SITE = {
  name: '10xGraph',
  url: 'https://10xgraph.com',
  tagline: '10xGraph by 10xScale: graph engineering for production AI agents.',
  description:
    'Open-source Python multi-agent framework that generates the production server: auth, owner-only threads, rate limits, replay-safe tools, Docker and k8s. MIT.',
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
  { label: 'Build', href: '/build' },
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
  { label: 'GitHub', href: SITE.github },
] as const;

// Blog categories. Every post has exactly one `kind`; each kind with posts gets /blog/kind/<kind>.
// Rules for what belongs in each: CONTENT_GUIDE.md at the repo root.
export const BLOG_KINDS = {
  tutorial: { label: 'Tutorials', blurb: 'Problem-first builds with 10xGraph: real use cases, working code, tested end to end.' },
  paper: { label: 'Papers', blurb: 'Research papers on agents, implemented in 10xGraph and run, with results, costs and limits.' },
  engineering: { label: 'Engineering', blurb: 'How 10xGraph works inside and why: failure modes, storage, auth and the runtime.' },
  release: { label: 'Releases', blurb: 'What changed in notable 10xGraph releases and how to upgrade. Every version is in the changelog.' },
  news: { label: 'News', blurb: 'Project announcements from the 10xGraph team: the rename from Agentflow, new packages, the GitHub org move and roadmap updates.' },
} as const;
export type BlogKind = keyof typeof BLOG_KINDS;

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
  'Glossary',
  'Project',
] as const;
export type DocSection = (typeof DOC_SECTIONS)[number];

// Section landing pages (/docs/<slug>). When a doc with id `<slug>/index` exists, its content
// is shown at the top of the landing page.
export const SECTION_INFO: Record<DocSection, { slug: string; title: string; blurb: string }> = {
  'Get started': { slug: 'get-started', title: 'Get started with 10xGraph: install and first agent', blurb: 'Install 10xGraph, build a first agent with a tool, and learn what the production template generates.' },
  'Beginner path': { slug: 'beginner', title: '10xGraph beginner path: from zero to a served agent', blurb: 'A guided path from zero: the mental model, a first agent, tools, memory, the API server and a TypeScript client.' },
  Concepts: { slug: 'concepts', title: '10xGraph concepts: graphs, tools, memory, serving', blurb: 'How 10xGraph works: graphs and state, tools, memory, serving, clients and the production runtime.' },
  Prebuilt: { slug: 'prebuild', title: 'Prebuilt agents and tools in 10xGraph', blurb: 'Ready-made 10xGraph agents (ReAct, RAG, supervisor team, swarm, plan-act-reflect, structured output, audio) and tools to use as they are or extend.' },
  'How-to guides': { slug: 'how-to', title: '10xGraph how-to guides: Python, CLI, production', blurb: 'Task-focused recipes for the Python library, production, the CLI and the TypeScript client.' },
  'Testing and QA': { slug: 'qa', title: 'Testing and evaluating AI agents with 10xGraph', blurb: 'Unit tests, evaluation sets, simulated users and quality gates for agents.' },
  Tutorials: { slug: 'tutorials', title: '10xGraph tutorials: end-to-end agent builds', blurb: 'End-to-end 10xGraph builds based on the examples in the repository, from a single tool agent to multi-agent systems.' },
  Reference: { slug: 'reference', title: '10xGraph reference: Python, REST API, CLI, TS client', blurb: 'Exact details: the Python library, the REST API, the CLI and configuration, and the TypeScript client.' },
  Troubleshooting: { slug: 'troubleshooting', title: 'Troubleshooting 10xGraph: install, providers, server', blurb: 'Fixes for common problems with installation, providers, the server and deployments.' },
  'Learn more': { slug: 'learn-more', title: 'Learn more: 10xGraph use cases and comparisons', blurb: 'Use cases, integrations, LLM providers, agent skills, and comparisons of 10xGraph with other agent frameworks.' },
  Glossary: { slug: 'glossary', title: 'AI agent glossary: key terms, explained', blurb: 'Plain definitions of AI agent terms: agents, ReAct, state graphs, memory, MCP, RAG, streaming, durable execution and idempotent tool calls.' },
  Project: { slug: 'project', title: '10xGraph project: roadmap, security, upgrades', blurb: 'How the 10xGraph project is run: roadmap, security policy, upgrade guides, maintainers, support and contributing.' },
};

// Project policies linked from the footer: the license file, plus the docs pages for contributing and security.
export const POLICIES = [
  { label: 'License (MIT)', href: 'https://github.com/10xHub/agentflow/blob/main/LICENSE' },
  { label: 'Contributing', href: '/docs/project/contributing' },
  { label: 'Security policy', href: '/docs/project/security' },
] as const;

// Packages that publish releases, with the names they are published under today.
export const PACKAGES = {
  core: { label: 'Core framework', registry: 'PyPI', name: '10xscale-agentflow', url: 'https://pypi.org/project/10xscale-agentflow/' },
  api: { label: 'API server and CLI', registry: 'PyPI', name: '10xscale-agentflow-cli', url: 'https://pypi.org/project/10xscale-agentflow-cli/' },
  client: { label: 'TypeScript client', registry: 'npm', name: '@10xscale/agentflow-client', url: 'https://www.npmjs.com/package/@10xscale/agentflow-client' },
} as const;
export type PackageKey = keyof typeof PACKAGES;
