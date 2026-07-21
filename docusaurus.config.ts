import {existsSync} from 'node:fs';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'agentflow-docs';
const orgName = process.env.GITHUB_REPOSITORY_OWNER ?? '10xHub';

const siteUrl = process.env.SITE_URL ?? 'https://agentflow.10xscale.ai';
const baseUrl = process.env.BASE_URL ?? '/';

const googleAnalyticsId = process.env.GOOGLE_ANALYTICS_ID;
const microsoftClarityId = process.env.MICROSOFT_CLARITY_ID;

/**
 * Versioned docs are cut with `npm run docs:cut-version -- 1.0` at release time
 * (see CONTRIBUTING.md). Until the first snapshot exists there is nothing to
 * switch between, so the navbar version dropdown stays hidden. It appears
 * automatically once `versioned_docs/` is created — no config edit needed.
 */
const hasVersionedDocs = existsSync('./versioned_docs');

const config: Config = {
  // Kept short on purpose: Docusaurus appends " | <title>" to every page
  // title, and a long site title pushes real page titles out of search results.
  title: 'AgentFlow',
  tagline: 'The open-source Python framework powering all 10xScale AI products. Build multi-agent systems with typed graphs, durable memory, streaming, and a full-stack API — without rebuilding the plumbing.',
  favicon: 'img/agentflow-mark.svg',

  url: siteUrl,
  baseUrl,

  organizationName: orgName,
  projectName: repoName,
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  customFields: {
    microsoftClarityId,
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          showLastUpdateAuthor: false,
          showLastUpdateTime: true,
          editUrl: `https://github.com/${orgName}/${repoName}/edit/main/`,
          // `current` documents the 1.0 release line and is served at /docs.
          // When work starts on the next minor, freeze this one first:
          //   npm run docs:cut-version -- 1.0
          // That creates versioned_docs/version-1.0, after which `current`
          // becomes the unreleased docs and the version dropdown appears.
          lastVersion: 'current',
          versions: {
            current: {
              label: '1.0',
              path: '',
              banner: 'none',
            },
          },
        },
        blog: {
          path: 'blog',
          routeBasePath: 'blog',
          showReadingTime: true,
          blogSidebarTitle: 'Latest posts',
          blogSidebarCount: 10,
          postsPerPage: 10,
          feedOptions: {
            type: ['rss', 'atom'],
            title: 'AgentFlow Blog — Building Production AI Agents in Python',
            description:
              'Deep dives, patterns, and migration guides for building production AI agents with AgentFlow.',
            xslt: true,
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          filename: 'sitemap.xml',
          ignorePatterns: ['/tags/**'],
        },
        gtag: googleAnalyticsId
          ? {
              trackingID: googleAnalyticsId,
              anonymizeIP: true,
            }
          : undefined,
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      // Generates a static lunr index at `npm run build` over docs + blog +
      // custom pages. The default `SearchBar` UI it ships is overridden by
      // our swizzle at `src/theme/SearchBar/` — we only consume the index +
      // search engine, not the bundled modal.
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: true,
        indexPages: true,
        language: ['en'],
        docsRouteBasePath: '/docs',
        blogRouteBasePath: '/blog',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Every renamed or moved page needs an entry here. `onBrokenLinks:
        // 'throw'` protects internal links; this protects external ones.
        redirects: [
          // The `concept2/` tree was merged into `concepts/` (Jul 2026).
          {from: '/docs/concept2', to: '/docs/concepts'},
          {from: '/docs/concept2/agents-tools-control', to: '/docs/concepts/agents-tools-control'},
          {from: '/docs/concept2/memory', to: '/docs/concepts/memory'},
          {from: '/docs/concept2/serving-agents', to: '/docs/concepts/serving-agents'},
          {from: '/docs/concept2/connecting-clients', to: '/docs/concepts/connecting-clients'},
          {from: '/docs/concept2/extensibility', to: '/docs/concepts/extensibility'},
          {from: '/docs/concept2/qa', to: '/docs/concepts/qa'},
          // Paths from the retired MkDocs site.
          {from: '/docs/getting-started', to: '/docs/get-started'},
          {from: '/docs/getting-started/installation', to: '/docs/get-started/installation'},
          {from: '/docs/getting-started/hello-world', to: '/docs/get-started/first-agent'},
          {from: '/docs/getting-started/core-concepts', to: '/docs/concepts'},
          {from: '/docs/getting-started/what-is-agentflow', to: '/docs/concepts'},
          {from: '/docs/reference/library', to: '/docs/reference'},
          {from: '/docs/reference/client', to: '/docs/reference/client/agentflow-client'},
          {from: '/docs/reference/cli', to: '/docs/reference/api-cli/commands'},
          {from: '/docs/Tutorial', to: '/docs/tutorials'},
          {from: '/docs/faq', to: '/docs/troubleshooting/installation'},
        ],
      },
    ],
    /**
     * Writes /llms-full.txt at build time: every doc page concatenated as plain
     * markdown with its canonical URL. `static/llms.txt` is the curated index
     * for crawlers; this is the full corpus for anything that wants to read the
     * documentation in one request instead of 300.
     */
    function llmsFullTextPlugin() {
      return {
        name: 'agentflow-llms-full-text',
        async postBuild({outDir}: {outDir: string}) {
          const {readFile, writeFile, readdir} = await import('node:fs/promises');
          const {join, relative} = await import('node:path');

          const docsDir = join(process.cwd(), 'docs');
          const canonical = siteUrl.replace(/\/$/, '');

          async function walk(dir: string): Promise<string[]> {
            const entries = await readdir(dir, {withFileTypes: true});
            const files: string[] = [];
            for (const entry of entries) {
              const full = join(dir, entry.name);
              if (entry.isDirectory()) files.push(...(await walk(full)));
              else if (/\.mdx?$/.test(entry.name)) files.push(full);
            }
            return files;
          }

          const files = (await walk(docsDir)).sort();
          const parts = [
            '# AgentFlow documentation — full text',
            '',
            `Source: ${canonical}/docs`,
            'Curated index: ' + canonical + '/llms.txt',
            `Pages: ${files.length}`,
            '',
          ];

          for (const file of files) {
            const raw = await readFile(file, 'utf8');
            // Drop front matter; keep the body as authored.
            const body = raw.startsWith('---')
              ? raw.slice(raw.indexOf('\n---', 3) + 4).trimStart()
              : raw;
            const slug = relative(docsDir, file).replace(/\\/g, '/').replace(/\.mdx?$/, '');
            parts.push(
              '',
              '---',
              '',
              `URL: ${canonical}/docs/${slug.replace(/\/index$/, '')}`,
              '',
              body.trim(),
            );
          }

          await writeFile(join(outDir, 'llms-full.txt'), parts.join('\n'), 'utf8');
        },
      };
    },
    function structuredDataPlugin() {
      const canonical = siteUrl.replace(/\/$/, '');
      const githubUrl = 'https://github.com/10xHub/Agentflow';
      const publisherUrl = 'https://10xscale.ai';
      const organization = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '10xScale',
        url: publisherUrl,
        logo: `${canonical}/img/agentflow-mark.svg`,
        sameAs: [githubUrl, canonical],
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'contact@10xscale.ai',
          contactType: 'technical support',
        },
      };
      const website = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'AgentFlow by 10xScale',
        url: canonical,
        inLanguage: 'en',
        publisher: {
          '@type': 'Organization',
          name: '10xScale',
          url: publisherUrl,
        },
      };
      const softwareApplication = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'AgentFlow',
        alternateName: '10xscale-agentflow',
        description:
          'Open-source Python framework built by 10xScale for production-grade multi-agent AI systems. Powers all 10xScale products. Includes typed StateGraph orchestration, Redis + Postgres persistence, REST and SSE API server, and a typed TypeScript client.',
        url: canonical,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        programmingLanguage: ['Python', 'TypeScript'],
        softwareRequirements: 'Python 3.12+',
        license: 'https://opensource.org/licenses/MIT',
        codeRepository: githubUrl,
        author: {
          '@type': 'Organization',
          name: '10xScale',
          url: publisherUrl,
        },
        offers: {'@type': 'Offer', price: '0', priceCurrency: 'USD'},
      };
      return {
        name: 'agentflow-seo-structured-data',
        injectHtmlTags() {
          return {
            headTags: [organization, website, softwareApplication].map((s) => ({
              tagName: 'script',
              attributes: {type: 'application/ld+json'},
              innerHTML: JSON.stringify(s),
            })),
          };
        },
      };
    },
  ],

  themeConfig: {
    image: 'img/agentflow-social-card.png',
    metadata: [
      {name: 'keywords', content: 'agentflow, 10xscale agentflow, 10xscale, ai agent framework, python ai agents, production ai agents, multi-agent orchestration, agent state graph, langgraph alternative, crewai alternative, autogen alternative, google adk alternative, llamaindex agents alternative, agent memory, agent api, typescript agent client, agentflow python, open source ai framework, python multi-agent, ai agent production, stateful ai agents, streaming ai agents, sse ai agents, agentflow 10xscale'},
      {name: 'author', content: '10xScale'},
      {name: 'application-name', content: 'AgentFlow'},
      {name: 'theme-color', content: '#0b1020'},
      {property: 'og:type', content: 'website'},
      {property: 'og:site_name', content: 'AgentFlow'},
      {property: 'og:locale', content: 'en_US'},
      {name: 'twitter:card', content: 'summary_large_image'},
      {name: 'twitter:site', content: '@10xscale'},
      {name: 'twitter:creator', content: '@10xscale'},
      {name: 'robots', content: 'index, follow'},
    ],
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'AgentFlow',
      logo: {
        alt: 'AgentFlow logo',
        src: 'img/agentflow-mark.svg',
      },
      // Kept to four left-hand entries. Everything else lives in the sidebar,
      // which is where people look once they are inside the docs.
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/docs/concepts', label: 'Concepts', position: 'left'},
        {to: '/docs/reference', label: 'Reference', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        // Explicit `search` slot — without this, Docusaurus appends the
        // SearchBar at the very end of the right cluster (after GitHub +
        // the color-mode toggle). Putting it first on the right places
        // it to the LEFT of both, which is what we want visually.
        {
          type: 'search',
          position: 'right',
        },
        ...(hasVersionedDocs
          ? [{type: 'docsVersionDropdown' as const, position: 'right' as const}]
          : []),
        {
          href: 'https://github.com/10xHub/Agentflow',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {label: 'Get started', to: '/docs/get-started'},
            {label: 'Beginner path', to: '/docs/beginner'},
            {label: 'Concepts', to: '/docs/concepts'},
            {label: 'Tutorials', to: '/docs/tutorials'},
            {label: 'GenAI courses', to: '/docs/courses'},
          ],
        },
        {
          title: 'Build',
          items: [
            {label: 'Installation', to: '/docs/get-started/installation'},
            {label: 'API reference', to: '/docs/reference'},
            {label: 'Deployment', to: '/docs/how-to/production/deployment'},
            {label: 'Troubleshooting', to: '/docs/troubleshooting/installation'},
            {label: 'Glossary', to: '/docs/glossary'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'Changelog', to: '/docs/project/changelog'},
            {label: 'Roadmap', to: '/docs/project/roadmap'},
            {label: 'Contributing', to: '/docs/project/contributing'},
            {label: 'Security', to: '/docs/project/security'},
            {label: 'Support', to: '/docs/project/support'},
          ],
        },
        {
          title: 'Elsewhere',
          items: [
            {label: 'GitHub', href: 'https://github.com/10xHub/Agentflow'},
            {label: 'PyPI', href: 'https://pypi.org/project/10xscale-agentflow/'},
            {label: 'npm', href: 'https://www.npmjs.com/package/@10xscale/agentflow-client'},
            {label: '10xscale.ai', href: 'https://10xscale.ai'},
            {label: 'contact@10xscale.ai', href: 'mailto:contact@10xscale.ai'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://10xscale.ai" target="_blank" rel="noopener noreferrer">10xScale</a>. AgentFlow is open source under the MIT license.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'python', 'typescript', 'tsx', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
