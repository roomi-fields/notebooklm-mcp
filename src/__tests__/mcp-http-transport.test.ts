/**
 * The MCP server is reachable over two transports, and they must behave the
 * same. The stdio entrypoint (`index.ts`) and the HTTP `/mcp` route (issue #42)
 * both build their server from `createMcpServer`, so this drives that factory
 * over an in-memory transport to prove the handshake and the tool list work.
 *
 * It then checks the HTTP wrapper actually mounts `/mcp` over streamable HTTP,
 * answers the stateless-only verbs plainly, and that `/mcp` is not miscounted
 * as a REST endpoint — it is the protocol itself, not an API operation.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

import { AuthManager } from '../auth/auth-manager.js';
import { SessionManager } from '../session/session-manager.js';
import { NotebookLibrary } from '../library/notebook-library.js';
import { ToolHandlers, buildToolDefinitions } from '../tools/index.js';
import { createMcpServer } from '../mcp-server.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf-8').replace(/\r\n/g, '\n');

const authManager = new AuthManager();
const sessionManager = new SessionManager(authManager);
const library = new NotebookLibrary();
const toolHandlers = new ToolHandlers(sessionManager, authManager, library);

afterAll(async () => {
  // SessionManager starts an unref'd cleanup interval; clear it so the suite
  // leaves no timer behind.
  await sessionManager.closeAllSessions();
});

describe('MCP over an in-memory transport (the shared factory)', () => {
  it('completes the handshake and lists the same tools the stdio server does', async () => {
    const server = createMcpServer({
      toolHandlers,
      library,
      toolDefinitions: buildToolDefinitions(library) as Tool[],
      version: 'test',
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0' }, { capabilities: {} });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    // The initialize handshake ran on connect; the server identifies itself.
    expect(client.getServerVersion()).toEqual({ name: 'notebooklm-mcp', version: 'test' });

    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(40);
    expect(tools.map((t) => t.name)).toContain('notebook_ask');

    await client.close();
    await server.close();
  });
});

describe('the HTTP /mcp transport', () => {
  const wrapper = read('http-wrapper.ts');

  it('mounts streamable HTTP on POST /mcp', () => {
    expect(wrapper).toMatch(/StreamableHTTPServerTransport/);
    expect(wrapper).toMatch(/app\.post\('\/mcp'/);
  });

  it('answers the stateless-only verbs (GET, DELETE) rather than hanging', () => {
    expect(wrapper).toMatch(/app\.get\('\/mcp'/);
    expect(wrapper).toMatch(/app\.delete\('\/mcp'/);
  });

  it('is the MCP transport, not a counted REST endpoint', () => {
    // The endpoint census in scripts/lib/facts.mjs must drop /mcp: it is not in
    // the OpenAPI spec and not mirrored to the generated Rust/Ruby/n8n clients.
    const facts = readFileSync(join(SRC, '..', 'scripts', 'lib', 'facts.mjs'), 'utf-8');
    expect(facts).toMatch(/TRANSPORT_ROUTES[\s\S]{0,200}\/mcp/);
  });
});
