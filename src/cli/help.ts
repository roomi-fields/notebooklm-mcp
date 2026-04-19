#!/usr/bin/env node
/**
 * CLI Help - Shows available commands
 */

console.log(`
==========================================
  NotebookLM MCP Server - Commands
==========================================

AUTHENTICATION:
  npm run setup-auth     Setup Google authentication (opens browser)
  npm run de-auth        Clear authentication (logout)

SERVER:
  npm run start:http     Start HTTP REST API server
  npm run dev:http       Start HTTP server in development mode (auto-reload)

DAEMON (PM2):
  npm run daemon:start   Start server as background daemon
  npm run daemon:stop    Stop daemon
  npm run daemon:restart Restart daemon
  npm run daemon:logs    View daemon logs
  npm run daemon:status  View daemon status
  npm run daemon:delete  Remove daemon from PM2

DEVELOPMENT:
  npm run build          Compile TypeScript to JavaScript
  npm run watch          Watch mode (auto-recompile on changes)
  npm run dev            Start MCP server in dev mode

DIAGNOSTICS:
  npm run doctor:basic   Verify Node version + required build artifacts
  npm run doctor:http    Verify the running HTTP server (/health + optional /content + /ask)
                         Pass --notebook-url to exercise /content and /ask

MCP STDIO:
  npx notebooklm-mcp     Start MCP server (for Claude Desktop/Code)

==========================================
  HTTP API Endpoints (when server running)
==========================================

HEALTH & AUTH:
  GET  /health           Server health and auth status
  POST /setup-auth       Setup authentication
  POST /de-auth          Clear authentication
  POST /re-auth          Re-authenticate (switch account)
  POST /cleanup-data     Clear all data

QUERIES:
  POST /ask              Ask a question to NotebookLM

NOTEBOOKS:
  GET  /notebooks              List all notebooks
  POST /notebooks              Add a notebook
  GET  /notebooks/search       Search notebooks
  GET  /notebooks/stats        Library statistics
  POST /notebooks/auto-discover  Auto-discover notebook from URL
  GET  /notebooks/:id          Get notebook details
  PUT  /notebooks/:id          Update notebook
  DELETE /notebooks/:id        Remove notebook
  PUT  /notebooks/:id/activate Set as active notebook

SESSIONS:
  GET  /sessions               List active sessions
  DELETE /sessions/:id         Close a session
  POST /sessions/:id/reset     Reset session history

==========================================
`);
