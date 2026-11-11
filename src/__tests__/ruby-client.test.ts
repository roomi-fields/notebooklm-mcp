/**
 * The Ruby gem ships from this repository, so the wiring that keeps it honest
 * is held shut here, exactly as the Rust crate's is.
 *
 * Three things can rot silently. The gem version can drift from the server
 * version it is a client for — the same drift that left the published REST
 * specification two years behind. The release can stop publishing it. And the
 * gem can stop being built and tested at all, which is how a second language
 * turns into a second source of untested code.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8').replace(/\r\n/g, '\n');

const GEM = 'gems/notebooklm';
const gemspec = read(`${GEM}/notebooklm.gemspec`);
const version = JSON.parse(read('package.json')).version as string;

describe('the gemspec', () => {
  it('carries the server version it is a client for', () => {
    expect(read(`${GEM}/lib/notebooklm/version.rb`)).toContain(`VERSION = '${version}'`);
  });

  it('tells readers to depend on that same minor line', () => {
    const [major, minor] = version.split('.');
    expect(read(`${GEM}/README.md`)).toContain(`gem 'notebooklm', '~> ${major}.${minor}'`);
  });

  it('is publishable: every field rubygems.org requires is present', () => {
    for (const field of ['name', 'version', 'summary', 'description', 'license', 'homepage']) {
      expect(gemspec).toMatch(new RegExp(`spec\\.${field} =`));
    }
    expect(gemspec).toContain("'source_code_uri'");
    expect(gemspec).toContain("'changelog_uri'");
  });

  it('publishes under the name the documentation uses', () => {
    expect(gemspec).toMatch(/spec\.name = 'notebooklm'/);
  });

  it('carries no runtime dependency, which is the gem own claim', () => {
    expect(gemspec).not.toMatch(/add_dependency/);
    expect(gemspec).not.toMatch(/add_runtime_dependency/);
  });
});

describe('the guards around it', () => {
  const ci = read('.github/workflows/ci.yml');
  const release = read('.github/workflows/release.yml');

  it.each([
    ['npm run ruby:check', 'the surface cannot drift from the specification'],
    ['rake test', 'the behaviour cannot rot'],
    ['gem build notebooklm.gemspec', 'an unpackageable gem fails before the release'],
  ])('CI runs %s, so %s', (command) => {
    expect(ci).toContain(command);
  });

  it('releases the gem without storing a token', () => {
    // RubyGems needs no stored credential: the workflow exchanges its OIDC
    // token for a key that lives fifteen minutes. The exchange is done by
    // hand because creating a *new* gem from a pending trusted publisher
    // requires asserting the owning account, which neither official action
    // can pass yet.
    expect(release).toContain('oidc/trusted_publisher/exchange_token');
    expect(release).toContain('vars.RUBYGEMS_OWNER');
    expect(release).toContain('gem push');
    // No secret of any kind on the RubyGems path.
    // End at the next job: publish-n8n-node sits between gem and registry and
    // legitimately carries secrets.NPM_TOKEN (npm has no OIDC for a scoped
    // first publish), so the slice must stop before it to test the gem alone.
    const job = release.slice(
      release.indexOf('publish-gem:'),
      release.indexOf('publish-n8n-node:')
    );
    expect(job).not.toMatch(/secrets\./);
  });

  it('masks the exchanged key before it can reach a log', () => {
    expect(release).toContain('::add-mask::${KEY}');
  });

  it('can be started on its own, without cutting a second tag', () => {
    // The first attempt failed on an action name that does not exist, and a
    // re-run of a push-triggered job uses the old workflow file — so the
    // publish has to be startable from the Actions tab too.
    expect(release).toMatch(/publish-gem:[\s\S]{0,400}workflow_dispatch/);
  });

  it('refuses to publish a gem whose version disagrees with the tag', () => {
    expect(release).toContain('the tag says ${TAG} and the gem says ${GEM}');
  });

  it('keeps the gem version synced by the release chain', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['version:sync']).toContain('build-ruby-client.mjs');
    expect(pkg.scripts.version).toContain(`${GEM}/lib/notebooklm/version.rb`);
    expect(pkg.scripts.version).toContain(`${GEM}/lib/notebooklm/generated.rb`);
    expect(read('scripts/sync-version.mjs')).toContain(`${GEM}/lib/notebooklm/version.rb`);
  });
});

describe('the generated surface', () => {
  const generated = read(`${GEM}/lib/notebooklm/generated.rb`);
  const spec = read('deployment/docs/openapi.yaml');

  const operations = [...spec.matchAll(/^      operationId: ([a-z_]+)$/gm)].map((m) => m[1]);
  const methods = [...generated.matchAll(/^    def (\w+)/gm)].map((m) => m[1]);

  it('covers every operation in the specification', () => {
    expect(operations.length).toBe(59);
    expect([...methods].sort()).toEqual([...operations].sort());
  });

  it('lists them for callers to introspect', () => {
    const listed = generated
      .slice(generated.indexOf('OPERATION_IDS = %w['), generated.indexOf('].freeze'))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[a-z_]+$/.test(l));
    expect([...listed].sort()).toEqual([...operations].sort());
  });

  it('says it is generated', () => {
    expect(generated).toContain('@generated by scripts/build-ruby-client.mjs');
  });

  it('documents every field of every shape with a type', () => {
    const fields = [...generated.matchAll(/^    field :(\w+), '([^']+)'/gm)];
    expect(fields.length).toBeGreaterThan(300);
    // Every `field` line is preceded by its `@return` type, so no reader is
    // left for the caller to discover by trial.
    const lines = generated.split('\n');
    const undocumented = lines
      .map((line, i) => (/^    field :/.test(line) ? lines[i - 1] : null))
      .filter((previous) => previous !== null && !/^    # @return \[/.test(previous));
    expect(undocumented).toEqual([]);
  });

  it('documents a possibly absent offset as possibly absent', () => {
    // The trap this gem exists to avoid: a passage starting at offset zero
    // arrives with the field missing, and a zero would attribute the
    // quotation to the top of a long document.
    const item = generated.slice(generated.indexOf('class SearchPassagesDataPassagesItem'));
    expect(item).toMatch(/# @return \[Integer, nil\]\n    field :start, 'start'/);
  });

  it('requires what the specification requires, and only that', () => {
    expect(generated).toContain('def ask_question(question:, notebook_id: nil');
    expect(generated).toContain('def add_notebook(id:, name:, url:, description: nil');
  });

  it('does not read the two unwrapped routes through the envelope', () => {
    // `/` and `/utcp` answer with their own document, not with success + data.
    expect(generated).toMatch(/def get_utcp_manual[\s\S]{0,200}enveloped: false/);
    expect(generated).toMatch(/def get_server_info[\s\S]{0,200}enveloped: false/);
  });
});

describe('what the gem promises in its own documentation', () => {
  const readme = read(`${GEM}/README.md`);

  it('says it does not own a browser, because that is the whole design', () => {
    expect(readme).toMatch(/owns no browser/);
  });

  it('names the current product name as well as the old one', () => {
    expect(readme).toMatch(/Gemini Notebook/);
    expect(readme).toMatch(/NotebookLM/);
  });

  it('tells the reader the api key is never printed', () => {
    expect(readme).toMatch(/inspect` redacts it|never printed/);
    expect(read(`${GEM}/lib/notebooklm/client.rb`)).toContain('<redacted>');
  });
});
