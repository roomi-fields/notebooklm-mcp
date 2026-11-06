/**
 * The README's release list, and why it is generated.
 *
 * It used to be hand-written, and had stopped at v3.0.1 while the package
 * shipped 4.6.0 — nine releases, including three security releases, invisible
 * to anyone reading the front page. A reader taking the list at face value
 * judged the project dormant. It is the same defect as the OpenAPI document
 * that was a frozen hand-maintained copy: a list nobody regenerates answers
 * confidently and wrongly.
 *
 * So the list comes out of the changelog's own headings, and these tests hold
 * three things shut: the markers that make the region regenerable, the newest
 * release being the one we actually ship, and category headings ("Fixed",
 * "Security") never standing in for a headline.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — a plain ES module shared with the sync scripts, no types
import { releaseList, releases } from '../../scripts/lib/facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8').replace(/\r\n/g, '\n');

type Release = { version: string; date: string; headlines: string[] };

const CHANGELOG = read('CHANGELOG.md');
const README = read('README.md');
const parsed = releases(CHANGELOG) as Release[];

describe('the releases read out of the changelog', () => {
  it('finds every version, newest first', () => {
    expect(parsed.length).toBeGreaterThan(20);
    expect(parsed[0].version).toBe(JSON.parse(read('package.json')).version);
  });

  it('dates each one', () => {
    for (const release of parsed.slice(0, 10)) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('never mistakes a category heading for a headline', () => {
    const headlines = parsed.flatMap((r) => r.headlines);
    expect(headlines.length).toBeGreaterThan(20);
    for (const headline of headlines) {
      expect(headline).not.toMatch(/^(Fixed|Added|Changed|Security|Breaking|Also)$/i);
    }
  });

  it('leaves no release out for having only category headings', () => {
    const versions = [...CHANGELOG.matchAll(/^## \[(\d[^\]]*)\]/gm)].map((m) => m[1]);
    expect(parsed.map((r) => r.version)).toEqual(versions);
  });
});

describe('the list the README publishes', () => {
  it('keeps the markers that make it regenerable', () => {
    expect(README).toContain('<!-- releases:start');
    expect(README).toContain('<!-- releases:end -->');
  });

  it('is exactly what the generator produces', () => {
    const region = /<!-- releases:start[^>]*-->\s*\n([\s\S]*?)\n\s*<!-- releases:end -->/.exec(
      README
    );
    expect(region).not.toBeNull();
    expect(region![1]).toBe(releaseList(CHANGELOG));
  });

  it('opens on the version we ship', () => {
    const version = JSON.parse(read('package.json')).version;
    expect(releaseList(CHANGELOG).split('\n')[0]).toContain(`**v${version}**`);
  });

  it('names a release by version alone rather than dropping it', () => {
    const list = releaseList('## [9.9.9] - 2030-01-01\n\n### Fixed\n\n- a thing\n');
    expect(list).toBe('- **v9.9.9** (2030-01-01)');
  });
});

describe('everyone who contributed is named', () => {
  it.each(['nils-friedrichs', 'teodor-t-tenev', 'ghostnshells', 'shinjiyu'])(
    'the README credits @%s',
    (login) => {
      expect(README).toContain(`https://github.com/${login}`);
    }
  );
});
