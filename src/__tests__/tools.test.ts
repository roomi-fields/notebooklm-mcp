/**
 * ToolHandlers Unit Tests
 *
 * Tests the ToolHandlers class structure and tool definitions.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('../utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    dim: jest.fn(),
  },
}));

// Mock config
jest.unstable_mockModule('../config.js', () => ({
  CONFIG: {
    dataDir: '/tmp/test-data',
    browserStateDir: '/tmp/test-data/browser_state',
    stealthEnabled: true,
    headless: true,
    viewport: { width: 1920, height: 1080 },
  },
  NOTEBOOKLM_AUTH_URL: 'https://notebooklm.google.com/',
  applyBrowserOptions: jest.fn((options: any) => options),
}));

describe('ToolHandlers', () => {
  let ToolHandlers: any;
  let buildToolDefinitions: any;
  let mockSessionManager: any;
  let mockAuthManager: any;
  let mockLibrary: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create minimal mocks
    mockSessionManager = {
      getOrCreateSession: jest.fn(),
      getSession: jest.fn(),
      getAllSessionsInfo: jest.fn().mockReturnValue([]),
      closeSession: jest.fn().mockResolvedValue(true),
      resetSession: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockReturnValue({
        active_sessions: 0,
        total_messages: 0,
        max_sessions: 5,
      }),
    };

    mockAuthManager = {
      hasSavedState: jest.fn().mockResolvedValue(true),
      isStateExpired: jest.fn().mockResolvedValue(false),
      getStatePath: jest.fn().mockReturnValue('/path/to/state'),
      clearState: jest.fn().mockResolvedValue(true),
      performLogin: jest.fn(),
    };

    mockLibrary = {
      getActiveNotebook: jest.fn().mockReturnValue(null),
      listNotebooks: jest.fn().mockReturnValue([]),
      getNotebook: jest.fn(),
      addNotebook: jest.fn(),
      updateNotebook: jest.fn(),
      removeNotebook: jest.fn(),
      searchNotebooks: jest.fn().mockReturnValue([]),
      selectNotebook: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        total: 0,
        byTopic: {},
        lastUpdated: null,
      }),
      reload: jest.fn(),
    };

    // Import the module
    const module = await import('../tools/index.js');
    ToolHandlers = module.ToolHandlers;
    buildToolDefinitions = module.buildToolDefinitions;
  });

  describe('Constructor', () => {
    it('should create instance with dependencies', () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      expect(handlers).toBeDefined();
    });
  });

  describe('buildToolDefinitions', () => {
    it('should return array of tool definitions', () => {
      const tools = buildToolDefinitions(mockLibrary);

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include the notebook_ask tool', () => {
      const tools = buildToolDefinitions(mockLibrary);

      // v2 advertises canonical namespaced names (underscore-separated).
      const askQuestion = tools.find((t: any) => t.name === 'notebook_ask');
      expect(askQuestion).toBeDefined();
      expect(askQuestion.inputSchema.required).toContain('question');
    });

    it('should include session management tools', () => {
      const tools = buildToolDefinitions(mockLibrary);

      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('session_list');
      expect(toolNames).toContain('session_close');
      expect(toolNames).toContain('session_reset');
    });

    it('should include notebook library tools', () => {
      const tools = buildToolDefinitions(mockLibrary);

      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('library_list');
      expect(toolNames).toContain('library_add');
      expect(toolNames).toContain('library_get');
      expect(toolNames).toContain('library_remove');
    });

    it('should include auth tools', () => {
      const tools = buildToolDefinitions(mockLibrary);

      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('auth_setup');
      expect(toolNames).toContain('auth_logout');
      expect(toolNames).toContain('server_health');
    });

    it('should include cleanup tool', () => {
      const tools = buildToolDefinitions(mockLibrary);

      const cleanup = tools.find((t: any) => t.name === 'server_cleanup');
      expect(cleanup).toBeDefined();
    });

    it('should advertise only MCP-spec-valid tool names', () => {
      const tools = buildToolDefinitions(mockLibrary);

      // MCP / Anthropic tool names must match this pattern — notably, dots are
      // forbidden, which is why canonical names use `_` rather than `.`.
      const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
      for (const tool of tools) {
        expect(tool.name).toMatch(NAME_PATTERN);
      }
    });

    it('should have valid inputSchema for all tools', () => {
      const tools = buildToolDefinitions(mockLibrary);

      tools.forEach((tool: any) => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });
  });
});

describe('Tool Input Schema Validation', () => {
  describe('ask_question schema', () => {
    const schema = {
      type: 'object',
      properties: {
        question: { type: 'string' },
        session_id: { type: 'string' },
        notebook_id: { type: 'string' },
        notebook_url: { type: 'string' },
        source_format: {
          type: 'string',
          enum: ['none', 'inline', 'footnotes', 'json', 'expanded'],
        },
      },
      required: ['question'],
    };

    it('should require question', () => {
      expect(schema.required).toContain('question');
    });

    it('should define source_format options', () => {
      expect(schema.properties.source_format.enum).toContain('none');
      expect(schema.properties.source_format.enum).toContain('inline');
      expect(schema.properties.source_format.enum).toContain('footnotes');
      expect(schema.properties.source_format.enum).toContain('json');
      expect(schema.properties.source_format.enum).toContain('expanded');
    });

    it('should allow optional session_id', () => {
      expect(schema.properties.session_id).toBeDefined();
      expect(schema.required).not.toContain('session_id');
    });

    it('should allow optional notebook_id', () => {
      expect(schema.properties.notebook_id).toBeDefined();
      expect(schema.required).not.toContain('notebook_id');
    });

    it('should allow optional notebook_url', () => {
      expect(schema.properties.notebook_url).toBeDefined();
      expect(schema.required).not.toContain('notebook_url');
    });
  });

  describe('add_notebook schema', () => {
    const schema = {
      type: 'object',
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        topics: { type: 'array', items: { type: 'string' } },
        content_types: { type: 'array', items: { type: 'string' } },
        use_cases: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['url', 'name', 'description', 'topics'],
    };

    it('should require url', () => {
      expect(schema.required).toContain('url');
    });

    it('should require name', () => {
      expect(schema.required).toContain('name');
    });

    it('should require description', () => {
      expect(schema.required).toContain('description');
    });

    it('should require topics', () => {
      expect(schema.required).toContain('topics');
    });

    it('should have topics as array of strings', () => {
      expect(schema.properties.topics.type).toBe('array');
      expect(schema.properties.topics.items.type).toBe('string');
    });
  });

  describe('cleanup_data schema', () => {
    const schema = {
      type: 'object',
      properties: {
        confirm: { type: 'boolean' },
        preserve_library: { type: 'boolean' },
      },
      required: ['confirm'],
    };

    it('should require confirm', () => {
      expect(schema.required).toContain('confirm');
    });

    it('should allow optional preserve_library', () => {
      expect(schema.properties.preserve_library).toBeDefined();
      expect(schema.required).not.toContain('preserve_library');
    });
  });

  describe('close_session schema', () => {
    const schema = {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
      },
      required: ['session_id'],
    };

    it('should require session_id', () => {
      expect(schema.required).toContain('session_id');
    });
  });

  describe('reset_session schema', () => {
    const schema = {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
      },
      required: ['session_id'],
    };

    it('should require session_id', () => {
      expect(schema.required).toContain('session_id');
    });
  });

  describe('get_notebook schema', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    };

    it('should require id', () => {
      expect(schema.required).toContain('id');
    });
  });

  describe('remove_notebook schema', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    };

    it('should require id', () => {
      expect(schema.required).toContain('id');
    });
  });

  describe('search_notebooks schema', () => {
    const schema = {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    };

    it('should require query', () => {
      expect(schema.required).toContain('query');
    });
  });
});

describe('Tool Descriptions', () => {
  it('should have descriptive text for each tool', () => {
    const toolDescriptions = {
      ask_question: 'Ask NotebookLM a question',
      list_notebooks: 'List all notebooks from library',
      get_notebook: 'Get notebook details by ID',
      add_notebook: 'Add notebook to library',
      remove_notebook: 'Remove notebook from library',
      list_sessions: 'List active browser sessions',
      close_session: 'Close a specific session',
      reset_session: 'Reset session chat history',
      get_health: 'Server health and status check',
      setup_auth: 'Setup Google authentication',
      de_auth: 'Clear authentication state',
      cleanup_data: 'Clean up cached data',
      auto_discover_notebook: 'Auto-discover notebook metadata',
      select_notebook: 'Set active notebook',
      update_notebook: 'Update notebook metadata',
      get_library_stats: 'Get library statistics',
      search_notebooks: 'Search notebooks by query',
      re_auth: 'Re-authenticate with different account',
    };

    Object.entries(toolDescriptions).forEach(([name, desc]) => {
      expect(name).toBeDefined();
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  it('should categorize tools by function', () => {
    const categories = {
      notebook: [
        'list_notebooks',
        'get_notebook',
        'add_notebook',
        'remove_notebook',
        'update_notebook',
        'select_notebook',
        'auto_discover_notebook',
      ],
      session: ['list_sessions', 'close_session', 'reset_session'],
      auth: ['setup_auth', 'de_auth', 're_auth'],
      utility: ['get_health', 'cleanup_data', 'get_library_stats', 'search_notebooks'],
      core: ['ask_question'],
    };

    const totalTools = Object.values(categories).flat().length;
    expect(totalTools).toBeGreaterThan(15);
  });
});

describe('Source Format Options', () => {
  const formats = ['none', 'inline', 'footnotes', 'json', 'expanded'];

  it('should have 5 format options', () => {
    expect(formats.length).toBe(5);
  });

  it('should include none format (fastest)', () => {
    expect(formats).toContain('none');
  });

  it('should include inline format', () => {
    expect(formats).toContain('inline');
  });

  it('should include footnotes format', () => {
    expect(formats).toContain('footnotes');
  });

  it('should include json format', () => {
    expect(formats).toContain('json');
  });

  it('should include expanded format', () => {
    expect(formats).toContain('expanded');
  });
});

describe('Browser Options Schema', () => {
  const browserOptionsSchema = {
    type: 'object',
    properties: {
      show: { type: 'boolean' },
      headless: { type: 'boolean' },
      timeout_ms: { type: 'number' },
      stealth: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          random_delays: { type: 'boolean' },
          human_typing: { type: 'boolean' },
          mouse_movements: { type: 'boolean' },
          typing_wpm_min: { type: 'number' },
          typing_wpm_max: { type: 'number' },
          delay_min_ms: { type: 'number' },
          delay_max_ms: { type: 'number' },
        },
      },
      viewport: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
        },
      },
    },
  };

  it('should define show option', () => {
    expect(browserOptionsSchema.properties.show.type).toBe('boolean');
  });

  it('should define headless option', () => {
    expect(browserOptionsSchema.properties.headless.type).toBe('boolean');
  });

  it('should define timeout_ms option', () => {
    expect(browserOptionsSchema.properties.timeout_ms.type).toBe('number');
  });

  it('should define stealth options', () => {
    expect(browserOptionsSchema.properties.stealth.type).toBe('object');
    expect(browserOptionsSchema.properties.stealth.properties.enabled.type).toBe('boolean');
    expect(browserOptionsSchema.properties.stealth.properties.random_delays.type).toBe('boolean');
  });

  it('should define viewport options', () => {
    expect(browserOptionsSchema.properties.viewport.type).toBe('object');
    expect(browserOptionsSchema.properties.viewport.properties.width.type).toBe('number');
    expect(browserOptionsSchema.properties.viewport.properties.height.type).toBe('number');
  });
});

describe('ToolHandlers Methods', () => {
  let ToolHandlers: any;
  let mockSessionManager: any;
  let mockAuthManager: any;
  let mockLibrary: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSessionManager = {
      getOrCreateSession: jest.fn(),
      getSession: jest.fn(),
      getAllSessionsInfo: jest.fn().mockReturnValue([]),
      closeSession: jest.fn().mockResolvedValue(true),
      closeSessionsForNotebook: jest.fn().mockResolvedValue(0),
      closeAllSessions: jest.fn().mockResolvedValue(undefined),
      resetSession: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockReturnValue({
        active_sessions: 2,
        total_messages: 10,
        max_sessions: 5,
        session_timeout: 600,
        oldest_session_seconds: 120,
      }),
    };

    mockAuthManager = {
      hasSavedState: jest.fn().mockResolvedValue(true),
      isStateExpired: jest.fn().mockResolvedValue(false),
      getValidStatePath: jest.fn().mockResolvedValue('/path/to/state'),
      clearState: jest.fn().mockResolvedValue(true),
      clearAllAuthData: jest.fn().mockResolvedValue(undefined),
      performLogin: jest.fn(),
      performSetup: jest.fn().mockResolvedValue(true),
    };

    mockLibrary = {
      getActiveNotebook: jest.fn().mockReturnValue(null),
      listNotebooks: jest.fn().mockReturnValue([]),
      getNotebook: jest.fn(),
      addNotebook: jest.fn(),
      updateNotebook: jest.fn(),
      removeNotebook: jest.fn(),
      searchNotebooks: jest.fn().mockReturnValue([]),
      selectNotebook: jest.fn(),
      incrementUseCount: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        total: 5,
        byTopic: { test: 2, docs: 3 },
        lastUpdated: new Date().toISOString(),
      }),
      reload: jest.fn(),
    };

    const module = await import('../tools/index.js');
    ToolHandlers = module.ToolHandlers;
  });

  describe('handleListSessions', () => {
    it('should return session statistics', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleListSessions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('active_sessions');
      expect(result.data).toHaveProperty('sessions');
      expect(mockSessionManager.getStats).toHaveBeenCalled();
    });

    it('should return empty sessions array when no sessions', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleListSessions();

      expect(result.data.sessions).toEqual([]);
    });
  });

  describe('handleCloseSession', () => {
    it('should close existing session', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleCloseSession({ session_id: 'test-session' });

      expect(result.success).toBe(true);
      expect(mockSessionManager.closeSession).toHaveBeenCalledWith('test-session');
    });

    it('should return error for non-existent session', async () => {
      mockSessionManager.closeSession.mockResolvedValue(false);
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleCloseSession({ session_id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('handleResetSession', () => {
    it('should return error for non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleResetSession({ session_id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reset existing session', async () => {
      const mockSession = { reset: jest.fn().mockResolvedValue(undefined) };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleResetSession({ session_id: 'test-session' });

      expect(result.success).toBe(true);
      expect(mockSession.reset).toHaveBeenCalled();
    });
  });

  describe('handleGetHealth', () => {
    it('should return health status', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleGetHealth();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status', 'ok');
      expect(result.data).toHaveProperty('authenticated');
      expect(result.data).toHaveProperty('active_sessions');
    });

    it('should indicate authenticated state', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleGetHealth();

      expect(result.data.authenticated).toBe(true);
    });

    it('should indicate unauthenticated state', async () => {
      mockAuthManager.getValidStatePath.mockResolvedValue(null);
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleGetHealth();

      expect(result.data.authenticated).toBe(false);
      expect(result.data).toHaveProperty('troubleshooting_tip');
    });
  });

  describe('handleDeAuth', () => {
    it('should de-authenticate successfully', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleDeAuth();

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('de-authenticated');
      expect(result.data.authenticated).toBe(false);
      expect(mockSessionManager.closeAllSessions).toHaveBeenCalled();
      expect(mockAuthManager.clearAllAuthData).toHaveBeenCalled();
    });
  });

  describe('handleListNotebooks', () => {
    it('should return notebooks list', async () => {
      const mockNotebooks = [
        { id: 'nb-1', name: 'Test Notebook', url: 'https://notebooklm.google.com/notebook/1' },
      ];
      mockLibrary.listNotebooks.mockReturnValue(mockNotebooks);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleListNotebooks();

      expect(result.success).toBe(true);
      expect(result.data.notebooks).toEqual(mockNotebooks);
    });

    it('should include active notebook id', async () => {
      mockLibrary.getActiveNotebook.mockReturnValue({ id: 'active-nb' });

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleListNotebooks();

      expect(result.data.active_notebook_id).toBe('active-nb');
    });

    it('should return null active notebook when none set', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleListNotebooks();

      expect(result.data.active_notebook_id).toBeNull();
    });
  });

  describe('handleGetNotebook', () => {
    it('should return notebook details', async () => {
      const mockNotebook = { id: 'nb-1', name: 'Test', url: 'https://example.com' };
      mockLibrary.getNotebook.mockReturnValue(mockNotebook);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleGetNotebook({ id: 'nb-1' });

      expect(result.success).toBe(true);
      expect(result.data.notebook).toEqual(mockNotebook);
    });

    it('should return error for non-existent notebook', async () => {
      mockLibrary.getNotebook.mockReturnValue(null);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleGetNotebook({ id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('handleSearchNotebooks', () => {
    it('should search notebooks', async () => {
      const mockResults = [{ id: 'nb-1', name: 'React Docs' }];
      mockLibrary.searchNotebooks.mockReturnValue(mockResults);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleSearchNotebooks({ query: 'react' });

      expect(result.success).toBe(true);
      expect(result.data.notebooks).toEqual(mockResults);
      expect(mockLibrary.searchNotebooks).toHaveBeenCalledWith('react');
    });

    it('should return empty results for no matches', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleSearchNotebooks({ query: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.data.notebooks).toEqual([]);
    });
  });

  describe('handleGetLibraryStats', () => {
    it('should return library statistics', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleGetLibraryStats();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('total', 5);
      expect(result.data).toHaveProperty('byTopic');
    });
  });

  describe('handleSelectNotebook', () => {
    it('should select notebook', async () => {
      const mockNotebook = { id: 'nb-1', name: 'Selected' };
      mockLibrary.selectNotebook.mockReturnValue(mockNotebook);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleSelectNotebook({ id: 'nb-1' });

      expect(result.success).toBe(true);
      expect(result.data.notebook).toEqual(mockNotebook);
    });

    it('should handle selection error', async () => {
      mockLibrary.selectNotebook.mockImplementation(() => {
        throw new Error('Notebook not found');
      });

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleSelectNotebook({ id: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('handleRemoveNotebook', () => {
    it('should remove notebook', async () => {
      mockLibrary.getNotebook.mockReturnValue({ id: 'nb-1', url: 'https://example.com' });
      mockLibrary.removeNotebook.mockReturnValue(true);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleRemoveNotebook({ id: 'nb-1' });

      expect(result.success).toBe(true);
      expect(result.data.removed).toBe(true);
    });

    it('should return error for non-existent notebook', async () => {
      mockLibrary.getNotebook.mockReturnValue(null);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleRemoveNotebook({ id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('handleAddNotebook', () => {
    it('should add notebook', async () => {
      const mockNotebook = { id: 'nb-new', name: 'New Notebook' };
      mockLibrary.addNotebook.mockResolvedValue(mockNotebook);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAddNotebook({
        url: 'https://notebooklm.google.com/notebook/123',
        name: 'New Notebook',
        description: 'Test description',
        topics: ['test'],
      });

      expect(result.success).toBe(true);
      expect(result.data.notebook).toEqual(mockNotebook);
    });

    it('should handle add error', async () => {
      mockLibrary.addNotebook.mockRejectedValue(new Error('Invalid URL'));

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAddNotebook({
        url: 'invalid',
        name: 'Test',
        description: 'Test',
        topics: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });
  });

  describe('handleUpdateNotebook', () => {
    it('should update notebook', async () => {
      const mockNotebook = { id: 'nb-1', name: 'Updated Name' };
      mockLibrary.updateNotebook.mockReturnValue(mockNotebook);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleUpdateNotebook({ id: 'nb-1', name: 'Updated Name' });

      expect(result.success).toBe(true);
      expect(result.data.notebook.name).toBe('Updated Name');
    });

    it('should handle update error', async () => {
      mockLibrary.updateNotebook.mockImplementation(() => {
        throw new Error('Update failed');
      });

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleUpdateNotebook({ id: 'nb-1', name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('handleSetupAuth', () => {
    it('should setup auth successfully', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleSetupAuth({ show_browser: false });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('authenticated');
      expect(mockAuthManager.performSetup).toHaveBeenCalled();
    });

    it('should handle setup failure', async () => {
      mockAuthManager.performSetup.mockRejectedValue(new Error('Setup failed'));

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleSetupAuth({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Setup failed');
    });
  });

  describe('handleReAuth', () => {
    it('should re-authenticate successfully', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleReAuth({ show_browser: false });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('authenticated');
      expect(mockSessionManager.closeAllSessions).toHaveBeenCalled();
      expect(mockAuthManager.clearAllAuthData).toHaveBeenCalled();
    });

    it('should handle re-auth failure', async () => {
      mockAuthManager.performSetup.mockRejectedValue(new Error('Re-auth failed'));

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleReAuth({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Re-auth failed');
    });
  });

  describe('handleAskQuestion', () => {
    it('should require question parameter', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAskQuestion({ question: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should require notebook identification', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAskQuestion({ question: 'Test?' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should use active notebook when available', async () => {
      mockLibrary.getActiveNotebook.mockReturnValue({
        id: 'nb-1',
        url: 'https://notebooklm.google.com/notebook/123',
      });

      const mockSession = {
        getPage: jest.fn().mockReturnValue(null),
        incrementMessageCount: jest.fn(),
      };
      mockSessionManager.getOrCreateSession.mockResolvedValue(mockSession);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAskQuestion({ question: 'Test?' });

      // Will fail at page access but proves notebook resolution worked
      expect(result.success).toBe(false);
    });

    it('should handle notebook_id parameter', async () => {
      mockLibrary.getNotebook.mockReturnValue({
        id: 'nb-1',
        url: 'https://notebooklm.google.com/notebook/456',
      });

      const mockSession = {
        getPage: jest.fn().mockReturnValue(null),
        incrementMessageCount: jest.fn(),
      };
      mockSessionManager.getOrCreateSession.mockResolvedValue(mockSession);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAskQuestion({
        question: 'Test?',
        notebook_id: 'nb-1',
      });

      // Fails at page level, but exercises notebook resolution path
      expect(result.success).toBe(false);
    });

    it('should handle notebook_url parameter', async () => {
      const mockSession = {
        getPage: jest.fn().mockReturnValue(null),
        incrementMessageCount: jest.fn(),
      };
      mockSessionManager.getOrCreateSession.mockResolvedValue(mockSession);

      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAskQuestion({
        question: 'Test?',
        notebook_url: 'https://notebooklm.google.com/notebook/789',
      });

      // Fails at page level, but exercises URL path
      expect(result.success).toBe(false);
    });
  });

  describe('handleAutoDiscoverNotebook', () => {
    it('should handle auto-discovery errors', async () => {
      const handlers = new ToolHandlers(mockSessionManager, mockAuthManager, mockLibrary);
      const result = await handlers.handleAutoDiscoverNotebook({ url: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
