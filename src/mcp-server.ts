/**
 * Shared MCP server factory.
 *
 * The MCP `Server` — its tool list, its resource list and the CallTool dispatch
 * — is identical whichever transport carries it. `index.ts` wraps it in a stdio
 * transport (how Claude Desktop / Cursor spawn us); the HTTP wrapper mounts the
 * same server on `/mcp` over streamable HTTP, for clients that cannot spawn a
 * local process (a container reaching another container — issue #42). Both get
 * their server from here, over the same managers, so a tool behaves identically
 * on either channel.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
} from '@modelcontextprotocol/sdk/types.js';

import { ToolHandlers } from './tools/index.js';
import { NotebookLibrary } from './library/notebook-library.js';
import { CANONICAL_TO_LEGACY } from './tools/tool-names.js';
import { log } from './utils/logger.js';

export interface McpServerDeps {
  toolHandlers: ToolHandlers;
  library: NotebookLibrary;
  toolDefinitions: Tool[];
  version: string;
}

/**
 * Register the tool and resource handlers on an MCP server, over injected
 * managers. Extracted verbatim from the former `NotebookLMMCPServer.setupHandlers`.
 */
export function registerMcpHandlers(server: Server, deps: McpServerDeps): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log.info('📋 [MCP] list_tools request received');
    return {
      tools: deps.toolDefinitions,
    };
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    log.info('📚 [MCP] list_resources request received');

    const notebooks = deps.library.listNotebooks();
    const resources: Resource[] = [
      {
        uri: 'notebooklm://library',
        name: 'Notebook Library',
        description:
          'Complete notebook library with all available knowledge sources. ' +
          'Read this to discover what notebooks are available. ' +
          "⚠️ If you think a notebook might help with the user's task, " +
          'ASK THE USER FOR PERMISSION before consulting it: ' +
          "'Should I consult the [notebook] for this task?'",
        mimeType: 'application/json',
      },
    ];

    // Add individual notebook resources
    for (const notebook of notebooks) {
      resources.push({
        uri: `notebooklm://library/${notebook.id}`,
        name: notebook.name,
        description:
          `${notebook.description} | Topics: ${notebook.topics.join(', ')} | ` +
          `💡 Use ask_question to query this notebook (ask user permission first if task isn't explicitly about these topics)`,
        mimeType: 'application/json',
      });
    }

    // Add legacy metadata resource for backwards compatibility
    const active = deps.library.getActiveNotebook();
    if (active) {
      resources.push({
        uri: 'notebooklm://metadata',
        name: 'Active Notebook Metadata (Legacy)',
        description:
          'Information about the currently active notebook. ' +
          'DEPRECATED: Use notebooklm://library instead for multi-notebook support. ' +
          "⚠️ Always ask user permission before using notebooks for tasks they didn't explicitly mention.",
        mimeType: 'application/json',
      });
    }

    return { resources };
  });

  // List resource templates
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    log.info('📑 [MCP] list_resource_templates request received');

    return {
      resourceTemplates: [
        {
          uriTemplate: 'notebooklm://library/{id}',
          name: 'Notebook by ID',
          description:
            'Access a specific notebook from your library by ID. ' +
            'Provides detailed metadata about the notebook including topics, use cases, and usage statistics. ' +
            "💡 Use the 'id' parameter from list_notebooks to access specific notebooks.",
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    log.info(`📖 [MCP] read_resource request: ${uri}`);

    // Handle library resource
    if (uri === 'notebooklm://library') {
      const notebooks = deps.library.listNotebooks();
      const stats = deps.library.getStats();
      const active = deps.library.getActiveNotebook();

      const libraryData = {
        active_notebook: active
          ? {
              id: active.id,
              name: active.name,
              description: active.description,
              topics: active.topics,
            }
          : null,
        notebooks: notebooks.map((nb) => ({
          id: nb.id,
          name: nb.name,
          description: nb.description,
          topics: nb.topics,
          content_types: nb.content_types,
          use_cases: nb.use_cases,
          url: nb.url,
          use_count: nb.use_count,
          last_used: nb.last_used,
          tags: nb.tags,
        })),
        stats,
      };

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(libraryData, null, 2),
          },
        ],
      };
    }

    // Handle individual notebook resource
    if (uri.startsWith('notebooklm://library/')) {
      const prefix = 'notebooklm://library/';
      const encodedId = uri.slice(prefix.length);
      if (!encodedId) {
        throw new Error('Notebook resource requires an ID (e.g. notebooklm://library/{id})');
      }

      let id: string;
      try {
        id = decodeURIComponent(encodedId);
      } catch {
        throw new Error(`Invalid notebook identifier encoding: ${encodedId}`);
      }

      if (!/^[a-z0-9][a-z0-9-]{0,62}$/i.test(id)) {
        throw new Error(
          `Invalid notebook identifier: ${encodedId}. Notebook IDs may only contain letters, numbers, and hyphens.`
        );
      }

      const notebook = deps.library.getNotebook(id);

      if (!notebook) {
        throw new Error(`Notebook not found: ${id}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(notebook, null, 2),
          },
        ],
      };
    }

    // Legacy metadata resource (backwards compatibility)
    if (uri === 'notebooklm://metadata') {
      const active = deps.library.getActiveNotebook();

      if (!active) {
        throw new Error('No active notebook. Use notebooklm://library to see all notebooks.');
      }

      const metadata = {
        description: active.description,
        topics: active.topics,
        content_types: active.content_types,
        use_cases: active.use_cases,
        notebook_url: active.url,
        notebook_id: active.id,
        last_used: active.last_used,
        use_count: active.use_count,
        note: 'DEPRECATED: Use notebooklm://library or notebooklm://library/{id} instead',
      };

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(metadata, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // Argument completions (for prompt arguments)
  // Note: Completions are optional and not supported by all MCP clients (e.g., Claude Desktop)
  // We skip registering this handler to maintain compatibility
  // server.setRequestHandler(CompleteRequestSchema, async (request) => {
  //   const { ref, argument } = request.params as any;
  //   try {
  //     if (ref?.type === "ref/resource") {
  //       // Complete variables for resource templates
  //       const uri = String(ref.uri || "");
  //       // Notebook by ID template
  //       if (uri === "notebooklm://library/{id}" && argument?.name === "id") {
  //         const values = this.completeNotebookIds(argument?.value);
  //         return this.buildCompletion(values) as any;
  //       }
  //     }
  //   } catch (e) {
  //     log.warning(`⚠️  [MCP] completion error: ${e}`);
  //   }
  //   return { completion: { values: [], total: 0 } } as any;
  // });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: requestedName, arguments: args } = request.params;
    // v2 tools are advertised under canonical (v2) names
    // (e.g. `notebook_ask`). The dispatch switch and handlers still use the
    // legacy flat names internally — and legacy names remain accepted as
    // aliases, so existing integrations keep working.
    const name = CANONICAL_TO_LEGACY[requestedName] ?? requestedName;
    const progressToken = (args as Record<string, unknown> | undefined)?._meta as
      | { progressToken?: string }
      | undefined;
    const token = progressToken?.progressToken;

    log.info(`🔧 [MCP] Tool call: ${name}`);
    if (token) {
      log.info(`  📊 Progress token: ${token}`);
    }

    // Create progress callback function
    const sendProgress = async (message: string, progress?: number, total?: number) => {
      if (token) {
        await server.notification({
          method: 'notifications/progress',
          params: {
            progressToken: token,
            message,
            ...(progress !== undefined && { progress }),
            ...(total !== undefined && { total }),
          },
        });
        log.dim(`  📊 Progress: ${message}`);
      }
    };

    try {
      let result;

      switch (name) {
        case 'ask_question':
          result = await deps.toolHandlers.handleAskQuestion(
            args as {
              question: string;
              session_id?: string;
              notebook_id?: string;
              notebook_url?: string;
              show_browser?: boolean;
            },
            sendProgress
          );
          break;

        case 'batch_to_vault':
          result = await deps.toolHandlers.handleBatchToVault(
            args as {
              questions: string[];
              vault_dir: string;
              notebook_id?: string;
              notebook_url?: string;
              slug_prefix?: string;
              source_format?: 'none' | 'inline' | 'footnotes' | 'json' | 'expanded';
              sleep_between_ms?: number;
              session_id?: string;
            }
          );
          break;

        case 'auto_discover_notebook':
          result = await deps.toolHandlers.handleAutoDiscoverNotebook(args as { url: string });
          break;

        case 'add_notebook':
          result = await deps.toolHandlers.handleAddNotebook(
            args as {
              url: string;
              name: string;
              description: string;
              topics: string[];
              content_types?: string[];
              use_cases?: string[];
              tags?: string[];
            }
          );
          break;

        case 'list_notebooks':
          result = await deps.toolHandlers.handleListNotebooks();
          break;

        case 'get_notebook':
          result = await deps.toolHandlers.handleGetNotebook(args as { id: string });
          break;

        case 'select_notebook':
          result = await deps.toolHandlers.handleSelectNotebook(args as { id: string });
          break;

        case 'update_notebook':
          result = await deps.toolHandlers.handleUpdateNotebook(
            args as {
              id: string;
              name?: string;
              description?: string;
              topics?: string[];
              content_types?: string[];
              use_cases?: string[];
              tags?: string[];
              url?: string;
            }
          );
          break;

        case 'remove_notebook':
          result = await deps.toolHandlers.handleRemoveNotebook(args as { id: string });
          break;

        case 'search_notebooks':
          result = await deps.toolHandlers.handleSearchNotebooks(args as { query: string });
          break;

        case 'get_library_stats':
          result = await deps.toolHandlers.handleGetLibraryStats();
          break;

        case 'list_sessions':
          result = await deps.toolHandlers.handleListSessions();
          break;

        case 'close_session':
          result = await deps.toolHandlers.handleCloseSession(args as { session_id: string });
          break;

        case 'reset_session':
          result = await deps.toolHandlers.handleResetSession(args as { session_id: string });
          break;

        case 'get_health':
          result = await deps.toolHandlers.handleGetHealth();
          break;

        case 'setup_auth':
          result = await deps.toolHandlers.handleSetupAuth(
            args as { show_browser?: boolean },
            sendProgress
          );
          break;

        case 'de_auth':
          result = await deps.toolHandlers.handleDeAuth();
          break;

        case 're_auth':
          result = await deps.toolHandlers.handleReAuth(
            args as { show_browser?: boolean },
            sendProgress
          );
          break;

        case 'cleanup_data':
          result = await deps.toolHandlers.handleCleanupData(args as { confirm: boolean });
          break;

        // Content Management Tools
        case 'add_source':
          result = await deps.toolHandlers.handleAddSource(
            args as {
              source_type: 'file' | 'url' | 'text' | 'youtube' | 'google_drive';
              file_path?: string;
              url?: string;
              text?: string;
              title?: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'delete_source':
          result = await deps.toolHandlers.handleDeleteSource(
            args as {
              source_id?: string;
              source_name?: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'list_sources':
          result = await deps.toolHandlers.handleListSources(
            args as { notebook_url?: string; notebook_id?: string }
          );
          break;

        case 'read_source':
          result = await deps.toolHandlers.handleReadSource(
            args as {
              source_id?: string;
              source_name?: string;
              notebook_url?: string;
              notebook_id?: string;
              format?: 'text' | 'html';
              paginate?: boolean;
              max_chars?: number;
              cursor?: number;
            }
          );
          break;

        case 'delete_content':
          result = await deps.toolHandlers.handleDeleteContent(
            args as { content_id: string; notebook_url?: string; notebook_id?: string }
          );
          break;

        case 'generate_content':
          result = await deps.toolHandlers.handleGenerateContent(
            args as {
              content_type: 'audio_overview';
              custom_instructions?: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'list_content':
          result = await deps.toolHandlers.handleListContent(
            args as {
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'download_content':
          result = await deps.toolHandlers.handleDownloadContent(
            args as {
              content_type:
                | 'audio_overview'
                | 'video'
                | 'infographic'
                | 'presentation'
                | 'data_table';
              output_path?: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'create_note':
          result = await deps.toolHandlers.handleCreateNote(
            args as {
              title: string;
              content: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'list_notes':
          result = await deps.toolHandlers.handleListNotes(
            args as {
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'get_note':
          result = await deps.toolHandlers.handleGetNote(
            args as {
              note_title: string;
              note_id?: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'save_chat_to_note':
          result = await deps.toolHandlers.handleSaveChatToNote(
            args as {
              title?: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'convert_note_to_source':
          result = await deps.toolHandlers.handleConvertNoteToSource(
            args as {
              note_title: string;
              notebook_url?: string;
              session_id?: string;
            }
          );
          break;

        case 'list_notebooks_from_nblm':
          result = await deps.toolHandlers.handleListNotebooksFromNblm(
            args as { show_browser?: boolean },
            sendProgress
          );
          break;

        case 'create_notebook':
          result = await deps.toolHandlers.handleCreateNotebook(
            args as { name?: string; show_browser?: boolean },
            sendProgress
          );
          break;

        case 'delete_notebooks_from_nblm':
          result = await deps.toolHandlers.handleDeleteNotebooksFromNblm(
            args as { notebook_ids: string[]; show_browser?: boolean },
            sendProgress
          );
          break;

        case 'rename_source':
          result = await deps.toolHandlers.handleRenameSource(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              source_id?: string;
              source_name?: string;
              title: string;
            }
          );
          break;

        case 'check_source_freshness':
          result = await deps.toolHandlers.handleSourceFreshness(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              source_id?: string;
              source_name?: string;
            }
          );
          break;

        case 'get_source_guide':
          result = await deps.toolHandlers.handleSourceGuide(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              source_id?: string;
              source_name?: string;
            }
          );
          break;

        case 'search_passages':
          result = await deps.toolHandlers.handleSearchPassages(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              query?: string;
              source_ids?: string[];
              source_names?: string[];
              limit?: number;
            }
          );
          break;

        case 'get_notebook_summary':
          result = await deps.toolHandlers.handleNotebookSummary(
            args as { notebook_url?: string; notebook_id?: string }
          );
          break;

        case 'get_chat_history':
          result = await deps.toolHandlers.handleChatHistory(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              conversation_id?: string;
              limit?: number;
            }
          );
          break;

        case 'delete_chat_history':
          result = await deps.toolHandlers.handleDeleteChatHistory(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              conversation_id?: string;
            }
          );
          break;

        case 'cancel_answer':
          result = await deps.toolHandlers.handleCancelAnswer(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              conversation_id?: string;
            }
          );
          break;

        case 'cancel_research':
          result = await deps.toolHandlers.handleCancelResearch(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              run_id?: string;
            }
          );
          break;

        case 'retry_content':
          result = await deps.toolHandlers.handleRetryContent(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              content_id?: string;
            }
          );
          break;

        case 'export_artifact':
          result = await deps.toolHandlers.handleExportArtifact(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              artifact_id: string;
              target?: 'docs' | 'sheets';
              title?: string;
            }
          );
          break;

        case 'revise_slide':
          result = await deps.toolHandlers.handleReviseSlide(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              artifact_id: string;
              slide_index: number;
              prompt: string;
            }
          );
          break;

        case 'share_notebook':
          result = await deps.toolHandlers.handleNotebookSharing(
            args as { notebook_url?: string; notebook_id?: string; set_public?: boolean }
          );
          break;

        case 'generate_study_aid':
          result = await deps.toolHandlers.handleGenerateStudyAid(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              kind: 'flashcards' | 'quiz';
              focus?: string;
              language?: string;
            }
          );
          break;

        case 'generate_mind_map':
          result = await deps.toolHandlers.handleGenerateMindMap(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              title?: string;
              language?: string;
              focus?: string;
            }
          );
          break;

        case 'manage_labels':
          result = await deps.toolHandlers.handleLabels(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              action?: 'list' | 'create' | 'delete';
              name?: string;
              emoji?: string;
              label_ids?: string[];
            }
          );
          break;

        case 'research_sources':
          result = await deps.toolHandlers.handleResearchSources(
            args as {
              notebook_url?: string;
              notebook_id?: string;
              query: string;
              import?: boolean;
            }
          );
          break;

        case 'get_usage':
          result = await deps.toolHandlers.handleGetUsage();
          break;

        default:
          log.error(`❌ [MCP] Unknown tool: ${name}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Unknown tool: ${name}`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
      }

      // Return result — both as text (for display) and as structuredContent
      // (matching each tool's outputSchema: the ToolResult envelope).
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [MCP] Tool execution error: ${errorMessage}`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: errorMessage,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  });
}

/** Build a fully-configured MCP server, ready to connect to any transport. */
export function createMcpServer(deps: McpServerDeps): Server {
  const server = new Server(
    { name: 'notebooklm-mcp', version: deps.version },
    { capabilities: { tools: {}, resources: {} } }
  );
  registerMcpHandlers(server, deps);
  return server;
}
