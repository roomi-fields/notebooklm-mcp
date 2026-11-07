#!/usr/bin/env node
/**
 * Sync the version from package.json to every other file that ships it:
 *   - .claude-plugin/plugin.json   (Claude Code plugin manifest)
 *   - website/docusaurus.config.ts (schema.org softwareVersion)
 *   - README.md                    (hero "v1.x.x — ..." line)
 *   - server.json                  (MCP Registry manifest, two fields)
 *   - deployment/docs/openapi.yaml (REST spec info.version)
 *   - website/static/llms.txt      (the AI-facing entry point)
 *   - ROADMAP.md                   ("## Current Version" header)
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

/**
 * Each transform takes the version to write, so the driver can run it twice:
 * once for real, once with a sentinel. A rule that changes nothing either way
 * matched nothing at all, which is a broken rule rather than a file in step.
 *
 * @type {Array<{path: string, label: string, transform: (s: string, v: string) => string}>}
 */
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
    transform: (s, v) =>
      s
        .replace(/^(\s*"version":\s*)"\d+\.\d+\.\d+"/m, `$1"${v}"`)
        .replace(
          /"@roomi-fields\/notebooklm-mcp(?:@\d+\.\d+\.\d+)?"/,
          `"@roomi-fields/notebooklm-mcp@${v}"`
        ),
  },
  {
    path: 'website/docusaurus.config.ts',
    label: 'docusaurus softwareVersion',
    transform: (s, v) => s.replace(/softwareVersion:\s*'[^']+'/, `softwareVersion: '${v}'`),
  },
  {
    path: 'README.md',
    label: 'README hero version',
    transform: (s, v) => s.replace(/(>\s*v)\d+\.\d+\.\d+(\s+—)/, `$1${v}$2`),
  },
  {
    path: 'server.json',
    label: 'MCP Registry server manifest',
    // Two "version" fields (top-level + the npm package entry) must both track
    // package.json, or the published registry entry drifts (it sat at 1.5.9
    // while the package shipped 3.0.0). Global replace hits both; the "$schema"
    // URL has no "version" key so it is untouched.
    transform: (s, v) => s.replace(/("version":\s*)"\d+\.\d+\.\d+"/g, `$1"${v}"`),
  },
  {
    path: 'website/static/llms.txt',
    label: 'llms.txt version line',
    // The one file written for AI answer engines, and the one that had
    // drifted furthest: it still announced 1.5.9 and "33 endpoints" while
    // the package shipped 4.1.0 with 45 — so engines quoting us repeated a
    // version six releases old. Nothing else was syncing it.
    transform: (s, v) => s.replace(/(current version )\d+\.\d+\.\d+/, `$1${v}`),
  },
  {
    path: 'website/static/.well-known/ai-catalog.json',
    label: 'AI catalog entry version',
    // The catalog states the server's version itself, and the AI Catalog spec
    // makes a present entry version authoritative for latest-selection — a
    // stale one there is a publishing error that breaks exactly the discovery
    // the file exists for.
    transform: (s, v) => s.replace(/("version":\s*)"\d+\.\d+\.\d+"/g, `$1"${v}"`),
  },
  {
    path: 'deployment/docs/openapi.yaml',
    label: 'OpenAPI info.version',
    // The published REST spec carries its own version and had drifted to
    // 1.5.9 while the package shipped 3.0.x — consumers generating a client
    // from it were told they were on a two-major-versions-old API.
    transform: (s, v) => s.replace(/(^info:\n(?:.*\n)*?  version:\s*)\d+\.\d+\.\d+/m, `$1${v}`),
  },
  {
    path: 'crates/notebooklm-client/Cargo.toml',
    label: 'Rust client crate',
    // The crate tracks the server version on purpose: it is a client for one
    // API, and a reader comparing the two should not have to map between two
    // numbering schemes. Only the package's own version is rewritten — a
    // dependency's `version = "1"` sits under a different key.
    transform: (s, v) => s.replace(/(\[package\][\s\S]*?\nversion = )"\d+\.\d+\.\d+"/, `$1"${v}"`),
  },
  {
    path: 'crates/notebooklm-client/README.md',
    label: 'Rust crate README dependency line',
    // What the README tells people to put in their Cargo.toml. A minor pin,
    // because that is what semver-compatible means for a caller.
    transform: (s, v) =>
      s.replace(/notebooklm = "\d+\.\d+"/, `notebooklm = "${v.split('.').slice(0, 2).join('.')}"`),
  },
  {
    path: 'gems/notebooklm/lib/notebooklm/version.rb',
    label: 'Ruby gem version',
    // The gem tracks the server version for the same reason the crate does:
    // it is a client for one API, and a reader comparing the two should not
    // have to map between two numbering schemes.
    transform: (s, v) => s.replace(/(VERSION = ')\d+\.\d+\.\d+'/, `$1${v}'`),
  },
  {
    path: 'gems/notebooklm/README.md',
    label: 'Ruby gem README dependency line',
    // What the README tells people to put in their Gemfile. A minor pin,
    // because that is what semver-compatible means for a caller.
    transform: (s, v) =>
      s.replace(
        /gem 'notebooklm', '~> \d+\.\d+'/,
        `gem 'notebooklm', '~> ${v.split('.').slice(0, 2).join('.')}'`
      ),
  },
  {
    path: 'nodes/n8n-nodes-gemini-notebook/package.json',
    label: 'n8n community node',
    // The node tracks the server version for the same reason the crate and the
    // gem do: it is a client for one API.
    transform: (s, v) => s.replace(/("version":\s*)"\d+\.\d+\.\d+"/, `$1"${v}"`),
  },
  {
    path: 'ROADMAP.md',
    label: 'ROADMAP current version',
    // The "## Current Version" header drifted to 1.5.4 while the package shipped
    // 3.0.x. Kept in lockstep here (and enforced by version:check in CI).
    transform: (s, v) => s.replace(/(## Current Version:\s*v)\d+\.\d+\.\d+/, `$1${v}`),
  },
];

/**
 * A version this file could never legitimately hold, used to ask a rule "would
 * you change anything at all?" without caring what it would change it to.
 */
const SENTINEL = '0.0.0';

let drifted = 0;
let broken = 0;
for (const target of targets) {
  const fullPath = join(ROOT, target.path);
  const raw = readFileSync(fullPath, 'utf-8');
  // Match against LF text and restore the file's own endings on write. A CRLF
  // working copy silently defeated the `^info:\n` anchor in the OpenAPI rule,
  // which then changed nothing and was reported as "already current" — a green
  // tick for a rule that had stopped running. CI, on an LF checkout, caught the
  // drift the local run had just blessed.
  const crlf = raw.includes('\r\n');
  const original = crlf ? raw.replace(/\r\n/g, '\n') : raw;
  const updated = target.transform(original, VERSION);

  // Distinguish "already correct" from "matched nothing": a rule that is also
  // inert against a version the file cannot be holding is a rule that no
  // longer finds its target — reindented, renamed, or anchored on the wrong
  // line ending. Reporting that as in step is how a stale version ships.
  if (target.transform(original, SENTINEL) === original) {
    broken++;
    console.error(
      `✗ ${target.path} (${target.label}): the rule matched nothing — ` +
        `the file moved out from under it, or its anchor is wrong`
    );
    continue;
  }

  if (original === updated) {
    console.log(`✓ ${target.path} already at ${VERSION} (${target.label})`);
    continue;
  }

  drifted++;
  if (checkOnly) {
    console.error(`✗ DRIFT in ${target.path} (${target.label})`);
  } else {
    writeFileSync(fullPath, crlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf-8');
    console.log(`→ ${target.path} synced to ${VERSION} (${target.label})`);
  }
}

if (broken > 0) {
  console.error(`\n${broken} rule(s) in this script no longer match their file. Fix the rule.`);
  process.exit(1);
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
