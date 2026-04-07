import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'agentflow-docs';
const orgName = process.env.GITHUB_REPOSITORY_OWNER ?? '10xscale';

const config: Config = {
  title: 'AgentFlow',
  tagline: 'Build production-grade multi-agent systems without rebuilding orchestration, memory, and API plumbing.',
  favicon: 'img/agentflow-mark.svg',

  url: process.env.SITE_URL ?? `https://${orgName}.github.io`,
  baseUrl: process.env.BASE_URL ?? `/${repoName}/`,

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

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    image: 'img/agentflow-social-card.svg',
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
        {to: '/docs/get-started', label: 'Get Started', position: 'left'},
        {to: '/docs/get-started/expose-with-api', label: 'API', position: 'left'},
        {to: '/docs/get-started/connect-client', label: 'Client', position: 'left'},
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
