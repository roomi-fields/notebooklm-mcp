#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    mode: 'basic',
    baseUrl: process.env.NOTEBOOKLM_MCP_BASE_URL || 'http://127.0.0.1:3000',
    notebookUrl: process.env.NOTEBOOK_URL || '',
    timeoutMs: 15000,
    question:
      'What is the main topic covered by this notebook? Answer in one sentence.',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--basic':
        args.mode = 'basic';
        break;
      case '--http':
        args.mode = 'http';
        break;
      case '--base-url':
        args.baseUrl = argv[++i] || args.baseUrl;
        break;
      case '--notebook-url':
        args.notebookUrl = argv[++i] || '';
        break;
      case '--timeout-ms':
        args.timeoutMs = Number(argv[++i] || args.timeoutMs);
        break;
      case '--question':
        args.question = argv[++i] || args.question;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith('--base-url=')) {
          args.baseUrl = arg.split('=', 2)[1];
        } else if (arg.startsWith('--notebook-url=')) {
          args.notebookUrl = arg.split('=', 2)[1];
        } else if (arg.startsWith('--timeout-ms=')) {
          args.timeoutMs = Number(arg.split('=', 2)[1]);
        } else if (arg.startsWith('--question=')) {
          args.question = arg.split('=', 2)[1];
        } else {
          throw new Error(`Unknown argument: ${arg}`);
        }
    }
  }

  return args;
}

function printHelp() {
  console.log(`NotebookLM MCP doctor

Usage:
  node scripts/doctor.mjs --basic
  node scripts/doctor.mjs --http
  node scripts/doctor.mjs --http --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"

Options:
  --basic               Run repo and build checks only.
  --http                Also verify the local HTTP server.
  --base-url <url>      Override HTTP base URL (default: http://127.0.0.1:3000).
  --notebook-url <url>  Optional NotebookLM URL for /content and /ask checks.
  --timeout-ms <ms>     Per-request timeout in milliseconds.
  --question <text>     Custom ask prompt for the /ask verification step.
`);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function warn(message) {
  console.log(`[WARN] ${message}`);
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
}

function loadPackageJson() {
  const packagePath = join(repoRoot, 'package.json');
  if (!existsSync(packagePath)) {
    throw new Error(`package.json not found at ${packagePath}`);
  }

  return JSON.parse(readFileSync(packagePath, 'utf8'));
}

function getMinNodeMajor(range) {
  const match = String(range || '').match(/(\d+)/);
  return match ? Number(match[1]) : 18;
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let hasFailure = false;

  const packageJson = loadPackageJson();
  const requiredNode = getMinNodeMajor(packageJson.engines?.node);
  const currentNode = Number(process.versions.node.split('.')[0]);

  if (currentNode < requiredNode) {
    fail(`Node.js ${process.versions.node} is too old. Required: >=${requiredNode}`);
    hasFailure = true;
  } else {
    pass(`Node.js ${process.versions.node} satisfies engines.node (${packageJson.engines?.node})`);
  }

  const requiredPaths = [
    ['package.json', join(repoRoot, 'package.json')],
    ['README.md', join(repoRoot, 'README.md')],
    ['dist/index.js', join(repoRoot, 'dist', 'index.js')],
    ['dist/http-wrapper.js', join(repoRoot, 'dist', 'http-wrapper.js')],
  ];

  for (const [label, filePath] of requiredPaths) {
    if (existsSync(filePath)) {
      pass(`Found ${label}`);
    } else {
      fail(`Missing ${label} at ${filePath}`);
      hasFailure = true;
    }
  }

  if (args.mode !== 'http') {
    if (hasFailure) {
      process.exit(1);
    }
    pass('Basic verification completed.');
    return;
  }

  const health = await fetchJson(`${args.baseUrl}/health`, {}, args.timeoutMs).catch((error) => {
    fail(`Could not reach ${args.baseUrl}/health: ${error.message}`);
    hasFailure = true;
    return null;
  });

  if (!health) {
    process.exit(1);
  }

  if (!health.ok || !health.data?.success) {
    fail(`/health failed with status ${health.status}`);
    hasFailure = true;
  } else {
    pass(`/health succeeded (authenticated=${health.data?.data?.authenticated === true})`);
  }

  if (!args.notebookUrl) {
    warn('No notebook URL provided. Skipping /content and /ask checks.');
    process.exit(hasFailure ? 1 : 0);
  }

  const encodedNotebookUrl = encodeURIComponent(args.notebookUrl);
  const content = await fetchJson(
    `${args.baseUrl}/content?notebook_url=${encodedNotebookUrl}`,
    {},
    Math.max(args.timeoutMs, 30000)
  ).catch((error) => {
    fail(`/content request failed: ${error.message}`);
    hasFailure = true;
    return null;
  });

  if (content) {
    if (!content.ok || !content.data?.success) {
      fail(`/content failed with status ${content.status}`);
      hasFailure = true;
    } else {
      const sourceCount = content.data?.data?.sourceCount;
      pass(`/content succeeded${typeof sourceCount === 'number' ? ` (sourceCount=${sourceCount})` : ''}`);
    }
  }

  const askPayload = {
    question: args.question,
    notebook_url: args.notebookUrl,
    session_id: `doctor-${Date.now()}`,
    source_format: 'none',
  };

  const ask = await fetchJson(
    `${args.baseUrl}/ask`,
    {
      method: 'POST',
      body: JSON.stringify(askPayload),
    },
    Math.max(args.timeoutMs, 120000)
  ).catch((error) => {
    fail(`/ask request failed: ${error.message}`);
    hasFailure = true;
    return null;
  });

  if (ask) {
    if (!ask.ok || !ask.data?.success) {
      fail(`/ask failed with status ${ask.status}`);
      hasFailure = true;
    } else {
      const answer = ask.data?.data?.answer || '';
      pass(`/ask succeeded (${answer.length} chars returned)`);
    }
  }

  if (hasFailure) {
    process.exit(1);
  }

  pass('HTTP verification completed.');
}

main().catch((error) => {
  fail(error.message);
  process.exit(1);
});
