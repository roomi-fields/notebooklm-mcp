#!/usr/bin/env node
/**
 * Sync the version from package.json to every other file that ships it:
 *   - .claude-plugin/plugin.json   (Claude Code plugin manifest)
 *   - website/docusaurus.config.ts (schema.org softwareVersion)
 *   - README.md                    (hero "v1.x.x — ..." line)
 *
 * Usage:
 *   node scripts/sync-version.mjs           # rewrite drifted files in place
 *   node scripts/sync-version.mjs --check   # exit 1 if anything would change (CI guard)
 *
 * Run after bumping package.json. The CI release workflow runs --check so a
 * release can never ship with a stale plugin manifest or website badge.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const VERSION = pkg.version;
if (!VERSION) {
  console.error('package.json has no version field');
  process.exit(2);
}

/** @type {Array<{path: string, label: string, transform: (s: string) => string}>} */
const targets = [
  {
    path: '.claude-plugin/plugin.json',
    label: 'plugin manifest',
    // Regex replace (not reparse+reserialize) so prettier-controlled
    // formatting decisions (e.g. keywords array on one line vs many) are
    // preserved between releases and don't trigger phantom drift.
    //
    // We rewrite TWO things in this file:
    //   1. The top-level "version" field — what /plugin Discover shows.
    //   2. The npx version pin in mcpServers.notebooklm.args — what the MCP
    //      runtime actually downloads. Pinning is required because npx -y
    //      without a version reuses the _npx/<hash>/ cache and ignores newly
    //      published releases until the cache is manually purged. By pinning
    //      to the same version /plugin update just installed, we force npx
    //      to fetch (or use the matching cache) for that exact version.
    transform: (s) =>
      s
        .replace(/^(\s*"version":\s*)"\d+\.\d+\.\d+"/m, `$1"${VERSION}"`)
        .replace(
          /"@roomi-fields\/notebooklm-mcp(?:@\d+\.\d+\.\d+)?"/,
          `"@roomi-fields/notebooklm-mcp@${VERSION}"`
        ),
  },
  {
    path: 'website/docusaurus.config.ts',
    label: 'docusaurus softwareVersion',
    transform: (s) =>
      s.replace(
        /softwareVersion:\s*'[^']+'/,
        `softwareVersion: '${VERSION}'`
      ),
  },
  {
    path: 'README.md',
    label: 'README hero version',
    transform: (s) =>
      s.replace(/(>\s*v)\d+\.\d+\.\d+(\s+—)/, `$1${VERSION}$2`),
  },
];

let drifted = 0;
for (const target of targets) {
  const fullPath = join(ROOT, target.path);
  const original = readFileSync(fullPath, 'utf-8');
  const updated = target.transform(original);

  if (original === updated) {
    console.log(`✓ ${target.path} already at ${VERSION} (${target.label})`);
    continue;
  }

  drifted++;
  if (checkOnly) {
    console.error(`✗ DRIFT in ${target.path} (${target.label})`);
  } else {
    writeFileSync(fullPath, updated, 'utf-8');
    console.log(`→ ${target.path} synced to ${VERSION} (${target.label})`);
  }
}

if (checkOnly && drifted > 0) {
  console.error(
    `\n${drifted} file(s) out of sync with package.json@${VERSION}. ` +
      `Run "npm run version:sync" locally and commit.`
  );
  process.exit(1);
}

if (!checkOnly) {
  console.log(
    drifted === 0
      ? `\nAll files already at ${VERSION}.`
      : `\nSynced ${drifted} file(s) to ${VERSION}.`
  );
}
