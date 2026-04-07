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
    {
      type: 'category',
      label: 'Beginner Path',
      collapsed: false,
      items: [
        'beginner/index',
        'beginner/mental-model',
        'beginner/your-first-agent',
        'beginner/add-a-tool',
        'beginner/add-memory',
        'beginner/run-with-api',
        'beginner/test-with-playground',
        'beginner/call-from-typescript',
      ],
    },
  ],
};

export default sidebars;
