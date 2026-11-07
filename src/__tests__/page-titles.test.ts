/**
 * A page title has about sixty characters before a results page cuts it, and
 * the site name is appended to every one of them.
 *
 * All seventeen documentation titles used to run 71 to 117 characters once the
 * old site name — `NotebookLM MCP + HTTP REST API` — was appended, so Google
 * truncated every single one, and six of them restated that name inside the
 * title it was about to be appended to. Measured the day Search Console first
 * reported 187 impressions and zero clicks.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8').replace(/\r\n/g, '\n');

const config = read('website/docusaurus.config.ts');
const sync = read('website/scripts/sync-docs.mjs');

/** What Docusaurus appends: ` | ${siteConfig.title}`. */
const siteTitle = /^\s*title: '([^']+)',$/m.exec(config)?.[1] ?? '';

/** Every per-page title the documentation sync writes as frontmatter. */
const titles = [...sync.matchAll(/'([^']+\.md)': \{\s*\n\s*title: ['"]([^'"]+)['"]/g)].map((m) => ({
  file: m[1],
  title: m[2],
}));

const LIMIT = 60;

describe('the site name that is appended to every title', () => {
  it('is short enough to leave room for the page', () => {
    expect(siteTitle).toBeTruthy();
    expect(siteTitle.length).toBeLessThanOrEqual(16);
  });

  it('still exists in full where length costs nothing', () => {
    // og:site_name and the schema.org blocks are not shown in a results page,
    // so they keep the descriptive form.
    expect(config).toContain("content: 'NotebookLM MCP + HTTP REST API'");
    expect(config).toContain("name: 'NotebookLM MCP + HTTP REST API'");
  });
});

describe('the documentation titles', () => {
  it('there are titles to check at all', () => {
    expect(titles.length).toBeGreaterThan(15);
  });

  it.each(titles.map((t) => [t.file, t.title]))(
    '%s fits in a results page once the site name is appended',
    (_file, title) => {
      expect(`${title} | ${siteTitle}`.length).toBeLessThanOrEqual(LIMIT);
    }
  );

  it.each(titles.map((t) => [t.file, t.title]))(
    '%s does not restate the site name it is appended to',
    (_file, title) => {
      expect(title.includes(siteTitle)).toBe(false);
    }
  );

  it('keeps the home page on both product names', () => {
    // The one query with volume is `notebooklm mcp`, and the rebrand means
    // `gemini notebook mcp` is the same question asked with the new name.
    const home = titles.find((t) => t.file === 'README.md');
    expect(`${home?.title} | ${siteTitle}`).toMatch(/Gemini Notebook/);
    expect(`${home?.title} | ${siteTitle}`).toMatch(/NotebookLM/);
  });
});
