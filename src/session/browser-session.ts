/**
 * Browser Session
 *
 * Represents a single browser session for NotebookLM interactions.
 *
 * Features:
 * - Human-like question typing
 * - Streaming response detection
 * - Auto-login on session expiry
 * - Session activity tracking
 * - Chat history reset
 *
 * Based on the Python implementation from browser_session.py
 */

import type { BrowserContext, Page } from 'patchright';
import { existsSync } from 'fs';
import { SharedContextManager } from './shared-context-manager.js';
import { AuthManager } from '../auth/auth-manager.js';
import { getAccountManager } from '../accounts/account-manager.js';
import { humanType, randomDelay } from '../utils/stealth-utils.js';
import {
  waitForLatestAnswer,
  snapshotAllResponses,
  isRateLimitMessage,
} from '../utils/page-utils.js';
import {
  extractCitations,
  type SourceFormat,
  type CitationExtractionResult,
} from '../utils/citation-extractor.js';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';
import type { SessionInfo, ProgressCallback } from '../types.js';
import { RateLimitError } from '../errors.js';

/**
 * Result from asking a question (internal)
 */
export interface AskResult {
  /** The answer text (formatted if source_format specified) */
  answer: string;
  /** Original unformatted answer */
  originalAnswer: string;
  /** Citation extraction result (if source_format is not 'none') */
  citationResult?: CitationExtractionResult;
}

export class BrowserSession {
  public readonly sessionId: string;
  public readonly notebookUrl: string;
  public readonly createdAt: number;
  public lastActivity: number;
  public messageCount: number;

  private context!: BrowserContext;
  private sharedContextManager: SharedContextManager;
  private authManager: AuthManager;
  private page: Page | null = null;
  private initialized: boolean = false;
  /** Headless mode override - true=headless, false=visible, undefined=use config default */
  private overrideHeadless?: boolean;

  constructor(
    sessionId: string,
    sharedContextManager: SharedContextManager,
    authManager: AuthManager,
    notebookUrl: string,
    overrideHeadless?: boolean
  ) {
    this.sessionId = sessionId;
    this.sharedContextManager = sharedContextManager;
    this.authManager = authManager;
    this.notebookUrl = notebookUrl;
    this.overrideHeadless = overrideHeadless;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.messageCount = 0;

    log.info(`🆕 BrowserSession ${sessionId} created`);
  }

