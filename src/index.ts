#!/usr/bin/env node

/**
 * NotebookLM MCP Server
 *
 * MCP Server for Google NotebookLM - Chat with Gemini 2.5 through NotebookLM
 * with session support and human-like behavior!
 *
 * Features:
 * - Session-based contextual conversations
 * - Auto re-login on session expiry
 * - Human-like typing and mouse movements
 * - Persistent browser fingerprint
 * - Stealth mode with Patchright
 * - Claude Code integration via npx
 *
 * Usage:
 *   npx notebooklm-mcp
 *   node dist/index.js
 *
 * Environment Variables:
 *   NOTEBOOK_URL - Default NotebookLM notebook URL
 *   AUTO_LOGIN_ENABLED - Enable automatic login (true/false)
 *   LOGIN_EMAIL - Google email for auto-login
 *   LOGIN_PASSWORD - Google password for auto-login
 *   HEADLESS - Run browser in headless mode (true/false)
 *   MAX_SESSIONS - Maximum concurrent sessions (default: 10)
 *   SESSION_TIMEOUT - Session timeout in seconds (default: 900)
 *
 * Based on the Python NotebookLM API implementation
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

import { AuthManager } from './auth/auth-manager.js';
import { SessionManager } from './session/session-manager.js';
import { NotebookLibrary } from './library/notebook-library.js';
import { ToolHandlers, buildToolDefinitions } from './tools/index.js';
import { createMcpServer } from './mcp-server.js';
import { CONFIG } from './config.js';
import { log } from './utils/logger.js';

const packageJson = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf-8')
) as { version: string };
const SERVER_VERSION = packageJson.version;

const SHUTDOWN_DEADLINE_MS = 10_000;
const PARENT_CHECK_INTERVAL_MS = 5_000;

/**
 * True for the errors a write to a stdio pipe raises once the client has gone.
 */
function isDeadStdioError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EPIPE' || code === 'ERR_STREAM_DESTROYED' || code === 'ECONNRESET';
}

/**
 * Main MCP Server Class
 */
class NotebookLMMCPServer {
  private server: Server;
  private authManager: AuthManager;
  private sessionManager: SessionManager;
  private library: NotebookLibrary;
  private toolHandlers: ToolHandlers;
  private toolDefinitions: Tool[];

  constructor() {
    // Initialize managers
    this.authManager = new AuthManager();
    this.sessionManager = new SessionManager(this.authManager);
    this.library = new NotebookLibrary();
    this.toolHandlers = new ToolHandlers(this.sessionManager, this.authManager, this.library);

    // Build tool definitions with library context
    this.toolDefinitions = buildToolDefinitions(this.library) as Tool[];

    // Build the MCP server from the shared factory. The same factory backs the
    // HTTP /mcp transport, so the tool + resource handlers live in one place.
    this.server = createMcpServer({
      toolHandlers: this.toolHandlers,
      library: this.library,
      toolDefinitions: this.toolDefinitions,
      version: SERVER_VERSION,
    });

    this.setupShutdownHandlers();

    log.info('🚀 NotebookLM MCP Server initialized');
    log.info(`  Version: ${SERVER_VERSION}`);
    log.info(`  Node: ${process.version}`);
    log.info(`  Platform: ${process.platform}`);
  }

  /**
   * Return notebook IDs matching the provided input (case-insensitive contains)
   * Note: Disabled for Claude Desktop compatibility
   */
  // private completeNotebookIds(input: unknown): string[] {
  //   const query = String(input ?? "").toLowerCase();
  //   return this.library
  //     .listNotebooks()
  //     .map((nb) => nb.id)
  //     .filter((id) => id.toLowerCase().includes(query))
  //     .slice(0, 50);
  // }

  /**
   * Build a completion payload for MCP responses
   * Note: Disabled for Claude Desktop compatibility
   */
  // private buildCompletion(values: string[]) {
  //   return {
  //     completion: {
  //       values,
  //       total: values.length,
  //     },
  //   };
  // }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    let shuttingDown = false;

    const shutdown = async (signal: string) => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      // Graceful cleanup must never keep the process alive on its own. If
      // closing the browser or the server hangs, exit anyway.
      setTimeout(() => process.exit(1), SHUTDOWN_DEADLINE_MS).unref();

      log.info(`\n🛑 Received ${signal}, shutting down gracefully...`);

      try {
        // Cleanup tool handlers (closes all sessions)
        await this.toolHandlers.cleanup();

        // Close server
        await this.server.close();

        log.success('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        log.error(`❌ Error during shutdown: ${error}`);
        process.exit(1);
      }
    };

    const requestShutdown = (signal: string) => {
      void shutdown(signal);
    };

    process.on('SIGINT', () => requestShutdown('SIGINT'));
    process.on('SIGTERM', () => requestShutdown('SIGTERM'));

