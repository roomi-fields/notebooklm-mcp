import { execFileSync } from 'node:child_process';

import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const SITE_URL = 'https://notebooklm.roomi-fields.com';

/** First commit of the project. A real fixed fact, safe to write down. */
const PUBLISHED = '2025-11-22';

/**
 * A hardcoded "last updated" goes stale the day after it is written, which is
 * the whole failure this is meant to fix. Read it from the last commit that
 * touched the documentation instead. Needs the full history, so the deploy
 * workflow checks out with fetch-depth 0.
 */
function lastModified(): string {
  try {
    const iso = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', 'website', 'deployment/docs'],
      { encoding: 'utf8' }
    ).trim();
    if (iso) return iso.slice(0, 10);
  } catch {
    // shallow clone, or no git at all — fall through
  }
  return new Date().toISOString().slice(0, 10);
}

const MODIFIED = lastModified();

const config: Config = {
  title: 'NotebookLM MCP + HTTP REST API',
  tagline:
    'Google Gemini Notebook (formerly NotebookLM) over MCP + a local HTTP REST API — Q&A with citations, audio podcasts, video generation, multi-account rotation',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://notebooklm.roomi-fields.com',
  baseUrl: '/',

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

  headTags: [
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        // One graph rather than a lone SoftwareApplication: engines use the
        // Organization to work out who publishes this, and the WebSite to tie
        // the docs to the package and to the other roomi-fields domains.
        '@graph': [
          {
            '@type': 'Organization',
            '@id': 'https://roomi-fields.com/#organization',
            name: 'roomi-fields',
            url: 'https://roomi-fields.com',
            logo: `${SITE_URL}/img/logo.svg`,
            founder: {
              '@type': 'Person',
              name: 'Romain Peyrichou',
              url: 'https://github.com/roomi-fields',
            },
            sameAs: [
              'https://github.com/roomi-fields',
              'https://www.npmjs.com/org/roomi-fields',
              'https://schemas.roomi-fields.com',
            ],
          },
          {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            name: 'NotebookLM MCP + HTTP REST API',
            url: `${SITE_URL}/`,
            inLanguage: 'en',
            publisher: { '@id': 'https://roomi-fields.com/#organization' },
            datePublished: PUBLISHED,
            dateModified: MODIFIED,
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${SITE_URL}/#software`,
            name: 'NotebookLM MCP + HTTP REST API',
            description:
              'Google NotebookLM over MCP + a local HTTP REST API. Citation-backed Q&A, audio podcasts, video generation, multi-account rotation.',
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Windows, macOS, Linux',
            url: `${SITE_URL}/`,
            downloadUrl: 'https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp',
            codeRepository: 'https://github.com/roomi-fields/notebooklm-mcp',
            publisher: { '@id': 'https://roomi-fields.com/#organization' },
            author: {
              '@type': 'Person',
              name: 'Romain Peyrichou',
              url: 'https://github.com/roomi-fields',
            },
            license: 'https://opensource.org/licenses/MIT',
            softwareVersion: '4.6.0',
            datePublished: PUBLISHED,
            dateModified: MODIFIED,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
        ],
      }),
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/roomi-fields/notebooklm-mcp/tree/main/website/',
          // A visible, per-page date read from git. An engine ranking two
          // sources on freshness has nothing to go on without one.
          showLastUpdateTime: true,
        },
        blog: {
          routeBasePath: '/blog',
          blogTitle: 'NotebookLM automation notes',
          blogDescription:
            'Field notes on automating Google NotebookLM: what the API can and cannot do, quota behaviour, citations, batching, and running an MCP server safely.',
          postsPerPage: 10,
          showReadingTime: true,
          blogSidebarTitle: 'All posts',
          blogSidebarCount: 'ALL',
          onUntruncatedBlogPosts: 'throw',
          feedOptions: {
            type: 'all',
            title: 'NotebookLM automation notes',
            copyright: `MIT — roomi-fields`,
          },
        },
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
    docs: {
      sidebar: { hideable: true },
      versionPersistence: 'localStorage',
    },
    metadata: [
      {
        name: 'keywords',
        content:
          'notebooklm, gemini notebook, gemini notebook api, google notebook, mcp, mcp-server, utcp, claude-code, codex, cursor, gemini, google-notebooklm, http-api, rest-api, n8n, zapier, make, anthropic, playwright, citations, ai-agent',
      },
      {
        name: 'description',
        content:
          'Google Gemini Notebook (formerly NotebookLM) over MCP, a local HTTP REST API, and a UTCP manual. Q&A with citations, audio, video, content generation, multi-account rotation. Works with Claude Code, Codex, Cursor, n8n, Zapier, Make.',
      },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'NotebookLM MCP + HTTP REST API' },
      { name: 'twitter:card', content: 'summary_large_image' },
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
          to: '/blog',
          label: 'Blog',
          position: 'left',
        },
        {
          to: '/changelog',
          label: 'Releases',
          position: 'left',
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
            { label: 'Install', to: '/install' },
            { label: 'Configuration', to: '/CONFIGURATION' },
            { label: 'REST API', to: '/notebooklm-rest-api' },
            { label: 'Run 1 000 questions', to: '/batch-1000-questions' },
            { label: 'Troubleshooting', to: '/TROUBLESHOOTING' },
          ],
        },
        {
          title: 'Integrations',
          items: [
            { label: 'n8n', to: '/notebooklm-n8n' },
            { label: 'Docker', to: '/DOCKER' },
            { label: 'WSL', to: '/WSL-USAGE' },
            { label: 'Multi-account', to: '/notebooklm-multi-account' },
          ],
        },
        {
          title: 'Compare',
          items: [{ label: 'vs PleasePrompto v2', to: '/compare' }],
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
