/**
 * The Rust client ships from this repository, so the wiring that keeps it
 * honest is held shut here.
 *
 * Three things can rot silently. The crate version can drift from the server
 * version it is a client for — the same drift that left the published REST
 * specification two years behind. The release can stop publishing it. And the
 * crate can stop being built and tested at all, which is how a second
 * language turns into a second source of untested code.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8').replace(/\r\n/g, '\n');

const CRATE = 'crates/notebooklm-client';
const manifest = read(`${CRATE}/Cargo.toml`);
const version = JSON.parse(read('package.json')).version as string;

describe('the crate manifest', () => {
  it('carries the server version it is a client for', () => {
    expect(manifest).toContain(`\nversion = "${version}"\n`);
  });

  it('tells readers to depend on that same minor line', () => {
    const [major, minor] = version.split('.');
    expect(read(`${CRATE}/README.md`)).toContain(`notebooklm = "${major}.${minor}"`);
  });

  it('is publishable: every field crates.io requires is present', () => {
    for (const field of ['description', 'license', 'repository', 'readme', 'keywords']) {
      expect(manifest).toMatch(new RegExp(`^${field} = `, 'm'));
    }
  });

  it('publishes under the name the documentation uses', () => {
    expect(manifest).toMatch(/^name = "notebooklm"$/m);
  });
});

describe('the guards around it', () => {
  const ci = read('.github/workflows/ci.yml');
  const release = read('.github/workflows/release.yml');

  it.each([
    ['cargo fmt --check', 'formatting'],
    ['cargo clippy --all-features --all-targets -- -D warnings', 'lints'],
    ['cargo test --all-features', 'tests'],
    ['cargo package', 'packaging'],
  ])('CI runs %s, so %s cannot rot', (command) => {
    expect(ci).toContain(command);
  });

  it('releases the crate without storing a token', () => {
    expect(release).toContain('rust-lang/crates-io-auth-action');
    expect(release).toContain('cargo publish');
    // A stored token would be the thing trusted publishing exists to remove.
    expect(release).not.toMatch(/CARGO_REGISTRY_TOKEN:\s*\$\{\{\s*secrets\./);
  });

  it('refuses to publish a crate whose version disagrees with the tag', () => {
    expect(release).toContain('the tag says');
  });

  it('keeps the crate version synced by the release chain', () => {
    const sync = read('scripts/sync-version.mjs');
    expect(sync).toContain(`${CRATE}/Cargo.toml`);
    expect(sync).toContain(`${CRATE}/README.md`);
    // And staged into the version commit, or the bump would leave it behind.
    const staged = JSON.parse(read('package.json')).scripts.version as string;
    expect(staged).toContain(`${CRATE}/Cargo.toml`);
    expect(staged).toContain(`${CRATE}/README.md`);
  });
});

/**
 * The one thing the release chain cannot do for the crate.
 *
 * A new REST route propagates to the OpenAPI specification and the UTCP manual
 * by itself, and `facts:check` fails if it does not. It does NOT become a
 * typed Rust method — those are hand-written, and a route added tomorrow
 * reaches a Rust caller through `manual()`, not through the typed surface.
 *
 * That boundary is a choice, and an undocumented choice is how a
 * hand-maintained copy starts rotting. So the typed surface is pinned here:
 * adding a method means adding it to this list, and losing one fails the
 * build instead of passing unnoticed.
 */
describe('the typed surface, which no generator maintains', () => {
  const client = read(`${CRATE}/src/client.rs`);
  const methods = [...client.matchAll(/pub async fn (\w+)/g)].map((m) => m[1]).sort();

  it('is exactly the subset the crate claims to cover', () => {
    expect(methods).toEqual([
      'ask',
      'health',
      'library',
      'manual',
      'search_passages',
      'source',
      'sources',
    ]);
  });

  it('offers every typed call in the blocking façade too', () => {
    const blocking = read(`${CRATE}/src/blocking.rs`);
    for (const method of methods) {
      expect(blocking).toContain(`pub fn ${method}(`);
    }
  });

  it('tells readers where the other operations are', () => {
    // Without this sentence a reader would take the seven methods for the
    // whole API and conclude the rest is unreachable from Rust.
    // The sentence wraps across two doc-comment lines, prefix included.
    expect(read(`${CRATE}/src/lib.rs`)).toMatch(/56 operations in(\s|\n|\/\/!)*all/);
    expect(read(`${CRATE}/README.md`)).toMatch(/56 operations in all/);
  });
});

describe('what the crate promises in its own documentation', () => {
  const lib = read(`${CRATE}/src/lib.rs`);

  it('says it does not own a browser, because that is the whole design', () => {
    expect(lib).toMatch(/does not own a browser/);
  });

  it('names the current product name as well as the old one', () => {
    expect(lib).toMatch(/Gemini Notebook/);
    expect(read(`${CRATE}/README.md`)).toMatch(/Gemini Notebook/);
  });
});
