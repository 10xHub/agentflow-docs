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
      collapsed: true,
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
    {
      type: 'category',
      label: 'Concepts',
      collapsed: true,
      items: [
        'concepts/architecture',
        'concepts/state-graph',
        'concepts/agents-and-tools',
        'concepts/state-and-messages',
        'concepts/checkpointing-and-threads',
        'concepts/memory-and-store',
        'concepts/streaming',
        'concepts/media-and-files',
        'concepts/dependency-injection',
        'concepts/production-runtime',
      ],
    },
    {
      type: 'category',
      label: 'How-to guides',
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'API & CLI',
          items: [
            'how-to/api-cli/initialize-project',
            'how-to/api-cli/run-api-server',
            'how-to/api-cli/open-playground',
            'how-to/api-cli/configure-agentflow-json',
            'how-to/api-cli/add-auth',
            'how-to/api-cli/generate-docker-files',
          ],
        },
        {
          type: 'category',
          label: 'TypeScript Client',
          items: [
            'how-to/client/create-client',
            'how-to/client/invoke-agent',
            'how-to/client/stream-responses',
            'how-to/client/manage-threads',
            'how-to/client/use-memory-api',
            'how-to/client/upload-files',
            'how-to/client/register-remote-tools',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'API & CLI',
          items: [
            'reference/api-cli/commands',
            'reference/api-cli/configuration',
            'reference/api-cli/auth',
            'reference/api-cli/environment',
            'reference/api-cli/thread-name-generator',
            'reference/api-cli/id-generator',
          ],
        },
        {
          type: 'category',
          label: 'REST API',
          items: [
            'reference/rest-api/graph',
            'reference/rest-api/threads',
            'reference/rest-api/memory-store',
            'reference/rest-api/files',
            'reference/rest-api/ping',
          ],
        },
        {
          type: 'category',
          label: 'TypeScript Client',
          items: [
            'reference/client/agentflow-client',
            'reference/client/message',
            'reference/client/invoke',
            'reference/client/stream',
            'reference/client/threads',
            'reference/client/memory',
            'reference/client/files',
            'reference/client/auth',
            'reference/client/tools',
          ],
        },
      ],
    },
  ],
};

export default sidebars;
