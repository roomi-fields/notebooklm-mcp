import { describe, it, expect } from '@jest/globals';
import { CONFIG, applyBrowserOptions, NOTEBOOKLM_AUTH_URL } from '../config.js';
import type { BrowserOptions } from '../config.js';

describe('Config Module', () => {
  describe('NOTEBOOKLM_AUTH_URL', () => {
    it('should export the correct auth URL', () => {
      expect(NOTEBOOKLM_AUTH_URL).toBe(
        'https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fnotebooklm.google.com%2F&flowName=GlifWebSignIn&flowEntry=ServiceLogin'
      );
    });

    it('should be a valid URL', () => {
      expect(() => new URL(NOTEBOOKLM_AUTH_URL)).not.toThrow();
      const url = new URL(NOTEBOOKLM_AUTH_URL);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('accounts.google.com');
    });
  });

  describe('CONFIG defaults', () => {
    it('should have correct default values', () => {
      expect(CONFIG.headless).toBe(true);
      expect(CONFIG.browserTimeout).toBe(30000);
      expect(CONFIG.maxSessions).toBe(10);
      expect(CONFIG.sessionTimeout).toBe(900);
      expect(CONFIG.autoLoginEnabled).toBe(false);
      expect(CONFIG.stealthEnabled).toBe(true);
    });

    it('should have valid viewport dimensions', () => {
      expect(CONFIG.viewport).toBeDefined();
      expect(CONFIG.viewport.width).toBe(1024);
      expect(CONFIG.viewport.height).toBe(768);
      expect(CONFIG.viewport.width).toBeGreaterThan(0);
      expect(CONFIG.viewport.height).toBeGreaterThan(0);
    });

    it('should have valid stealth settings', () => {
      expect(CONFIG.stealthEnabled).toBe(true);
      expect(CONFIG.stealthRandomDelays).toBe(true);
      expect(CONFIG.stealthHumanTyping).toBe(true);
      expect(CONFIG.stealthMouseMovements).toBe(true);
      expect(CONFIG.typingWpmMin).toBe(160);
      expect(CONFIG.typingWpmMax).toBe(240);
      expect(CONFIG.typingWpmMin).toBeLessThanOrEqual(CONFIG.typingWpmMax);
    });

    it('should have valid delay ranges', () => {
      expect(CONFIG.minDelayMs).toBe(100);
      expect(CONFIG.maxDelayMs).toBe(400);
      expect(CONFIG.minDelayMs).toBeLessThanOrEqual(CONFIG.maxDelayMs);
      expect(CONFIG.minDelayMs).toBeGreaterThanOrEqual(0);
    });

    it('should have valid authentication defaults', () => {
      expect(CONFIG.autoLoginEnabled).toBe(false);
      expect(CONFIG.loginEmail).toBe('');
      expect(CONFIG.loginPassword).toBe('');
      expect(CONFIG.autoLoginTimeoutMs).toBe(120000);
    });

    it('should have valid profile strategy', () => {
      expect(CONFIG.profileStrategy).toBe('auto');
      expect(['auto', 'single', 'isolated']).toContain(CONFIG.profileStrategy);
    });

    it('should have valid cleanup settings', () => {
      expect(CONFIG.cleanupInstancesOnStartup).toBe(true);
      expect(CONFIG.cleanupInstancesOnShutdown).toBe(true);
      expect(CONFIG.cloneProfileOnIsolated).toBe(false);
      expect(CONFIG.instanceProfileTtlHours).toBe(72);
      expect(CONFIG.instanceProfileMaxCount).toBe(20);
    });

    it('should have valid path configuration', () => {
      expect(CONFIG.dataDir).toBeTruthy();
      expect(CONFIG.browserStateDir).toBeTruthy();
      expect(CONFIG.chromeProfileDir).toBeTruthy();
      expect(CONFIG.chromeInstancesDir).toBeTruthy();
      expect(typeof CONFIG.dataDir).toBe('string');
      expect(typeof CONFIG.browserStateDir).toBe('string');
    });

    it('should have valid library defaults', () => {
      expect(CONFIG.notebookDescription).toBe('General knowledge base');
      expect(CONFIG.notebookTopics).toEqual(['General topics']);
      expect(CONFIG.notebookContentTypes).toEqual(['documentation', 'examples']);
      expect(CONFIG.notebookUseCases).toEqual(['General research']);
      expect(Array.isArray(CONFIG.notebookTopics)).toBe(true);
    });

    it('should have empty notebook URL by default', () => {
      expect(CONFIG.notebookUrl).toBe('');
    });
  });

  describe('applyBrowserOptions', () => {
    it('should return config copy without mutation when no options provided', () => {
      const result = applyBrowserOptions();

      expect(result).not.toBe(CONFIG);
      expect(result.headless).toBe(CONFIG.headless);
      expect(result.browserTimeout).toBe(CONFIG.browserTimeout);
    });

    it('should apply show option (inverts headless)', () => {
      const result = applyBrowserOptions({ show: true });
      expect(result.headless).toBe(false);

      const result2 = applyBrowserOptions({ show: false });
      expect(result2.headless).toBe(true);
    });

    it('should apply headless option directly', () => {
      const result = applyBrowserOptions({ headless: false });
      expect(result.headless).toBe(false);

      const result2 = applyBrowserOptions({ headless: true });
      expect(result2.headless).toBe(true);
    });

    it('should prioritize headless over show when both provided', () => {
      const result = applyBrowserOptions({ show: true, headless: true });
      expect(result.headless).toBe(true);

      const result2 = applyBrowserOptions({ show: false, headless: false });
      expect(result2.headless).toBe(false);
    });

    it('should apply timeout_ms option', () => {
      const result = applyBrowserOptions({ timeout_ms: 60000 });
      expect(result.browserTimeout).toBe(60000);
    });

    it('should apply viewport options', () => {
      const result = applyBrowserOptions({
        viewport: { width: 1920, height: 1080 },
      });
      expect(result.viewport.width).toBe(1920);
      expect(result.viewport.height).toBe(1080);
    });

    it('should apply partial viewport options', () => {
      const result = applyBrowserOptions({
        viewport: { width: 1920 },
      });
      expect(result.viewport.width).toBe(1920);
      expect(result.viewport.height).toBe(CONFIG.viewport.height);
    });

    it('should apply stealth enabled option', () => {
      const result = applyBrowserOptions({
        stealth: { enabled: false },
      });
      expect(result.stealthEnabled).toBe(false);
    });

    it('should apply stealth random_delays option', () => {
      const result = applyBrowserOptions({
        stealth: { random_delays: false },
      });
      expect(result.stealthRandomDelays).toBe(false);
    });

    it('should apply stealth human_typing option', () => {
      const result = applyBrowserOptions({
        stealth: { human_typing: false },
      });
      expect(result.stealthHumanTyping).toBe(false);
    });

    it('should apply stealth mouse_movements option', () => {
      const result = applyBrowserOptions({
        stealth: { mouse_movements: false },
      });
      expect(result.stealthMouseMovements).toBe(false);
    });

    it('should apply stealth typing WPM options', () => {
      const result = applyBrowserOptions({
        stealth: { typing_wpm_min: 100, typing_wpm_max: 200 },
      });
      expect(result.typingWpmMin).toBe(100);
      expect(result.typingWpmMax).toBe(200);
    });

    it('should apply stealth delay options', () => {
      const result = applyBrowserOptions({
        stealth: { delay_min_ms: 50, delay_max_ms: 500 },
      });
      expect(result.minDelayMs).toBe(50);
      expect(result.maxDelayMs).toBe(500);
    });

    it('should apply multiple stealth options together', () => {
      const result = applyBrowserOptions({
        stealth: {
          enabled: false,
          random_delays: false,
          human_typing: false,
          mouse_movements: false,
          typing_wpm_min: 150,
          typing_wpm_max: 250,
          delay_min_ms: 200,
          delay_max_ms: 600,
        },
      });

      expect(result.stealthEnabled).toBe(false);
      expect(result.stealthRandomDelays).toBe(false);
      expect(result.stealthHumanTyping).toBe(false);
      expect(result.stealthMouseMovements).toBe(false);
      expect(result.typingWpmMin).toBe(150);
      expect(result.typingWpmMax).toBe(250);
      expect(result.minDelayMs).toBe(200);
      expect(result.maxDelayMs).toBe(600);
    });

    it('should handle legacy show_browser parameter', () => {
      const result = applyBrowserOptions(undefined, true);
      expect(result.headless).toBe(false);

      const result2 = applyBrowserOptions(undefined, false);
      expect(result2.headless).toBe(true);
    });

    it('should prioritize browser_options over legacy show_browser', () => {
      const result = applyBrowserOptions({ show: false }, true);
      expect(result.headless).toBe(true);
    });

    it('should not mutate original CONFIG', () => {
      const originalHeadless = CONFIG.headless;
      const originalTimeout = CONFIG.browserTimeout;

      applyBrowserOptions({ headless: !originalHeadless, timeout_ms: 99999 });

      expect(CONFIG.headless).toBe(originalHeadless);
      expect(CONFIG.browserTimeout).toBe(originalTimeout);
    });

    it('should handle complex combined options', () => {
      const options: BrowserOptions = {
        show: true,
        timeout_ms: 45000,
        viewport: { width: 1600, height: 900 },
        stealth: {
          enabled: true,
          random_delays: true,
          human_typing: false,
          typing_wpm_min: 180,
        },
      };

      const result = applyBrowserOptions(options);

      expect(result.headless).toBe(false);
      expect(result.browserTimeout).toBe(45000);
      expect(result.viewport.width).toBe(1600);
      expect(result.viewport.height).toBe(900);
      expect(result.stealthEnabled).toBe(true);
      expect(result.stealthRandomDelays).toBe(true);
      expect(result.stealthHumanTyping).toBe(false);
      expect(result.typingWpmMin).toBe(180);
    });

    it('should preserve unmodified config values', () => {
      const result = applyBrowserOptions({ timeout_ms: 60000 });

      expect(result.maxSessions).toBe(CONFIG.maxSessions);
      expect(result.sessionTimeout).toBe(CONFIG.sessionTimeout);
      expect(result.notebookDescription).toBe(CONFIG.notebookDescription);
      expect(result.profileStrategy).toBe(CONFIG.profileStrategy);
    });

    it('should handle empty options object', () => {
      const result = applyBrowserOptions({});

      expect(result.headless).toBe(CONFIG.headless);
      expect(result.browserTimeout).toBe(CONFIG.browserTimeout);
      expect(result.viewport).toEqual(CONFIG.viewport);
    });

    it('should handle undefined values in options', () => {
      const result = applyBrowserOptions({
        show: undefined,
        headless: undefined,
        timeout_ms: undefined,
      });

      expect(result.headless).toBe(CONFIG.headless);
      expect(result.browserTimeout).toBe(CONFIG.browserTimeout);
    });

    it('should handle edge case values', () => {
      const result = applyBrowserOptions({
        timeout_ms: 0,
        viewport: { width: 0, height: 0 },
        stealth: {
          typing_wpm_min: 0,
          typing_wpm_max: 0,
          delay_min_ms: 0,
          delay_max_ms: 0,
        },
      });

      expect(result.browserTimeout).toBe(0);
      expect(result.viewport.width).toBe(0);
      expect(result.viewport.height).toBe(0);
      expect(result.typingWpmMin).toBe(0);
      expect(result.typingWpmMax).toBe(0);
      expect(result.minDelayMs).toBe(0);
      expect(result.maxDelayMs).toBe(0);
    });
  });
});
