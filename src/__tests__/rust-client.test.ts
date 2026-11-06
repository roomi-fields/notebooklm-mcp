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
