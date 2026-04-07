import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    {
      type: 'category',
      label: 'Get Started',
      collapsed: false,
      items: [
        'get-started/index',
        'get-started/installation',
        'get-started/first-agent',
      ],
    },
    {
      type: 'category',
      label: 'Beginner Path',
      collapsed: false,
      items: ['beginner/index'],
    },
    {
      type: 'category',
      label: 'Concepts',
      collapsed: false,
      items: [
        'concepts/index',
        'concepts/why-agentflow',
        'concepts/architecture',
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      collapsed: false,
      items: ['tutorials/index'],
    },
    {
      type: 'category',
      label: 'How-To Guides',
      collapsed: false,
      items: ['how-to/index'],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      collapsed: false,
      items: ['troubleshooting/index'],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        'reference/index',
        'reference/python/index',
        'reference/api-cli/index',
      ],
    },
  ],
};

export default sidebars;
