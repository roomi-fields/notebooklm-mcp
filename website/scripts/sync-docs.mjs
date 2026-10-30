#!/usr/bin/env node

/**
 * Sync source-of-truth docs into website/docs/ with Docusaurus frontmatter.
 *
 * Source:  repo root CHANGELOG.md + deployment/docs/*.md
 * Target:  website/docs/*.md (regenerated on every build, gitignored)
 *
 * This keeps a single source of truth for the raw docs and lets us apply
 * SEO-tuned frontmatter per page without polluting the raw files shipped
 * to the npm consumers of the package.
 */

import { execFileSync } from 'node:child_process';

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(__dirname, '..');
const repoRoot = resolve(websiteRoot, '..');
const sourceDir = resolve(repoRoot, 'deployment', 'docs');
const targetDir = resolve(websiteRoot, 'docs');

/**
 * What each page *is*, for the machines.
 *
 * Every page used to carry the same site-wide block saying "this is a piece of
 * software", which is true of the project and false of the page. An engine
 * comparing that block to the visible text found 27% overlap and treated the
 * page as incoherent. A page that declares itself a procedure is the one an
 * engine reaches for when someone asks how to do something.
 *
 *   HowTo    — a procedure the reader follows, steps taken from its H2s
 *   FAQPage  — problems and their answers, pairs taken from its H3s
 *   TechArticle (default) — reference and explanation
 */
const SCHEMA_TYPE = {
  '01-INSTALL.md': 'HowTo',
  '08-DOCKER.md': 'HowTo',
  '08-WSL-USAGE.md': 'HowTo',
  '04-N8N-INTEGRATION.md': 'HowTo',
  '05-TROUBLESHOOTING.md': 'FAQPage',
};

