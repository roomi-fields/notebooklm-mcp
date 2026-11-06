/**
 * The UTCP manual, and the two properties that make it worth publishing.
 *
 * A UTCP client has no protocol server to talk to: it reads a manual and then
 * calls this REST API itself. It can also convert our OpenAPI document on its
 * own — but the reference converter keeps an operation ONLY if it carries an
 * `operationId`, and it understands `apiKey`/`basic`/`oauth2` security
 * schemes, not the `http`+`bearer` one our specification declares. So an
 * unnamed route is invisible, and an auto-converted manual calls everything
 * unauthenticated. Both are regressions a test can hold shut.
 *
 * Field names below are the reference client's own, read from
 * universal-tool-calling-protocol/python-utcp on 2026-11-06 — the RFC and the
 * published docs disagree with each other, the code does not.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  BASE_PLACEHOLDER,
  loadManual,
  rebaseManual,
  resetManualCache,
  type UtcpManual,
} from '../utcp/manual.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANUAL = join(ROOT, 'deployment', 'docs', 'utcp.json');
const SPEC = readFileSync(join(ROOT, 'deployment', 'docs', 'openapi.yaml'), 'utf-8').replace(
  /\r\n/g,
  '\n'
);

const manual = JSON.parse(readFileSync(MANUAL, 'utf-8')) as UtcpManual;

beforeEach(() => resetManualCache());

describe('the published manual', () => {
  it('is a manual a client will recognise as one', () => {
    // The transport decides between "this is a manual" and "this is an
    // OpenAPI document to convert" by looking for exactly these two keys.
    expect(typeof manual.utcp_version).toBe('string');
    expect(Array.isArray(manual.tools)).toBe(true);
    expect(typeof manual.manual_version).toBe('string');
  });

  it('names every tool, uniquely', () => {
    const names = manual.tools.map((t) => t.name);
    expect(names.every((n) => /^[a-z][a-z0-9_]*$/.test(n))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it('describes every tool, because the description is what an agent chooses on', () => {
    expect(manual.tools.filter((t) => !t.description.trim())).toEqual([]);
  });

  it('declares the key as a header the server actually accepts', () => {
    // Our specification declares a bearer scheme, which the reference
    // converter does not map — auto-conversion would call everything
    // unauthenticated. The server takes X-API-Key as well, so that is what
    // the manual asks for, in the form the client's own model defines.
    for (const tool of manual.tools) {
      expect(tool.tool_call_template.auth).toEqual({
        auth_type: 'api_key',
        api_key: '${NOTEBOOKLM_API_KEY}',
        var_name: 'X-API-Key',
        location: 'header',
      });
    }
  });

  it('never embeds a key, only a request for one', () => {
    // `${VAR}` is the client's own indirection. A literal value here would
    // publish the user's key to anyone who fetches the manual.
    const serialized = readFileSync(MANUAL, 'utf-8');
    expect(serialized).not.toMatch(/"api_key":\s*"(?!\$\{)/);
  });

  it('points a POST at a body field, and a GET at none', () => {
    const search = manual.tools.find((t) => t.name === 'search_passages');
    expect(search?.tool_call_template.http_method).toBe('POST');
    expect(search?.tool_call_template.body_field).toBe('body');

    const read = manual.tools.find((t) => t.name === 'read_source');
    expect(read?.tool_call_template.http_method).toBe('GET');
    expect(read?.tool_call_template.body_field).toBeUndefined();
  });

  it('keeps a path parameter in the address and in the inputs', () => {
    const read = manual.tools.find((t) => t.name === 'read_source');
    expect(read?.tool_call_template.url).toBe(
      `${BASE_PLACEHOLDER}/notebooks/{id}/sources/{sourceId}`
    );
    const inputs = read?.inputs as { required: string[] };
    expect(inputs.required).toEqual(['id', 'sourceId']);
  });

  it('carries the tools our own names promise', () => {
    const names = manual.tools.map((t) => t.name);
    for (const expected of [
      'ask_question',
      'search_passages',
      'retry_content',
      'list_notebooks',
      'get_health',
    ]) {
      expect(names).toContain(expected);
    }
  });
});

describe('the specification the manual is generated from', () => {
  it('names every operation, since an unnamed one is dropped by the converter', () => {
    const operations = SPEC.match(/^ {4}(get|post|put|patch|delete):$/gm) ?? [];
    const named = SPEC.match(/^ {6}operationId: /gm) ?? [];
    expect(operations.length).toBeGreaterThan(50);
    expect(named.length).toBe(operations.length);
  });

  it('has one tool per operation', () => {
    const operations = SPEC.match(/^ {4}(get|post|put|patch|delete):$/gm) ?? [];
    expect(manual.tools.length).toBe(operations.length);
  });
});

describe('rebasing', () => {
  it('swaps the placeholder for the address the caller reached', () => {
    const out = rebaseManual(manual, 'https://nblm.example.org');
    expect(out.tools[0].tool_call_template.url.startsWith('https://nblm.example.org/')).toBe(true);
    expect(out.tools.every((t) => !t.tool_call_template.url.includes(BASE_PLACEHOLDER))).toBe(true);
  });

  it('drops a trailing slash rather than doubling it', () => {
    const out = rebaseManual(manual, 'https://nblm.example.org/');
    expect(out.tools.every((t) => !t.tool_call_template.url.includes('.org//'))).toBe(true);
  });

  it('leaves the original untouched', () => {
    const before = manual.tools[0].tool_call_template.url;
    rebaseManual(manual, 'https://elsewhere.test');
    expect(manual.tools[0].tool_call_template.url).toBe(before);
  });

  it('leaves an address alone when the placeholder is not its prefix', () => {
    const odd: UtcpManual = {
      utcp_version: '1.0.0',
      manual_version: '0.0.0',
      tools: [
        {
          name: 'x',
          description: 'x',
          tool_call_template: { url: `https://other.test/p?u=${BASE_PLACEHOLDER}` },
        },
      ],
    };
    expect(rebaseManual(odd, 'https://here.test').tools[0].tool_call_template.url).toBe(
      `https://other.test/p?u=${BASE_PLACEHOLDER}`
    );
  });
});

describe('loading', () => {
  it('refuses a manual that declares nothing, rather than serving an empty one', () => {
    // An empty manual reads to a client as "this server exposes no tools",
    // which is a lie we would then debug from the client's side.
    expect(() => loadManual(join(ROOT, 'package.json'))).toThrow(/declares no tools/);
  });

  it('reads the file once', () => {
    expect(loadManual(MANUAL)).toBe(loadManual(join(ROOT, 'package.json')));
  });
});
