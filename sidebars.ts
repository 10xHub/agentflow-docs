import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    {
      type: 'category',
      label: 'Get Started',
      collapsed: false,
      items: [
        'get-started/index',
        'get-started/what-is-agentflow',
        'get-started/installation',
        'get-started/first-python-agent',
        'get-started/expose-with-api',
        'get-started/connect-client',
        'get-started/open-playground',
      ],
    },
  ],
};

export default sidebars;