// Per-file frontmatter. Keys are the filenames in deployment/docs/.
// For any file not listed here, the sync still copies but without frontmatter.
const FRONTMATTER = {
  'README.md': {
    title: 'Overview — NotebookLM MCP + HTTP REST API',
    description:
      'Google NotebookLM over MCP plus a local HTTP REST API. Citation-backed Q&A, audio, video, content generation, multi-account rotation. Claude Code, Codex, Cursor, n8n, Zapier, Make.',
    keywords: [
      'notebooklm',
      'mcp',
      'mcp-server',
      'claude-code',
      'codex',
      'cursor',
      'gemini',
      'google-notebooklm',
      'http-api',
      'rest-api',
      'n8n',
      'zapier',
      'make',
      'anthropic',
      'citations',
      'ai-agent',
    ],
    slug: '/',
    sidebar_position: 1,
  },
  '01-INSTALL.md': {
    title: 'Install NotebookLM MCP + REST API on Windows, macOS, Linux, WSL',
    description:
      'Install the NotebookLM MCP server and REST API. Clone, npm install, build, authenticate Google, register with Claude Code, Codex, Cursor, or run as a local HTTP REST API for n8n / Zapier / Make.',
    keywords: [
      'notebooklm mcp install',
      'install notebooklm rest api',
      'notebooklm mcp setup',
      'claude code mcp install',
      'notebooklm installation windows',
      'notebooklm wsl',
      'notebooklm cli install',
    ],
    slug: '/install',
  },
  '02-CONFIGURATION.md': {
    title: 'Configure NotebookLM MCP — env vars, headless, stealth, locale',
    description:
      'Full configuration reference. Environment variables for headless mode, stealth, UI locale, data directory, session timeout, max sessions. Persistent auth layout and security notes.',
    keywords: [
      'notebooklm mcp config',
      'notebooklm environment variables',
      'notebooklm headless',
      'notebooklm locale',
      'patchright stealth',
    ],
  },
  '03-API.md': {
    title: 'NotebookLM REST API reference — 54 HTTP endpoints',
    description:
      'HTTP REST API reference for NotebookLM, 54 endpoints: /ask, /content, /notebooks, /sources, /labels, /share, /health, /setup-auth. Request and response schemas, ready for n8n / Zapier / Make / curl.',
    keywords: [
      'notebooklm rest api',
      'notebooklm http api',
      'notebooklm api endpoints',
      'notebooklm ask endpoint',
      'notebooklm content api',
      'notebooklm api reference',
      'notebooklm openapi',
    ],
    slug: '/notebooklm-rest-api',
  },
  '04-N8N-INTEGRATION.md': {
    title: 'NotebookLM in n8n — HTTP workflows with citations',
    description:
      'Integrate NotebookLM into n8n workflows via the HTTP REST API. Webhook examples, scheduled queries, Slack integration, content generation flows, citation-backed responses. Works the same way for Zapier and Make.',
    keywords: [
      'notebooklm n8n',
      'n8n notebooklm integration',
      'n8n http request notebooklm',
      'notebooklm workflow automation',
      'zapier notebooklm',
      'make.com notebooklm',
      'notebooklm webhook',
    ],
    slug: '/notebooklm-n8n',
  },
  '05-TROUBLESHOOTING.md': {
    title: 'Troubleshooting — doctor scripts, common failures and fixes',
    description:
      'Common failure signatures and fixes for the NotebookLM MCP server. Doctor script, port conflicts, authentication loops, rate limits, browser profile locks, session expiry.',
    keywords: [
      'notebooklm troubleshooting',
      'notebooklm mcp errors',
      'notebooklm authentication failed',
      'notebooklm rate limit',
      'notebooklm doctor script',
    ],
  },
  '06-NOTEBOOK-LIBRARY.md': {
    title: 'Notebook library — save, search, activate, auto-discover',
    description:
      'Manage a persistent library of NotebookLM notebooks. Add by URL, search by name or topics, set an active notebook, share across Codex and Claude Code via cross-client sharing.',
    keywords: [
      'notebooklm library',
      'notebooklm notebook manager',
      'notebooklm search',
      'notebooklm cross-client',
    ],
  },
  '07-AUTO-DISCOVERY.md': {
    title: 'Auto-discover NotebookLM notebook metadata from a URL',
    description:
      'Use the auto_discover_notebook tool or /notebooks/auto-discover endpoint to extract notebook name, description, topics, and use cases from just a NotebookLM URL.',
    keywords: [
      'notebooklm auto discovery',
      'notebooklm metadata extraction',
      'auto_discover_notebook',
      'claude desktop auto discovery',
    ],
  },
  '08-DOCKER.md': {
    title: 'Deploy NotebookLM MCP with Docker and noVNC',
    description:
      'Dockerfile and docker-compose setup for the NotebookLM MCP server. Build from source, visual authentication via noVNC, Synology and QNAP NAS deployment patterns.',
    keywords: [
      'notebooklm docker',
      'notebooklm mcp container',
      'notebooklm novnc',
      'notebooklm synology',
      'notebooklm nas',
    ],
  },
  '08-WSL-USAGE.md': {
    title: 'Use NotebookLM MCP from WSL on Windows',
    description:
      'WSL workflow for the NotebookLM MCP server. Run the server on the Windows side, call it from WSL via a helper, manage the Chrome profile across WSL and Windows.',
    keywords: ['notebooklm wsl', 'notebooklm windows subsystem linux', 'notebooklm mcp wsl setup'],
  },
  '09-MULTI-INTERFACE.md': {
    title: 'Run NotebookLM MCP + HTTP server simultaneously',
    description:
      'Use NotebookLM as an MCP stdio server for Claude Code AND as a local HTTP REST API for n8n, Zapier, curl, at the same time. Stdio-to-HTTP proxy pattern, no profile conflicts.',
    keywords: [
      'notebooklm mcp http',
      'notebooklm stdio http proxy',
      'notebooklm claude desktop',
      'notebooklm multi interface',
    ],
  },
  '10-CONTENT-MANAGEMENT.md': {
    title: 'Generate audio, video, infographics, reports from NotebookLM',
    description:
      'Generate NotebookLM Studio outputs — audio podcasts, video brief and explainer, infographics, reports, presentations, data tables — programmatically via MCP or HTTP API.',
    keywords: [
      'notebooklm audio',
      'notebooklm video',
      'notebooklm podcast api',
      'notebooklm infographic',
      'notebooklm studio api',
      'notebooklm content generation',
    ],
  },
  '11-MULTI-ACCOUNT.md': {
    title: 'NotebookLM multi-account rotation with TOTP auto-reauth',
    description:
      'Configure multiple Google accounts for NotebookLM. Automatic rotation on rate-limit detection, TOTP (2FA) auto-reauth, AES-256-GCM encrypted credential vault, per-account profile storage.',
    keywords: [
      'notebooklm multi account',
      'notebooklm account rotation',
      'notebooklm rate limit',
      'notebooklm totp',
      'notebooklm 2fa automation',
      'notebooklm auto reauth',
      'google account rotation',
    ],
    slug: '/notebooklm-multi-account',
  },
  '12-BATCH-1000.md': {
    title: 'Run 1 000 NotebookLM questions overnight — REST API batch pattern',
    description:
      'Production pattern for running 1 000+ citation-backed Q&A queries against Google NotebookLM through a local HTTP REST API. Resilient batches, auto-reauth, multi-account rotation, JSON citation export, restart-safe progress, throttling.',
    keywords: [
      'notebooklm batch processing',
      'notebooklm rest api',
      'notebooklm 1000 questions',
      'automate notebooklm',
      'notebooklm overnight automation',
      'notebooklm research workflow',
      'notebooklm thesis automation',
      'notebooklm bulk queries',
    ],
    slug: '/batch-1000-questions',
  },
  '14-RTFM-INTEGRATION.md': {
    title: 'NotebookLM + RTFM — cache batch outputs as a searchable markdown vault',
    description:
      'Pipeline pattern for academic research and competitive intelligence: use NotebookLM as a one-shot ingestion layer, RTFM as the retrieval layer. /batch-to-vault endpoint, nblm-answer-v1 JSON schema, RTFM index integration, offline unlimited queries.',
    keywords: [
      'notebooklm rtfm',
      'notebooklm cache',
      'notebooklm vault',
      'notebooklm markdown',
      'notebooklm offline',
      'notebooklm retrieval layer',
      'notebooklm rate limit workaround',
      'notebooklm sota workflow',
      'notebooklm research pipeline',
      'rtfm notebooklm integration',
    ],
    slug: '/notebooklm-rtfm',
  },
  '13-COMPARE.md': {
    title: 'Migrating from PleasePrompto/notebooklm-mcp (archived) — tool mapping and comparison',
    description:
      'PleasePrompto/notebooklm-mcp was archived in September 2026. How to migrate: 17 of its 19 tool names work unchanged, the environment variables that differ, the one variable that means something else here, and a full feature comparison.',
    keywords: [
      'pleaseprompto notebooklm-mcp archived',
      'notebooklm-mcp unmaintained',
      'notebooklm-mcp alternative',
      'migrate from notebooklm-mcp',
      'notebooklm mcp replacement',
      'notebooklm mcp comparison',
      'notebooklm rest api alternative',
      'notebooklm studio api',
    ],
    // Slug kept as /compare: the page changed purpose, but the URL has been
    // live for months and carries whatever ranking it has earned. Title,
    // description and keywords do the targeting; the path string does not.
    slug: '/compare',
  },
  '15-SECURITY.md': {
    title: 'Securing the NotebookLM HTTP API — token, bind address, allowed origins',
    description:
      'Secure the NotebookLM REST API: loopback by default, NOTEBOOKLM_API_KEY required to expose it, NOTEBOOKLM_ALLOWED_ORIGINS for browser clients, Docker requirements, and how to report a vulnerability.',
    keywords: [
      'notebooklm mcp security',
      'notebooklm api token',
      'mcp server authentication',
      'notebooklm rest api auth',
      'mcp server exposed port',
      'notebooklm api key',
    ],
    slug: '/security',
  },
};

