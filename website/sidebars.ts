import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'README',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Get Started',
      collapsed: false,
      items: ['INSTALL', 'CONFIGURATION'],
    },
    {
      type: 'category',
      label: 'Usage',
      collapsed: false,
      items: ['API', 'CONTENT-MANAGEMENT', 'NOTEBOOK-LIBRARY', 'AUTO-DISCOVERY'],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: ['N8N-INTEGRATION', 'DOCKER', 'WSL-USAGE', 'MULTI-INTERFACE'],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: ['MULTI-ACCOUNT', 'TROUBLESHOOTING'],
    },
    {
      type: 'doc',
      id: 'CHANGELOG',
      label: 'Release history',
    },
  ],
};

export default sidebars;
