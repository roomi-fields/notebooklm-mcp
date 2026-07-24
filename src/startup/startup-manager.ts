/**
 * Startup Manager
 *
 * Handles the complete startup sequence:
 * 1. Server initialization
 * 2. Account discovery and selection
 * 3. Authentication verification
 * 4. Auto-reconnect on cookie expiry
 * 5. Clear status messages
 */

import { NOTEBOOK_BASE_URL } from '../utils/notebook-domain.js';
import { AuthManager } from '../auth/auth-manager.js';
import { getAccountManager, AccountManager } from '../accounts/account-manager.js';
import { AutoLoginManager } from '../accounts/auto-login-manager.js';
import { log } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { maskEmail } from '../accounts/crypto.js';

export interface StartupResult {
  success: boolean;
  serverStarted: boolean;
  authenticated: boolean;
  accountId?: string;
  accountEmail?: string;
  error?: string;
  message: string;
  details: string[];
}

export class StartupManager {
  private authManager: AuthManager;
  private accountManager: AccountManager | null = null;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Execute the complete startup sequence
   */
  async startup(): Promise<StartupResult> {
    const details: string[] = [];
    log.info('');
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info('  🚀 NotebookLM MCP Server - Startup Sequence');
    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info('');

    // Step 1: Initialize account manager
    log.info('📋 Step 1: Loading accounts...');
    try {
      this.accountManager = await getAccountManager();
      const accountCount = this.accountManager.getAccountCount();

      if (accountCount === 0) {
        details.push('No accounts configured');
        log.warning('  ⚠️  No accounts configured');
        log.info('');
        log.info('  💡 To add an account:');
        log.info('     - Use setup_auth tool for manual login');
        log.info('     - Or add credentials via account management API');
        log.info('');

        // Check if there's a legacy state file (single account mode)
        const legacyState = await this.authManager.getValidStatePath();
        if (legacyState) {
          details.push('Legacy authentication found');
          log.success('  ✅ Legacy authentication found (single account mode)');
          return {
            success: true,
            serverStarted: true,
            authenticated: true,
            message: 'Server started with legacy authentication',
            details,
          };
        }

        return {
          success: true,
          serverStarted: true,
          authenticated: false,
          message: 'Server started - No accounts configured',
          details,
        };
      }

      details.push(`${accountCount} account(s) found`);
      log.success(`  ✅ ${accountCount} account(s) found`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      details.push(`Account initialization failed: ${errorMsg}`);
      log.error(`  ❌ Account initialization failed: ${errorMsg}`);
      return {
        success: false,
        serverStarted: true,
        authenticated: false,
        error: errorMsg,
        message: 'Server started but account initialization failed',
        details,
      };
    }

    // Step 2: Select account to use
    log.info('');
    log.info('🔍 Step 2: Selecting account...');

    // Check for current account first
    const currentAccountId = await this.accountManager.getCurrentAccountId();
    let selectedAccount = currentAccountId
      ? this.accountManager.getAccount(currentAccountId)
      : null;

    if (selectedAccount) {
      details.push(`Using current account: ${maskEmail(selectedAccount.config.email)}`);
      log.success(`  ✅ Using current account: ${maskEmail(selectedAccount.config.email)}`);
    } else {
      // Get best available account
      const selection = await this.accountManager.getBestAccount();
      if (!selection) {
        details.push('No available accounts (all exhausted or failed)');
        log.warning('  ⚠️  No available accounts');
        return {
          success: true,
          serverStarted: true,
          authenticated: false,
          message: 'Server started - No available accounts',
          details,
        };
      }
      selectedAccount = selection.account;
      details.push(
        `Selected account: ${maskEmail(selectedAccount.config.email)} (${selection.reason})`
      );
      log.success(`  ✅ Selected: ${maskEmail(selectedAccount.config.email)}`);
      log.dim(`     Reason: ${selection.reason}`);
    }

    // Step 3: Verify authentication
    log.info('');
    log.info('🔐 Step 3: Verifying authentication...');

    const authResult = await this.verifyAndConnectAccount(selectedAccount.config.id);

    if (authResult.authenticated) {
      // Cookies look valid on disk — but verify with a REAL browser navigation
      // Google can revoke sessions server-side while local cookies still look fine
      log.info('');
      log.info('🌐 Step 4: Real browser verification...');
      const realAuthValid = await this.verifyWithBrowser();

      if (!realAuthValid) {
        log.warning('  ⚠️  Google session expired server-side — launching re-authentication...');
        details.push('Google session expired server-side, re-authenticating');

        // Try auto-login first (uses stored credentials — fills email+password automatically)
        const autoReauthResult = await this.attemptAutoReauth(selectedAccount.config.id);
        let reAuthSuccess = autoReauthResult.success;

        if (!reAuthSuccess) {
          // Auto-login failed or no credentials — fall back to manual performSetup
          log.warning(
            `  ⚠️  Auto-login failed (${autoReauthResult.error}), falling back to manual login...`
          );
          reAuthSuccess = await this.authManager.performSetup(
            async (message) => {
              log.info(`  ${message}`);
            },
            true, // show_browser = visible
            true // force = skip cookie check
          );
        }

        if (reAuthSuccess) {
          details.push('Re-authentication successful');
          await this.accountManager.saveCurrentAccountId(selectedAccount.config.id);
          // Sync fresh auth TO account
          await this.accountManager.syncMainToAccount(selectedAccount.config.id);

          log.info('');
          log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          log.success(
            `  ✅ Ready - Re-authenticated as ${maskEmail(selectedAccount.config.email)}`
          );
          log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          log.info('');

          return {
            success: true,
            serverStarted: true,
            authenticated: true,
            accountId: selectedAccount.config.id,
            accountEmail: selectedAccount.config.email,
            message: `Re-authenticated as ${maskEmail(selectedAccount.config.email)}`,
            details,
          };
        }

        // Re-auth failed — fall through to try other accounts
        details.push('Re-authentication failed');
        log.error('  ❌ Re-authentication failed');
        authResult.needsReauth = true;
        authResult.authenticated = false;
      } else {
        details.push('Authentication verified (real browser check)');
        await this.accountManager.saveCurrentAccountId(selectedAccount.config.id);
        await this.accountManager.syncProfileToMain(selectedAccount.config.id);

        log.info('');
        log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log.success(`  ✅ Ready - Connected as ${maskEmail(selectedAccount.config.email)}`);
        log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log.info('');

        return {
          success: true,
          serverStarted: true,
          authenticated: true,
          accountId: selectedAccount.config.id,
          accountEmail: selectedAccount.config.email,
          message: `Connected as ${maskEmail(selectedAccount.config.email)}`,
          details,
        };
      }
    }

    // Authentication failed for selected account, try others
    if (authResult.needsReauth) {
      details.push(`Cookies expired for ${maskEmail(selectedAccount.config.email)}`);
      log.warning(`  ⚠️  Cookies expired for ${maskEmail(selectedAccount.config.email)}`);

      // Try auto-reauth if enabled and credentials available
      if (this.accountManager.isAutoLoginEnabled()) {
        log.info('  🔄 Attempting auto-reconnect...');
        const reAuthResult = await this.attemptAutoReauth(selectedAccount.config.id);

        if (reAuthResult.success) {
          details.push('Auto-reconnect successful');
          await this.accountManager.saveCurrentAccountId(selectedAccount.config.id);
          await this.accountManager.recordLoginSuccess(selectedAccount.config.id);
          await this.accountManager.syncProfileToMain(selectedAccount.config.id);

          log.info('');
          log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          log.success(`  ✅ Ready - Reconnected as ${maskEmail(selectedAccount.config.email)}`);
          log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          log.info('');

          return {
            success: true,
            serverStarted: true,
            authenticated: true,
            accountId: selectedAccount.config.id,
            accountEmail: selectedAccount.config.email,
            message: `Reconnected as ${maskEmail(selectedAccount.config.email)}`,
            details,
          };
        }

        details.push(`Auto-reconnect failed: ${reAuthResult.error}`);
        log.error(`  ❌ Auto-reconnect failed: ${reAuthResult.error}`);
      }

      // Try other accounts
      log.info('  🔄 Trying other accounts...');
      const fallbackResult = await this.tryFallbackAccounts(selectedAccount.config.id);

      if (fallbackResult.success && fallbackResult.accountId) {
        const fallbackAccount = this.accountManager.getAccount(fallbackResult.accountId);
        if (fallbackAccount) {
          details.push(`Fallback to: ${maskEmail(fallbackAccount.config.email)}`);

          log.info('');
          log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          log.success(`  ✅ Ready - Fallback to ${maskEmail(fallbackAccount.config.email)}`);
          log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          log.info('');

          return {
            success: true,
            serverStarted: true,
            authenticated: true,
            accountId: fallbackResult.accountId,
            accountEmail: fallbackAccount.config.email,
            message: `Connected as ${maskEmail(fallbackAccount.config.email)} (fallback)`,
            details,
          };
        }
      }
    }

    // All accounts failed
    details.push('All accounts failed authentication');
    log.info('');
    log.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.error('  ❌ Authentication failed for all accounts');
    log.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info('');
    log.info('  💡 Solutions:');
    log.info('     - POST /setup-auth to re-authenticate');
    log.info('     - POST /re-auth to switch account');
    log.info('     - Check account credentials');
    log.info('');

    return {
      success: true,
      serverStarted: true,
      authenticated: false,
      error: 'All accounts failed authentication',
      message: 'Server started - Authentication required',
      details,
    };
  }

  /**
   * Verify authentication with a REAL browser navigation.
   * Launches a quick headless browser, navigates to NotebookLM,
   * and checks if Google redirects to sign-in page.
   * Returns true if we land on NotebookLM, false if redirected to Google.
   */
  private async verifyWithBrowser(): Promise<boolean> {
    const { chromium } = await import('patchright');
    let context;

    try {
      const browserLocale = CONFIG.uiLocale === 'fr' ? 'fr-FR' : 'en-US';
      context = await chromium.launchPersistentContext(CONFIG.chromeProfileDir, {
        headless: true,
        ...(CONFIG.browserChannel === 'chrome' && { channel: 'chrome' as const }),
        viewport: CONFIG.viewport,
        locale: browserLocale,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-infobars',
          '--disable-sync',
          '--log-level=3',
        ],
      });

      const pages = context.pages();
      const page = pages.length > 0 ? pages[0] : await context.newPage();

      // Navigate to NotebookLM
      log.info('  🌐 Navigating to NotebookLM to verify session...');
      await page.goto(NOTEBOOK_BASE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for any redirects to settle
      await page.waitForTimeout(3000);

      const finalUrl = page.url();
      log.info(`  📍 Final URL: ${finalUrl}`);

      const isOnGoogle = finalUrl.includes('accounts.google.com');

      if (isOnGoogle) {
        log.warning('  ❌ Redirected to Google sign-in — session is NOT valid');
        return false;
      }

      log.success('  ✅ Landed on NotebookLM — session is valid');
      return true;
    } catch (error) {
      log.warning(`  ⚠️  Browser verification failed: ${error}`);
      // If verification itself fails, assume auth is OK and let runtime handle it
      return true;
    } finally {
      if (context) {
        try {
          await context.close();
        } catch {
          /* ignore cleanup errors */
        }
      }
    }
  }

  /**
   * Verify authentication for a specific account
   * Uses account-specific state file path, not global AuthManager path
   */
  private async verifyAndConnectAccount(
    accountId: string
  ): Promise<{ authenticated: boolean; needsReauth: boolean; error?: string }> {
    if (!this.accountManager) {
      return { authenticated: false, needsReauth: false, error: 'Account manager not initialized' };
    }

    const account = this.accountManager.getAccount(accountId);
    if (!account) {
      return { authenticated: false, needsReauth: false, error: 'Account not found' };
    }

    // Check account-specific state file (NOT the global AuthManager path)
    const accountStatePath = account.stateFilePath;
    const fs = await import('fs/promises');
    const { existsSync } = await import('fs');

    if (!existsSync(accountStatePath)) {
      log.warning('  ⚠️  No authentication state found');
      log.dim(`     Expected: ${accountStatePath}`);
      return { authenticated: false, needsReauth: true };
    }

    // Validate cookies in the account state file
    try {
      const stateData = await fs.readFile(accountStatePath, 'utf-8');
      const state = JSON.parse(stateData);

      if (!state.cookies || state.cookies.length === 0) {
        log.warning('  ⚠️  No cookies in state file');
        return { authenticated: false, needsReauth: true };
      }

      // Check for critical Google auth cookies
      const criticalCookieNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID'];
      const criticalCookies = state.cookies.filter((c: { name: string }) =>
        criticalCookieNames.includes(c.name)
      );

      if (criticalCookies.length === 0) {
        log.warning('  ⚠️  No critical auth cookies found');
        return { authenticated: false, needsReauth: true };
      }

      // Check cookie expiration
      const currentTime = Date.now() / 1000;
      for (const cookie of criticalCookies) {
        const expires = cookie.expires ?? -1;
        if (expires !== -1 && expires < currentTime) {
          log.warning(`  ⚠️  Cookie '${cookie.name}' has expired`);
          return { authenticated: false, needsReauth: true };
        }
      }

      log.success(`  ✅ Authentication valid (${criticalCookies.length} critical cookies)`);
      return { authenticated: true, needsReauth: false };
    } catch (error) {
      log.warning(`  ⚠️  Failed to validate state file: ${error}`);
      return { authenticated: false, needsReauth: true };
    }
  }

  /**
   * Attempt automatic re-authentication using stored credentials
   */
  private async attemptAutoReauth(
    accountId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.accountManager) {
      return { success: false, error: 'Account manager not initialized' };
    }

    // Check if account has credentials
    const account = this.accountManager.getAccount(accountId);
    if (!account || !account.config.hasCredentials) {
      return { success: false, error: 'No stored credentials for auto-login' };
    }

    try {
      // Use the AutoLoginManager for auto-login
      const autoLoginManager = new AutoLoginManager(this.accountManager);

      // Always use visible browser for re-authentication
      // Headless auth doesn't work with Google (2FA, captcha, etc.)
      log.info('  🌐 Opening browser for authentication...');
      const result = await autoLoginManager.performAutoLogin(accountId, {
        showBrowser: true,
        timeout: CONFIG.autoLoginTimeoutMs * 2, // Give time for manual login
      });

      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error || 'Authentication failed or cancelled' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Try to authenticate with fallback accounts
   */
  private async tryFallbackAccounts(
    excludeAccountId: string
  ): Promise<{ success: boolean; accountId?: string }> {
    if (!this.accountManager) {
      return { success: false };
    }

    const selection = await this.accountManager.getBestAccount(excludeAccountId);
    if (!selection) {
      return { success: false };
    }

    const authResult = await this.verifyAndConnectAccount(selection.account.config.id);
    if (authResult.authenticated) {
      await this.accountManager.saveCurrentAccountId(selection.account.config.id);
      await this.accountManager.syncProfileToMain(selection.account.config.id);
      return { success: true, accountId: selection.account.config.id };
    }

    // Try auto-reauth for fallback account
    if (authResult.needsReauth && this.accountManager.isAutoLoginEnabled()) {
      const reAuthResult = await this.attemptAutoReauth(selection.account.config.id);
      if (reAuthResult.success) {
        await this.accountManager.saveCurrentAccountId(selection.account.config.id);
        await this.accountManager.recordLoginSuccess(selection.account.config.id);
        await this.accountManager.syncProfileToMain(selection.account.config.id);
        return { success: true, accountId: selection.account.config.id };
      }
    }

    // Recursively try other accounts
    return this.tryFallbackAccounts(selection.account.config.id);
  }

  /**
   * Get current connection status
   */
  async getStatus(): Promise<{
    authenticated: boolean;
    accountId?: string;
    accountEmail?: string;
    cookiesExpired: boolean;
  }> {
    const statePath = await this.authManager.getValidStatePath();
    const hasState = await this.authManager.hasSavedState();

    if (!this.accountManager) {
      try {
        this.accountManager = await getAccountManager();
      } catch {
        return {
          authenticated: statePath !== null,
          cookiesExpired: hasState && !statePath,
        };
      }
    }

    const currentAccountId = await this.accountManager.getCurrentAccountId();
    const account = currentAccountId ? this.accountManager.getAccount(currentAccountId) : null;

    return {
      authenticated: statePath !== null,
      accountId: currentAccountId || undefined,
      accountEmail: account?.config.email,
      cookiesExpired: hasState && !statePath,
    };
  }
}