/**
 * The generated pages are gitignored, so Docusaurus finds no history for them
 * and renders no date at all. An answer engine choosing between two sources
 * ranks on freshness, so a page with no date loses to one that has one.
 *
 * Carry the date of the last commit that touched the *source* file instead,
 * which is the date the page's content actually changed.
 */
function lastCommitDate(file) {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim();
    if (iso) return iso;
  } catch {
    // no git, or a shallow clone with no commit touching this file
  }
  return null;
}

const ORGANIZATION_ID = 'https://roomi-fields.com/#organization';
const WEBSITE_ID = 'https://notebooklm.roomi-fields.com/#website';
const SOFTWARE_ID = 'https://notebooklm.roomi-fields.com/#software';

/** Strip markdown decoration from a heading so the schema carries plain text. */
function plainText(markdown) {
  return markdown
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Headings of one level, in document order, skipping fenced code blocks.
 * Each carries the H2 it sits under, so a caller can tell a troubleshooting
 * entry from the navigation that happens to use the same heading level.
 */
function headings(body, level) {
  const marker = '#'.repeat(level);
  const out = [];
  let fenced = false;
  let section = '';
  body.split('\n').forEach((line, index) => {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced) return;
    if (line.startsWith('## ')) section = plainText(line.slice(2));
    if (line.startsWith(`${marker} `)) {
      out.push({ text: plainText(line.slice(marker.length)), index, section });
    }
  });
  return out;
}

/**
 * The prose under a heading, used as an FAQ answer.
 *
 * Code blocks are skipped and blank lines are not an end: a troubleshooting
 * entry opens with the symptom, shows the error, and only then gives the fix,
 * so stopping at the first paragraph returns the symptom and calls it the
 * answer. Everything down to the next heading is the answer.
 */
function paragraphAfter(body, index) {
  const lines = body.split('\n');
  const collected = [];
  let fenced = false;
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (line.startsWith('#')) break;
    if (!line.trim()) continue;
    collected.push(line.replace(/^[-*]\s+/, '').trim());
    if (collected.join(' ').length > 600) break;
  }
  const text = plainText(collected.join(' '));
  return text.length >= 30 ? text.slice(0, 500) : null;
}

