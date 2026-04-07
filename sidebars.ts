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
  ],
};

export default sidebars;
