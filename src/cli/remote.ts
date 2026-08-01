#!/usr/bin/env node

/**
 * Lightweight remote MCP client entrypoint.
 *
 * This command configures the existing stdio-to-HTTP proxy from a URL argument,
 * so MCP clients can connect to a remote NotebookLM HTTP server without cloning
 * this repository or referencing dist/stdio-http-proxy.js directly.
 */

function printUsage(): void {
  console.error(`Usage:
  notebooklm-mcp-remote <server-url>
  notebooklm-mcp-remote --url <server-url>

Environment variables:
  NOTEBOOKLM_SERVER_URL  Remote NotebookLM HTTP server URL
  MCP_HTTP_URL           Backward-compatible server URL
  MCP_HTTP_TIMEOUT       HTTP request timeout in milliseconds

Example:
  notebooklm-mcp-remote --url http://192.168.1.211:3000`);
}

function resolveServerUrl(args: string[]): string | undefined {
  const urlFlagIndex = args.findIndex((arg) => arg === '--url' || arg === '-u');
  if (urlFlagIndex >= 0) {
    return args[urlFlagIndex + 1];
  }

  return args.find((arg) => !arg.startsWith('-'));
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

const serverUrl =
  resolveServerUrl(args) || process.env.NOTEBOOKLM_SERVER_URL || process.env.MCP_HTTP_URL;

if (!serverUrl) {
  console.error('[remote-client] Missing NotebookLM server URL.');
  printUsage();
  process.exit(1);
}

let parsedUrl: URL;
try {
  parsedUrl = new URL(serverUrl);
} catch {
  console.error(`[remote-client] Invalid server URL: ${serverUrl}`);
  process.exit(1);
}

if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
  console.error('[remote-client] Server URL must use http:// or https://');
  process.exit(1);
}

process.env.MCP_HTTP_URL = parsedUrl.toString().replace(/\/$/, '');

await import('../stdio-http-proxy.js');
