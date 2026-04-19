import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'NotebookLM MCP + HTTP REST API',
  tagline:
    'Google NotebookLM over MCP + a local HTTP REST API — Q&A with citations, audio podcasts, video generation, multi-account rotation',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://roomi-fields.github.io',
  baseUrl: '/notebooklm-mcp/',

  organizationName: 'roomi-fields',
  projectName: 'notebooklm-mcp',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

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
          routeBasePath: '/',
          editUrl: 'https://github.com/roomi-fields/notebooklm-mcp/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    metadata: [
      {
        name: 'keywords',
        content:
          'notebooklm, mcp, mcp-server, claude-code, codex, cursor, gemini, google-notebooklm, http-api, rest-api, n8n, zapier, make, anthropic, playwright, citations, ai-agent',
      },
      {
        name: 'description',
        content:
          'Google NotebookLM over MCP + a local HTTP REST API. Q&A with citations, audio, video, content generation, multi-account rotation. Works with Claude Code, Codex, Cursor, n8n, Zapier, Make.',
      },
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'NotebookLM MCP',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/roomi-fields/notebooklm-mcp',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Get Started',
          items: [
            { label: 'Install', to: '/INSTALL' },
            { label: 'Configuration', to: '/CONFIGURATION' },
            { label: 'HTTP API', to: '/API' },
            { label: 'Troubleshooting', to: '/TROUBLESHOOTING' },
          ],
        },
        {
          title: 'Integrations',
          items: [
            { label: 'n8n', to: '/N8N-INTEGRATION' },
            { label: 'Docker', to: '/DOCKER' },
            { label: 'WSL', to: '/WSL-USAGE' },
            { label: 'Multi-account', to: '/MULTI-ACCOUNT' },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/roomi-fields/notebooklm-mcp',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp',
            },
            {
              label: 'Issues',
              href: 'https://github.com/roomi-fields/notebooklm-mcp/issues',
            },
          ],
        },
      ],
      copyright: `MIT © ${new Date().getFullYear()} Romain Peyrichou + contributors`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
