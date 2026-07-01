import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'agentflow-docs';
const orgName = process.env.GITHUB_REPOSITORY_OWNER ?? '10xHub';

const siteUrl = process.env.SITE_URL ?? 'https://agentflow.10xscale.ai';
const baseUrl = process.env.BASE_URL ?? '/';

const googleAnalyticsId = process.env.GOOGLE_ANALYTICS_ID;
const microsoftClarityId = process.env.MICROSOFT_CLARITY_ID;

const config: Config = {
  title: 'AgentFlow by 10xScale',
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
        redirects: [
          // Add entries when you rename or move pages, e.g.:
          // {from: '/docs/old-slug', to: '/docs/new-slug'},
        ],
      },
    ],
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
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/docs/concept2', label: 'Concepts', position: 'left'},
        {to: '/docs/how-to/python/build-a-graph', label: 'How to Guide', position: 'left'},
        {to: '/docs/skills', label: 'Skills', position: 'left'},
        {to: '/docs/tutorials', label: 'Tutorials', position: 'left'},
        {to: '/docs/courses', label: 'Courses', position: 'left'},

        {to: '/blog', label: 'Blog', position: 'left'},
        {to: '/docs/glossary', label: 'Glossary', position: 'left'},
        // Explicit `search` slot — without this, Docusaurus appends the
        // SearchBar at the very end of the right cluster (after GitHub +
        // the color-mode toggle). Putting it first on the right places
        // it to the LEFT of both, which is what we want visually.
        {
          type: 'search',
          position: 'right',
        },
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
            {label: 'Start here', to: '/docs/get-started'},
            {label: 'What is AgentFlow?', to: '/docs/get-started'},
            {label: 'First Python agent', to: '/docs/get-started/first-agent'},
          ],
        },
        {
          title: 'Golden path',
          items: [
            {label: 'Installation', to: '/docs/get-started/installation'},
            {label: 'Your First Agent', to: '/docs/get-started/first-agent'},
            {label: 'Open playground', to: '/docs/how-to/api-cli/open-playground'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub', href: 'https://github.com/10xHub/Agentflow'},
          ],
        },
        {
          title: '10xScale',
          items: [
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
