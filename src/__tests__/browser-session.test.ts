/**
 * Browser Session Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    dim: jest.fn(),
  },
}));

jest.unstable_mockModule('../config.js', () => ({
  CONFIG: {
    dataDir: '/tmp/test-data',
  },
}));

describe('BrowserSession', () => {
  let BrowserSession: any;
  let mockSharedContextManager: any;
  let mockAuthManager: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock shared context manager
    mockSharedContextManager = {
      getOrCreateContext: jest.fn(),
      closeContext: jest.fn(),
    };

    // Mock auth manager
    mockAuthManager = {
      getValidStatePath: jest.fn().mockResolvedValue('/tmp/state.json'),
    };

    // Import module
    const module = await import('../session/browser-session.js');
    BrowserSession = module.BrowserSession;
  });

  describe('Constructor', () => {
    it('should create session with correct initial values', () => {
      const session = new BrowserSession(
        'test-session-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      expect(session.sessionId).toBe('test-session-1');
      expect(session.notebookUrl).toBe('https://notebooklm.google.com/notebook/test123');
      expect(session.messageCount).toBe(0);
    });

    it('should set creation timestamp', () => {
      const before = Date.now();
      const session = new BrowserSession(
        'test-session-2',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );
      const after = Date.now();

      expect(session.createdAt).toBeGreaterThanOrEqual(before);
      expect(session.createdAt).toBeLessThanOrEqual(after);
    });

    it('should set last activity timestamp', () => {
      const session = new BrowserSession(
        'test-session-3',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      expect(session.lastActivity).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Activity Tracking', () => {
    it('should update activity timestamp', async () => {
      const session = new BrowserSession(
        'test-session-4',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      const initialActivity = session.lastActivity;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      session.updateActivity();

      expect(session.lastActivity).toBeGreaterThan(initialActivity);
    });
  });

  describe('Expiration', () => {
    it('should not be expired immediately', () => {
      const session = new BrowserSession(
        'test-session-5',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      expect(session.isExpired(60)).toBe(false);
    });

    it('should handle 0 timeout (never expires)', () => {
      const session = new BrowserSession(
        'test-session-6',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      // 0 timeout means never expires
      expect(session.isExpired(0)).toBe(false);
    });
  });

  describe('Session Info', () => {
    it('should return correct session info', () => {
      const session = new BrowserSession(
        'test-session-7',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      const info = session.getInfo();

      expect(info.id).toBe('test-session-7');
      expect(info.notebook_url).toBe('https://notebooklm.google.com/notebook/test123');
      expect(info.message_count).toBe(0);
      expect(info.age_seconds).toBeGreaterThanOrEqual(0);
      expect(info.inactive_seconds).toBeGreaterThanOrEqual(0);
      expect(info.created_at).toBeDefined();
      expect(info.last_activity).toBeDefined();
    });
  });

  describe('Initialization State', () => {
    it('should report not initialized before init()', () => {
      const session = new BrowserSession(
        'test-session-8',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      expect(session.isInitialized()).toBe(false);
    });

    it('should return null page before init()', () => {
      const session = new BrowserSession(
        'test-session-9',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      expect(session.getPage()).toBeNull();
    });
  });
});

describe('BrowserSession Info Format', () => {
  it('should format dates as ISO strings', () => {
    const now = new Date();
    const isoString = now.toISOString();

    expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should calculate age in seconds', () => {
    const createdAt = Date.now() - 60000; // 1 minute ago
    const ageSeconds = Math.floor((Date.now() - createdAt) / 1000);

    expect(ageSeconds).toBeGreaterThanOrEqual(60);
    expect(ageSeconds).toBeLessThan(65);
  });

  it('should calculate inactive time in seconds', () => {
    const lastActivity = Date.now() - 30000; // 30 seconds ago
    const inactiveSeconds = Math.floor((Date.now() - lastActivity) / 1000);

    expect(inactiveSeconds).toBeGreaterThanOrEqual(30);
    expect(inactiveSeconds).toBeLessThan(35);
  });
});

describe('BrowserSession Extended Tests', () => {
  let BrowserSession: any;
  let mockSharedContextManager: any;
  let mockAuthManager: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSharedContextManager = {
      getOrCreateContext: jest.fn(),
      closeContext: jest.fn(),
    };

    mockAuthManager = {
      getValidStatePath: jest.fn().mockResolvedValue('/tmp/state.json'),
    };

    const module = await import('../session/browser-session.js');
    BrowserSession = module.BrowserSession;
  });

  describe('Message Count Tracking', () => {
    it('should start with zero message count', () => {
      const session = new BrowserSession(
        'msg-test-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      expect(session.messageCount).toBe(0);
    });

    it('should increment message count correctly', () => {
      const session = new BrowserSession(
        'msg-test-2',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      // Manually increment (normally done by askQuestion)
      session.messageCount++;
      expect(session.messageCount).toBe(1);

      session.messageCount++;
      expect(session.messageCount).toBe(2);
    });
  });

  describe('Close Operations', () => {
    it('should handle close without page', async () => {
      const session = new BrowserSession(
        'close-test-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      // Close without init - should not throw
      await session.close();

      expect(session.isInitialized()).toBe(false);
    });
  });

  describe('Timeout Validation', () => {
    it('should handle very large timeout values', () => {
      const session = new BrowserSession(
        'timeout-test-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      // Very long timeout - should not be expired
      expect(session.isExpired(99999999)).toBe(false);
    });

    it('should handle small timeout values', async () => {
      const session = new BrowserSession(
        'timeout-test-2',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      // Wait a small amount
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Very short timeout should make it expired
      expect(session.isExpired(0.05)).toBe(true); // 50ms timeout
    });
  });

  describe('Activity Updates', () => {
    it('should update last activity multiple times', async () => {
      const session = new BrowserSession(
        'activity-test-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      const times: number[] = [];

      times.push(session.lastActivity);
      await new Promise((resolve) => setTimeout(resolve, 20));

      session.updateActivity();
      times.push(session.lastActivity);
      await new Promise((resolve) => setTimeout(resolve, 20));

      session.updateActivity();
      times.push(session.lastActivity);

      // Each should be greater than the previous
      expect(times[1]).toBeGreaterThan(times[0]);
      expect(times[2]).toBeGreaterThan(times[1]);
    });
  });

  describe('Session Info Details', () => {
    it('should include all required fields', () => {
      const session = new BrowserSession(
        'info-test-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      const info = session.getInfo();

      expect(info).toHaveProperty('id');
      expect(info).toHaveProperty('notebook_url');
      expect(info).toHaveProperty('message_count');
      expect(info).toHaveProperty('age_seconds');
      expect(info).toHaveProperty('inactive_seconds');
      expect(info).toHaveProperty('created_at');
      expect(info).toHaveProperty('last_activity');
    });

    it('should return correct types for each field', () => {
      const session = new BrowserSession(
        'info-test-2',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      const info = session.getInfo();

      expect(typeof info.id).toBe('string');
      expect(typeof info.notebook_url).toBe('string');
      expect(typeof info.message_count).toBe('number');
      expect(typeof info.age_seconds).toBe('number');
      expect(typeof info.inactive_seconds).toBe('number');
      // created_at and last_activity can be strings or numbers depending on implementation
      expect(['string', 'number']).toContain(typeof info.created_at);
      expect(['string', 'number']).toContain(typeof info.last_activity);
    });
  });

  describe('Session Lifecycle', () => {
    it('should handle multiple session instances', () => {
      const sessions = [];

      for (let i = 0; i < 3; i++) {
        sessions.push(
          new BrowserSession(
            `lifecycle-test-${i}`,
            mockSharedContextManager,
            mockAuthManager,
            `https://notebooklm.google.com/notebook/test${i}`
          )
        );
      }

      expect(sessions.length).toBe(3);
      expect(sessions[0].sessionId).toBe('lifecycle-test-0');
      expect(sessions[1].sessionId).toBe('lifecycle-test-1');
      expect(sessions[2].sessionId).toBe('lifecycle-test-2');
    });

    it('should have independent timestamps for each session', async () => {
      const session1 = new BrowserSession(
        'timestamp-test-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test1'
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const session2 = new BrowserSession(
        'timestamp-test-2',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test2'
      );

      expect(session2.createdAt).toBeGreaterThan(session1.createdAt);
    });
  });

  describe('Discussion Recovery', () => {
    it('ignores disabled chat inputs when searching for the composer', async () => {
      const session = new BrowserSession(
        'discussion-test-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      const disabledInput = {
        isVisible: jest.fn().mockResolvedValue(true),
        isEnabled: jest.fn().mockResolvedValue(false),
        getAttribute: jest.fn().mockResolvedValue('Ask something'),
      };

      session['page'] = {
        $: jest.fn().mockImplementation((selector: string) => {
          if (selector === 'textarea.query-box-input') {
            return Promise.resolve(disabledInput);
          }
          return Promise.resolve(null);
        }),
      };

      const selector = await session['findChatInput']();
      expect(selector).toBeNull();
    });

    it('navigates back to Discussion when the chat input is hidden', async () => {
      const session = new BrowserSession(
        'discussion-test-2',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test'
      );

      session['page'] = {
        waitForSelector: jest.fn().mockResolvedValue(undefined),
      };

      session['findChatInput'] = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('textarea.query-box-input');
      session['dismissTransientUi'] = jest.fn().mockResolvedValue(undefined);
      session['navigateToDiscussion'] = jest.fn().mockResolvedValue(undefined);

      await session['ensureDiscussionReady']();

      expect(session['dismissTransientUi']).toHaveBeenCalled();
      expect(session['navigateToDiscussion']).toHaveBeenCalled();
    });
  });
});