  /**
   * Initialize the session by creating a page and navigating to the notebook
   */
  async init(): Promise<void> {
    if (this.initialized) {
      log.warning(`⚠️  Session ${this.sessionId} already initialized`);
      return;
    }

    log.info(`🚀 Initializing session ${this.sessionId}...`);

    try {
      // Ensure a valid shared context (pass overrideHeadless to maintain visibility mode)
      this.context = await this.sharedContextManager.getOrCreateContext(this.overrideHeadless);

      // Create new page (tab) in the shared context (with auto-recovery)
      try {
        this.page = await this.context.newPage();
      } catch (e: unknown) {
        const msg = String(e instanceof Error ? e.message : e);
        if (
          /has been closed|Target .* closed|Browser has been closed|Context .* closed/i.test(msg)
        ) {
          log.warning('  ♻️  Context was closed. Recreating and retrying newPage...');
          this.context = await this.sharedContextManager.getOrCreateContext(this.overrideHeadless);
          this.page = await this.context.newPage();
        } else {
          throw e;
        }
      }
      log.success(`  ✅ Created new page`);

      // Navigate to notebook
      log.info(`  🌐 Navigating to: ${this.notebookUrl}`);
      await this.page.goto(this.notebookUrl, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.browserTimeout,
      });

      // Wait for page to stabilize
      await randomDelay(2000, 3000);

      // Check if we need to login
      // IMPORTANT: Check actual URL first — Google can expire sessions server-side
      // even when local cookies still have valid expiry dates
      const postNavUrl = this.page.url();
      const isOnGoogleSignIn = postNavUrl.includes('accounts.google.com');
      if (isOnGoogleSignIn) {
        log.warning(`  ⚠️ Redirected to Google sign-in — server-side session expired`);
      }
      const isAuthenticated = isOnGoogleSignIn
        ? false
        : await this.authManager.validateCookiesExpiry(this.context);

      if (!isAuthenticated) {
        log.warning(`  🔑 Session ${this.sessionId} needs authentication`);
        const loginSuccess = await this.ensureAuthenticated();
        if (!loginSuccess) {
          throw new Error(
            'Google session expired and re-authentication failed.\n' +
              'Please re-authenticate:\n' +
              '  1. Stop the server (Ctrl+C)\n' +
              '  2. Run: npx notebooklm-mcp setup-auth --show-browser\n' +
              '  3. Restart: npm run start:http'
          );
        }
        // After re-auth, navigate back to notebook (we may still be on Google sign-in page)
        if (isOnGoogleSignIn) {
          log.info(`  🌐 Re-navigating to notebook after auth...`);
          await this.page.goto(this.notebookUrl, {
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.browserTimeout,
          });
          await randomDelay(2000, 3000);
          // Verify we actually made it to the notebook
          const recheckUrl = this.page.url();
          if (recheckUrl.includes('accounts.google.com')) {
            throw new Error(
              'Google session expired. Re-auth loaded cookies but Google still requires sign-in.\n' +
                'Please re-authenticate:\n' +
                '  1. Stop the server (Ctrl+C)\n' +
                '  2. Run: npx notebooklm-mcp setup-auth --show-browser\n' +
                '  3. Restart: npm run start:http'
            );
          }
        }
      } else {
        log.success(`  ✅ Session already authenticated`);
      }

      // CRITICAL: Restore sessionStorage from saved state
      // This is essential for maintaining Google session state!
      log.info(`  🔄 Restoring sessionStorage...`);
      const sessionData = await this.authManager.loadSessionStorage();
      if (sessionData) {
        const entryCount = Object.keys(sessionData).length;
        if (entryCount > 0) {
          await this.restoreSessionStorage(sessionData, entryCount);
        } else {
          log.info(`  ℹ️  SessionStorage empty (fresh session)`);
        }
      } else {
        log.info(`  ℹ️  No saved sessionStorage found (fresh session)`);
      }

      // Wait for NotebookLM interface to load
      log.info(`  ⏳ Waiting for NotebookLM interface...`);
      await this.waitForNotebookLMReady();

      this.initialized = true;
      this.updateActivity();
      log.success(`✅ Session ${this.sessionId} initialized successfully`);
    } catch (error) {
      log.error(`❌ Failed to initialize session ${this.sessionId}: ${error}`);
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      throw error;
    }
  }

  /**
   * Wait for NotebookLM interface to be ready
   *
   * IMPORTANT: Wait for BOTH:
   * 1. Chat input to be visible
   * 2. Page content to be fully loaded (no skeleton UI)
   */
  private async waitForNotebookLMReady(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // PRIMARY: Wait for chat input
      log.info('  ⏳ Waiting for chat input (textarea.query-box-input)...');
      await this.page.waitForSelector('textarea.query-box-input', {
        timeout: 15000,
        state: 'visible',
      });
      log.success('  ✅ Chat input ready!');

      // CRITICAL: Wait for page content to load (no skeleton UI)
      log.info('  ⏳ Waiting for page content to load...');
      await this.waitForContentLoaded();
      log.success('  ✅ Page content loaded!');
    } catch {
      // FALLBACK: Try alternative selector
      try {
        log.info('  ⏳ Trying fallback selector (aria-label)...');
        await this.page.waitForSelector('textarea[aria-label="Feld für Anfragen"]', {
          timeout: 5000,
          state: 'visible',
        });
        log.success('  ✅ Chat input ready (fallback)!');
      } catch (error) {
        log.error(`  ❌ NotebookLM interface not ready: ${error}`);
        const currentUrl = this.page?.url() || 'unknown';
        throw new Error(
          `Could not find NotebookLM chat input.\n\n` +
            `Current URL: ${currentUrl}\n\n` +
            `Possible causes:\n` +
            `1. Invalid notebook URL - the notebook may not exist or you don't have access\n` +
            `2. NotebookLM page structure changed (rare)\n` +
            `3. Page took too long to load (timeout after 15 seconds)\n\n` +
            `Please verify:\n` +
            `- The notebook URL is correct\n` +
            `- You have access to this notebook\n` +
            `- The URL format: https://notebooklm.google.com/notebook/[id]`
        );
      }
    }
  }

  /**
   * Wait for page content to be fully loaded (no skeleton/loading UI)
   * This ensures NotebookLM has finished loading sources and is ready to answer
   */
  private async waitForContentLoaded(): Promise<void> {
    if (!this.page) return;

    const maxWaitMs = 15000;
    const pollIntervalMs = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      // Check if skeleton UI is still visible
      const hasSkeletonUI = await this.page.evaluate(`
        (() => {
          // Look for skeleton/loading indicators
          const skeletonSelectors = [
            '.skeleton',
            '[class*="skeleton"]',
            '[class*="loading"]',
            '.mat-progress-bar',
            '.loading-indicator',
            '.shimmer',
            '[class*="shimmer"]',
          ];

          for (const selector of skeletonSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              const style = window.getComputedStyle(el);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                return true;
              }
            }
          }

          // Also check for placeholder bars (common in loading states)
          const placeholderBars = document.querySelectorAll('[style*="background"][style*="animate"]');
          if (placeholderBars.length > 0) return true;

          return false;
        })()
      `);

      if (!hasSkeletonUI) {
        // Also wait a small additional delay to be safe
        await randomDelay(500, 800);
        return;
      }

      await this.page.waitForTimeout(pollIntervalMs);
    }

    log.warning('  ⚠️ Timeout waiting for content to load, proceeding anyway...');
  }

  private isPageClosedSafe(): boolean {
    if (!this.page) return true;
    const p = this.page as { isClosed?: () => boolean };
    try {
      if (typeof p.isClosed === 'function') {
        if (p.isClosed()) return true;
      }
      // Accessing URL should be safe; if page is gone, this may throw
      void this.page.url();
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Ensure the session is authenticated, perform auto-login if needed
   */
  private async ensureAuthenticated(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    log.info(`🔑 Checking authentication for session ${this.sessionId}...`);

    // IMPORTANT: Check actual page URL first — Google can expire sessions server-side
    // even when local cookies still have valid expiry dates.
    // If the browser is on accounts.google.com, cookies are worthless.
    const currentUrl = this.page.url();
    const onGoogleSignIn = currentUrl.includes('accounts.google.com');

    if (onGoogleSignIn) {
      log.warning(
        `  ⚠️ Page is on Google sign-in — cookies valid locally but session expired server-side`
      );
    } else {
      // Only trust cookie validity when NOT on Google sign-in page
      const isValid = await this.authManager.validateCookiesExpiry(this.context);
      if (isValid) {
        log.success(`  ✅ Cookies valid`);
        return true;
      }
    }

    log.warning(`  ⚠️  Cookies expired or invalid`);

    // Try to get valid auth state - prefer account-specific path
    let statePath: string | null = null;
    try {
      const accountManager = await getAccountManager();
      const currentAccountId = await accountManager.getCurrentAccountId();
      if (currentAccountId) {
        const account = accountManager.getAccount(currentAccountId);
        if (account && existsSync(account.stateFilePath)) {
          statePath = account.stateFilePath;
        }
      }
    } catch {
      // Fall back to legacy path
    }

    // If no account-specific state, try legacy path
    if (!statePath) {
      statePath = await this.authManager.getValidStatePath();
    }

    if (statePath) {
      // Load saved state
      log.info(`  📂 Loading auth state from: ${statePath}`);
      await this.authManager.loadAuthState(this.context, statePath);

      // Reload page to apply new auth
      log.info(`  🔄 Reloading page...`);
      await (this.page as Page).reload({ waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 3000);

      // Check if it worked — verify URL first (Google may still redirect)
      const postReloadUrl = this.page.url();
      if (postReloadUrl.includes('accounts.google.com')) {
        log.warning(
          `  ⚠️ Still on Google sign-in after loading auth state — session expired server-side`
        );
      } else {
        const nowValid = await this.authManager.validateCookiesExpiry(this.context);
        if (nowValid) {
          log.success(`  ✅ Auth state loaded successfully`);
          return true;
        }
      }
    }

    // Need fresh login
    log.warning(`  🔑 Fresh login required`);

    if (CONFIG.autoLoginEnabled) {
      log.info(`  🤖 Attempting auto-login...`);
      const loginSuccess = await this.authManager.loginWithCredentials(
        this.context,
        this.page,
        CONFIG.loginEmail,
        CONFIG.loginPassword
      );

      if (loginSuccess) {
        log.success(`  ✅ Auto-login successful`);
        // Navigate back to notebook
        await this.page.goto(this.notebookUrl, {
          waitUntil: 'domcontentloaded',
        });
        await randomDelay(2000, 3000);
        return true;
      } else {
        log.error(`  ❌ Auto-login failed`);
        return false;
      }
    } else {
      // Try auto-login with stored credentials (AutoLoginManager),
      // then fall back to manual performSetup if no credentials.
      log.warning(`  🔑 Attempting re-authentication...`);

      try {
        const accountManager = await getAccountManager();
        const currentAccountId = await accountManager.getCurrentAccountId();
        let reAuthSuccess = false;

        if (currentAccountId) {
          const account = accountManager.getAccount(currentAccountId);
          if (account?.config.hasCredentials) {
            // Auto-login uses account.profileDir (not chrome_profile) → no lock conflict
            log.info(`  🤖 Auto-login with stored credentials...`);
            const { AutoLoginManager } = await import('../accounts/auto-login-manager.js');
            const autoLoginManager = new AutoLoginManager(accountManager);
            const result = await autoLoginManager.performAutoLogin(currentAccountId, {
              showBrowser: true,
              timeout: CONFIG.autoLoginTimeoutMs * 2,
            });

            if (result.success) {
              log.success(`  ✅ Auto-login successful`);

              // Close current context → sync fresh profile → re-init
              await this.sharedContextManager.closeContext();
              this.page = null;
              this.context = null as unknown as BrowserContext;
              this.initialized = false;

              await accountManager.syncProfileToMain(currentAccountId);
              await this.init();
              return true;
            }
            log.warning(`  ⚠️  Auto-login failed: ${result.error}`);
          }
        }

        // Fall back to manual performSetup
        log.warning(`  📝 Opening browser for manual login...`);

        // Close context to release chrome_profile lock
        await this.sharedContextManager.closeContext();
        this.page = null;
        this.context = null as unknown as BrowserContext;
        this.initialized = false;

        reAuthSuccess = await this.authManager.performSetup(
          async (message) => {
            log.info(`  ${message}`);
          },
          true, // show_browser = visible
          true // force = skip cookie check
        );

        if (reAuthSuccess) {
          log.success(`  ✅ Manual re-authentication successful`);

          if (currentAccountId) {
            await accountManager.syncMainToAccount(currentAccountId);
          }

          await this.init();
          return true;
        }

        log.error(`  ❌ Re-authentication failed`);
        return false;
      } catch (error) {
        log.error(`  ❌ Re-authentication failed: ${error}`);
        return false;
      }
    }
  }

  private getOriginFromUrl(url: string): string | null {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }

  /**
   * Safely restore sessionStorage when the page is on the expected origin
   */
  private async restoreSessionStorage(
    sessionData: Record<string, string>,
    entryCount: number
  ): Promise<void> {
    if (!this.page) {
      log.warning(`  ⚠️  Cannot restore sessionStorage without an active page`);
      return;
    }

    const targetOrigin = this.getOriginFromUrl(this.notebookUrl);
    if (!targetOrigin) {
      log.warning(`  ⚠️  Unable to determine target origin for sessionStorage restore`);
      return;
    }

    let restored = false;

    const applyToPage = async (): Promise<boolean> => {
      if (!this.page) {
        return false;
      }

      const currentOrigin = this.getOriginFromUrl(this.page.url());
      if (currentOrigin !== targetOrigin) {
        return false;
      }

      try {
        await this.page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            // @ts-expect-error - sessionStorage exists in browser context
            sessionStorage.setItem(key, value);
          }
        }, sessionData);
        restored = true;
        log.success(`  ✅ SessionStorage restored: ${entryCount} entries`);
        return true;
      } catch (error) {
        log.warning(`  ⚠️  Failed to restore sessionStorage: ${error}`);
        return false;
      }
    };

    if (await applyToPage()) {
      return;
    }

    log.info(`  ⏳ Waiting for NotebookLM origin before restoring sessionStorage...`);

    const handleNavigation = async () => {
      if (restored) {
        return;
      }

      if (await applyToPage()) {
        cleanup();
      }
    };

    // Cleanup function to remove listener and prevent memory leak
    const cleanup = () => {
      this.page?.off('framenavigated', handleNavigation);
      this.page?.off('close', cleanup);
    };

    this.page.on('framenavigated', handleNavigation);
    // Also cleanup if page closes before restoration completes
    this.page.once('close', cleanup);
  }

  /**
   * Ask a question to NotebookLM
   *
   * @param question The question to ask
   * @param sendProgress Progress callback for status updates
   * @param sourceFormat Optional format for source citation extraction
   * @returns AskResult with answer and optional citation data
   */
  async ask(
    question: string,
    sendProgress?: ProgressCallback,
    sourceFormat: SourceFormat = 'none'
  ): Promise<AskResult> {
    const askOnce = async (): Promise<AskResult> => {
      if (!this.initialized || !this.page || this.isPageClosedSafe()) {
        log.warning(`  ℹ️  Session not initialized or page missing → re-initializing...`);
        await this.init();
      }

      log.info(`💬 [${this.sessionId}] Asking: "${question.substring(0, 100)}..."`);
      const page = this.page!;
      // Ensure we're still authenticated — check URL first (Google redirect = expired)
      await sendProgress?.('Verifying authentication...', 2, 5);
      const currentUrl = page.url();
      const isOnGoogle = currentUrl.includes('accounts.google.com');
      const isAuth = isOnGoogle
        ? false
        : await this.authManager.validateCookiesExpiry(this.context);
      if (!isAuth) {
        log.warning(
          `  🔑 Session expired${isOnGoogle ? ' (redirected to Google sign-in)' : ''}, re-authenticating...`
        );
        await sendProgress?.('Re-authenticating session...', 2, 5);
        const reAuthSuccess = await this.ensureAuthenticated();
        if (!reAuthSuccess) {
          throw new Error(
            'SESSION_EXPIRED: Google session expired.\n' +
              'Re-authenticate:\n' +
              '  1. Stop the server (Ctrl+C)\n' +
              '  2. Run: npx notebooklm-mcp setup-auth --show-browser\n' +
              '  3. Restart: npm run start:http'
          );
        }
        // After re-auth, navigate back to notebook if we were on Google
        if (isOnGoogle) {
          await this.page!.goto(this.notebookUrl, {
            waitUntil: 'domcontentloaded',
            timeout: CONFIG.browserTimeout,
          });
          await randomDelay(2000, 3000);
        }
      }

      // Snapshot existing responses BEFORE asking
      log.info(`  📸 Snapshotting existing responses...`);
      const existingResponses = await snapshotAllResponses(page);
      log.success(`  ✅ Captured ${existingResponses.length} existing responses`);

      // Ensure sources are selected before asking
      await this.ensureSourcesSelected();

      // Check for rate limit BEFORE trying to submit a question
      log.info(`  🔍 Checking for rate limit before asking...`);
      if (await this.detectRateLimitError()) {
        throw new RateLimitError('NotebookLM daily limit reached - switching to another account');
      }

      // Find the chat input
      const inputSelector = await this.findChatInput();
      if (!inputSelector) {
        throw new Error(
          'Could not find visible chat input element. ' +
            'Please check if the notebook page has loaded correctly.'
        );
      }

      log.info(`  ⌨️  Typing question with human-like behavior...`);
      await sendProgress?.('Typing question with human-like behavior...', 2, 5);
      await humanType(page, inputSelector, question, {
        withTypos: true,
        wpm: Math.max(CONFIG.typingWpmMin, CONFIG.typingWpmMax),
      });

      // Small pause before submitting
      await randomDelay(500, 1000);

      // Submit the question (Enter key)
      log.info(`  📤 Submitting question...`);
      await sendProgress?.('Submitting question...', 3, 5);
      await page.keyboard.press('Enter');

      // Small pause after submit
      await randomDelay(1000, 1500);

      // Wait for the response with streaming detection
      log.info(`  ⏳ Waiting for response (with streaming detection)...`);
      await sendProgress?.('Waiting for NotebookLM response (streaming detection active)...', 3, 5);
      const answer = await waitForLatestAnswer(page, {
        question,
        timeoutMs: 120000, // 2 minutes
        pollIntervalMs: 1000,
        ignoreTexts: existingResponses,
        debug: true,
      });

      if (!answer) {
        throw new Error('Timeout waiting for response from NotebookLM');
      }

      // Check if the answer itself is a rate limit message
      if (isRateLimitMessage(answer)) {
        log.warning(`  ⚠️ Rate limit detected in response: "${answer.substring(0, 50)}..."`);
        throw new RateLimitError('NotebookLM daily limit reached - switching to another account');
      }

      // Check for rate limit errors in page elements AFTER receiving answer
      log.info(`  🔍 Checking for rate limit errors...`);
      if (await this.detectRateLimitError()) {
        throw new RateLimitError('NotebookLM daily limit reached - switching to another account');
      }

      // Update session stats
      this.messageCount++;
      this.updateActivity();

      log.success(
        `✅ [${this.sessionId}] Received answer (${answer.length} chars, ${this.messageCount} total messages)`
      );

      // Extract citations if requested (no additional API calls - just DOM interaction)
      let citationResult: CitationExtractionResult | undefined;
      if (sourceFormat !== 'none') {
        await sendProgress?.('Extracting source citations...', 4, 5);

        // Find the response container for citation extraction
        const responseContainer = await page.$(
          '.to-user-container:last-child .message-text-content'
        );

        citationResult = await extractCitations(page, answer, responseContainer, sourceFormat);

        if (citationResult.success && citationResult.citations.length > 0) {
          log.success(`  📚 Extracted ${citationResult.citations.length} source citations`);
        }
      }

      // Return result with optional citation data
      const result: AskResult = {
        answer: citationResult?.formattedAnswer || answer,
        originalAnswer: answer,
        citationResult: sourceFormat !== 'none' ? citationResult : undefined,
      };

      return result;
    };

    try {
      return await askOnce();
    } catch (error: unknown) {
      const msg = String(error instanceof Error ? error.message : error);
      if (/has been closed|Target .* closed|Browser has been closed|Context .* closed/i.test(msg)) {
        log.warning(`  ♻️  Detected closed page/context. Recovering session and retrying ask...`);
        try {
          this.initialized = false;
          if (this.page) {
            try {
              await this.page.close();
            } catch {
              /* Ignore errors during cleanup */
            }
          }
          this.page = null;
          await this.init();
          return await askOnce();
        } catch (e2) {
          log.error(`❌ Recovery failed: ${e2}`);
          throw e2;
        }
      }
      log.error(`❌ [${this.sessionId}] Failed to ask question: ${msg}`);
      throw error;
    }
  }

  /**
   * Find the chat input element
   *
   * IMPORTANT: Matches Python implementation EXACTLY!
   * - Uses SPECIFIC selectors from Python
   * - Checks ONLY visibility (NOT disabled state!)
   *
   * Based on Python ask() method from browser_session.py:166-171
   */
  private async findChatInput(): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    // Use EXACT Python selectors (in order of preference)
    const selectors = [
      'textarea.query-box-input', // ← PRIMARY Python selector
      'textarea[aria-label="Feld für Anfragen"]', // ← Python fallback
    ];

    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            // NO disabled check! Just like Python!
            log.success(`  ✅ Found chat input: ${selector}`);
            return selector;
          }
        }
      } catch {
        continue;
      }
    }

    log.error(`  ❌ Could not find visible chat input`);
    return null;
  }

  /**
   * Detect if a rate limit error occurred
   *
   * Searches the page for error messages indicating rate limit/quota exhaustion.
   * Free NotebookLM accounts have 50 queries/day limit.
   *
   * @returns true if rate limit error detected, false otherwise
   */
  private async detectRateLimitError(): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    // Error message selectors (common patterns for error containers)
    const errorSelectors = [
      '.error-message',
      '.error-container',
      "[role='alert']",
      '.rate-limit-message',
      '[data-error]',
      '.notification-error',
      '.alert-error',
      '.toast-error',
    ];

    // Keywords that indicate rate limiting (English + French)
    // IMPORTANT: Must be VERY specific — generic phrases like "limit exceeded", "revenez plus tard",
    // or "too many requests" can appear in academic text and cause false positives.
    const keywords = [
      'rate limit exceeded',
      'daily limit reached',
      'daily discussion limit',
      'query limit reached',
      'request limit reached',
      // French keywords - SPECIFIC phrases only
      'limite quotidienne de discussions',
      'atteint la limite quotidienne',
      'vous avez atteint la limite quotidienne',
    ];

    // Check error containers for rate limit messages (NOT full body — too many false positives)
    for (const selector of errorSelectors) {
      try {
        const elements = await this.page.$$(selector);
        for (const el of elements) {
          try {
            const text = await el.innerText();
            const lower = text.toLowerCase();

            if (keywords.some((k) => lower.includes(k))) {
              log.error(`🚫 Rate limit detected: ${text.slice(0, 100)}`);
              return true;
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    // Check chat input for rate limit messages (placeholder, value, or disabled state)
    try {
      const inputSelector = 'textarea.query-box-input';
      const input = await this.page.$(inputSelector);
      if (input) {
        // Check placeholder text (rate limit message often appears here)
        const placeholder = await input.getAttribute('placeholder');
        if (placeholder) {
          const placeholderLower = placeholder.toLowerCase();
          if (keywords.some((k) => placeholderLower.includes(k))) {
            log.error(
              `🚫 Rate limit detected in input placeholder: "${placeholder.substring(0, 80)}..."`
            );
            return true;
          }
        }

        // Check input value (sometimes the message is in the field itself)
        const inputValue = await input.inputValue();
        if (inputValue) {
          const valueLower = inputValue.toLowerCase();
          if (keywords.some((k) => valueLower.includes(k))) {
            log.error(`🚫 Rate limit detected in input value: "${inputValue.substring(0, 80)}..."`);
            return true;
          }
        }

        // Check if input is disabled
        const isDisabled = await input.evaluate((el) => {
          return (el as { disabled?: boolean }).disabled || el.hasAttribute('disabled');
        });

        if (isDisabled) {
          // Check if there's an error message near the input
          const parent = await input.evaluateHandle((el) => el.parentElement);
          const parentEl = parent.asElement();
          if (parentEl) {
            try {
              const parentText = await parentEl.innerText();
              const lower = parentText.toLowerCase();
              if (keywords.some((k) => lower.includes(k))) {
                log.error(`🚫 Rate limit detected: Chat input disabled with error message`);
                return true;
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Ignore errors checking input state
    }

    return false;
  }

  /**
   * Ensure all sources are selected (checkbox checked)
   * NotebookLM requires sources to be selected to answer questions
   */
  private async ensureSourcesSelected(): Promise<void> {
    if (!this.page) return;

    try {
      log.info(`  📋 Ensuring sources are selected...`);

      // Look for "Select all sources" checkbox (French: "Sélectionner toutes les sources")
      const selectAllSelectors = [
        'text=/Sélectionner toutes les sources/i',
        'text=/Select all sources/i',
        'text=/Select all/i',
        'text=/Tout sélectionner/i',
        // Checkbox before the "Select all" text
        'mat-checkbox:near(:text("Sélectionner"))',
        'mat-checkbox:near(:text("Select all"))',
        // First checkbox in sources panel (usually "select all")
        '.sources-list mat-checkbox:first-child',
        '[class*="source"] mat-checkbox:first-of-type',
      ];

      for (const selector of selectAllSelectors) {
        try {
          const checkbox = this.page.locator(selector).first();
          if (await checkbox.isVisible({ timeout: 2000 })) {
            // Check if already selected
            const isChecked = await checkbox
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DOM element in browser context
              .evaluate((el: any) => {
                // Check various ways to determine if checked
                const checkboxEl = el.querySelector('input[type="checkbox"]') || el;
                return (
                  checkboxEl.checked ||
                  el.classList?.contains('mat-mdc-checkbox-checked') ||
                  el.getAttribute('aria-checked') === 'true'
                );
              })
              .catch(() => false);

            if (!isChecked) {
              log.info(`  ☑️ Clicking "Select all sources"...`);
              await checkbox.click();
              await randomDelay(500, 800);
            } else {
              log.info(`  ✅ Sources already selected`);
            }
            return;
          }
        } catch {
          continue;
        }
      }

      // Fallback: Try clicking on the sources panel header to select all
      log.info(`  🔍 "Select all" not found, trying to verify sources manually...`);
    } catch (error) {
      log.warning(`  ⚠️ Could not ensure sources selected: ${error}`);
    }
  }

  /**
   * Reset the chat history (start a new conversation)
   */
  async reset(): Promise<void> {
    const resetOnce = async (): Promise<void> => {
      if (!this.initialized || !this.page || this.isPageClosedSafe()) {
        await this.init();
      }
      log.info(`🔄 [${this.sessionId}] Resetting chat history...`);
      // Reload the page to clear chat history
      await (this.page as Page).reload({ waitUntil: 'domcontentloaded' });
      await randomDelay(2000, 3000);

      // Check if reload redirected to Google sign-in (session expired server-side)
      const page = this.page as Page;
      const postResetUrl = page.url();
      if (postResetUrl.includes('accounts.google.com')) {
        log.warning(
          `  ⚠️ [${this.sessionId}] Google session expired during reset — attempting re-auth`
        );
        const loginSuccess = await this.ensureAuthenticated();
        if (!loginSuccess) {
          throw new Error(
            'SESSION_EXPIRED: Google session expired during reset.\n' +
              'Re-authenticate:\n' +
              '  1. Stop the server (Ctrl+C)\n' +
              '  2. Run: npx notebooklm-mcp setup-auth --show-browser\n' +
              '  3. Restart: npm run start:http'
          );
        }
        // Re-navigate to notebook after auth
        await page.goto(this.notebookUrl, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.browserTimeout,
        });
        await randomDelay(2000, 3000);
      }

      // Wait for interface to be ready again
      await this.waitForNotebookLMReady();

      // Reset message count
      this.messageCount = 0;
      this.updateActivity();

      log.success(`✅ [${this.sessionId}] Chat history reset`);
    };

    try {
      await resetOnce();
    } catch (error: unknown) {
      const msg = String(error instanceof Error ? error.message : error);
      if (/has been closed|Target .* closed|Browser has been closed|Context .* closed/i.test(msg)) {
        log.warning(`  ♻️  Detected closed page/context during reset. Recovering and retrying...`);
        this.initialized = false;
        if (this.page) {
          try {
            await this.page.close();
          } catch {
            /* Ignore errors during cleanup */
          }
        }
        this.page = null;
        await this.init();
        await resetOnce();
        return;
      }
      log.error(`❌ [${this.sessionId}] Failed to reset: ${msg}`);
      throw error;
    }
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    log.info(`🛑 Closing session ${this.sessionId}...`);

    if (this.page) {
      try {
        await this.page.close();
        this.page = null;
        log.success(`  ✅ Page closed`);
      } catch (error) {
        log.warning(`  ⚠️  Error closing page: ${error}`);
      }
    }

    this.initialized = false;
    log.success(`✅ Session ${this.sessionId} closed`);
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Check if session has expired (inactive for too long)
   * @param timeoutSeconds - Timeout in seconds. 0 means never expires.
   */
  isExpired(timeoutSeconds: number): boolean {
    if (timeoutSeconds <= 0) {
      return false; // 0 or negative timeout means never expires
    }
    const inactiveSeconds = (Date.now() - this.lastActivity) / 1000;
    return inactiveSeconds > timeoutSeconds;
  }

  /**
   * Get session information
   */
  getInfo(): SessionInfo {
    const now = Date.now();
    return {
      id: this.sessionId,
      created_at: this.createdAt,
      last_activity: this.lastActivity,
      age_seconds: (now - this.createdAt) / 1000,
      inactive_seconds: (now - this.lastActivity) / 1000,
      message_count: this.messageCount,
      notebook_url: this.notebookUrl,
    };
  }

  /**
   * Get the underlying page (for advanced operations)
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.page !== null;
  }
}
