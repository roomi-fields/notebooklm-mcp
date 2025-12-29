/**
 * HTTP Wrapper for NotebookLM MCP Server
 *
 * Exposes the MCP server via HTTP REST API
 * Allows n8n and other tools to call the server without stdio
 */

import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AuthManager } from './auth/auth-manager.js';
import { SessionManager } from './session/session-manager.js';
import { NotebookLibrary } from './library/notebook-library.js';
import { ToolHandlers } from './tools/index.js';
import { AutoDiscovery } from './auto-discovery/auto-discovery.js';
import { log } from './utils/logger.js';

// Extend Express Request to include requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Request ID middleware for debugging and log correlation
app.use((req: Request, res: Response, next: NextFunction) => {
  // Use existing X-Request-ID header or generate a new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// CORS for n8n
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize managers
const authManager = new AuthManager();
const sessionManager = new SessionManager(authManager);
const library = new NotebookLibrary(sessionManager);
const toolHandlers = new ToolHandlers(sessionManager, authManager, library);

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleGetHealth();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Ask question
app.post('/ask', async (req: Request, res: Response) => {
  const reqId = req.requestId.substring(0, 8); // Short ID for logs
  try {
    const { question, session_id, notebook_id, notebook_url, show_browser } = req.body;

    if (!question) {
      log.warning(`[${reqId}] /ask - Missing question`);
      return res.status(400).json({
        success: false,
        error: 'Missing required field: question',
      });
    }

    log.info(`[${reqId}] /ask - "${question.substring(0, 50)}..."`);

    const result = await toolHandlers.handleAskQuestion(
      { question, session_id, notebook_id, notebook_url, show_browser },
      async (message, progress, total) => {
        log.info(`[${reqId}] Progress: ${message} (${progress}/${total})`);
      }
    );

    log.success(`[${reqId}] /ask - Completed`);
    res.json(result);
  } catch (error) {
    log.error(`[${reqId}] /ask - Error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Setup auth
app.post('/setup-auth', async (req: Request, res: Response) => {
  try {
    const { show_browser } = req.body;

    const result = await toolHandlers.handleSetupAuth(
      { show_browser },
      async (message, progress, total) => {
        log.info(`Progress: ${message} (${progress}/${total})`);
      }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// De-authenticate (logout)
app.post('/de-auth', async (_req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleDeAuth();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Re-authenticate
app.post('/re-auth', async (req: Request, res: Response) => {
  try {
    const { show_browser } = req.body;

    const result = await toolHandlers.handleReAuth(
      { show_browser },
      async (message, progress, total) => {
        log.info(`Progress: ${message} (${progress}/${total})`);
      }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Cleanup data
app.post('/cleanup-data', async (req: Request, res: Response) => {
  try {
    const { confirm, preserve_library } = req.body;
    const result = await toolHandlers.handleCleanupData({ confirm, preserve_library });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// List notebooks
app.get('/notebooks', async (_req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleListNotebooks();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Add notebook
app.post('/notebooks', async (req: Request, res: Response) => {
  try {
    const { url, name, description, topics, content_types, use_cases, tags } = req.body;

    if (!url || !name || !description || !topics) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: url, name, description, topics',
      });
    }

    const result = await toolHandlers.handleAddNotebook({
      url,
      name,
      description,
      topics,
      content_types,
      use_cases,
      tags,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Search notebooks (MUST be before /notebooks/:id to avoid being shadowed)
app.get('/notebooks/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query parameter',
      });
    }
    const result = await toolHandlers.handleSearchNotebooks({ query });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get library stats (MUST be before /notebooks/:id to avoid being shadowed)
app.get('/notebooks/stats', async (_req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleGetLibraryStats();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get notebook
app.get('/notebooks/:id', async (req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleGetNotebook({ id: req.params.id });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Update notebook
app.put('/notebooks/:id', async (req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleUpdateNotebook({
      id: req.params.id,
      ...req.body,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Delete notebook
app.delete('/notebooks/:id', async (req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleRemoveNotebook({ id: req.params.id });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Auto-discover notebook metadata
app.post('/notebooks/auto-discover', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    // Validate URL is provided
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: url',
      });
    }

    // Validate it's a NotebookLM URL (proper URL parsing to prevent bypass)
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== 'notebooklm.google.com') {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL: must be a NotebookLM URL (notebooklm.google.com)',
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      });
    }

    // Create AutoDiscovery instance and discover metadata
    const autoDiscovery = new AutoDiscovery(sessionManager);

    let metadata;
    try {
      metadata = await autoDiscovery.discoverMetadata(url);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to discover metadata: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Transform metadata to NotebookLibrary format
    // - tags → topics (rename field)
    // - Add default content_types
    // - Add default use_cases based on first few tags
    const notebookInput = {
      url,
      name: metadata.name,
      description: metadata.description,
      topics: metadata.tags, // tags → topics
      content_types: ['documentation'],
      use_cases: metadata.tags.slice(0, 3), // Use first 3 tags as use cases
      auto_generated: true,
    };

    // Add notebook to library
    let notebook;
    try {
      notebook = await library.addNotebook(notebookInput);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Failed to add notebook to library: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Return success with created notebook
    res.json({
      success: true,
      notebook,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Activate notebook (set as active)
app.put('/notebooks/:id/activate', async (req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleSelectNotebook({ id: req.params.id });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// List sessions
app.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleListSessions();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Close session
app.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleCloseSession({ session_id: req.params.id });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Reset session
app.post('/sessions/:id/reset', async (req: Request, res: Response) => {
  try {
    const result = await toolHandlers.handleResetSession({ session_id: req.params.id });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ========================================
// Content Management Routes
// ========================================

// Add source to notebook
app.post('/content/sources', async (req: Request, res: Response) => {
  try {
    const { source_type, file_path, url, text, title, notebook_url, session_id } = req.body;

    if (!source_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: source_type',
      });
    }

    const result = await toolHandlers.handleAddSource({
      source_type,
      file_path,
      url,
      text,
      title,
      notebook_url,
      session_id,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Generate audio overview
app.post('/content/audio', async (req: Request, res: Response) => {
  try {
    const { custom_instructions, notebook_url, session_id } = req.body;

    const result = await toolHandlers.handleGenerateAudio({
      custom_instructions,
      notebook_url,
      session_id,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Generate content (briefing, study guide, FAQ, etc.)
app.post('/content/generate', async (req: Request, res: Response) => {
  try {
    const { content_type, custom_instructions, notebook_url, session_id } = req.body;

    if (!content_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: content_type',
      });
    }

    const result = await toolHandlers.handleGenerateContent({
      content_type,
      custom_instructions,
      notebook_url,
      session_id,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// List sources and generated content
app.get('/content', async (req: Request, res: Response) => {
  try {
    const { notebook_url, session_id } = req.query;

    const result = await toolHandlers.handleListContent({
      notebook_url: typeof notebook_url === 'string' ? notebook_url : undefined,
      session_id: typeof session_id === 'string' ? session_id : undefined,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Download audio file
app.get('/content/audio/download', async (req: Request, res: Response) => {
  try {
    const { output_path, notebook_url, session_id } = req.query;

    const result = await toolHandlers.handleDownloadAudio({
      output_path: typeof output_path === 'string' ? output_path : undefined,
      notebook_url: typeof notebook_url === 'string' ? notebook_url : undefined,
      session_id: typeof session_id === 'string' ? session_id : undefined,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Add note with research
app.post('/content/notes', async (req: Request, res: Response) => {
  try {
    const { topic, mode, custom_instructions, notebook_url, session_id } = req.body;

    if (!topic || !mode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: topic, mode',
      });
    }

    if (mode !== 'fast' && mode !== 'deep') {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "fast" or "deep"',
      });
    }

    const result = await toolHandlers.handleAddNote({
      topic,
      mode,
      custom_instructions,
      notebook_url,
      session_id,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Global error handler - catches any unhandled errors in async routes
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const reqId = req.requestId?.substring(0, 8) || 'unknown';
  log.error(`[${reqId}] Unhandled error: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId: req.requestId,
  });
});

// Start server
const PORT = Number(process.env.HTTP_PORT) || 3000;
const HOST = process.env.HTTP_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  log.success(`🌐 NotebookLM MCP HTTP Server v1.4.2`);
  log.success(`   Listening on ${HOST}:${PORT}`);
  log.info('');
  log.info('📊 Quick Links:');
  log.info(`   Health check: http://localhost:${PORT}/health`);
  log.info(`   API endpoint: http://localhost:${PORT}/ask`);
  log.info('');
  log.info('📖 Available Endpoints:');
  log.info('   Authentication:');
  log.info('   POST   /setup-auth             First-time authentication');
  log.info('   POST   /de-auth                Logout (clear credentials)');
  log.info('   POST   /re-auth                Re-authenticate / switch account');
  log.info('   POST   /cleanup-data           Clean all data (requires confirm)');
  log.info('');
  log.info('   Queries:');
  log.info('   POST   /ask                    Ask a question to NotebookLM');
  log.info('   GET    /health                 Server health check');
  log.info('');
  log.info('   Notebooks:');
  log.info('   GET    /notebooks              List all notebooks');
  log.info('   POST   /notebooks              Add a new notebook');
  log.info('   POST   /notebooks/auto-discover Auto-discover notebook metadata');
  log.info('   GET    /notebooks/search       Search notebooks by query');
  log.info('   GET    /notebooks/stats        Get library statistics');
  log.info('   GET    /notebooks/:id          Get notebook details');
  log.info('   PUT    /notebooks/:id          Update notebook metadata');
  log.info('   DELETE /notebooks/:id          Delete a notebook');
  log.info('   PUT    /notebooks/:id/activate Activate a notebook (set as default)');
  log.info('');
  log.info('   Sessions:');
  log.info('   GET    /sessions               List active sessions');
  log.info('   POST   /sessions/:id/reset     Reset session history');
  log.info('   DELETE /sessions/:id           Close a session');
  log.info('');
  log.info('   Content Management:');
  log.info('   POST   /content/sources        Add source to notebook');
  log.info('   POST   /content/audio          Generate audio overview');
  log.info('   POST   /content/generate       Generate content (briefing, etc.)');
  log.info('   POST   /content/notes          Add note with research (fast/deep)');
  log.info('   GET    /content                List sources and content');
  log.info('   GET    /content/audio/download Download audio file');
  log.info('');
  log.info('💡 Configuration:');
  log.info(
    `   Host: ${HOST} ${HOST === '0.0.0.0' ? '(accessible from network)' : '(localhost only)'}`
  );
  log.info(`   Port: ${PORT}`);
  log.info('');
  log.dim('📖 Documentation: ./deployment/docs/');
  log.dim('⏹️  Press Ctrl+C to stop');
});

// Graceful shutdown with error handling
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down gracefully...');
  try {
    await toolHandlers.cleanup();
  } catch (error) {
    log.error(`Cleanup failed: ${error}`);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down gracefully...');
  try {
    await toolHandlers.cleanup();
  } catch (error) {
    log.error(`Cleanup failed: ${error}`);
  }
  process.exit(0);
});
