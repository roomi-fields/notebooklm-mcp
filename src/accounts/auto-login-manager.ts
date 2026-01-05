/**
 * Auto-Login Manager
 *
 * Handles automated login for accounts with stored credentials.
 * Uses existing AuthManager infrastructure but with multi-account support.
 */

import type { BrowserContext, Page } from 'patchright';
import { chromium } from 'patchright';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { CONFIG, NOTEBOOKLM_AUTH_URL } from '../config.js';
import { log } from '../utils/logger.js';
import {
  humanType,
  randomDelay,
  realisticClick,
  randomMouseMovement,
} from '../utils/stealth-utils.js';
import { AccountManager } from './account-manager.js';
import { maskEmail } from './crypto.js';
import type { Account, AutoLoginResult } from './types.js';

export class AutoLoginManager {
  private accountManager: AccountManager;

  constructor(accountManager: AccountManager) {
    this.accountManager = accountManager;
  }

  /**
   * Perform auto-login for a specific account
   */
  async performAutoLogin(
    accountId: string,
    options: { showBrowser?: boolean; timeout?: number } = {}
  ): Promise<AutoLoginResult> {
    const startTime = Date.now();
    const account = this.accountManager.getAccount(accountId);

    if (!account) {
      return {
        success: false,
        accountId,
        error: 'Account not found',
        duration: Date.now() - startTime,
        requiresManualIntervention: false,
      };
    }

    // Get credentials
    const credentials = await this.accountManager.getCredentials(accountId);
    if (!credentials) {
      return {
        success: false,
        accountId,
        error: 'No credentials available',
        duration: Date.now() - startTime,
        requiresManualIntervention: true,
      };
    }

    log.info(`🔄 Auto-login for: ${maskEmail(credentials.email)}`);

    let context: BrowserContext | null = null;

    try {
      // Ensure account profile directory exists
      if (!existsSync(account.profileDir)) {
        await fs.mkdir(account.profileDir, { recursive: true });
      }

      // Ensure browser_state directory exists
      const browserStateDir = path.dirname(account.stateFilePath);
      if (!existsSync(browserStateDir)) {
        await fs.mkdir(browserStateDir, { recursive: true });
      }

      // Launch persistent browser for this account
      // Map uiLocale to browser locale
      const browserLocale = CONFIG.uiLocale === 'fr' ? 'fr-FR' : 'en-US';
      const browserTimezone = CONFIG.uiLocale === 'fr' ? 'Europe/Paris' : 'America/New_York';

      context = await chromium.launchPersistentContext(account.profileDir, {
        headless: !options.showBrowser,
        ...(CONFIG.browserChannel === 'chrome' && { channel: 'chrome' }),
        viewport: CONFIG.viewport,
        locale: browserLocale,
        timezoneId: browserTimezone,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          // Docker-specific flags
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-features=VizDisplayCompositor',
          // Suppress warnings
          '--disable-infobars',
          '--disable-sync',
          '--log-level=3',
        ],
      });

      const page = context.pages()[0] || (await context.newPage());
      const timeout = options.timeout ?? CONFIG.autoLoginTimeoutMs;
      const deadline = Date.now() + timeout;

      // Navigate to Google login
      log.info('  🌐 Navigating to Google login...');
      await page.goto(NOTEBOOKLM_AUTH_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Check if already authenticated
      if (await this.isOnNotebookLM(page)) {
        log.success('  ✅ Already authenticated!');
        await this.saveState(context, page, account);
        await this.accountManager.recordLoginSuccess(accountId);
        await context.close();
        return {
          success: true,
          accountId,
          duration: Date.now() - startTime,
          requiresManualIntervention: false,
        };
      }

      // Perform login steps
      log.info('  📧 Entering email...');
      const emailResult = await this.fillEmail(page, credentials.email, deadline);
      if (!emailResult.success) {
        if (emailResult.alreadyAuthenticated) {
          await this.saveState(context, page, account);
          await this.accountManager.recordLoginSuccess(accountId);
          await context.close();
          return {
            success: true,
            accountId,
            duration: Date.now() - startTime,
            requiresManualIntervention: false,
          };
        }
        throw new Error(emailResult.error || 'Email step failed');
      }

      // Check if already on NotebookLM (session still valid)
      if (await this.isOnNotebookLM(page)) {
        log.success('  ✅ Already authenticated (session still valid)!');
        await this.saveState(context, page, account);
        await this.accountManager.recordLoginSuccess(accountId);
        await context.close();
        return {
          success: true,
          accountId,
          duration: Date.now() - startTime,
          requiresManualIntervention: false,
        };
      }

      // Wait for password page
      log.info('  🔐 Waiting for password page...');
      await this.waitForPasswordPage(page, deadline);

      // Check again if redirected to NotebookLM during wait
      if (await this.isOnNotebookLM(page)) {
        log.success('  ✅ Already authenticated!');
        await this.saveState(context, page, account);
        await this.accountManager.recordLoginSuccess(accountId);
        await context.close();
        return {
          success: true,
          accountId,
          duration: Date.now() - startTime,
          requiresManualIntervention: false,
        };
      }

      // Enter password
      log.info('  🔐 Entering password...');
      const passwordResult = await this.fillPassword(page, credentials.password, deadline);
      if (!passwordResult.success) {
        // Final check - maybe we got redirected during password entry
        if (await this.isOnNotebookLM(page)) {
          log.success('  ✅ Authentication completed!');
          await this.saveState(context, page, account);
          await this.accountManager.recordLoginSuccess(accountId);
          await context.close();
          return {
            success: true,
            accountId,
            duration: Date.now() - startTime,
            requiresManualIntervention: false,
          };
        }
        throw new Error(passwordResult.error || 'Password step failed');
      }

      // Check for 2FA
      const currentUrl = page.url();
      if (currentUrl.includes('challenge')) {
        if (credentials.totpSecret) {
          log.info('  🔑 Handling 2FA with TOTP...');
          const totpResult = await this.handle2FA(page, credentials.totpSecret, deadline);
          if (!totpResult.success) {
            throw new Error(totpResult.error || '2FA failed');
          }
        } else {
          log.warning('  ⚠️  2FA required but no TOTP secret configured');
          return {
            success: false,
            accountId,
            error: '2FA required - no TOTP secret',
            duration: Date.now() - startTime,
            requiresManualIntervention: true,
          };
        }
      }

      // Wait for redirect to NotebookLM
      log.info('  ⏳ Waiting for NotebookLM redirect...');
      const redirectSuccess = await this.waitForNotebookLM(page, deadline);

      if (!redirectSuccess) {
        // Check if we're on a challenge page
        const url = page.url();
        if (url.includes('challenge') || url.includes('signin/rejected')) {
          log.error('  ❌ Google requires additional verification');
          return {
            success: false,
            accountId,
            error: 'Google verification required',
            duration: Date.now() - startTime,
            requiresManualIntervention: true,
          };
        }
        throw new Error('Redirect to NotebookLM timed out');
      }

      // Save state
      log.info('  💾 Saving authentication state...');
      await this.saveState(context, page, account);

      // Record success
      await this.accountManager.recordLoginSuccess(accountId);

      log.success(`✅ Auto-login successful for: ${maskEmail(credentials.email)}`);
      await context.close();

      return {
        success: true,
        accountId,
        duration: Date.now() - startTime,
        requiresManualIntervention: false,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`❌ Auto-login failed: ${errorMsg}`);

      // Record failure
      await this.accountManager.recordLoginFailure(accountId, errorMsg);

      // Try to take screenshot for debugging
      if (context) {
        try {
          const pages = context.pages();
          if (pages.length > 0) {
            const screenshotPath = path.join(
              CONFIG.dataDir,
              `login_fail_${accountId}_${Date.now()}.png`
            );
            await pages[0].screenshot({ path: screenshotPath });
            log.info(`  📸 Screenshot saved: ${screenshotPath}`);
          }
        } catch {
          // Ignore screenshot errors
        }

        try {
          await context.close();
        } catch {
          // Ignore close errors
        }
      }

      return {
        success: false,
        accountId,
        error: errorMsg,
        duration: Date.now() - startTime,
        requiresManualIntervention: errorMsg.includes('verification') || errorMsg.includes('2FA'),
      };
    }
  }