    // MCP clients (Claude Desktop, Claude Code, Codex, …) signal disconnect by
    // closing the stdio pipe, not by sending a signal. Without these handlers
    // the process stays alive as an orphan because the Patchright/Chromium
    // browser session keeps the event loop running. 'end' is the graceful EOF
    // (normal client exit); 'close' covers an abrupt fd close (client killed,
    // crashed parent, broken pipe). The `shuttingDown` guard makes whichever
    // fires second a no-op.
    process.stdin.on('end', () => requestShutdown('stdin-end'));
    process.stdin.on('close', () => requestShutdown('stdin-close'));

    // Once the client is gone, every write to stdout/stderr fails. Logging that
    // failure writes to stderr again, which fails again: an orphaned server sat
    // in that loop at 100% CPU for days. A dead stdio pipe means the client is
    // gone, so exit at once and do not log.
    process.stdout.on('error', () => process.exit(1));
    process.stderr.on('error', () => process.exit(1));

    // Last line of defence for a client that died without closing our stdin
    // (e.g. the pipe was inherited by another process): when the parent that
    // started us is gone, we are reparented and process.ppid changes.
    const parentPid = process.ppid;
    setInterval(() => {
      if (process.ppid !== parentPid) {
        requestShutdown('parent-exit');
      }
    }, PARENT_CHECK_INTERVAL_MS).unref();

    process.on('uncaughtException', (error) => {
      if (isDeadStdioError(error)) {
        process.exit(1);
      }
      log.error(`💥 Uncaught exception: ${error}`);
      log.error(error.stack || '');
      requestShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      log.error(`💥 Unhandled rejection at: ${promise}`);
      log.error(`Reason: ${reason}`);
      requestShutdown('unhandledRejection');
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    log.info('🎯 Starting NotebookLM MCP Server...');
    log.info('');
    log.info('📝 Configuration:');
    log.info(`  Config Dir: ${CONFIG.configDir}`);
    log.info(`  Data Dir: ${CONFIG.dataDir}`);
    log.info(`  Headless: ${CONFIG.headless}`);
    log.info(`  Max Sessions: ${CONFIG.maxSessions}`);
    log.info(`  Session Timeout: ${CONFIG.sessionTimeout}s`);
    log.info(`  Stealth: ${CONFIG.stealthEnabled}`);
    log.info('');

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await this.server.connect(transport);

    log.success('✅ MCP Server connected via stdio');
    log.success('🎉 Ready to receive requests from Claude Code!');
    log.info('');
    log.info('💡 Available tools:');
    for (const tool of this.toolDefinitions) {
      const desc = tool.description ? tool.description.split('\n')[0] : 'No description'; // First line only
      log.info(`  - ${tool.name}: ${desc.substring(0, 80)}...`);
    }
    log.info('');
    log.info('📖 For documentation, see: README.md');
    log.info('📖 For MCP details, see: MCP_INFOS.md');
    log.info('');
  }
}

/**
 * Main entry point
 */
async function main() {
  // CLI subcommand dispatch. When launched as an MCP server (no args — how
  // Claude Desktop / Cursor spawn it), fall through to the server below.
  // A bare subcommand (e.g. `notebooklm-mcp setup-auth`) delegates to the
  // matching CLI so global-install users can run the interactive login in a
  // terminal instead of through the in-client tool (which the client's
  // tool-call timeout kills mid-login). See issue #27.
  // Flags are handled before subcommands: `--help` used to fall straight
  // through and boot a full stdio server that then sat there indefinitely,
  // because the guard below only ever matched bare words. See issue #30.
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h' || arg === 'help') {
    await import('./cli/help.js');
    return;
  }
  if (arg === '--version' || arg === '-v') {
    console.log(SERVER_VERSION);
    return;
  }
  if (arg && !arg.startsWith('-')) {
    const cliModules: Record<string, string> = {
      'setup-auth': './cli/setup-auth.js',
      'de-auth': './cli/de-auth.js',
      accounts: './cli/accounts.js',
    };
    const cliModule = cliModules[arg];
    if (cliModule) {
      await import(cliModule); // each CLI runs its own main() on import
      return;
    }
    console.error(`Unknown command: ${arg}`);
    console.error(`Available commands: ${Object.keys(cliModules).join(', ')}, help`);
    console.error('Flags: --help, --version');
    process.exit(1);
  }
  if (arg) {
    // An unrecognised flag must be reported, but must not abort: MCP clients
    // sometimes append flags of their own. Warn on stderr only — stdout is the
    // JSON-RPC channel and has to stay clean.
    console.error(`Unrecognised option "${arg}" ignored. Run with --help for usage.`);
  }

  // Print banner
  console.error('╔══════════════════════════════════════════════════════════╗');
  console.error('║                                                          ║');
  console.error(`║           NotebookLM MCP Server v${SERVER_VERSION.padEnd(22, ' ')}║`);
  console.error('║                                                          ║');
  console.error('║   Chat with Gemini 2.5 through NotebookLM via MCP       ║');
  console.error('║                                                          ║');
  console.error('╚══════════════════════════════════════════════════════════╝');
  console.error('');

  try {
    const server = new NotebookLMMCPServer();
    await server.start();
  } catch (error) {
    log.error(`💥 Fatal error starting server: ${error}`);
    if (error instanceof Error) {
      log.error(error.stack || '');
    }
    process.exit(1);
  }
}

// Run the server
main();
