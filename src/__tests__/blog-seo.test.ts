/**
 * Every blog post must carry what an engine needs to rank and attribute it.
 *
 * These posts are the project's only inbound channel that is not a directory
 * listing, and a post missing its description or its canonical signals fails
 * silently: it renders perfectly, it just never arrives. Nothing in a
 * Docusaurus build complains about it either — the build is green whether or
 * not the metadata is there.
 *
 * One of these caught a real defect. `docusaurus.config.ts` declared
 * `img/social-card.png` as the site-wide preview image and the file did not
 * exist, so every page of the site — docs and posts alike — advertised a
 * 404 as its preview for as long as that had been true.
 */

import { describe, it, expect } from '@jest/globals';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOG = join(ROOT, 'website', 'blog');

const posts = readdirSync(BLOG).filter((f) => f.endsWith('.mdx'));

/** The frontmatter block, as raw YAML-ish text. */
function frontmatter(file: string): string {
  const body = readFileSync(join(BLOG, file), 'utf-8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(body);
  if (!m) throw new Error(`${file} has no frontmatter block`);
  return m[1];
}

/** A scalar field's value, quotes stripped. */
function field(fm: string, name: string): string | null {
  const m = new RegExp(`^${name}:[ \\t]*(.+)$`, 'm').exec(fm);
  if (!m) return null;
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

describe('blog posts carry what they need to be found', () => {
  it('there are posts to check at all', () => {
    // A rename of the directory would otherwise turn every assertion below
    // into a vacuous pass over an empty list.
    expect(posts.length).toBeGreaterThan(5);
  });

  it.each(posts)('%s declares a title short enough to survive a results page', (file) => {
    const title = field(frontmatter(file), 'title');
    expect(title).toBeTruthy();
    expect(title!.length).toBeGreaterThan(15);
    expect(title!.length).toBeLessThanOrEqual(80);
  });

  it.each(posts)('%s declares a description of usable length', (file) => {
    // Too short wastes the snippet; past roughly 260 characters it is cut,
    // and a sentence cut mid-clause reads as carelessness.
    const description = field(frontmatter(file), 'description');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThanOrEqual(110);
    expect(description!.length).toBeLessThanOrEqual(260);
  });

  it.each(posts)('%s has a stable slug that matches its filename', (file) => {
    const slug = field(frontmatter(file), 'slug');
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    // The date prefix is the only difference. A slug that drifts from the
    // filename is a link that changes when the file is touched.
    expect(file).toBe(`${file.slice(0, 11)}${slug}.mdx`);
  });

  it.each(posts)('%s names an author and at least two tags', (file) => {
    const fm = frontmatter(file);
    expect(field(fm, 'authors')).toBeTruthy();
    const tags = field(fm, 'tags');
    expect(tags).toBeTruthy();
    expect(tags!.replace(/[[\]]/g, '').split(',').filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });

  it.each(posts)('%s declares at least three keywords', (file) => {
    const fm = frontmatter(file);
    const inline = /^keywords:[ \t]*\[([\s\S]*?)\]/m.exec(fm);
    const listed = [...fm.matchAll(/^ {2}- (.+)$/gm)].map((m) => m[1]);
    const keywords = inline
      ? inline[1]
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : listed;
    expect(keywords.length).toBeGreaterThanOrEqual(3);
  });

  it.each(posts)('%s has a truncation marker, so the listing is not the whole post', (file) => {
    const body = readFileSync(join(BLOG, file), 'utf-8');
    expect(body).toContain('{/* truncate */}');
  });

  it.each(posts)('%s links somewhere else on the site', (file) => {
    // An island page is one an engine reaches and leaves. Every post should
    // hand the reader on to the docs or to another post.
    const body = readFileSync(join(BLOG, file), 'utf-8');
    expect(body).toMatch(/\]\(\/[a-z]/);
  });
});

describe("the product's current name", () => {
  /**
   * Google renamed NotebookLM to Gemini Notebook in July 2026. Both names are
   * in use — people still search for the old one, so neither replaces the
   * other — but a surface that writes only the old one is invisible to anyone
   * searching the new one, and an engine has no way to learn they are the
   * same product from a page that never says so.
   *
   * Keywords alone do not count: these check the prose and the descriptions
   * a reader and a crawler actually see.
   */
  const NEW_NAME = /Gemini Notebook/i;

  it.each(posts)('%s writes it in the post body, not only in the keywords', (file) => {
    const body = readFileSync(join(BLOG, file), 'utf-8').split(/\n---\n/)[1] ?? '';
    expect(body).toMatch(NEW_NAME);
  });

  it.each([
    'README.md',
    'package.json',
    'server.json',
    'website/static/llms.txt',
    'website/docusaurus.config.ts',
    'website/scripts/sync-docs.mjs',
    'website/static/.well-known/ai-catalog.json',
  ])('%s names it', (file) => {
    expect(readFileSync(join(ROOT, file), 'utf-8')).toMatch(NEW_NAME);
  });
});

describe('the preview image the whole site advertises', () => {
  const config = readFileSync(join(ROOT, 'website', 'docusaurus.config.ts'), 'utf-8');

  it('exists on disk', () => {
    const declared = /^\s*image:\s*'([^']+)'/m.exec(config);
    expect(declared).not.toBeNull();
    // Declared paths are relative to static/. This was a 404 on every page of
    // the site until 2026-11-06.
    expect(existsSync(join(ROOT, 'website', 'static', declared![1]))).toBe(true);
  });
});