  /**
   * Check if page is on NotebookLM
   */
  private async isOnNotebookLM(page: Page): Promise<boolean> {
    try {
      const url = page.url();
      return url.startsWith('https://notebooklm.google.com/');
    } catch {
      return false;
    }
  }

  /**
   * Fill email field
   */
  private async fillEmail(
    page: Page,
    email: string,
    _deadline: number
  ): Promise<{ success: boolean; error?: string; alreadyAuthenticated?: boolean }> {
    const selectors = ['input#identifierId', "input[name='identifier']", "input[type='email']"];

    for (const selector of selectors) {
      try {
        const field = await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
        if (!field) continue;

        // Human-like interaction
        const box = await field.boundingBox();
        if (box) {
          await randomMouseMovement(page, box.x + box.width / 2, box.y + box.height / 2);
          await randomDelay(200, 400);
        }

        await realisticClick(page, selector, false);
        await humanType(page, selector, email, { wpm: 180, withTypos: false });
        await randomDelay(300, 600);

        // Click Next
        const nextClicked = await this.clickNextButton(page);
        if (!nextClicked) {
          await field.press('Enter');
        }

        await randomDelay(500, 1000);
        return { success: true };
      } catch {
        continue;
      }
    }

    // Check if already on NotebookLM (was already logged in)
    if (await this.isOnNotebookLM(page)) {
      return { success: true, alreadyAuthenticated: true };
    }

    return { success: false, error: 'Email field not found' };
  }

