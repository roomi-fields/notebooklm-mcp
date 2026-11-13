/**
 * A tool is reachable only if three separate places agree: its definition in
 * `buildToolDefinitions`, a handler method on `ToolHandlers`, and a case in the
 * dispatch switch. Miss one and the tool is advertised, called, and answered
 * with "Unknown tool" — no build error, no test failure, just a tool that is
 * not there.
 *
 * It has bitten this project before, which is why the audit used to be a
 * manual `comm` diff after every change. This guard does it on every run.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { LEGACY_TO_CANONICAL } from '../tools/tool-names.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Read a source file, normalising CRLF — the working copy may use either. */
const read = (p: string) => readFileSync(join(SRC, p), 'utf-8').replace(/\r\n/g, '\n');

/** Tool names declared in the definitions array. */
function defined(): string[] {
  const body = read('tools/index.ts');
  return [...new Set([...body.matchAll(/^ {6}name: '([a-z_]+)',$/gm)].map((m) => m[1]))];
}

/**
 * Tool names answered by the dispatch switch. The switch lives in
 * `mcp-server.ts` (the factory shared by the stdio and HTTP /mcp transports);
 * as a free function rather than a class method, its cases sit at 8 spaces.
 */
function dispatched(): string[] {
  const body = read('mcp-server.ts');
  return [...new Set([...body.matchAll(/^ {8}case '([a-z_]+)':$/gm)].map((m) => m[1]))];
}

describe('MCP tool wiring', () => {
  it('finds the tool definitions and the dispatch switch', () => {
    // If a refactor moves or reindents either list, the two readers above go
    // quiet and this guard would pass by reading nothing at all.
    expect(defined().length).toBeGreaterThan(40);
    expect(dispatched().length).toBeGreaterThan(40);
  });

  it('dispatches every tool it advertises', () => {
    const handled = new Set(dispatched());
    expect(defined().filter((name) => !handled.has(name))).toEqual([]);
  });

  it('advertises every tool it dispatches, legacy aliases aside', () => {
    const advertised = new Set(defined());
    const aliases = new Set(Object.keys(LEGACY_TO_CANONICAL));
    expect(dispatched().filter((n) => !advertised.has(n) && !aliases.has(n))).toEqual([]);
  });
});
