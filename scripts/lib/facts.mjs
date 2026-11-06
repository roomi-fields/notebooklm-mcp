/**
 * The countable claims, derived from the code rather than from prose.
 *
 * Shared by `sync-facts.mjs` (rewrites the claims in this repo) and
 * `check-skill-sync.mjs` (verifies the standalone skill repo repeats the same
 * numbers). Deriving them twice is how they drifted in the first place.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

const routeLine = /^app\.(get|post|put|delete|patch)\('([^']+)'/gm;

export function routes() {
  const found = [];
  const src = read('src/http-wrapper.ts');
  for (const m of src.matchAll(routeLine)) found.push(`${m[1].toUpperCase()} ${m[2]}`);
  return [...new Set(found)].sort();
}

export function toolNames() {
  const src = read('src/tools/index.ts');
  return [...new Set([...src.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1]))].sort();
}

export function nodeFloor() {
  const pkg = JSON.parse(read('package.json'));
  const match = /(\d+)/.exec(pkg.engines?.node ?? '');
  if (!match) throw new Error('package.json has no engines.node to read');
  return match[1];
}

export const ENDPOINTS = routes().length;
export const TOOLS = toolNames().length;
export const NODE = nodeFloor();

// --------------------------------------------------------- the release list

/**
 * The newest releases, read out of the changelog's own headings.
 *
 * A category heading ("Fixed", "Security"…) is not a headline, so those are
 * dropped; a release left with none is listed by version alone rather than
 * silently omitted.
 */
const SHOWN = 10;
const HEADLINES = 2;
const CATEGORY = /^(Fixed|Added|Changed|Removed|Security|Deprecated|Breaking|Also|Notes?)$/i;

export function releases(changelog) {
  const found = [];
  let current = null;
  for (const line of changelog.split('\n')) {
    const release = /^## \[(\d[^\]]*)\](?: - (\S+))?/.exec(line);
    if (release) {
      current = { version: release[1], date: release[2] ?? '', headlines: [] };
      found.push(current);
      continue;
    }
    if (/^## /.test(line)) {
      current = null;
      continue;
    }
    const heading = /^### (.+?)\s*$/.exec(line);
    if (heading && current && !CATEGORY.test(heading[1])) current.headlines.push(heading[1]);
  }
  return found;
}

export function releaseList(changelog) {
  return releases(changelog)
    .slice(0, SHOWN)
    .map(({ version, date, headlines }) => {
      const shown = headlines.slice(0, HEADLINES);
      if (headlines.length > HEADLINES) shown.push('and more');
      const summary = shown.length ? ` — ${shown.join(' · ')}` : '';
      const when = date ? ` (${date})` : '';
      return `- **v${version}**${when}${summary}`;
    })
    .join('\n');
}