  /**
   * Wait for password page to load
   */
  private async waitForPasswordPage(page: Page, deadline: number): Promise<void> {
    const selectors = ["input[name='Passwd']", "input[type='password']"];

    while (Date.now() < deadline) {
      for (const selector of selectors) {
        try {
          const field = await page.$(selector);
          if (field && (await field.isVisible())) {
            return;
          }
        } catch {
          continue;
        }
      }

      // Check for challenge page
      if (page.url().includes('challenge')) {
        return; // Will handle 2FA
      }

      // Check if already on NotebookLM
      if (await this.isOnNotebookLM(page)) {
        return;
      }

      await page.waitForTimeout(500);
    }
  }

  /**
   * Fill password field
   */
  private async fillPassword(
    page: Page,
    password: string,
    _deadline: number
  ): Promise<{ success: boolean; error?: string }> {
    const selectors = ["input[name='Passwd']", "input[type='password']"];

    for (const selector of selectors) {
      try {
        const field = await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
        if (!field) continue;

        // Human-like interaction
        const box = await field.boundingBox();
        if (box) {
          await randomMouseMovement(page, box.x + box.width / 2, box.y + box.height / 2);
          await randomDelay(200, 400);
        }

        await realisticClick(page, selector, false);
        await humanType(page, selector, password, { wpm: 150, withTypos: false });
        await randomDelay(300, 600);

        // Click Next
        const nextClicked = await this.clickNextButton(page);
        if (!nextClicked) {
          await field.press('Enter');
        }

        await randomDelay(500, 1000);
        return { success: true };
      } catch {
        continue;
      }
    }

    return { success: false, error: 'Password field not found' };
  }