/** Headings that organise a page without being a step in it. */
const NOT_A_STEP =
  /^(table of contents|contents|next steps|see also|related|overview|summary|further reading|resources|changelog)$/i;

/**
 * Build the page's own structured data. Returns null when the page has nothing
 * truthful to say — an empty FAQ is worse than no FAQ.
 */
function buildSchema(file, body, meta, modified) {
  const type = SCHEMA_TYPE[file] ?? 'TechArticle';
  const name = meta.title ?? plainText(headings(body, 1)[0]?.text ?? '');
  if (!name) return null;

  const common = {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description: meta.description,
    inLanguage: 'en',
    datePublished: '2025-11-22',
    dateModified: modified ? modified.slice(0, 10) : undefined,
    publisher: { '@id': ORGANIZATION_ID },
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': SOFTWARE_ID },
  };

  if (type === 'HowTo') {
    const steps = headings(body, 2)
      .map((h) => h.text)
      .filter((text) => text && !NOT_A_STEP.test(text))
      .map((text, i) => ({ '@type': 'HowToStep', position: i + 1, name: text }));
    if (steps.length < 2) return { ...common, '@type': 'TechArticle' };
    return { ...common, step: steps };
  }

  if (type === 'FAQPage') {
    // Only the entries the document itself files under a "Problems" heading.
    // The rest of its H3s are navigation, and a question that is not a
    // question is worse structured data than none.
    const pairs = headings(body, 3)
      .filter((h) => /problem|issue|error/i.test(h.section))
      .map((h) => ({ question: h.text, answer: paragraphAfter(body, h.index) }))
      .filter((p) => p.question && p.answer)
      .map((p) => ({
        '@type': 'Question',
        name: p.question,
        acceptedAnswer: { '@type': 'Answer', text: p.answer },
      }));
    if (pairs.length < 3) return { ...common, '@type': 'TechArticle' };
    return { ...common, mainEntity: pairs };
  }

  return common;
}

function renderFrontmatter(meta) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => JSON.stringify(v)).join(', ')}]`);
    } else if (typeof value === 'string') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (value && typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) lines.push(`  ${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

// Ensure target exists — website/docs/ is gitignored, so on a fresh
// CI checkout the directory may not exist yet.
mkdirSync(targetDir, { recursive: true });

/**
 * Per-page structured data, keyed by document id.
 *
 * It travels in its own file rather than in each page's frontmatter: a JSON
 * string carried through YAML and MDX comes out the other end corrupted, and
 * a page whose schema will not parse silently renders none at all.
 */
const schemas = {};

// Sync deployment/docs/*.md → website/docs/
for (const file of readdirSync(sourceDir)) {
  if (!file.endsWith('.md')) continue;
  const src = resolve(sourceDir, file);
  const dst = resolve(targetDir, file);
  const body = readFileSync(src, 'utf-8');
  const meta = { ...(FRONTMATTER[file] ?? {}) };
  const date = lastCommitDate(src);
  if (date) meta.last_update = { date };
  const schema = buildSchema(file, body, meta, date);
  // Docusaurus drops the numeric ordering prefix when it builds the document
  // id, so key the map the way the renderer will ask for it.
  if (schema) schemas[file.replace(/^\d+-/, '').replace(/\.md$/, '')] = schema;
  const fm = Object.keys(meta).length ? renderFrontmatter(meta) : '';
  writeFileSync(dst, fm + body, 'utf-8');
  console.log(`  ${file}`);
}

// Sync root CHANGELOG.md → website/docs/CHANGELOG.md
{
  const changelogSrc = resolve(repoRoot, 'CHANGELOG.md');
  const changelogDst = resolve(targetDir, 'CHANGELOG.md');
  const changelogDate = lastCommitDate(changelogSrc);
  const fm = renderFrontmatter({
    title: 'Release history and per-version changelog',
    description:
      'Detailed per-version changelog for the NotebookLM MCP + HTTP REST API server. Added, changed, fixed, and security notes for every release since 1.0.0.',
    keywords: ['notebooklm mcp changelog', 'notebooklm release history', 'notebooklm mcp versions'],
    sidebar_position: 99,
    slug: '/changelog',
    ...(changelogDate ? { last_update: { date: changelogDate } } : {}),
  });
  let body = readFileSync(changelogSrc, 'utf-8');
  body = body.replace(/^#\s+Changelog\s*\n+/, '');
  writeFileSync(changelogDst, fm + body, 'utf-8');
  console.log('  CHANGELOG.md');
}

writeFileSync(
  resolve(websiteRoot, 'src', 'page-schemas.json'),
  `${JSON.stringify(schemas, null, 2)}\n`,
  'utf-8'
);
console.log(`  page-schemas.json (${Object.keys(schemas).length} pages)`);

console.log('Docs sync complete.');
