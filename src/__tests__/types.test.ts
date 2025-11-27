import { describe, it, expect } from '@jest/globals';
import type {
  SessionInfo,
  AskQuestionResult,
  ToolResult,
  Tool,
  TypingOptions,
  WaitForAnswerOptions,
  ProgressCallback,
  ServerState,
} from '../types.js';

describe('Type Definitions', () => {
  describe('SessionInfo', () => {
    it('should accept valid session info', () => {
      const sessionInfo: SessionInfo = {
        id: 'session-123',
        created_at: Date.now(),
        last_activity: Date.now(),
        age_seconds: 60,
        inactive_seconds: 10,
        message_count: 5,
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(sessionInfo.id).toBeTruthy();
      expect(typeof sessionInfo.id).toBe('string');
      expect(typeof sessionInfo.created_at).toBe('number');
      expect(typeof sessionInfo.last_activity).toBe('number');
      expect(typeof sessionInfo.age_seconds).toBe('number');
      expect(typeof sessionInfo.inactive_seconds).toBe('number');
      expect(typeof sessionInfo.message_count).toBe('number');
      expect(typeof sessionInfo.notebook_url).toBe('string');
    });

    it('should handle zero message count', () => {
      const sessionInfo: SessionInfo = {
        id: 'session-new',
        created_at: Date.now(),
        last_activity: Date.now(),
        age_seconds: 0,
        inactive_seconds: 0,
        message_count: 0,
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(sessionInfo.message_count).toBe(0);
      expect(sessionInfo.age_seconds).toBe(0);
    });

    it('should handle long-running sessions', () => {
      const sessionInfo: SessionInfo = {
        id: 'session-old',
        created_at: Date.now() - 3600000,
        last_activity: Date.now(),
        age_seconds: 3600,
        inactive_seconds: 0,
        message_count: 100,
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(sessionInfo.age_seconds).toBeGreaterThan(0);
      expect(sessionInfo.message_count).toBeGreaterThan(0);
    });

    it('should handle inactive sessions', () => {
      const sessionInfo: SessionInfo = {
        id: 'session-inactive',
        created_at: Date.now() - 3600000,
        last_activity: Date.now() - 1800000,
        age_seconds: 3600,
        inactive_seconds: 1800,
        message_count: 5,
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(sessionInfo.inactive_seconds).toBeGreaterThan(0);
      expect(sessionInfo.last_activity).toBeLessThan(Date.now());
    });
  });

  describe('AskQuestionResult', () => {
    it('should accept successful result', () => {
      const result: AskQuestionResult = {
        status: 'success',
        question: 'What is the capital of France?',
        answer: 'Paris is the capital of France.',
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
        session_id: 'session-123',
        session_info: {
          age_seconds: 60,
          message_count: 5,
          last_activity: Date.now(),
        },
      };

      expect(result.status).toBe('success');
      expect(result.answer).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should accept error result', () => {
      const result: AskQuestionResult = {
        status: 'error',
        question: 'What is the capital of France?',
        error: 'Failed to get answer',
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.answer).toBeUndefined();
    });

    it('should accept result without session info', () => {
      const result: AskQuestionResult = {
        status: 'success',
        question: 'Test question',
        answer: 'Test answer',
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(result.session_id).toBeUndefined();
      expect(result.session_info).toBeUndefined();
    });

    it('should handle empty question', () => {
      const result: AskQuestionResult = {
        status: 'error',
        question: '',
        error: 'Question is required',
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(result.question).toBe('');
      expect(result.status).toBe('error');
    });

    it('should handle long answers', () => {
      const longAnswer = 'A'.repeat(10000);
      const result: AskQuestionResult = {
        status: 'success',
        question: 'Tell me a long story',
        answer: longAnswer,
        notebook_url: 'https://notebooklm.google.com/notebook/abc',
      };

      expect(result.answer?.length).toBe(10000);
    });
  });

  describe('ToolResult', () => {
    it('should accept successful result with data', () => {
      const result: ToolResult<string> = {
        success: true,
        data: 'Operation completed',
      };

      expect(result.success).toBe(true);
      expect(result.data).toBe('Operation completed');
      expect(result.error).toBeUndefined();
    });

    it('should accept error result', () => {
      const result: ToolResult = {
        success: false,
        error: 'Operation failed',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation failed');
      expect(result.data).toBeUndefined();
    });

    it('should accept generic type parameter', () => {
      const numberResult: ToolResult<number> = {
        success: true,
        data: 42,
      };

      const objectResult: ToolResult<{ count: number }> = {
        success: true,
        data: { count: 5 },
      };

      expect(numberResult.data).toBe(42);
      expect(objectResult.data?.count).toBe(5);
    });

    it('should accept any type as default', () => {
      const result: ToolResult = {
        success: true,
        data: { anything: 'goes', here: true, count: 123 },
      };

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle undefined data', () => {
      const result: ToolResult = {
        success: true,
        data: undefined,
      };

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe('Tool', () => {
    it('should accept valid tool definition', () => {
      const tool: Tool = {
        name: 'ask_question',
        title: 'Ask Question',
        description: 'Ask a question to NotebookLM',
        inputSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The question to ask' },
          },
          required: ['question'],
        },
      };

      expect(tool.name).toBe('ask_question');
      expect(tool.title).toBe('Ask Question');
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');
    });

    it('should accept tool without title', () => {
      const tool: Tool = {
        name: 'get_health',
        description: 'Get server health',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      expect(tool.title).toBeUndefined();
      expect(tool.name).toBe('get_health');
    });

    it('should accept tool with no required fields', () => {
      const tool: Tool = {
        name: 'list_notebooks',
        description: 'List all notebooks',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max results' },
          },
        },
      };

      expect(tool.inputSchema.required).toBeUndefined();
    });

    it('should accept tool with multiple required fields', () => {
      const tool: Tool = {
        name: 'create_notebook',
        description: 'Create a notebook',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name', 'description'],
        },
      };

      expect(tool.inputSchema.required).toHaveLength(2);
      expect(tool.inputSchema.required).toContain('name');
    });

    it('should accept complex property definitions', () => {
      const tool: Tool = {
        name: 'complex_tool',
        description: 'A complex tool',
        inputSchema: {
          type: 'object',
          properties: {
            options: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                count: { type: 'number' },
              },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      };

      expect(tool.inputSchema.properties.options).toBeDefined();
      expect(tool.inputSchema.properties.tags).toBeDefined();
    });
  });

  describe('TypingOptions', () => {
    it('should accept valid options', () => {
      const options: TypingOptions = {
        wpm: 180,
        withTypos: true,
      };

      expect(options.wpm).toBe(180);
      expect(options.withTypos).toBe(true);
    });

    it('should accept partial options', () => {
      const options1: TypingOptions = { wpm: 200 };
      const options2: TypingOptions = { withTypos: false };
      const options3: TypingOptions = {};

      expect(options1.withTypos).toBeUndefined();
      expect(options2.wpm).toBeUndefined();
      expect(options3.wpm).toBeUndefined();
    });

    it('should accept various WPM values', () => {
      const slow: TypingOptions = { wpm: 60 };
      const fast: TypingOptions = { wpm: 300 };
      const zero: TypingOptions = { wpm: 0 };

      expect(slow.wpm).toBe(60);
      expect(fast.wpm).toBe(300);
      expect(zero.wpm).toBe(0);
    });

    it('should accept typo configurations', () => {
      const withTypos: TypingOptions = { withTypos: true };
      const noTypos: TypingOptions = { withTypos: false };

      expect(withTypos.withTypos).toBe(true);
      expect(noTypos.withTypos).toBe(false);
    });
  });

  describe('WaitForAnswerOptions', () => {
    it('should accept all options', () => {
      const options: WaitForAnswerOptions = {
        question: 'What is AI?',
        timeoutMs: 120000,
        pollIntervalMs: 1000,
        ignoreTexts: ['Loading...', 'Please wait...'],
        debug: true,
      };

      expect(options.question).toBe('What is AI?');
      expect(options.timeoutMs).toBe(120000);
      expect(options.pollIntervalMs).toBe(1000);
      expect(options.ignoreTexts).toHaveLength(2);
      expect(options.debug).toBe(true);
    });

    it('should accept empty options', () => {
      const options: WaitForAnswerOptions = {};

      expect(options.question).toBeUndefined();
      expect(options.timeoutMs).toBeUndefined();
      expect(options.pollIntervalMs).toBeUndefined();
      expect(options.ignoreTexts).toBeUndefined();
      expect(options.debug).toBeUndefined();
    });

    it('should accept partial options', () => {
      const options: WaitForAnswerOptions = {
        timeoutMs: 60000,
        debug: true,
      };

      expect(options.timeoutMs).toBe(60000);
      expect(options.debug).toBe(true);
      expect(options.question).toBeUndefined();
    });

    it('should accept empty ignore texts', () => {
      const options: WaitForAnswerOptions = {
        ignoreTexts: [],
      };

      expect(options.ignoreTexts).toEqual([]);
      expect(options.ignoreTexts).toHaveLength(0);
    });

    it('should accept various timeout values', () => {
      const short: WaitForAnswerOptions = { timeoutMs: 30000 };
      const long: WaitForAnswerOptions = { timeoutMs: 300000 };

      expect(short.timeoutMs).toBe(30000);
      expect(long.timeoutMs).toBe(300000);
    });
  });

  describe('ProgressCallback', () => {
    it('should accept valid callback function', async () => {
      const callback: ProgressCallback = async (message, _progress, _total) => {
        expect(typeof message).toBe('string');
      };

      await callback('Processing...', 1, 10);
    });

    it('should accept callback with all parameters', async () => {
      const callback: ProgressCallback = async (message, progress, total) => {
        expect(message).toBe('Step 1');
        expect(progress).toBe(1);
        expect(total).toBe(5);
      };

      await callback('Step 1', 1, 5);
    });

    it('should accept callback with optional parameters', async () => {
      const callback: ProgressCallback = async (message) => {
        expect(message).toBeTruthy();
      };

      await callback('Message only');
    });

    it('should return promise', async () => {
      const callback: ProgressCallback = async (_message) => {
        return Promise.resolve();
      };

      const result = callback('Test');
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('should handle async operations', async () => {
      let called = false;
      const callback: ProgressCallback = async (_message) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        called = true;
      };

      await callback('Test');
      expect(called).toBe(true);
    });
  });

  describe('ServerState', () => {
    it('should accept valid server state', () => {
      const state: ServerState = {
        playwright: {},
        sessionManager: {},
        authManager: {},
      };

      expect(state.playwright).toBeDefined();
      expect(state.sessionManager).toBeDefined();
      expect(state.authManager).toBeDefined();
    });

    it('should accept actual manager instances', () => {
      const mockPlaywright = { launch: () => {} };
      const mockSessionManager = { getSessions: () => [] };
      const mockAuthManager = { isAuthenticated: () => false };

      const state: ServerState = {
        playwright: mockPlaywright,
        sessionManager: mockSessionManager,
        authManager: mockAuthManager,
      };

      expect(state.playwright).toBe(mockPlaywright);
      expect(state.sessionManager).toBe(mockSessionManager);
      expect(state.authManager).toBe(mockAuthManager);
    });

    it('should accept any type for managers', () => {
      const state: ServerState = {
        playwright: null,
        sessionManager: undefined,
        authManager: { custom: 'property' },
      };

      expect(state.playwright).toBeNull();
      expect(state.sessionManager).toBeUndefined();
      expect(state.authManager).toBeDefined();
    });
  });

  describe('Type compatibility', () => {
    it('should allow session info in ask result', () => {
      const sessionInfo: AskQuestionResult['session_info'] = {
        age_seconds: 60,
        message_count: 5,
        last_activity: Date.now(),
      };

      const result: AskQuestionResult = {
        status: 'success',
        question: 'Test',
        answer: 'Answer',
        notebook_url: 'https://example.com',
        session_info: sessionInfo,
      };

      expect(result.session_info).toBeDefined();
      expect(result.session_info?.age_seconds).toBe(60);
    });

    it('should allow ToolResult with SessionInfo', () => {
      const sessionInfo: SessionInfo = {
        id: 'session-123',
        created_at: Date.now(),
        last_activity: Date.now(),
        age_seconds: 60,
        inactive_seconds: 10,
        message_count: 5,
        notebook_url: 'https://example.com',
      };

      const result: ToolResult<SessionInfo> = {
        success: true,
        data: sessionInfo,
      };

      expect(result.data?.id).toBe('session-123');
    });

    it('should allow ToolResult with arrays', () => {
      const sessions: SessionInfo[] = [
        {
          id: 'session-1',
          created_at: Date.now(),
          last_activity: Date.now(),
          age_seconds: 60,
          inactive_seconds: 10,
          message_count: 5,
          notebook_url: 'https://example.com',
        },
      ];

      const result: ToolResult<SessionInfo[]> = {
        success: true,
        data: sessions,
      };

      expect(result.data).toHaveLength(1);
    });
  });
});