  /**
   * Handle 2FA with TOTP
   */
  private async handle2FA(
    page: Page,
    totpSecret: string,
    _deadline: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Dynamic import otplib only when needed
      const { authenticator } = await import('otplib');

      // Generate TOTP code
      const code = authenticator.generate(totpSecret);
      log.info(`  🔑 Generated TOTP code: ${code.slice(0, 2)}****`);

      // Wait for TOTP input field
      const totpSelectors = [
        "input[name='totpPin']",
        "input[type='tel']",
        "input[autocomplete='one-time-code']",
      ];

      for (const selector of totpSelectors) {
        try {
          const field = await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
          if (!field) continue;

          await realisticClick(page, selector, false);
          await humanType(page, selector, code, { wpm: 120, withTypos: false });
          await randomDelay(300, 600);

          // Click Next/Verify
          const nextClicked = await this.clickNextButton(page);
          if (!nextClicked) {
            await field.press('Enter');
          }

          await randomDelay(1000, 2000);
          return { success: true };
        } catch {
          continue;
        }
      }

      // Before failing, check if we're already on NotebookLM (Google skipped 2FA)
      const currentUrl = page.url();
      if (currentUrl.includes('notebooklm.google.com')) {
        log.info('  ✅ 2FA was skipped (trusted device), already on NotebookLM');
        return { success: true };
      }

      return { success: false, error: 'TOTP input field not found' };
    } catch (error) {
      return { success: false, error: `TOTP failed: ${error}` };
    }
  }

  /**
   * Click Next button
   */
  private async clickNextButton(page: Page): Promise<boolean> {
    const selectors = [
      '#identifierNext',
      '#passwordNext',
      '#totpNext',
      "button:has-text('Next')",
      "button:has-text('Weiter')",
      "button:has-text('Verify')",
    ];

    for (const selector of selectors) {
      try {
        const button = await page.locator(selector);
        if ((await button.count()) > 0 && (await button.isVisible())) {
          await realisticClick(page, selector, true);
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Wait for redirect to NotebookLM
   */
  private async waitForNotebookLM(page: Page, deadline: number): Promise<boolean> {
    while (Date.now() < deadline) {
      if (await this.isOnNotebookLM(page)) {
        // Wait for page to stabilize
        try {
          await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch {
          // Ignore timeout
        }
        await page.waitForTimeout(2000);
        return true;
      }

      // Handle Google interstitial pages (passkeys, security prompts, etc.)
      await this.handleInterstitialPages(page);

      await page.waitForTimeout(500);
    }
    return false;
  }

  /**
   * Handle Google interstitial pages that may appear after login
   */
  private async handleInterstitialPages(page: Page): Promise<void> {
    // List of buttons to click to dismiss interstitial pages
    const dismissButtons = [
      // Passkeys prompt
      "button:has-text('Not now')",
      "button:has-text('Nicht jetzt')",
      "button:has-text('Pas maintenant')",
      // Security prompt / Skip buttons
      "button:has-text('Skip')",
      "button:has-text('Überspringen')",
      "button:has-text('Ignorer')",
      // Continue / Done buttons (for info pages)
      '#confirm',
      "button:has-text('Done')",
      "button:has-text('Fertig')",
      "button:has-text('Terminé')",
      // Reject cookies / consent
      "button:has-text('Reject all')",
      "button:has-text('Alle ablehnen')",
      "button:has-text('Tout refuser')",
    ];

    for (const selector of dismissButtons) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 100 })) {
          log.info(`  🔄 Dismissing interstitial page: ${selector}`);
          await button.click({ timeout: 2000 });
          await page.waitForTimeout(1000);
          return; // Only click one button per iteration
        }
      } catch {
        // Button not found or not visible, continue
      }
    }
  }

  /**
   * Save browser state for account
   */
  private async saveState(context: BrowserContext, page: Page, account: Account): Promise<void> {
    // Ensure directory exists
    const stateDir = path.dirname(account.stateFilePath);
    if (!existsSync(stateDir)) {
      await fs.mkdir(stateDir, { recursive: true });
    }

    // Save storage state
    await context.storageState({ path: account.stateFilePath });

    // Save session storage
    try {
      const sessionData = await page.evaluate((): string => {
        // Runs in browser context where sessionStorage exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ss = (globalThis as any).sessionStorage;
        const storage: Record<string, string> = {};
        for (let i = 0; i < ss.length; i++) {
          const key = ss.key(i);
          if (key) {
            storage[key] = ss.getItem(key) || '';
          }
        }
        return JSON.stringify(storage);
      });

      const sessionPath = path.join(stateDir, 'session.json');
      await fs.writeFile(sessionPath, sessionData, 'utf-8');
    } catch {
      // Ignore session storage errors
    }

    log.success(`  ✅ State saved: ${account.stateFilePath}`);
  }

  /**
   * Auto-login for best available account
   */
  async autoLoginBestAccount(
    options: { showBrowser?: boolean } = {}
  ): Promise<AutoLoginResult | null> {
    const selection = await this.accountManager.getBestAccount();

    if (!selection) {
      log.warning('⚠️  No accounts available for auto-login');
      return null;
    }

    return this.performAutoLogin(selection.account.config.id, options);
  }
}
