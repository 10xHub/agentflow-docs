import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'agentflow-docs';
const orgName = process.env.GITHUB_REPOSITORY_OWNER ?? '10xscale';

const siteUrl = process.env.SITE_URL ?? 'https://agentflow.10xscale.ai';
const baseUrl = process.env.BASE_URL ?? '/';

const googleAnalyticsId = process.env.GOOGLE_ANALYTICS_ID;
const microsoftClarityId = process.env.MICROSOFT_CLARITY_ID;

const config: Config = {
  title: 'AgentFlow',
  tagline: 'Build production-grade multi-agent systems without rebuilding orchestration, memory, and API plumbing.',
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
        blog: false,
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

  themes: ['@docusaurus/theme-mermaid'],

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
      const githubUrl = 'https://github.com/10xscale/agentflow';
      const publisherUrl = 'https://10xscale.ai';
      const organization = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'AgentFlow',
        url: canonical,
        logo: `${canonical}/img/agentflow-mark.svg`,
        sameAs: [githubUrl, publisherUrl],
      };
      const website = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'AgentFlow',
        url: canonical,
        inLanguage: 'en',
      };
      const softwareApplication = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'AgentFlow',
        description:
          'Open-source Python framework for building production-grade multi-agent systems with built-in orchestration, state, memory, API, and TypeScript client.',
        url: canonical,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        programmingLanguage: 'Python',
        softwareRequirements: 'Python 3.10+',
        license: 'https://opensource.org/licenses/MIT',
        codeRepository: githubUrl,
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
      {name: 'keywords', content: 'agentflow, ai agent framework, python ai agents, multi-agent orchestration, langgraph alternative, crewai alternative, autogen alternative, llamaindex agents alternative, google adk alternative, agent state graph, agent memory, agent api, typescript agent client'},
      {name: 'author', content: 'AgentFlow Contributors'},
      {name: 'application-name', content: 'AgentFlow'},
      {name: 'theme-color', content: '#0b1020'},
      {property: 'og:type', content: 'website'},
      {property: 'og:site_name', content: 'AgentFlow'},
      {property: 'og:locale', content: 'en_US'},
      {name: 'twitter:card', content: 'summary_large_image'},
      {name: 'twitter:site', content: '@10xscale'},
      {name: 'twitter:creator', content: '@10xscale'},
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
        {to: '/docs/courses', label: 'Courses', position: 'left'},
        {to: '/docs/concepts/architecture', label: 'Concepts', position: 'left'},
        {to: '/docs/tutorials', label: 'Tutorials', position: 'left'},
        {
          href: 'https://github.com/10xscale/agentflow',
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
            {label: 'What is AgentFlow?', to: '/docs/get-started/what-is-agentflow'},
            {label: 'First Python agent', to: '/docs/get-started/first-python-agent'},
          ],
        },
        {
          title: 'Golden path',
          items: [
            {label: 'Installation', to: '/docs/get-started/installation'},
            {label: 'Expose with API', to: '/docs/get-started/expose-with-api'},
            {label: 'Open playground', to: '/docs/get-started/open-playground'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub', href: 'https://github.com/10xscale/agentflow'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AgentFlow Contributors.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'python', 'typescript', 'tsx', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
