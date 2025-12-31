#!/usr/bin/env node

/**
 * Stdio-to-HTTP Proxy for NotebookLM MCP Server
 *
 * This proxy enables Claude Desktop (which only supports stdio MCP)
 * to use the HTTP server backend. It translates MCP stdio protocol
 * to HTTP REST API calls.
 *
 * Architecture:
 *   Claude Desktop → stdio → this proxy → HTTP → NotebookLM MCP Server → Chrome → NotebookLM
 *
 * Benefits:
 * - No Chrome profile conflicts (HTTP server owns the Chrome instance)
 * - Can run simultaneously with HTTP server
 * - Lightweight client (no Playwright dependency)
 *
 * Usage:
 *   node dist/stdio-http-proxy.js
 *
 * Environment Variables:
 *   MCP_HTTP_URL - HTTP server URL (default: http://localhost:3000)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
} from '@modelcontextprotocol/sdk/types.js';

// HTTP server URL (configurable via environment)
const HTTP_BASE_URL = process.env.MCP_HTTP_URL || 'http://localhost:3000';

/**
 * Helper to make HTTP requests to the backend server
 */
async function httpRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: unknown
): Promise<T> {
  const url = `${HTTP_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Log to stderr (stdio uses stdout for MCP protocol)
 */
function log(message: string): void {
  console.error(`[stdio-proxy] ${message}`);
}

/**
 * Build tool definitions for the proxy
 * These mirror the HTTP server's tools but are fetched dynamically
 */
function buildProxyToolDefinitions(): Tool[] {
  // Static tool definitions that match the HTTP server
  // These could be fetched dynamically in the future
  return [
    {
      name: 'ask_question',
      description:
        '🔌 [PROXY MODE] Ask NotebookLM via HTTP server.\n\n' +
        'This tool proxies requests to the HTTP server at ' +
        HTTP_BASE_URL +
        '\n' +
        'Ensure the HTTP server is running: npm run start:http\n\n' +
        'Parameters:\n' +
        '- question (required): The question to ask\n' +
        '- notebook_id: Library notebook ID\n' +
        '- notebook_url: Direct notebook URL\n' +
        '- session_id: Reuse existing session\n' +
        '- show_browser: Show browser window for debugging\n' +
        '- source_format: Citation extraction format (none, inline, footnotes, json, expanded)',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to ask NotebookLM' },
          session_id: { type: 'string', description: 'Optional session ID for context' },
          notebook_id: { type: 'string', description: 'Optional notebook ID from library' },
          notebook_url: { type: 'string', description: 'Optional direct notebook URL' },
          show_browser: { type: 'boolean', description: 'Show browser window for debugging' },
          source_format: {
            type: 'string',
            enum: ['none', 'inline', 'footnotes', 'json', 'expanded'],
            description:
              'Citation extraction format: none (default, fastest), inline ([1: "text..."]), footnotes (sources at end), json (separate object), expanded (replace markers with full text)',
          },
        },
        required: ['question'],
      },
    },
    {
      name: 'list_notebooks',
      description: '🔌 [PROXY] List all notebooks from library via HTTP server',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_notebook',
      description: '🔌 [PROXY] Get notebook details by ID via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Notebook ID' } },
        required: ['id'],
      },
    },
    {
      name: 'add_notebook',
      description: '🔌 [PROXY] Add notebook to library via HTTP server',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'NotebookLM URL' },
          name: { type: 'string', description: 'Display name' },
          description: { type: 'string', description: 'Description' },
          topics: { type: 'array', items: { type: 'string' }, description: 'Topics' },
          content_types: { type: 'array', items: { type: 'string' } },
          use_cases: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['url', 'name', 'description', 'topics'],
      },
    },
    {
      name: 'auto_discover_notebook',
      description: '🔌 [PROXY] Auto-discover notebook metadata via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'NotebookLM URL' } },
        required: ['url'],
      },
    },
    {
      name: 'select_notebook',
      description: '🔌 [PROXY] Set active notebook via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Notebook ID' } },
        required: ['id'],
      },
    },
    {
      name: 'update_notebook',
      description: '🔌 [PROXY] Update notebook metadata via HTTP server',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Notebook ID' },
          name: { type: 'string' },
          description: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
          content_types: { type: 'array', items: { type: 'string' } },
          use_cases: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          url: { type: 'string' },
        },
        required: ['id'],
      },
    },
    {
      name: 'remove_notebook',
      description: '🔌 [PROXY] Remove notebook from library via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Notebook ID' } },
        required: ['id'],
      },
    },
    {
      name: 'search_notebooks',
      description: '🔌 [PROXY] Search notebooks via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
    {
      name: 'get_library_stats',
      description: '🔌 [PROXY] Get library statistics via HTTP server',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_sessions',
      description: '🔌 [PROXY] List active sessions via HTTP server',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'close_session',
      description: '🔌 [PROXY] Close session via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { session_id: { type: 'string', description: 'Session ID' } },
        required: ['session_id'],
      },
    },
    {
      name: 'reset_session',
      description: '🔌 [PROXY] Reset session history via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { session_id: { type: 'string', description: 'Session ID' } },
        required: ['session_id'],
      },
    },
    {
      name: 'get_health',
      description: '🔌 [PROXY] Get server health status via HTTP server',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'setup_auth',
      description:
        '🔌 [PROXY] Setup Google authentication via HTTP server.\n' +
        'Opens browser on the HTTP server machine for login.',
      inputSchema: {
        type: 'object',
        properties: { show_browser: { type: 'boolean', description: 'Show browser window' } },
      },
    },
    {
      name: 'de_auth',
      description: '🔌 [PROXY] Logout (clear credentials) via HTTP server',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 're_auth',
      description: '🔌 [PROXY] Re-authenticate with different account via HTTP server',
      inputSchema: {
        type: 'object',
        properties: { show_browser: { type: 'boolean', description: 'Show browser window' } },
      },
    },
    {
      name: 'cleanup_data',
      description: '🔌 [PROXY] Cleanup server data via HTTP server',
      inputSchema: {
        type: 'object',
        properties: {
          confirm: { type: 'boolean', description: 'Confirm deletion (false for preview)' },
          preserve_library: { type: 'boolean', description: 'Keep library.json' },
        },
        required: ['confirm'],
      },
    },
    // Content Management Tools
    {
      name: 'add_source',
      description: '🔌 [PROXY] Add source/document to notebook via HTTP server',
      inputSchema: {
        type: 'object',
        properties: {
          source_type: {
            type: 'string',
            enum: ['file', 'url', 'text', 'youtube', 'google_drive'],
            description: 'Type of source to add',
          },
          file_path: { type: 'string', description: 'Path to file (for file type)' },
          url: { type: 'string', description: 'URL (for url/youtube/google_drive types)' },
          text: { type: 'string', description: 'Text content (for text type)' },
          title: { type: 'string', description: 'Optional title for the source' },
          notebook_url: { type: 'string', description: 'Optional notebook URL' },
          session_id: { type: 'string', description: 'Optional session ID' },
        },
        required: ['source_type'],
      },
    },
    {
      name: 'generate_audio',
      description: '🔌 [PROXY] Generate audio overview (podcast) via HTTP server',
      inputSchema: {
        type: 'object',
        properties: {
          custom_instructions: {
            type: 'string',
            description: 'Custom focus/instructions for audio',
          },
          notebook_url: { type: 'string', description: 'Optional notebook URL' },
          session_id: { type: 'string', description: 'Optional session ID' },
        },
      },
    },
    {
      name: 'generate_content',
      description:
        '🔌 [PROXY] Generate content via HTTP server.\n' +
        'Supported content types:\n' +
        '- audio_overview: Audio podcast/overview (Deep Dive conversation)\n' +
        '- video: Video summary that visually explains main topics (brief or explainer format)\n' +
        '- presentation: Slides/presentation with AI-generated content and images\n' +
        '- report: Briefing document (2,000-3,000 words) summarizing key findings, PDF/DOCX export\n' +
        '- infographic: Visual infographic in horizontal (16:9) or vertical (9:16) format\n' +
        '- data_table: Structured table organizing key information (CSV/Excel export)',
      inputSchema: {
        type: 'object',
        properties: {
          content_type: {
            type: 'string',
            enum: [
              'audio_overview',
              'video',
              'presentation',
              'report',
              'infographic',
              'data_table',
            ],
            description:
              'Type of content to generate: audio_overview (podcast), video (brief or explainer), presentation (slides), report (briefing doc 2,000-3,000 words, PDF/DOCX export), infographic (horizontal 16:9 or vertical 9:16), or data_table (CSV/Excel export)',
          },
          custom_instructions: { type: 'string', description: 'Custom instructions' },
          notebook_url: { type: 'string', description: 'Optional notebook URL' },
          session_id: { type: 'string', description: 'Optional session ID' },
        },
        required: ['content_type'],
      },
    },
    {
      name: 'list_content',
      description: '🔌 [PROXY] List sources and generated content via HTTP server',
      inputSchema: {
        type: 'object',
        properties: {
          notebook_url: { type: 'string', description: 'Optional notebook URL' },
          session_id: { type: 'string', description: 'Optional session ID' },
        },
      },
    },
    {
      name: 'download_audio',
      description: '🔌 [PROXY] Download generated audio file via HTTP server',
      inputSchema: {
        type: 'object',
        properties: {
          output_path: { type: 'string', description: 'Local path to save the audio file' },
          notebook_url: { type: 'string', description: 'Optional notebook URL' },
          session_id: { type: 'string', description: 'Optional session ID' },
        },
      },
    },
  ];
}

/**
 * Map tool calls to HTTP endpoints
 */
async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (name) {
      // Query endpoints
      case 'ask_question':
        return await httpRequest('POST', '/ask', args);

      case 'get_health':
        return await httpRequest('GET', '/health');

      // Notebook endpoints
      case 'list_notebooks':
        return await httpRequest('GET', '/notebooks');

      case 'get_notebook':
        return await httpRequest('GET', `/notebooks/${args.id}`);

      case 'add_notebook':
        return await httpRequest('POST', '/notebooks', args);

      case 'auto_discover_notebook':
        return await httpRequest('POST', '/notebooks/auto-discover', args);

      case 'select_notebook':
        return await httpRequest('PUT', `/notebooks/${args.id}/activate`);

      case 'update_notebook': {
        const { id, ...updateData } = args;
        return await httpRequest('PUT', `/notebooks/${id}`, updateData);
      }

      case 'remove_notebook':
        return await httpRequest('DELETE', `/notebooks/${args.id}`);

      case 'search_notebooks':
        return await httpRequest(
          'GET',
          `/notebooks/search?query=${encodeURIComponent(String(args.query))}`
        );

      case 'get_library_stats':
        return await httpRequest('GET', '/notebooks/stats');

      // Session endpoints
      case 'list_sessions':
        return await httpRequest('GET', '/sessions');

      case 'close_session':
        return await httpRequest('DELETE', `/sessions/${args.session_id}`);

      case 'reset_session':
        return await httpRequest('POST', `/sessions/${args.session_id}/reset`);

      // Auth endpoints
      case 'setup_auth':
        return await httpRequest('POST', '/setup-auth', args);

      case 'de_auth':
        return await httpRequest('POST', '/de-auth');

      case 're_auth':
        return await httpRequest('POST', '/re-auth', args);

      case 'cleanup_data':
        return await httpRequest('POST', '/cleanup-data', args);

      // Content Management endpoints
      case 'add_source':
        return await httpRequest('POST', '/content/sources', args);

      case 'delete_source': {
        // Use source_id in path if provided, otherwise use query params for source_name
        const deleteParams = new URLSearchParams();
        if (args.notebook_url) deleteParams.set('notebook_url', String(args.notebook_url));
        if (args.session_id) deleteParams.set('session_id', String(args.session_id));
        const deleteQuery = deleteParams.toString();

        if (args.source_id) {
          return await httpRequest(
            'DELETE',
            `/content/sources/${encodeURIComponent(String(args.source_id))}${deleteQuery ? `?${deleteQuery}` : ''}`
          );
        } else {
          if (args.source_name) deleteParams.set('source_name', String(args.source_name));
          const deleteByNameQuery = deleteParams.toString();
          return await httpRequest(
            'DELETE',
            `/content/sources${deleteByNameQuery ? `?${deleteByNameQuery}` : ''}`
          );
        }
      }

      case 'generate_audio':
        return await httpRequest('POST', '/content/audio', args);

      case 'generate_content':
        return await httpRequest('POST', '/content/generate', args);

      case 'list_content': {
        const queryParams = new URLSearchParams();
        if (args.notebook_url) queryParams.set('notebook_url', String(args.notebook_url));
        if (args.session_id) queryParams.set('session_id', String(args.session_id));
        const query = queryParams.toString();
        return await httpRequest('GET', `/content${query ? `?${query}` : ''}`);
      }

      case 'download_audio': {
        const downloadParams = new URLSearchParams();
        if (args.output_path) downloadParams.set('output_path', String(args.output_path));
        if (args.notebook_url) downloadParams.set('notebook_url', String(args.notebook_url));
        if (args.session_id) downloadParams.set('session_id', String(args.session_id));
        const downloadQuery = downloadParams.toString();
        return await httpRequest(
          'GET',
          `/content/audio/download${downloadQuery ? `?${downloadQuery}` : ''}`
        );
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Check if HTTP server is not running
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return {
        success: false,
        error:
          `Cannot connect to HTTP server at ${HTTP_BASE_URL}\n\n` +
          'Please ensure the HTTP server is running:\n' +
          '  npm run start:http\n\n' +
          'Or start it as a daemon:\n' +
          '  npm run daemon:start\n\n' +
          `Original error: ${message}`,
      };
    }

    return { success: false, error: message };
  }
}

/**
 * Main Proxy Server Class
 */
class StdioHttpProxyServer {
  private server: Server;
  private toolDefinitions: Tool[];

  constructor() {
    this.server = new Server(
      {
        name: 'notebooklm-mcp-proxy',
        version: '1.3.6',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.toolDefinitions = buildProxyToolDefinitions();
    this.setupHandlers();
    this.setupShutdownHandlers();

    log('🔌 NotebookLM MCP Stdio-HTTP Proxy initialized');
    log(`   Backend: ${HTTP_BASE_URL}`);
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      log('📋 list_tools request');
      return { tools: this.toolDefinitions };
    });

    // List resources (proxy to HTTP server or return empty)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      log('📚 list_resources request');

      // For now, return a simple resource pointing to the library
      const resources: Resource[] = [
        {
          uri: 'notebooklm://library',
          name: 'Notebook Library (via HTTP proxy)',
          description:
            'Access notebook library through HTTP server. Use list_notebooks tool instead.',
          mimeType: 'application/json',
        },
      ];

      return { resources };
    });

    // List resource templates
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      log('📑 list_resource_templates request');
      return { resourceTemplates: [] };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      log(`📖 read_resource: ${uri}`);

      // Proxy library resource to HTTP
      if (uri === 'notebooklm://library') {
        try {
          const result = await httpRequest<{ success: boolean; data?: unknown }>(
            'GET',
            '/notebooks'
          );
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(result.data || result, null, 2),
              },
            ],
          };
        } catch (error) {
          throw new Error(`Failed to fetch library: ${error}`);
        }
      }

      throw new Error(`Unknown resource: ${uri}. Use tools instead of resources with the proxy.`);
    });

    // Handle tool calls - proxy to HTTP server
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      log(`🔧 Tool call: ${name}`);

      const result = await handleToolCall(name, (args || {}) as Record<string, unknown>);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    });
  }

  private setupShutdownHandlers(): void {
    let shuttingDown = false;

    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;

      log(`🛑 Received ${signal}, shutting down...`);

      try {
        await this.server.close();
        log('✅ Proxy shutdown complete');
        process.exit(0);
      } catch (error) {
        log(`❌ Error during shutdown: ${error}`);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  }

  async start(): Promise<void> {
    log('🎯 Starting Stdio-HTTP Proxy...');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    log('✅ Proxy connected via stdio');
    log('🎉 Ready to proxy requests to HTTP server!');
  }
}

/**
 * Main entry point
 */
async function main() {
  console.error('╔══════════════════════════════════════════════════════════╗');
  console.error('║                                                          ║');
  console.error('║     NotebookLM MCP Stdio-HTTP Proxy v1.3.6               ║');
  console.error('║                                                          ║');
  console.error('║   Proxy stdio MCP requests to HTTP server                ║');
  console.error('║                                                          ║');
  console.error('╚══════════════════════════════════════════════════════════╝');
  console.error('');
  console.error(`Backend URL: ${HTTP_BASE_URL}`);
  console.error('');

  try {
    const server = new StdioHttpProxyServer();
    await server.start();
  } catch (error) {
    console.error(`💥 Fatal error: ${error}`);
    process.exit(1);
  }
}

main();
