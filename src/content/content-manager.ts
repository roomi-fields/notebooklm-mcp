/**
 * Content Manager
 *
 * Handles NotebookLM content operations:
 * - Source/document upload
 * - Content generation (audio, briefing, study guides, etc.)
 * - Content listing and download
 *
 * Uses Playwright to interact with NotebookLM's web interface.
 */

import type { Page, Locator, ElementHandle } from 'patchright';
import path from 'path';
import { existsSync } from 'fs';
import { randomDelay, realisticClick, humanType } from '../utils/stealth-utils.js';
import { log } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { waitForLatestAnswer, snapshotAllResponses, isErrorMessage } from '../utils/page-utils.js';
import { setLocale, tAll } from '../i18n/index.js';

// Initialize i18n with configured locale
setLocale(CONFIG.uiLocale);

/**
 * Build selectors for all supported locales
 * @param template Selector template with {text} placeholder
 * @param category i18n category (e.g., 'tabs', 'buttons')
 * @param key i18n key within the category
 * @returns Array of selectors for all locales
 */
function i18nSelectors(
  template: string,
  category:
    | 'tabs'
    | 'buttons'
    | 'sourceTypes'
    | 'sourceNames'
    | 'contentTypes'
    | 'actions'
    | 'placeholders',
  key: string
): string[] {
  const texts = tAll(category, key);
  return texts.map((text) => template.replace('{text}', text));
}

import type {
  SourceUploadInput,
  SourceUploadResult,
  SourceDeleteInput,
  SourceDeleteResult,
  ContentType,
  ContentGenerationInput,
  ContentGenerationResult,
  NotebookSource,
  GeneratedContent,
  NotebookContentOverview,
  ContentDownloadResult,
  NoteInput,
  NoteResult,
  SaveChatToNoteInput,
  SaveChatToNoteResult,
  NoteToSourceInput,
  NoteToSourceResult,
} from './types.js';
import { ContentGenerator } from './content-generator.js';

// Note: UI selectors are defined inline in methods for better maintainability
// as NotebookLM's UI may change frequently

export class ContentManager {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ============================================================================
  // Source/Document Upload
  // ============================================================================

  /**
   * Add a source to the current notebook
   */
  async addSource(input: SourceUploadInput): Promise<SourceUploadResult> {
    log.info(`📄 Adding source: ${input.type}`);

    // CRITICAL: Capture initial URL BEFORE any action
    // NotebookLM may redirect when clicking "Add source" button!
    const initialUrl = this.page.url();
    const expectedNotebookUuid = initialUrl.match(/notebook\/([a-f0-9-]+)/)?.[1];
    log.info(`  🎯 Target notebook UUID: ${expectedNotebookUuid || 'NOT FOUND'}`);

    try {
      const existingSourceNames = await this.getAllSourceLabels();

      // Click "Add source" button
      await this.clickAddSource();

      // DEBUG: Screenshot after clicking add source to see what UI appeared
      try {
        await this.page.screenshot({ path: path.join(CONFIG.dataDir, 'debug-after-add-click.png') });
        log.info(`  📸 Debug screenshot saved: debug-after-add-click.png`);
      } catch { /* ignore */ }

      // Wait for upload dialog
      await this.waitForUploadDialog();

      // Select upload type and upload (pass expectedNotebookUuid for redirect detection)
      switch (input.type) {
        case 'file':
          return await this.uploadFile(input, expectedNotebookUuid, existingSourceNames);
        case 'url':
          return await this.uploadUrl(input, expectedNotebookUuid, existingSourceNames);
        case 'text':
          return await this.uploadText(input, expectedNotebookUuid, existingSourceNames);
        case 'google_drive':
          return await this.uploadGoogleDrive(input, expectedNotebookUuid, existingSourceNames);
        case 'youtube':
          return await this.uploadYouTube(input, expectedNotebookUuid, existingSourceNames);
        default:
          return { success: false, error: `Unsupported source type: ${input.type}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`❌ Failed to add source: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Click the "Add source" button
   */
  private async clickAddSource(): Promise<void> {
    // First, ensure we're on the Sources panel (left panel)
    await this.ensureSourcesPanel();

    // Wait for panel to be ready (increased for reliability)
    await randomDelay(800, 1200);

    // Check if a dialog is already open and close it first
    try {
      const existingDialog = this.page.locator('[role="dialog"]');
      if (await existingDialog.isVisible({ timeout: 500 })) {
        log.info('  ⚠️ Dialog already open, closing first...');
        await this.page.keyboard.press('Escape');
        await randomDelay(500, 800);
      }
    } catch {
      // No existing dialog, continue
    }

    const addSourceSelectors = [
      // NotebookLM current UI (Dec 2024) - aria-label based (most reliable)
      'button[aria-label="Add source"]',
      'button[aria-label="Ajouter une source"]', // French
      'button[aria-label*="Add source"]',
      'button[aria-label*="Ajouter une source"]',
      'button[aria-label*="add source" i]',
      // Icon button with "add" icon specifically
      'button:has(mat-icon:has-text("add"))',
      'button:has(mat-icon:has-text("add_circle"))',
      // Text-based patterns (bilingual via i18n)
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'addSource'),
      // FAB buttons (floating action button for adding)
      'button.mat-fab',
      'button.mat-mini-fab',
      // REMOVED generic selectors that match ANY icon button
    ];

    log.info(`  🔍 Looking for Add source button...`);

    for (const selector of addSourceSelectors) {
      try {
        const button = this.page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          log.info(`  ✅ Found add source button: ${selector}`);
          await realisticClick(this.page, selector, true);
          await randomDelay(500, 1000);
          return;
        }
      } catch {
        continue;
      }
    }

    // Fallback: Try to find any button with "add" aria-label
    log.info(`  🔍 Trying fallback: buttons with add-related aria-label...`);
    try {
      const addButtons = await this.page.locator('button[aria-label]').all();
      for (const btn of addButtons) {
        const ariaLabel = await btn.getAttribute('aria-label');
        if (ariaLabel && /add|ajouter|upload|source/i.test(ariaLabel)) {
          if (await btn.isVisible()) {
            log.info(`  ✅ Found add button via fallback: aria-label="${ariaLabel}"`);
            await btn.click();
            await randomDelay(500, 1000);
            return;
          }
        }
      }
    } catch {
      // Continue to debug
    }

    // Debug: log page content to help identify the correct selector
    await this.debugPageContent();

    throw new Error('Could not find "Add source" button');
  }

  /**
   * Ensure we're on the Sources panel
   */
  private async ensureSourcesPanel(): Promise<void> {
    log.info(`  📑 Ensuring Sources panel is active...`);

    // First, close any open dialogs that might be blocking
    try {
      const openDialog = this.page.locator('[role="dialog"]');
      if (await openDialog.isVisible({ timeout: 500 })) {
        log.info(`  ⚠️ Closing blocking dialog first...`);
        await this.page.keyboard.press('Escape');
        await randomDelay(300, 500);
      }
    } catch {
      /* no dialog */
    }

    const sourcesTabSelectors = [
      // NotebookLM current UI (Dec 2024) - MDC tabs (bilingual FR/EN via i18n)
      ...i18nSelectors('div.mdc-tab:has-text("{text}")', 'tabs', 'sources'),
      ...i18nSelectors('.mat-mdc-tab:has-text("{text}")', 'tabs', 'sources'),
      ...i18nSelectors('[role="tab"]:has-text("{text}")', 'tabs', 'sources'),
      // First tab in the tab list (Sources is typically first)
      '.mat-mdc-tab-list .mdc-tab:first-child',
    ];

    for (const selector of sourcesTabSelectors) {
      try {
        const tab = this.page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 })) {
          // Check if already selected using multiple methods
          const isSelected = await tab.getAttribute('aria-selected');
          const hasActiveClass = (await tab.getAttribute('class'))?.includes('mdc-tab--active');

          if (isSelected !== 'true' && !hasActiveClass) {
            log.info(`  📑 Clicking Sources tab: ${selector}`);
            // Use shorter timeout and force click if needed
            await tab.click({ timeout: 5000 });
            await randomDelay(500, 1000);
          } else {
            log.info(`  ✅ Sources tab already active`);
          }
          return;
        }
      } catch (e) {
        log.warning(`  ⚠️ Selector failed: ${selector} - ${e}`);
        continue;
      }
    }
    // Sources panel might already be visible or not use tabs
    log.info(`  ℹ️ No Sources tab found, assuming already on sources panel`);

    // Take debug screenshot to help identify the correct selectors
    try {
      const screenshotPath = path.join(CONFIG.dataDir, 'debug-sources-panel.png');
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      log.info(`  📸 Debug screenshot saved: ${screenshotPath}`);

      // Log all tab elements to help find the correct selector
      const allTabs = await this.page.locator('[role="tab"], .mdc-tab, .mat-tab-label').all();
      log.info(`  🔍 Found ${allTabs.length} tab-like elements:`);
      for (let i = 0; i < Math.min(allTabs.length, 10); i++) {
        const tab = allTabs[i];
        const text = await tab.textContent();
        const ariaLabel = await tab.getAttribute('aria-label');
        const classes = await tab.getAttribute('class');
        log.info(
          `    Tab[${i}]: text="${text?.trim()}", aria="${ariaLabel}", class="${classes?.substring(0, 50)}..."`
        );
      }
    } catch (e) {
      log.warning(`  ⚠️ Could not capture debug info: ${e}`);
    }
  }

  /**
   * Debug helper to log page content for selector debugging
   */
  private async debugPageContent(): Promise<void> {
    try {
      // Log all buttons on the page
      const buttons = await this.page.locator('button').all();
      log.info(`  🔍 DEBUG: Found ${buttons.length} buttons on page`);

      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        const btn = buttons[i];
        const ariaLabel = await btn.getAttribute('aria-label');
        const text = await btn.textContent();
        const classes = await btn.getAttribute('class');
        log.info(
          `  🔍 Button[${i}]: aria="${ariaLabel}", text="${text?.trim()}", class="${classes}"`
        );
      }

      // Take a screenshot for debugging
      const screenshotPath = path.join(CONFIG.dataDir, 'debug-add-source.png');
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      log.info(`  📸 Debug screenshot saved: ${screenshotPath}`);
    } catch (e) {
      log.warning(`  ⚠️ Debug failed: ${e}`);
    }
  }

  /**
   * Wait for upload dialog to appear
   */
  private async waitForUploadDialog(): Promise<void> {
    const dialogSelectors = [
      '[role="dialog"]',
      '.upload-dialog',
      '.modal',
      '[data-dialog="upload"]',
    ];

    for (const selector of dialogSelectors) {
      try {
        await this.page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
        log.info(`  ✅ Upload dialog appeared`);
        return;
      } catch {
        continue;
      }
    }

    // Dialog might not be a separate element - continue anyway
    log.info(`  ℹ️ No explicit dialog, continuing with upload...`);
  }

  /**
   * Upload a local file
   */
  private async uploadFile(
    input: SourceUploadInput,
    expectedNotebookUuid?: string,
    previousSourceNames: string[] = []
  ): Promise<SourceUploadResult> {
    if (!input.filePath) {
      return { success: false, error: 'File path is required' };
    }

    // Path traversal protection: resolve first, then validate startsWith(allowedDir)
    const resolvedPath = path.resolve(input.filePath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal
    const allowedDir = path.resolve(CONFIG.dataDir);

    // Allow files from dataDir or current working directory
    const cwd = path.resolve(process.cwd());
    const isAllowed = resolvedPath.startsWith(allowedDir) || resolvedPath.startsWith(cwd);

    if (!isAllowed) {
      log.warning(`  ⚠️ Path traversal attempt blocked: ${input.filePath}`);
      return {
        success: false,
        error: 'File path not allowed: must be within data directory or current working directory',
      };
    }

    if (!existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${input.filePath}` };
    }

    log.info(`  📁 Uploading file: ${path.basename(resolvedPath)}`);

    try {
      // Click on file upload option (bilingual via i18n)
      const fileTypeSelectors = [
        ...i18nSelectors('button:has-text("{text}")', 'sourceTypes', 'uploadFiles'),
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'upload'),
        '[data-type="file"]',
      ];

      for (const selector of fileTypeSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click();
            await randomDelay(300, 500);
            break;
          }
        } catch {
          continue;
        }
      }

      // Find file input and upload
      const fileInput = await this.page.waitForSelector('input[type="file"]', {
        state: 'attached',
        timeout: 5000,
      });

      if (!fileInput) {
        throw new Error('File input not found');
      }

      await fileInput.setInputFiles(input.filePath);
      log.info(`  ✅ File selected`);

      // Wait for upload to start
      await randomDelay(1000, 2000);

      // Click upload/confirm button
      await this.clickUploadButton();

      // Wait for processing
      const result = await this.waitForSourceProcessing(
        input.title || path.basename(input.filePath),
        undefined,
        expectedNotebookUuid,
        previousSourceNames
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `File upload failed: ${errorMsg}` };
    }
  }

  /**
   * Upload from URL
   */
  private async uploadUrl(
    input: SourceUploadInput,
    expectedNotebookUuid?: string,
    previousSourceNames: string[] = []
  ): Promise<SourceUploadResult> {
    if (!input.url) {
      return { success: false, error: 'URL is required' };
    }

    log.info(`  🌐 Adding URL: ${input.url}`);

    try {
      // Click on URL/Website option (bilingual selectors)
      // NotebookLM UI may show source types as buttons, spans, divs, or list items
      const urlTypeSelectors = [
        // Button-based (original dialog UI)
        ...i18nSelectors('button:has-text("{text}")', 'sourceTypes', 'website'),
        ...i18nSelectors('button:has-text("{text}")', 'sourceTypes', 'link'),
        ...i18nSelectors('button:has-text("{text}")', 'sourceTypes', 'url'),
        // New UI (2025+): source types may be spans, divs, or clickable list items
        ...i18nSelectors('span:has-text("{text}")', 'sourceTypes', 'website'),
        ...i18nSelectors('div:has-text("{text}")', 'sourceTypes', 'website'),
        ...i18nSelectors('[role="menuitem"]:has-text("{text}")', 'sourceTypes', 'website'),
        ...i18nSelectors('[role="option"]:has-text("{text}")', 'sourceTypes', 'website'),
        ...i18nSelectors('span:has-text("{text}")', 'sourceTypes', 'link'),
        ...i18nSelectors('[role="menuitem"]:has-text("{text}")', 'sourceTypes', 'link'),
        // Aria-label patterns
        '[data-type="url"]',
        '[aria-label*="website" i]',
        '[aria-label*="URL"]',
        '[aria-label*="link" i]:not([aria-label*="unlink"])',
      ];

      log.info(`  🔍 Looking for URL option...`);
      let foundUrlOption = false;
      for (const selector of urlTypeSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 500 })) {
            log.info(`  ✅ Found URL option: ${selector}`);
            await btn.click();
            await randomDelay(300, 500);
            foundUrlOption = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!foundUrlOption) {
        log.info(`  ℹ️ No URL option button found, looking for input directly`);
        // DEBUG: List all visible buttons in the page
        try {
          const buttons = await this.page.locator('button').all();
          log.info(`  🔍 DEBUG: Found ${buttons.length} buttons total`);
          for (let i = 0; i < Math.min(buttons.length, 15); i++) {
            const btn = buttons[i];
            const visible = await btn.isVisible().catch(() => false);
            if (visible) {
              const text = await btn.textContent().catch(() => '');
              const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
              log.info(`  🔍 Button[${i}]: text="${text?.trim()}", aria="${ariaLabel}"`);
            }
          }
        } catch (e) {
          log.warning(`  ⚠️ Could not list buttons: ${e}`);
        }
      }

      // Wait for input to appear after clicking option
      await randomDelay(500, 1000);

      // Find URL input (can be input OR textarea) - bilingual selectors
      // IMPORTANT: Exclude the "Search the web" search bar which is always visible
      log.info(`  🔍 Looking for URL input...`);
      const urlInputSelectors = [
        // i18n placeholder selectors
        ...i18nSelectors('input[placeholder*="{text}"]', 'placeholders', 'pasteUrl'),
        ...i18nSelectors('textarea[placeholder*="{text}"]', 'placeholders', 'pasteUrl'),
        ...i18nSelectors('input[placeholder*="{text}"]', 'placeholders', 'enterUrl'),
        ...i18nSelectors('textarea[placeholder*="{text}"]', 'placeholders', 'enterUrl'),
        ...i18nSelectors('input[placeholder*="{text}"]', 'placeholders', 'pasteLinks'),
        ...i18nSelectors('textarea[placeholder*="{text}"]', 'placeholders', 'pasteLinks'),
        // URL/http generic selectors (work in both languages)
        'input[placeholder*="URL"]',
        'textarea[placeholder*="URL"]',
        'input[placeholder*="url"]',
        'textarea[placeholder*="url"]',
        'input[placeholder*="http"]',
        'textarea[placeholder*="http"]',
        'input[name="url"]',
        'input[type="url"]',
        // Dialog-based selectors (old UI)
        '[role="dialog"] input[type="text"]',
        '[role="dialog"] input:not([type="hidden"])',
        '[role="dialog"] textarea',
        '.mat-dialog-content input',
        '.mat-dialog-content textarea',
        '.mdc-dialog__content input',
        '.mdc-dialog__content textarea',
        // New UI (2025+): overlay/panel/popover selectors (not [role="dialog"])
        '[role="menu"] input[type="text"]',
        '[role="menu"] textarea',
        '.cdk-overlay-pane input[type="text"]',
        '.cdk-overlay-pane textarea',
        '.cdk-overlay-pane input:not([type="hidden"])',
        '.mat-menu-panel input',
        '.mat-menu-panel textarea',
      ];

      let urlInput = null;
      for (const selector of urlInputSelectors) {
        try {
          const input = this.page.locator(selector).first();
          if (await input.isVisible({ timeout: 500 })) {
            urlInput = input;
            log.info(`  ✅ Found URL input: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      // Fallback: find any visible input or textarea in dialog or overlay
      if (!urlInput) {
        log.info(`  🔍 Trying fallback: any visible input/textarea in dialog or overlay...`);
        // Search in multiple container types (dialog, overlay, menu, panel)
        const containerSelectors = [
          '[role="dialog"]',
          '.cdk-overlay-pane',
          '[role="menu"]',
          '.mat-menu-panel',
        ];
        try {
          for (const container of containerSelectors) {
            if (urlInput) break;
            // Try inputs first
            const allInputs = await this.page.locator(`${container} input`).all();
            for (const input of allInputs) {
              if (await input.isVisible()) {
                urlInput = input;
                const placeholder = await input.getAttribute('placeholder');
                log.info(`  ✅ Found input via fallback (${container}): placeholder="${placeholder}"`);
                break;
              }
            }
            // Try textareas if no input found
            if (!urlInput) {
              const allTextareas = await this.page.locator(`${container} textarea`).all();
              for (const textarea of allTextareas) {
                if (await textarea.isVisible()) {
                  urlInput = textarea;
                  const placeholder = await textarea.getAttribute('placeholder');
                  log.info(`  ✅ Found textarea via fallback (${container}): placeholder="${placeholder}"`);
                  break;
                }
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Last resort: find ANY visible input/textarea on page, excluding the search bar
      if (!urlInput) {
        log.info(`  🔍 Last resort: scanning ALL visible inputs (excluding search bar)...`);
        try {
          const allPageInputs = await this.page.locator('input, textarea').all();
          for (const input of allPageInputs) {
            if (!(await input.isVisible())) continue;
            const placeholder = (await input.getAttribute('placeholder')) || '';
            // Skip the "Search the web" search bar and other non-URL inputs
            if (placeholder.toLowerCase().includes('search')) continue;
            if (placeholder.toLowerCase().includes('ask')) continue;
            if (placeholder.toLowerCase().includes('chat')) continue;
            // Prefer inputs that look URL-related
            const type = (await input.getAttribute('type')) || '';
            if (type === 'search') continue;
            urlInput = input;
            log.info(`  ✅ Found input via last resort: placeholder="${placeholder}", type="${type}"`);
            break;
          }
        } catch {
          /* ignore */
        }
      }

      // Debug: list all inputs/textareas if still not found
      if (!urlInput) {
        log.warning(`  ⚠️ URL input not found, listing ALL page inputs for debug...`);
        try {
          const inputs = await this.page
            .locator('input, textarea')
            .all();
          for (let i = 0; i < Math.min(inputs.length, 20); i++) {
            const el = inputs[i];
            const tag = await el.evaluate((e) => e.tagName?.toLowerCase() || 'unknown');
            const type = await el.getAttribute('type');
            const placeholder = await el.getAttribute('placeholder');
            const visible = await el.isVisible();
            log.info(
              `  🔍 Element[${i}]: tag=${tag}, type="${type}", placeholder="${placeholder}", visible=${visible}`
            );
          }
        } catch (e) {
          log.warning(`  ⚠️ Could not list page elements: ${e}`);
        }
        throw new Error('URL input not found');
      }

      await urlInput.fill(input.url);
      log.info(`  ✅ URL entered`);

      await randomDelay(300, 500);

      // Click add/upload button
      log.info(`  🔍 Looking for upload button...`);
      await this.clickUploadButton();

      // Wait for processing
      const result = await this.waitForSourceProcessing(
        input.title || input.url,
        undefined,
        expectedNotebookUuid,
        previousSourceNames
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `URL upload failed: ${errorMsg}` };
    }
  }

  /**
   * Upload text content
   */
  private async uploadText(
    input: SourceUploadInput,
    expectedNotebookUuid?: string,
    previousSourceNames: string[] = []
  ): Promise<SourceUploadResult> {
    if (!input.text) {
      return { success: false, error: 'Text content is required' };
    }

    log.info(`  📝 Adding text content (${input.text.length} chars)`);

    try {
      // Click on paste text option (bilingual FR/EN via i18n)
      const textTypeSelectors = [
        // Span element with pasted text label
        ...i18nSelectors('span:has-text("{text}")', 'sourceTypes', 'pastedText'),
        ...i18nSelectors(':has-text("{text}")', 'sourceTypes', 'pastedText'),
        // Parent of the span (clickable area)
        ...i18nSelectors('*:has(> span:has-text("{text}"))', 'sourceTypes', 'pastedText'),
        // Generic fallbacks
        'span:has-text("Paste text")',
        ':has-text("Paste text")',
        '[data-type="text"]',
      ];

      log.info(`  🔍 Looking for paste text option...`);
      let foundTextOption = false;

      // Debug: Log all clickable elements in the dialog
      try {
        const dialogButtons = await this.page
          .locator('[role="dialog"] button, [role="dialog"] [role="button"], [role="dialog"] a')
          .all();
        log.info(`  🔍 DEBUG: Found ${dialogButtons.length} clickable elements in dialog`);
        for (let i = 0; i < Math.min(dialogButtons.length, 15); i++) {
          const btn = dialogButtons[i];
          const text = await btn.textContent();
          log.info(`    Element[${i}]: "${text?.trim()}"`);
        }
      } catch (e) {
        log.warning(`  ⚠️ Could not debug dialog elements: ${e}`);
      }

      for (const selector of textTypeSelectors) {
        try {
          log.info(`  🔍 Trying selector: ${selector}`);
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            log.info(`  ✅ Found text option: ${selector}`);
            await btn.click();
            await randomDelay(500, 1000);
            foundTextOption = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!foundTextOption) {
        log.warning(`  ⚠️ No text option found - this will likely fail!`);
        // Take screenshot for debugging
        try {
          const screenshotPath = path.join(CONFIG.dataDir, 'debug-text-option-not-found.png');
          await this.page.screenshot({ path: screenshotPath });
          log.info(`  📸 Debug screenshot: ${screenshotPath}`);
        } catch {
          /* ignore */
        }
      }

      // Find text input - must be in the dialog, not the chat input
      log.info(`  🔍 Looking for text input in dialog...`);

      // Wait for the paste dialog to fully appear
      await randomDelay(500, 800);

      // Try to find textarea specifically in the dialog context
      const textInputSelectors = [
        '[role="dialog"] textarea',
        '.mat-dialog-container textarea',
        '.mdc-dialog textarea',
        // Fallback to any visible textarea that's not the chat input
        'textarea:not(.query-box-input)',
      ];

      let textInput = null;
      for (const selector of textInputSelectors) {
        try {
          const el = await this.page.waitForSelector(selector, {
            state: 'visible',
            timeout: 3000,
          });
          if (el) {
            log.info(`  ✅ Found text input with: ${selector}`);
            textInput = el;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!textInput) {
        // Debug: list all textareas on page
        const allTextareas = await this.page.locator('textarea').all();
        log.warning(`  ⚠️ Found ${allTextareas.length} textareas on page`);
        for (let i = 0; i < Math.min(allTextareas.length, 3); i++) {
          const cls = await allTextareas[i].getAttribute('class');
          const placeholder = await allTextareas[i].getAttribute('placeholder');
          log.info(`    textarea[${i}]: class="${cls}", placeholder="${placeholder}"`);
        }
        throw new Error('Text input not found in dialog');
      }

      let textToInsert = input.text;
      await textInput.fill(textToInsert);
      log.info(`  ✅ Text entered (${textToInsert.length} chars)`);

      // Set title if provided
      log.info(`  🔍 Looking for title input...`);
      if (input.title) {
        const titleSelectors = [
          'input[placeholder*="title"]',
          'input[placeholder*="Title"]',
          'input[placeholder*="name"]',
          'input[placeholder*="Name"]',
          'input[name="title"]',
          '[role="dialog"] input[type="text"]:not([readonly])',
        ];

        let titleSet = false;
        for (const selector of titleSelectors) {
          try {
            const titleInput = this.page.locator(selector).first();
            if (await titleInput.isVisible({ timeout: 500 })) {
              await titleInput.fill(input.title);
              log.info(`  ✅ Title set: ${input.title} (via ${selector})`);
              titleSet = true;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!titleSet) {
          log.warning(`  ⚠️ Title input NOT found - source will have default name`);
          textToInsert = `${input.title}\n\n${input.text}`;
          await textInput.fill(textToInsert);
          log.info(`  ✅ Fallback title injected into pasted text: ${input.title}`);
          // Debug: list all inputs in dialog
          try {
            const allInputs = await this.page.locator('[role="dialog"] input').all();
            log.info(`  🔍 DEBUG: Found ${allInputs.length} inputs in dialog`);
            for (let i = 0; i < Math.min(allInputs.length, 5); i++) {
              const inp = allInputs[i];
              const type = await inp.getAttribute('type');
              const placeholder = await inp.getAttribute('placeholder');
              log.info(`    input[${i}]: type="${type}", placeholder="${placeholder}"`);
            }
          } catch {
            /* ignore */
          }
        }
      }

      await randomDelay(300, 500);

      // DEBUG: Take screenshot before clicking upload button
      try {
        const screenshotPath = path.join(CONFIG.dataDir, 'debug-before-insert.png');
        await this.page.screenshot({ path: screenshotPath });
        log.info(`  📸 Debug screenshot saved: ${screenshotPath}`);
      } catch (e) {
        log.warning(`  ⚠️ Could not take debug screenshot: ${e}`);
      }

      // DEBUG: Check if the "Insert" button is enabled (bilingual via i18n)
      try {
        const insertBtnSelectors = i18nSelectors('button:has-text("{text}")', 'buttons', 'insert');
        for (const sel of insertBtnSelectors) {
          const btn = this.page.locator(sel).first();
          if (await btn.isVisible({ timeout: 500 })) {
            const isDisabled = await btn.isDisabled();
            const ariaDisabled = await btn.getAttribute('aria-disabled');
            const classList = await btn.getAttribute('class');
            log.info(
              `  🔍 Button "${sel}" - disabled: ${isDisabled}, aria-disabled: ${ariaDisabled}`
            );
            log.info(`  🔍 Button classes: ${classList}`);
            break;
          }
        }
      } catch (e) {
        log.warning(`  ⚠️ Could not check button state: ${e}`);
      }

      // Get first few words of text for later verification (NotebookLM uses text content as title)
      const textPreview = textToInsert.slice(0, 30).trim();
      log.info(`  📝 Text preview for verification: "${textPreview}..."`);

      // Click add button
      log.info(`  🔍 Looking for upload button...`);
      await this.clickUploadButton();

      // Wait for processing - NotebookLM names pasted text sources "Texte collé" in French or "Pasted text"
      // We'll look for either the expected name or "Texte collé"
      // Pass initialUuid to detect notebook redirection
      const result = await this.waitForSourceProcessing(
        input.title || 'Texte collé',
        textPreview,
        expectedNotebookUuid,
        previousSourceNames
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Text upload failed: ${errorMsg}` };
    }
  }

  /**
   * Upload from Google Drive
   */
  private async uploadGoogleDrive(
    input: SourceUploadInput,
    expectedNotebookUuid?: string,
    previousSourceNames: string[] = []
  ): Promise<SourceUploadResult> {
    if (!input.url) {
      return { success: false, error: 'Google Drive URL is required' };
    }

    log.info(`  📂 Adding Google Drive source: ${input.url}`);

    // Similar to URL upload but with Google Drive specific handling
    return await this.uploadUrl({ ...input, type: 'url' }, expectedNotebookUuid, previousSourceNames);
  }

  /**
   * Upload YouTube video
   */
  private async uploadYouTube(
    input: SourceUploadInput,
    expectedNotebookUuid?: string,
    previousSourceNames: string[] = []
  ): Promise<SourceUploadResult> {
    if (!input.url) {
      return { success: false, error: 'YouTube URL is required' };
    }

    log.info(`  🎬 Adding YouTube video: ${input.url}`);

    try {
      // Wait for dialog to be fully ready
      await randomDelay(500, 800);

      // Click on YouTube option with expanded selectors
      const ytSelectors = [
        'button:has-text("YouTube")',
        '[data-type="youtube"]',
        'button[aria-label*="YouTube"]',
        '[role="button"]:has-text("YouTube")',
        // Material design buttons
        '.mat-button:has-text("YouTube")',
        '.mdc-button:has-text("YouTube")',
        // List items that might be clickable
        '[role="listitem"]:has-text("YouTube")',
        '[role="option"]:has-text("YouTube")',
        // Generic clickable elements with YouTube text
        '[class*="option"]:has-text("YouTube")',
        '[class*="source-type"]:has-text("YouTube")',
      ];

      let youtubeClicked = false;
      for (const selector of ytSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            log.info(`  ✅ Found YouTube option: ${selector}`);
            await btn.click();
            await randomDelay(500, 800);
            youtubeClicked = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!youtubeClicked) {
        log.warning('  ⚠️ Could not click YouTube option, trying to proceed anyway...');
      }

      // Enter YouTube URL (can be input or textarea)
      await randomDelay(500, 1000);

      const ytInputSelectors = [
        // French placeholders
        'input[placeholder*="Collez"]',
        'textarea[placeholder*="Collez"]',
        'input[placeholder*="YouTube"]',
        'textarea[placeholder*="YouTube"]',
        // English placeholders
        'input[placeholder*="youtube" i]',
        'textarea[placeholder*="youtube" i]',
        'input[placeholder*="URL"]',
        'textarea[placeholder*="URL"]',
        'input[placeholder*="Paste"]',
        'textarea[placeholder*="Paste"]',
        '[role="dialog"] input[type="text"]',
        '[role="dialog"] textarea',
      ];

      let urlInput = null;
      log.info(`  🔍 Looking for YouTube URL input...`);
      for (const selector of ytInputSelectors) {
        try {
          const input = this.page.locator(selector).first();
          if (await input.isVisible({ timeout: 500 })) {
            urlInput = input;
            log.info(`  ✅ Found YouTube input: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      // Fallback: any visible input/textarea in dialog
      if (!urlInput) {
        log.info(`  🔍 Trying fallback for YouTube input...`);
        try {
          const allInputs = await this.page
            .locator('[role="dialog"] input, [role="dialog"] textarea')
            .all();
          for (const input of allInputs) {
            if (await input.isVisible()) {
              urlInput = input;
              const placeholder = await input.getAttribute('placeholder');
              log.info(`  ✅ Found via fallback: placeholder="${placeholder}"`);
              break;
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (!urlInput) {
        throw new Error('YouTube URL input not found');
      }

      await urlInput.fill(input.url);
      log.info(`  ✅ YouTube URL entered`);

      await randomDelay(500, 1000);

      await this.clickUploadButton();

      const result = await this.waitForSourceProcessing(
        input.title || 'YouTube video',
        undefined,
        expectedNotebookUuid,
        previousSourceNames
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `YouTube upload failed: ${errorMsg}` };
    }
  }

  /**
   * Click the upload/add button
   */
  private async clickUploadButton(): Promise<void> {
    const uploadBtnSelectors = [
      // Primary action buttons (most likely) - bilingual via i18n
      ...i18nSelectors('button.mdc-button--raised:has-text("{text}")', 'buttons', 'insert'),
      ...i18nSelectors('button.mat-flat-button:has-text("{text}")', 'buttons', 'insert'),
      ...i18nSelectors('button[color="primary"]:has-text("{text}")', 'buttons', 'insert'),
      // Generic text patterns (bilingual via i18n)
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'insert'),
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'add'),
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'upload'),
      'button:has-text("Import")',
      'button:has-text("Save")',
      'button:has-text("Submit")',
      // Form submit
      'button[type="submit"]',
      // Dialog actions
      '[role="dialog"] button:not(:has-text("Cancel")):not(:has-text("Close"))',
      '.mat-dialog-actions button:not(:has-text("Cancel"))',
      '.mdc-dialog__actions button:not(:has-text("Cancel"))',
    ];

    for (const selector of uploadBtnSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        if (await btn.isVisible({ timeout: 500 })) {
          log.info(`  ✅ Found upload button: ${selector}`);
          await btn.click();
          log.info(`  ✅ Clicked upload button`);
          return;
        }
      } catch {
        continue;
      }
    }

    // Debug: list all buttons in dialog or overlay
    log.warning(`  ⚠️ No upload button found, listing buttons...`);
    try {
      const containers = ['[role="dialog"]', '.cdk-overlay-pane', '[role="menu"]'];
      for (const container of containers) {
        const containerButtons = await this.page.locator(`${container} button`).all();
        if (containerButtons.length > 0) {
          log.info(`  🔍 Buttons in ${container}:`);
          for (let i = 0; i < Math.min(containerButtons.length, 5); i++) {
            const text = await containerButtons[i].textContent();
            log.info(`  🔍 Button[${i}]: "${text?.trim()}"`);
          }
        }
      }
    } catch {
      // ignore
    }

    // Try pressing Enter as fallback
    log.info(`  ⌨️ Pressing Enter as fallback`);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Wait for source to finish processing
   * @param sourceName The name we expect the source to have
   * @param _textPreview Optional first words of text (for text sources - NotebookLM may use this as name)
   * @param expectedNotebookUuid Optional UUID of the notebook we expect to be on (to detect redirects)
   */
  private async waitForSourceProcessing(
    sourceName: string,
    _textPreview?: string,
    expectedNotebookUuid?: string,
    previousSourceNames: string[] = []
  ): Promise<SourceUploadResult> {
    log.info(`  ⏳ Waiting for source processing: ${sourceName}`);

    const timeout = 90000; // 1.5 minutes (sources can take time)
    const startTime = Date.now();

    // COUNT-BASED DETECTION (primary method for 2025 UI):
    // Capture source count NOW — dialog is still open, source not yet added to DOM.
    // Later, if count increases, we know a source was successfully added.
    let initialSourceCount = -1;
    let initialSourceLabels: string[] = [];
    try {
      initialSourceCount = await this.page.locator('.single-source-container').count();
      log.info(`  📊 Source count before processing: ${initialSourceCount}`);
      initialSourceLabels = await this.getAllSourceLabels();
    } catch { /* ignore */ }

    // First, wait a bit for the dialog to close (indicates upload started)
    await randomDelay(2000, 3000);

    while (Date.now() - startTime < timeout) {
      // Check for errors in the dialog or page
      // NOTE: Avoid overly broad selectors like [class*="error"] which match
      // random page elements and produce garbage error messages
      const errorSelectors = [
        '.error-message',
        '[role="alert"]:has-text("error")',
        '[role="alert"]:has-text("Error")',
        '.mdc-snackbar--error',
        '.mdc-snackbar--open:has-text("error")',
        '[role="dialog"] [class*="error"]',
        '.cdk-overlay-pane [class*="error"]',
      ];

      for (const errorSelector of errorSelectors) {
        try {
          const errorEl = this.page.locator(errorSelector).first();
          if (await errorEl.isVisible({ timeout: 500 })) {
            const errorText = (await errorEl.textContent())?.trim();
            // Skip garbage text that contains icon names (more_vert, etc.)
            if (errorText && errorText.length < 200 && !errorText.includes('more_vert') && !errorText.includes('more_horiz')) {
              return { success: false, error: errorText || 'Upload failed', status: 'failed' };
            }
          }
        } catch {
          continue;
        }
      }

      // Check if dialog is still open (might mean still processing)
      const dialogSelectors = ['[role="dialog"]', '.mat-dialog-container', '.mdc-dialog'];
      let dialogVisible = false;
      for (const dialogSelector of dialogSelectors) {
        try {
          const dialog = this.page.locator(dialogSelector).first();
          if (await dialog.isVisible({ timeout: 500 })) {
            dialogVisible = true;
            break;
          }
        } catch {
          continue;
        }
      }

      // If dialog closed, check if source appears in the sources list
      if (!dialogVisible) {
        log.info(`  ℹ️ Dialog closed, checking for source in list...`);

        // PRIMARY: Count-based detection (most reliable for 2025 UI)
        // NotebookLM shows page titles (not URLs) in the source list, so name-based
        // detection fails for URL sources. Count-based detection works regardless.
        try {
          const currentCount = await this.page.locator('.single-source-container').count();
          log.info(`  📊 Source count: ${initialSourceCount} → ${currentCount}`);
          if (initialSourceCount >= 0 && currentCount > initialSourceCount) {
            let detectedSourceName: string | undefined;
            let detectedSourceId: string | undefined;

            try {
              const currentLabels = await this.getAllSourceLabels();
              detectedSourceName =
                this.findAddedSourceName(initialSourceLabels, currentLabels) ||
                this.findAddedSourceName(previousSourceNames, currentLabels);

              if (detectedSourceName) {
                let detectedIndex = -1;
                for (let i = currentLabels.length - 1; i >= 0; i--) {
                  if (
                    this.normalizeSourceName(currentLabels[i]) ===
                    this.normalizeSourceName(detectedSourceName)
                  ) {
                    detectedIndex = i;
                    break;
                  }
                }
                if (detectedIndex >= 0) {
                  detectedSourceId = `source-${detectedIndex}`;
                }
              }
            } catch {
              // Continue below and fall back if needed
            }

            if (!detectedSourceName) {
              log.info('  ℹ️  Source count increased, but a stable source name is not available yet');
            } else {
              log.info(`  ℹ️  Detected new source: ${detectedSourceName}`);
              log.success(`  ✅ Source added! Count increased from ${initialSourceCount} to ${currentCount}`);
              return {
                success: true,
                sourceId: detectedSourceId,
                sourceName: detectedSourceName,
                status: 'ready',
              };
            }
          }
        } catch { /* ignore */ }

        try {
          const currentNames = await this.getVisibleSourceNames();
          if (currentNames.some((name) => this.normalizeSourceName(name) === this.normalizeSourceName(sourceName))) {
            log.success(`  ✅ Source added and matched requested source name: ${sourceName}`);
            return { success: true, sourceName, status: 'ready' };
          }
        } catch { /* ignore */ }

        // CRITICAL: Verify we're still on the correct notebook after dialog closes
        // NotebookLM sometimes redirects to a NEW notebook when adding text sources!
        const currentUrl = this.page.url();
        log.info(`  🔍 Current URL: ${currentUrl}`);

        // Check if URL changed (different notebook UUID)
        const currentUuid = currentUrl.match(/notebook\/([a-f0-9-]+)/)?.[1];
        log.info(`  🆔 Current UUID: ${currentUuid || 'NOT FOUND'}`);
        log.info(`  🆔 Expected UUID: ${expectedNotebookUuid || 'NOT PROVIDED'}`);

        if (currentUuid && expectedNotebookUuid && currentUuid !== expectedNotebookUuid) {
          log.error(`  ❌ NOTEBOOK MISMATCH! NotebookLM redirected to a different notebook!`);
          log.error(`  ❌ Expected: ${expectedNotebookUuid}`);
          log.error(`  ❌ Got: ${currentUuid}`);

          // Navigate back to the correct notebook and try to add source properly
          log.warning(
            `  ⚠️ This is a known NotebookLM behavior - text sources may create new notebooks`
          );

          // Return failure with clear error message
          return {
            success: false,
            error: `NotebookLM redirected to a different notebook (${currentUuid}) instead of the target (${expectedNotebookUuid}). This happens when NotebookLM creates a new notebook for pasted text. The source was added to an 'Untitled notebook' instead.`,
            status: 'failed',
          };
        }

        // Try to get notebook title for logging
        try {
          const titleSelectors = ['h1', '[class*="notebook-title"]', '[class*="title"]'];
          for (const sel of titleSelectors) {
            try {
              const titleEl = this.page.locator(sel).first();
              if (await titleEl.isVisible({ timeout: 500 })) {
                const title = await titleEl.textContent();
                if (title && title.length < 100) {
                  log.info(`  📓 Notebook title: "${title.trim()}"`);
                  break;
                }
              }
            } catch {
              continue;
            }
          }
        } catch {
          /* ignore */
        }

        // Take screenshot after dialog closed
        try {
          const screenshotPath = path.join(CONFIG.dataDir, 'debug-after-insert.png');
          await this.page.screenshot({ path: screenshotPath });
          log.info(`  📸 Debug screenshot (after click): ${screenshotPath}`);
        } catch {
          /* ignore */
        }

        await randomDelay(1000, 2000);

        // METHOD 1: Look for pasted text source in the SOURCES PANEL specifically (not anywhere on page)
        // Use more specific selectors to avoid matching dialog content
        // Support both French ("Texte collé") and English ("Pasted text") UI via i18n
        const pastedTextSelectors = [
          // Sources panel specific selectors (bilingual via i18n)
          ...i18nSelectors('mat-checkbox:has-text("{text}")', 'sourceNames', 'pastedText'),
          ...i18nSelectors('[class*="source"]:has-text("{text}")', 'sourceNames', 'pastedText'),
          ...i18nSelectors(':has-text("{text}"):not([role="dialog"])', 'sourceNames', 'pastedText'),
        ];

        // Get localized pasted text names for detection
        const pastedTextNames = tAll('sourceNames', 'pastedText');

        for (const selector of pastedTextSelectors) {
          try {
            const el = this.page.locator(selector).first();
            if (await el.isVisible({ timeout: 1000 })) {
              log.success(`  ✅ Found pasted text source: ${selector}`);
              // Detect source name from selector - find which locale's text is in the selector
              const detectedName =
                pastedTextNames.find((name) => selector.includes(name)) || pastedTextNames[0];
              return { success: true, sourceName: detectedName, status: 'ready' };
            }
          } catch {
            continue;
          }
        }

        // METHOD 2: Check for source in the sources panel by name
        const sourceListSelectors = [
          // Source items that might contain our source
          `[class*="source"]:has-text("${sourceName}")`,
          `[class*="Source"]:has-text("${sourceName}")`,
          // Generic list items
          '.source-list-item',
          '[class*="source-item"]',
          '[class*="SourceItem"]',
          // Material list
          'mat-list-item',
          '.mat-list-item',
          // By count change (sources list exists)
          '[class*="sources"]',
        ];

        // Try to find the specific source by name
        for (const selector of sourceListSelectors.slice(0, 2)) {
          // Only name-based selectors
          try {
            const el = this.page.locator(selector).first();
            if (await el.isVisible({ timeout: 500 })) {
              log.success(`  ✅ Source added successfully: ${sourceName}`);
              return { success: true, sourceName, status: 'ready' };
            }
          } catch {
            continue;
          }
        }

        // Wait a bit more and try again - sources can take time to appear
        log.info(`  ⏳ Source not found yet, waiting 5 more seconds...`);
        await randomDelay(4000, 6000);

        // Try again for pasted text source with different variations
        for (const selector of pastedTextSelectors) {
          try {
            const el = this.page.locator(selector).first();
            if (await el.isVisible({ timeout: 1000 })) {
              log.success(`  ✅ Found pasted text source after wait: ${selector}`);
              // Detect source name from selector - find which locale's text is in the selector
              const detectedName =
                pastedTextNames.find((name) => selector.includes(name)) || pastedTextNames[0];
              return { success: true, sourceName: detectedName, status: 'ready' };
            }
          } catch {
            continue;
          }
        }

        // Try one more time to find the source by name
        try {
          const sourceByName = this.page
            .locator(`[class*="source"]:has-text("${sourceName}")`)
            .first();
          if (await sourceByName.isVisible({ timeout: 2000 })) {
            log.success(`  ✅ Source found after wait: ${sourceName}`);
            return { success: true, sourceName, status: 'ready' };
          }
        } catch {
          /* ignore */
        }

        // If still not found, this is a failure - don't assume success
        log.warning(`  ⚠️ Dialog closed but source not found in list - upload likely failed`);
        return {
          success: false,
          sourceName,
          error: 'Source not found after upload - dialog closed but source not visible in list',
          status: 'failed',
        };
      }

      // Still in dialog - check for processing indicators
      const processingSelectors = [
        '.loading',
        '.spinner',
        '[class*="loading"]',
        '[class*="processing"]',
        'mat-progress-bar',
        'mat-spinner',
        '.mdc-linear-progress',
      ];

      let isProcessing = false;
      for (const procSelector of processingSelectors) {
        try {
          const proc = this.page.locator(procSelector).first();
          if (await proc.isVisible({ timeout: 500 })) {
            isProcessing = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (isProcessing) {
        log.info(`  ⏳ Still processing...`);
      }

      await this.page.waitForTimeout(2000);
    }

    return { success: false, error: 'Timeout waiting for source processing', status: 'failed' };
  }

  // ============================================================================
  // Chat-Based Content Generation (New UI - Dec 2024)
  // ============================================================================

  /**
   * Send a message in the chat interface (without waiting for response)
   * This is the new way to generate content in NotebookLM
   * Uses the same typing and submission approach as ask_question for reliability
   */
  private async sendChatMessage(message: string): Promise<void> {
    log.info(`  💬 Sending chat message: "${message.substring(0, 50)}..."`);

    // Find the chat input (same approach as BrowserSession.findChatInput)
    const chatInputSelectors = [
      'textarea.query-box-input', // PRIMARY - same as Python implementation
      'textarea[aria-label*="query"]',
      'textarea[aria-label*="Zone de requête"]',
    ];

    let inputSelector: string | null = null;
    for (const selector of chatInputSelectors) {
      try {
        const input = await this.page.waitForSelector(selector, {
          state: 'visible',
          timeout: 3000,
        });
        if (input) {
          inputSelector = selector;
          log.info(`  ✅ Found chat input: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!inputSelector) {
      throw new Error('Chat input not found');
    }

    // Clear any existing text first
    const inputEl = await this.page.$(inputSelector);
    if (inputEl) {
      await inputEl.click();
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.press('Backspace');
      await randomDelay(200, 400);
    }

    // Type the message with human-like behavior (same as BrowserSession.askQuestion)
    log.info(`  ⌨️ Typing message with human-like behavior...`);
    await humanType(this.page, inputSelector, message, {
      withTypos: false, // No typos for prompts to avoid confusion
      wpm: 150, // Faster typing for long prompts
    });

    // Small pause before submitting
    await randomDelay(500, 1000);

    // Submit with Enter key (same as BrowserSession.askQuestion)
    log.info(`  📤 Submitting message...`);
    await this.page.keyboard.press('Enter');

    // Small pause after submit
    await randomDelay(1000, 1500);

    log.info(`  ✅ Message sent`);
  }

  /**
   * Wait for generated content to appear in chat
   * Uses the same proven approach as /ask endpoint (waitForLatestAnswer with full timeout)
   */
  private async waitForGeneratedContent(
    contentType: ContentType,
    timeoutMs: number = 600000
  ): Promise<{ source: 'chat' | 'studio'; content: string }> {
    log.info(`  ⏳ Waiting for ${contentType} response (up to ${timeoutMs / 60000} minutes)...`);

    // Scroll to bottom to ensure we see all messages
    await this.scrollChatToBottom();

    // Snapshot existing chat responses to ignore them
    const existingChatResponses = await snapshotAllResponses(this.page);
    log.info(`  📊 Ignoring ${existingChatResponses.length} existing chat responses`);

    // Use the same proven logic as /ask endpoint - wait for new chat response
    const response = await waitForLatestAnswer(this.page, {
      question: '', // Empty question since we already sent the message
      timeoutMs: timeoutMs,
      pollIntervalMs: 2000, // Poll every 2 seconds
      ignoreTexts: existingChatResponses,
      debug: true, // Enable debug to see what's happening
    });

    // Check if response is an error message from NotebookLM
    if (response && isErrorMessage(response)) {
      log.error(`  ❌ NotebookLM returned an error: "${response}"`);
      throw new Error(`NotebookLM error: ${response}`);
    }

    if (response && response.length > 50) {
      log.success(`  ✅ Content received (${response.length} chars)`);
      return { source: 'chat', content: response };
    }

    throw new Error(`Timeout waiting for ${contentType} generation after ${timeoutMs / 1000}s`);
  }

  /**
   * Scroll chat container to bottom to ensure latest messages are visible
   */
  private async scrollChatToBottom(): Promise<void> {
    try {
      // Try multiple selectors for the chat container
      const chatContainerSelectors = [
        '.chat-scroll-container',
        '.messages-container',
        '[class*="scroll"]',
        '.query-container',
      ];

      for (const selector of chatContainerSelectors) {
        const container = await this.page.$(selector);
        if (container) {
          await container.evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          });
          log.debug(`  📜 Scrolled chat to bottom using ${selector}`);
          return;
        }
      }

      // Fallback: scroll the whole page
      await this.page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
      log.debug(`  📜 Scrolled page to bottom (fallback)`);
    } catch (error) {
      log.debug(`  ⚠️ Could not scroll: ${error}`);
    }
  }

  // ============================================================================
  // Content Generation
  // ============================================================================

  /**
   * Generate content (audio overview, presentation, report)
   *
   * Supported content types:
   * - audio_overview: Uses real Studio UI buttons for audio podcast generation
   * - video: Uses generic ContentGenerator for video generation (with format, language, style options)
   * - infographic: Uses generic ContentGenerator for infographic generation (with format options)
   * - presentation: Uses generic ContentGenerator for slides generation (with format options)
   * - report: Uses generic ContentGenerator for briefing document generation (with format options)
   * - data_table: Uses generic ContentGenerator for data table generation (with format options)
   *
   * NOTE: Other content types (study_guide, faq, timeline, table_of_contents)
   * were removed because they only sent chat prompts instead of clicking actual
   * NotebookLM Studio buttons.
   */
  async generateContent(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`🎨 Generating content: ${input.type}`);

    try {
      if (input.type === 'audio_overview') {
        return await this.generateAudioOverview(input);
      }

      // Use generic ContentGenerator for all other supported types
      if (
        input.type === 'video' ||
        input.type === 'infographic' ||
        input.type === 'presentation' ||
        input.type === 'report' ||
        input.type === 'data_table'
      ) {
        return await this.generateGenericContent(input);
      }

      // Unsupported content type
      return {
        success: false,
        contentType: input.type,
        error: `Unsupported content type: ${input.type}. Supported types: 'audio_overview', 'video', 'infographic', 'presentation', 'report', 'data_table'.`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`❌ Content generation failed: ${errorMsg}`);
      return { success: false, contentType: input.type, error: errorMsg };
    }
  }

  /**
   * Generate content using the generic ContentGenerator
   *
   * This method handles all content types except audio_overview:
   * - video: With format (brief/explainer), language, and visual style options
   * - infographic: With format (horizontal/vertical) and language options
   * - presentation: With format (overview/detailed) and language options
   * - report: With format (summary/detailed) and language options
   * - data_table: With format (simple/detailed) and language options
   *
   * @param input Content generation input with all options
   * @returns Content generation result
   */
  private async generateGenericContent(
    input: ContentGenerationInput
  ): Promise<ContentGenerationResult> {
    log.info(`🎨 Generating ${input.type} via ContentGenerator...`);

    try {
      const generator = new ContentGenerator(this.page);
      const result = await generator.generate(input);

      if (result.success) {
        log.success(`  ✅ ${input.type} generated successfully`);
      } else {
        log.error(`  ❌ ${input.type} generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ ${input.type} generation failed: ${errorMsg}`);
      return {
        success: false,
        contentType: input.type,
        error: errorMsg,
      };
    }
  }

  /**
   * Generate Audio Overview (podcast)
   *
   * NOTE (Dec 2024): NotebookLM UI has changed significantly.
   * Audio generation now works via chat requests or may require specific UI interaction.
   * This method attempts both approaches.
   */
  async generateAudioOverview(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`🎙️ Generating Audio Overview...`);

    try {
      // First, check Studio for existing audio or audio generation button
      await this.navigateToStudio();
      await this.page.waitForTimeout(1000);

      // Check if audio already exists
      const existingAudio = await this.page.$('audio, .audio-player, [class*="audio-overview"]');
      if (existingAudio) {
        log.info(`  ℹ️ Audio Overview already exists`);
        return {
          success: true,
          contentType: 'audio_overview',
          status: 'ready',
        };
      }

      // Try to find audio generation button in Studio
      const audioSelectors = [
        'button:has-text("Audio")',
        'button:has-text("Generate audio")',
        'button:has-text("Générer")',
        'button[aria-label*="audio" i]',
        '[class*="audio"] button',
        'button:has(mat-icon:has-text("mic"))',
        'button:has(mat-icon:has-text("podcast"))',
      ];

      for (const selector of audioSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            log.info(`  ✅ Found audio button: ${selector}`);

            // Add custom instructions if provided
            if (input.customInstructions) {
              await this.addCustomInstructions(input.customInstructions);
            }

            await btn.click();
            log.info(`  ✅ Started audio generation`);

            // Wait for generation
            return await this.waitForAudioGeneration();
          }
        } catch {
          continue;
        }
      }

      // Fallback: Try chat-based approach
      log.info(`  ℹ️ No audio button found, trying chat-based approach...`);
      await this.navigateToDiscussion();

      let prompt =
        'Create an audio overview (Deep Dive podcast) for this notebook. Generate a conversational podcast script that covers the main topics from all sources.';

      if (input.customInstructions) {
        prompt += `\n\nCustom instructions: ${input.customInstructions}`;
      }

      await this.sendChatMessage(prompt);
      const result = await this.waitForGeneratedContent('audio_overview', 600000);

      if (result.content && result.content.length > 100) {
        log.success(`  ✅ Audio overview script generated via ${result.source}`);
        return {
          success: true,
          contentType: 'audio_overview',
          status: 'ready',
          textContent: result.content,
        };
      }

      throw new Error(
        'Could not generate audio overview - button not found and chat approach failed'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, contentType: 'audio_overview', error: errorMsg };
    }
  }

  // NOTE: generateBriefingDoc, generateStudyGuide, generateTimeline, generateFAQ,
  // generateTOC, and generateDocumentContent methods were removed because they
  // only sent chat prompts instead of clicking actual NotebookLM Studio buttons.
  // Only audio_overview uses real UI interaction.

  /**
   * Generate Presentation/Slides using the generic ContentGenerator
   *
   * This uses the generic content generation architecture that:
   * 1. Navigates to Studio panel
   * 2. Looks for presentation/slides button
   * 3. Falls back to chat-based generation if button not found
   *
   * @param input Content generation input with optional custom instructions
   * @returns Content generation result
   */
  async generatePresentation(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`📊 Generating Presentation/Slides...`);

    try {
      // Use the generic ContentGenerator for presentation generation
      const generator = new ContentGenerator(this.page);
      const result = await generator.generate({
        type: 'presentation',
        customInstructions: input.customInstructions,
        sources: input.sources,
        language: input.language,
        presentationStyle: input.presentationStyle,
        presentationLength: input.presentationLength,
      });

      if (result.success) {
        log.success(`  ✅ Presentation generated successfully`);
      } else {
        log.error(`  ❌ Presentation generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Presentation generation failed: ${errorMsg}`);
      return {
        success: false,
        contentType: 'presentation',
        error: errorMsg,
      };
    }
  }

  /**
   * Generate Report/Briefing Document using the generic ContentGenerator
   *
   * Creates a comprehensive briefing document (2,000-3,000 words) that summarizes
   * key findings, insights, and recommendations from notebook sources.
   * Can be exported as PDF or DOCX format.
   *
   * This uses the generic content generation architecture that:
   * 1. Navigates to Studio panel
   * 2. Looks for briefing/report button
   * 3. Falls back to chat-based generation if button not found
   *
   * @param input Content generation input with optional custom instructions
   * @returns Content generation result with text content
   */
  async generateReport(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`📄 Generating Report/Briefing Document...`);

    try {
      // Use the generic ContentGenerator for report generation
      const generator = new ContentGenerator(this.page);
      const result = await generator.generate({
        type: 'report',
        customInstructions: input.customInstructions,
        sources: input.sources,
        language: input.language,
        reportFormat: input.reportFormat,
      });

      if (result.success) {
        log.success(`  ✅ Report generated successfully`);
      } else {
        log.error(`  ❌ Report generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Report generation failed: ${errorMsg}`);
      return {
        success: false,
        contentType: 'report',
        error: errorMsg,
      };
    }
  }

  /**
   * Generate Infographic using the generic ContentGenerator
   *
   * Creates a visual infographic from the notebook sources.
   * Supports two formats:
   * - horizontal (16:9): Landscape format for presentations/displays
   * - vertical (9:16): Portrait format for social media/mobile
   *
   * This uses the generic content generation architecture that:
   * 1. Navigates to Studio panel
   * 2. Looks for infographic button
   * 3. Falls back to chat-based generation if button not found
   *
   * @param input Content generation input with optional custom instructions and format
   * @returns Content generation result
   */
  async generateInfographic(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`Generating Infographic...`);

    try {
      // Use the generic ContentGenerator for infographic generation
      const generator = new ContentGenerator(this.page);
      const result = await generator.generate({
        type: 'infographic',
        customInstructions: input.customInstructions,
        sources: input.sources,
        language: input.language,
        infographicFormat: input.infographicFormat,
      });

      if (result.success) {
        log.success(`  Infographic generated successfully`);
      } else {
        log.error(`  Infographic generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  Infographic generation failed: ${errorMsg}`);
      return {
        success: false,
        contentType: 'infographic',
        error: errorMsg,
      };
    }
  }

  /**
   * Generate a Data Table using the generic ContentGenerator
   *
   * Creates a structured table that organizes key information from notebook sources.
   * The generated table can be exported as CSV or Excel format.
   *
   * @param input Content generation input with optional custom instructions
   * @returns Content generation result with table data
   */
  async generateDataTable(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`Generating Data Table...`);

    try {
      // Use the generic ContentGenerator for data table generation
      const generator = new ContentGenerator(this.page);
      const result = await generator.generate({
        type: 'data_table',
        customInstructions: input.customInstructions,
        sources: input.sources,
        language: input.language,
        // Note: data_table has no format options - exports to Google Sheets
      });

      if (result.success) {
        log.success(`  ✅ Data Table generated successfully`);
      } else {
        log.error(`  ❌ Data Table generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Data Table generation failed: ${errorMsg}`);
      return {
        success: false,
        contentType: 'data_table',
        error: errorMsg,
      };
    }
  }

  /**
   * Generate a Video using the generic ContentGenerator
   *
   * Creates a video summary that visually explains the main topics from notebook sources.
   * Video generation may take several minutes depending on content complexity.
   *
   * Supported formats:
   * - brief: Short video summary (2-3 minutes)
   * - explainer: Detailed explanation video (5-10 minutes)
   *
   * This uses the generic content generation architecture that:
   * 1. Navigates to Studio panel
   * 2. Looks for video generation button
   * 3. Falls back to chat-based generation if button not found
   *
   * @param input Content generation input with optional custom instructions and format
   * @returns Content generation result with video data
   */
  async generateVideo(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`🎬 Generating Video...`);

    try {
      // Use the generic ContentGenerator for video generation
      const generator = new ContentGenerator(this.page);
      const result = await generator.generate({
        type: 'video',
        customInstructions: input.customInstructions,
        sources: input.sources,
        language: input.language,
        videoFormat: input.videoFormat,
      });

      if (result.success) {
        log.success(`  ✅ Video generated successfully`);
      } else {
        log.error(`  ❌ Video generation failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Video generation failed: ${errorMsg}`);
      return {
        success: false,
        contentType: 'video',
        error: errorMsg,
      };
    }
  }

  /**
   * Navigate to Discussion panel (chat)
   */
  private async navigateToDiscussion(): Promise<void> {
    const discussionSelectors = [
      'div.mdc-tab:has-text("Discussion")',
      '.mat-mdc-tab:has-text("Discussion")',
      '[role="tab"]:has-text("Discussion")',
      'div.mdc-tab >> text=Discussion',
    ];

    for (const selector of discussionSelectors) {
      try {
        const el = this.page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 })) {
          // Check if already selected
          const isActive =
            (await el.getAttribute('aria-selected')) === 'true' ||
            (await el.getAttribute('class'))?.includes('mdc-tab--active');

          if (!isActive) {
            await el.click();
            await randomDelay(500, 800);
            log.info(`  ✅ Clicked Discussion tab`);
          } else {
            log.info(`  ✅ Discussion tab already active`);
          }
          return;
        }
      } catch {
        continue;
      }
    }

    // Quick check if there's any chat content visible (might already be on Discussion)
    try {
      const chatContent = this.page
        .locator('[class*="chat"], [class*="discussion"], [class*="message"]')
        .first();
      if (await chatContent.isVisible({ timeout: 1000 })) {
        log.info(`  ℹ️ Discussion content appears accessible`);
        return;
      }
    } catch {
      // Continue to error
    }

    // Fail-fast: throw error if Discussion tab not found
    throw new Error('Discussion tab not found - notebook may not have a chat history');
  }

  /**
   * Navigate to Studio panel
   */
  private async navigateToStudio(): Promise<void> {
    // Updated selectors based on current NotebookLM UI (Dec 2024)
    // The tabs are: Sources | Discussion | Studio
    // Tab class: mdc-tab mat-mdc-tab mat-focus-indicator
    const studioSelectors = [
      // Material Design tabs (bilingual FR/EN via i18n)
      ...i18nSelectors('div.mdc-tab:has-text("{text}")', 'tabs', 'studio'),
      ...i18nSelectors('.mat-mdc-tab:has-text("{text}")', 'tabs', 'studio'),
      ...i18nSelectors('[role="tab"]:has-text("{text}")', 'tabs', 'studio'),
      ...i18nSelectors('div.mdc-tab >> text={text}', 'tabs', 'studio'),
      '.notebook-guide', // Legacy fallback
    ];

    for (const selector of studioSelectors) {
      try {
        const el = this.page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 })) {
          // Check if already selected
          const isActive =
            (await el.getAttribute('aria-selected')) === 'true' ||
            (await el.getAttribute('class'))?.includes('mdc-tab--active');

          if (!isActive) {
            await el.click();
            await randomDelay(800, 1200);
            log.info(`  ✅ Clicked Studio tab`);
          } else {
            log.info(`  ✅ Studio tab already active`);
          }
          return;
        }
      } catch {
        continue;
      }
    }

    // Try clicking by finding the tab list and clicking the third tab
    try {
      const tabList = this.page.locator('.mat-mdc-tab-list .mdc-tab').nth(2); // Studio is 3rd tab (0-indexed)
      if (await tabList.isVisible({ timeout: 1000 })) {
        await tabList.click();
        await randomDelay(800, 1200);
        log.info(`  ✅ Studio tab accessed via tab list`);
        return;
      }
    } catch {
      // Continue to fallback
    }

    log.warning(`  ⚠️ Could not find Studio tab, content generation may fail`);
  }

  /**
   * Add custom instructions for content generation
   */
  private async addCustomInstructions(instructions: string): Promise<void> {
    const instructionSelectors = [
      'textarea[placeholder*="instruction"]',
      'textarea[placeholder*="focus"]',
      'textarea[placeholder*="custom"]',
      '.custom-instructions textarea',
    ];

    for (const selector of instructionSelectors) {
      try {
        const textarea = await this.page.$(selector);
        if (textarea && (await textarea.isVisible())) {
          await textarea.fill(instructions);
          log.info(`  ✅ Custom instructions added`);
          return;
        }
      } catch {
        continue;
      }
    }
  }

  /**
   * Wait for audio generation to complete
   */
  private async waitForAudioGeneration(): Promise<ContentGenerationResult> {
    log.info(`  ⏳ Waiting for audio generation (this may take several minutes)...`);

    const timeout = 600000; // 10 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check for errors
      const errorEl = await this.page.$('.error-message, [role="alert"]:has-text("error")');
      if (errorEl) {
        const errorText = await errorEl.textContent();
        return {
          success: false,
          contentType: 'audio_overview',
          error: errorText || 'Audio generation failed',
          status: 'failed',
        };
      }

      // Check for audio player (generation complete)
      const audioPlayer = await this.page.$(
        'audio, .audio-player, [data-component="audio-player"]'
      );
      if (audioPlayer) {
        log.success(`  ✅ Audio Overview generated!`);
        return { success: true, contentType: 'audio_overview', status: 'ready' };
      }

      // Check progress
      const progressEl = await this.page.$('[role="progressbar"], .progress-bar');
      if (progressEl) {
        const progress = await progressEl.getAttribute('aria-valuenow');
        if (progress) {
          log.info(`  ⏳ Generation progress: ${progress}%`);
        }
      }

      await this.page.waitForTimeout(5000);
    }

    return {
      success: false,
      contentType: 'audio_overview',
      error: 'Timeout waiting for audio generation',
      status: 'failed',
    };
  }

  // ============================================================================
  // Content Listing & Download
  // ============================================================================

  /**
   * Get overview of notebook content (sources and generated content)
   */
  async getContentOverview(): Promise<NotebookContentOverview> {
    log.info(`📋 Getting notebook content overview...`);

    const sources = await this.listSources();
    const generatedContent = await this.listGeneratedContent();

    const hasAudioOverview = generatedContent.some((c) => c.type === 'audio_overview');

    return {
      sources,
      generatedContent,
      sourceCount: sources.length,
      hasAudioOverview,
    };
  }

  private normalizeSourceName(name: string): string {
    return name.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private extractSourceName(rawText: string): string | null {
    const lines = rawText
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const ignoredExact = new Set([
      'sources',
      'chat',
      'studio',
      'add sources',
      'add source',
      'select all sources',
      'web',
      'fast research',
      'description',
    ]);

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (ignoredExact.has(lower)) continue;
      if (lower.includes('search the web for new sources')) continue;
      if (/^(check|drive_pdf|markdown|description|more_vert|more_horiz)$/i.test(line)) continue;
      return line;
    }

    return null;
  }

  private async getVisibleSourceRows(
    dedupe = true
  ): Promise<Array<{ name: string; element: ElementHandle }>> {
    await this.ensureSourcesPanel();

    const rowReadySelectors = [
      '.single-source-container',
      'mat-checkbox.select-checkbox',
      '.source-stretched-button',
    ];

    for (const selector of rowReadySelectors) {
      try {
        await this.page.waitForSelector(selector, { state: 'attached', timeout: 2000 });
        break;
      } catch {
        continue;
      }
    }

    await randomDelay(1200, 1800);

    const rows: Array<{ name: string; element: ElementHandle }> = [];
    const seen = new Set<string>();
    const selectors = ['.single-source-container', 'mat-checkbox', '[class*="source-item"]'];

    for (const selector of selectors) {
      try {
        const elements = await this.page.$$(selector);
        if (elements.length === 0) continue;

        for (const element of elements) {
          try {
            const buttonLabel =
              (await element
                .$eval('.source-stretched-button', (node) => node.getAttribute('aria-label') || '')
                .catch(() => '')) || '';
            const checkboxLabel =
              (await element
                .$eval('input[type="checkbox"]', (node) => node.getAttribute('aria-label') || '')
                .catch(() => '')) || '';
            const text = (await element.textContent()) || '';
            const name =
              this.extractSourceName(buttonLabel) ||
              this.extractSourceName(checkboxLabel) ||
              this.extractSourceName(text);
            if (!name) continue;

            const normalized = this.normalizeSourceName(name);
            if (dedupe && seen.has(normalized)) continue;

            seen.add(normalized);
            rows.push({ name, element });
          } catch {
            continue;
          }
        }

        if (rows.length > 0) {
          break;
        }
      } catch {
        continue;
      }
    }

    if (rows.length === 0) {
      log.warning('  ⚠️  No visible source rows parsed from current NotebookLM UI');
    }

    return rows;
  }

  private async getVisibleSourceNames(): Promise<string[]> {
    const rows = await this.getVisibleSourceRows();
    return rows.map((row) => row.name);
  }

  private async getAllSourceLabels(): Promise<string[]> {
    const rows = await this.getVisibleSourceRows(false);
    return rows.map((row) => row.name);
  }

  private findAddedSourceName(previousLabels: string[], currentLabels: string[]): string | undefined {
    const counts = new Map<string, number>();

    for (const label of previousLabels) {
      const normalized = this.normalizeSourceName(label);
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }

    for (const label of currentLabels) {
      const normalized = this.normalizeSourceName(label);
      const count = counts.get(normalized) || 0;
      if (count === 0) {
        return label;
      }
      counts.set(normalized, count - 1);
    }

    return undefined;
  }

  private async findVisibleSourceRow(
    sourceId?: string,
    sourceName?: string
  ): Promise<{ name: string; element: ElementHandle } | null> {
    const rows = await this.getVisibleSourceRows(false);
    if (rows.length === 0) {
      return null;
    }

    const normalizedTargetName = sourceName ? this.normalizeSourceName(sourceName) : null;

    for (const [index, row] of rows.entries()) {
      if (sourceId && sourceId === `source-${index}`) {
        return row;
      }

      if (!normalizedTargetName) {
        continue;
      }

      const normalizedRowName = this.normalizeSourceName(row.name);
      if (
        normalizedRowName === normalizedTargetName ||
        normalizedRowName.includes(normalizedTargetName) ||
        normalizedTargetName.includes(normalizedRowName)
      ) {
        return row;
      }
    }

    return null;
  }

  private async dismissBlockingOverlays(): Promise<void> {
    const backdrop = this.page.locator('.cdk-overlay-backdrop.cdk-overlay-backdrop-showing').first();
    try {
      if (await backdrop.isVisible({ timeout: 300 })) {
        log.info('  ℹ️  Dismissing blocking overlay backdrop');
        await this.page.keyboard.press('Escape').catch(() => {});
        await randomDelay(200, 400);

        if (await backdrop.isVisible({ timeout: 300 }).catch(() => false)) {
          await backdrop.click({ force: true }).catch(() => {});
          await randomDelay(200, 400);
        }
      }
    } catch {
      // Ignore missing/backdrop timing issues
    }
  }

  /**
   * List all sources in the notebook
   */
  async listSources(): Promise<NotebookSource[]> {
    const sources: NotebookSource[] = [];

    try {
      const rows = await this.getVisibleSourceRows(false);
      if (rows.length > 0) {
        log.info(`  📚 Parsed ${rows.length} visible source rows`);
        return rows.map((row, index) => ({
          id: `source-${index}`,
          name: row.name,
          type: 'document',
          status: 'ready',
        }));
      }

      // First ensure Sources panel is active
      await this.ensureSourcesPanel();
      await randomDelay(500, 800);

      // Try to find source names by looking at the actual text content visible on page
      // NotebookLM shows source names in spans/divs - look for text that looks like file names
      const seenNames = new Set<string>();

      // Method 1: Look for elements with PDF-like text using Playwright locators
      try {
        // Find all elements containing .pdf text
        const pdfElements = await this.page.locator('text=/\\.pdf/i').all();
        if (pdfElements.length > 0) {
          log.info(`  📚 Found ${pdfElements.length} PDF elements`);
          for (const el of pdfElements) {
            try {
              const text = await el.textContent();
              if (text && text.length > 10 && !seenNames.has(text.trim())) {
                seenNames.add(text.trim());
                sources.push({
                  id: `source-${sources.length}`,
                  name: text.trim(),
                  type: 'document',
                  status: 'ready',
                });
              }
            } catch {
              continue;
            }
          }
        }

        // Also look for elements with [Author] format (brackets)
        if (sources.length === 0) {
          const bracketElements = await this.page.locator('text=/\\[.+\\]/').all();
          if (bracketElements.length > 0) {
            log.info(`  📚 Found ${bracketElements.length} bracketed elements`);
            for (const el of bracketElements) {
              try {
                const text = await el.textContent();
                if (text && text.length > 10 && !seenNames.has(text.trim())) {
                  // Skip UI elements
                  if (/^(Sources|Discussion|Studio|Sélectionner)/i.test(text.trim())) continue;
                  seenNames.add(text.trim());
                  sources.push({
                    id: `source-${sources.length}`,
                    name: text.trim(),
                    type: 'document',
                    status: 'ready',
                  });
                }
              } catch {
                continue;
              }
            }
          }
        }
      } catch (error) {
        log.warning(`  ⚠️ Text scan failed: ${error}`);
      }

      // Method 2: If no sources found, try looking at specific source list selectors
      if (sources.length === 0) {
        log.info(`  🔍 Trying alternative source selectors...`);

        // Look for any element that contains source text
        const sourceTextSelectors = [
          '.source-item-name',
          '.source-name',
          '[class*="source-item"] span:not(mat-icon)',
          '[class*="source"] span.mdc-list-item__primary-text',
          'mat-list-item span',
        ];

        for (const selector of sourceTextSelectors) {
          try {
            const elements = await this.page.$$(selector);
            if (elements.length > 0) {
              log.info(`  📄 Found ${elements.length} elements with ${selector}`);
              for (const el of elements) {
                const text = (await el.textContent())?.trim();
                if (text && text.length > 5 && !seenNames.has(text)) {
                  // Skip icon text
                  if (text.match(/^(drive_pdf|markdown|more_vert|check)/i)) continue;
                  seenNames.add(text);
                  sources.push({
                    id: `source-${sources.length}`,
                    name: text,
                    type: 'document',
                    status: 'ready',
                  });
                }
              }
              if (sources.length > 0) break;
            }
          } catch {
            continue;
          }
        }
      }
    } catch (error) {
      log.warning(`  ⚠️ Could not list sources: ${error}`);
    }

    return sources;
  }

  /**
   * Delete a source from the current notebook
   *
   * @param input - Either sourceId or sourceName to identify the source to delete
   * @returns Result indicating success or failure
   */
  async deleteSource(input: SourceDeleteInput): Promise<SourceDeleteResult> {
    const { sourceId, sourceName } = input;

    if (!sourceId && !sourceName) {
      return { success: false, error: 'Either sourceId or sourceName is required' };
    }

    log.info(`🗑️ Deleting source: ${sourceId || sourceName}`);

    try {
      // First, ensure we're on the Sources panel
      await this.ensureSourcesPanel();
      await randomDelay(500, 800);
      await this.dismissBlockingOverlays();

      const matchedRow = await this.findVisibleSourceRow(sourceId, sourceName);

      // Find the source element
      const sourceElement = matchedRow?.element ?? await this.findSourceElement(sourceId, sourceName);

      if (!sourceElement) {
        return {
          success: false,
          error: `Source not found: ${sourceId || sourceName}`,
        };
      }

      // Get the source name for logging before deletion
      let deletedSourceName = sourceName || matchedRow?.name;
      if (!deletedSourceName) {
        try {
          deletedSourceName = await sourceElement.$eval(
            '.source-name, .title, [class*="name"], [class*="title"]',
            (e) => e.textContent?.trim() || 'Unknown'
          );
        } catch {
          deletedSourceName = sourceId || 'Unknown';
        }
      }

      // Open the source menu (3-dot menu or right-click)
      const menuOpened = await this.openSourceMenu(sourceElement);

      if (!menuOpened) {
        // Try right-click as fallback
        log.info(`  🔍 Trying right-click on source...`);
        await sourceElement.click({ button: 'right', force: true });
        await randomDelay(300, 500);
      }

      // Click delete option
      const deleteClicked = await this.clickDeleteOption();

      if (!deleteClicked) {
        return {
          success: false,
          error: 'Could not find delete option in menu',
        };
      }

      // Confirm deletion if prompted
      await this.confirmDeletion();

      // Wait for source to be removed
      await randomDelay(1000, 2000);

      // Verify deletion by checking if source is still present
      const stillExists = deletedSourceName
        ? await this.findSourceElement(undefined, deletedSourceName)
        : await this.findSourceElement(sourceId, sourceName);
      if (stillExists) {
        return {
          success: false,
          error: 'Source deletion may have failed - source still appears in list',
        };
      }

      log.success(`  ✅ Source deleted: ${deletedSourceName}`);
      return {
        success: true,
        sourceId: sourceId,
        sourceName: deletedSourceName,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`❌ Failed to delete source: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Find a source element by ID or name
   */
  private async findSourceElement(
    sourceId?: string,
    sourceName?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<import('patchright').ElementHandle<any> | null> {
    log.info(`  🔍 Finding source: id="${sourceId}", name="${sourceName}"`);

    const visibleRow = await this.findVisibleSourceRow(sourceId, sourceName);
    if (visibleRow) {
      log.info(`  ✅ Found source via visible source rows: "${visibleRow.name}"`);
      return visibleRow.element;
    }

    // METHOD 1: Direct text search (most reliable for NotebookLM)
    if (sourceName) {
      const directSelectors = [
        // Try to find element containing the source name text
        `:has-text("${sourceName}")`,
        `text="${sourceName}"`,
        `text=/.*${sourceName}.*/i`,
      ];

      for (const selector of directSelectors) {
        try {
          const el = this.page.locator(selector).first();
          if (await el.isVisible({ timeout: 1000 })) {
            log.info(`  ✅ Found source via direct text: ${selector}`);
            return await el.elementHandle();
          }
        } catch {
          continue;
        }
      }
    }

    // METHOD 2: Look within sources panel structure
    const sourceItemSelectors = [
      // NotebookLM current UI structure (checkboxes with labels)
      'mat-checkbox',
      '[class*="checkbox"]',
      // Standard list items
      '.source-item',
      '[data-item="source"]',
      '.sources-list-item',
      '[class*="source-list"] > div',
      '[class*="source-list"] > li',
      'mat-list-item',
      '.mat-list-item',
      '[role="listitem"]',
    ];

    for (const selector of sourceItemSelectors) {
      try {
        const elements = await this.page.$$(selector);
        log.info(`  🔍 Checking ${elements.length} elements with selector: ${selector}`);

        for (const el of elements) {
          // Check by data-id attribute
          if (sourceId) {
            const dataId = await el.getAttribute('data-id');
            if (dataId === sourceId) {
              log.info(`  ✅ Found source by data-id`);
              return el;
            }
          }

          // Check by name/title text content
          if (sourceName) {
            const textContent = await el.textContent();
            if (textContent && textContent.toLowerCase().includes(sourceName.toLowerCase())) {
              log.info(`  ✅ Found source by text content: "${textContent.slice(0, 50)}..."`);
              return el;
            }

            // Also check specific name/title elements
            try {
              const nameText = await el.$eval(
                '.source-name, .title, [class*="name"], [class*="title"], label, span',
                (e) => e.textContent?.trim() || ''
              );
              if (nameText.toLowerCase().includes(sourceName.toLowerCase())) {
                log.info(`  ✅ Found source by inner text: "${nameText}"`);
                return el;
              }
            } catch {
              // Element doesn't have a name/title child
            }
          }
        }
      } catch {
        continue;
      }
    }

    // Take debug screenshot
    try {
      const screenshotPath = path.join(CONFIG.dataDir, 'debug-find-source-failed.png');
      await this.page.screenshot({ path: screenshotPath });
      log.info(`  📸 Debug screenshot saved: ${screenshotPath}`);
    } catch {
      /* ignore */
    }

    log.warning(`  ⚠️ Source not found: ${sourceId || sourceName}`);
    return null;
  }

  /**
   * Open the source menu (3-dot menu)
   */
  private async openSourceMenu(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sourceElement: import('patchright').ElementHandle<any>
  ): Promise<boolean> {
    await this.dismissBlockingOverlays();

    const menuButtonSelectors = [
      // Material Design 3-dot menu button
      'button:has(mat-icon:has-text("more_vert"))',
      'button:has(mat-icon:has-text("more_horiz"))',
      'button[aria-label*="menu" i]',
      'button[aria-label*="options" i]',
      'button[aria-label*="actions" i]',
      'button[aria-label*="More" i]',
      'button[aria-label*="Plus" i]',
      '.mat-mdc-icon-button:has(mat-icon)',
      '[class*="menu-button"]',
      '[class*="more-button"]',
      '[data-action="menu"]',
      // Generic icon buttons that might be the menu
      'button.mat-icon-button',
      'button.mdc-icon-button',
    ];

    // First, try to find the menu button within the source element
    for (const selector of menuButtonSelectors) {
      try {
        const menuBtn = await sourceElement.$(selector);
        if (menuBtn) {
          const isVisible = await menuBtn.isVisible();
          if (isVisible) {
            log.info(`  ✅ Found menu button: ${selector}`);
            await menuBtn.click({ force: true });
            await randomDelay(300, 500);
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    // Hover over the source to reveal hidden menu button
    log.info(`  🔍 Hovering to reveal menu button...`);
    try {
      await sourceElement.hover();
    } catch {
      log.warning('  ⚠️  Could not hover source row to reveal menu button');
      return false;
    }
    await randomDelay(500, 800);

    // Try again after hover
    for (const selector of menuButtonSelectors) {
      try {
        const menuBtn = await sourceElement.$(selector);
        if (menuBtn) {
          const isVisible = await menuBtn.isVisible();
          if (isVisible) {
            log.info(`  ✅ Found menu button after hover: ${selector}`);
            await menuBtn.click({ force: true });
            await randomDelay(300, 500);
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Click the delete option in the menu
   */
  private async clickDeleteOption(): Promise<boolean> {
    const deleteSelectors = [
      // Menu item selectors (bilingual FR/EN via i18n)
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'delete'),
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'remove'),
      ...i18nSelectors('[role="menuitem"]:has-text("{text}")', 'buttons', 'delete'),
      ...i18nSelectors('[role="menuitem"]:has-text("{text}")', 'buttons', 'remove'),
      ...i18nSelectors('mat-menu-item:has-text("{text}")', 'buttons', 'delete'),
      ...i18nSelectors('.mat-menu-item:has-text("{text}")', 'buttons', 'delete'),
      // With icons
      'button:has(mat-icon:has-text("delete"))',
      '[role="menuitem"]:has(mat-icon:has-text("delete"))',
      'mat-menu-item:has(mat-icon:has-text("delete"))',
      // Aria labels
      'button[aria-label*="Delete" i]',
      'button[aria-label*="Remove" i]',
      'button[aria-label*="Supprimer" i]',
      // Generic patterns
      '[data-action="delete"]',
      '[class*="delete"]',
    ];

    // Wait for menu to appear
    await randomDelay(300, 500);

    for (const selector of deleteSelectors) {
      try {
        const deleteBtn = this.page.locator(selector).first();
        if (await deleteBtn.isVisible({ timeout: 500 })) {
          log.info(`  ✅ Found delete option: ${selector}`);
          await deleteBtn.click();
          await randomDelay(300, 500);
          return true;
        }
      } catch {
        continue;
      }
    }

    // Debug: list menu items
    log.warning(`  ⚠️ Delete option not found, listing menu items...`);
    try {
      const menuItems = await this.page.$$('[role="menuitem"], .mat-menu-item, mat-menu-item');
      for (let i = 0; i < Math.min(menuItems.length, 5); i++) {
        const text = await menuItems[i].textContent();
        log.info(`  🔍 Menu item[${i}]: "${text?.trim()}"`);
      }
    } catch {
      // ignore
    }

    return false;
  }

  /**
   * Confirm deletion if a confirmation dialog appears
   */
  private async confirmDeletion(): Promise<void> {
    const confirmSelectors = [
      // Confirmation buttons (bilingual via i18n)
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'confirm'),
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'yes'),
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'delete'),
      'button:has-text("OK")',
      // Dialog confirm buttons
      '[role="dialog"] button.mat-primary',
      '[role="dialog"] button[color="primary"]',
      '[role="dialog"] button.mdc-button--raised',
      '.mat-dialog-actions button:not(:has-text("Cancel")):not(:has-text("Annuler"))',
      '.mdc-dialog__actions button:not(:has-text("Cancel")):not(:has-text("Annuler"))',
      // Aria patterns
      'button[aria-label*="Confirm" i]',
      'button[aria-label*="Delete" i]',
    ];

    // Wait a moment for dialog to appear
    await randomDelay(500, 800);

    // Check if a confirmation dialog is visible
    const dialogSelectors = ['[role="dialog"]', '.mat-dialog-container', '.mdc-dialog'];
    let dialogVisible = false;
    for (const dialogSelector of dialogSelectors) {
      try {
        const dialog = this.page.locator(dialogSelector).first();
        if (await dialog.isVisible({ timeout: 500 })) {
          dialogVisible = true;
          log.info(`  📋 Confirmation dialog detected`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!dialogVisible) {
      log.info(`  ℹ️ No confirmation dialog detected`);
      return;
    }

    // Click confirm button
    for (const selector of confirmSelectors) {
      try {
        const confirmBtn = this.page.locator(selector).first();
        if (await confirmBtn.isVisible({ timeout: 500 })) {
          log.info(`  ✅ Clicking confirm: ${selector}`);
          await confirmBtn.click();
          await randomDelay(300, 500);
          return;
        }
      } catch {
        continue;
      }
    }

    log.warning(`  ⚠️ No confirm button found, pressing Enter as fallback`);
    await this.page.keyboard.press('Enter');
  }

  /**
   * List all generated content
   */
  async listGeneratedContent(): Promise<GeneratedContent[]> {
    const content: GeneratedContent[] = [];

    try {
      // Check for audio overview
      const audioPlayer = await this.page.$('audio, .audio-player');
      if (audioPlayer) {
        content.push({
          id: 'audio-overview',
          type: 'audio_overview',
          name: 'Audio Overview',
          status: 'ready',
          createdAt: new Date().toISOString(),
        });
      }

      // Note: We only list audio_overview content now since other content types
      // (briefing_doc, study_guide, etc.) were removed as they were fake implementations.
      // Any notes in the Studio panel would have been created by the user directly in NotebookLM.
    } catch (error) {
      log.warning(`  ⚠️ Could not list generated content: ${error}`);
    }

    return content;
  }

  /**
   * Download generated content (audio, video, infographic)
   *
   * For media content types that produce downloadable files:
   * - audio_overview: WAV audio file
   * - video: MP4 video file
   * - infographic: PNG image file
   *
   * Note: Text-based content (report, presentation, data_table) is returned
   * directly in the generation response, not as downloadable files.
   *
   * @param contentType Type of content to download
   * @param outputPath Optional path to save the file
   * @returns Download result with file path
   */
  async downloadContent(
    contentType: ContentType,
    outputPath?: string
  ): Promise<ContentDownloadResult> {
    log.info(`📥 Downloading ${contentType}...`);

    // Handle Google export types (presentation -> Google Slides, data_table -> Google Sheets)
    if (contentType === 'presentation') {
      return await this.exportPresentationToGoogleSlides();
    }

    if (contentType === 'data_table') {
      return await this.exportDataTableToGoogleSheets();
    }

    // Report is truly text-based with no export option
    if (contentType === 'report') {
      return {
        success: false,
        error: `Content type 'report' is text-based and returned in the generation response. No file download available.`,
      };
    }

    try {
      // Navigate to the appropriate content panel
      const panelConfig = this.getContentPanelConfig(contentType);
      await this.navigateToContentPanel(panelConfig);

      // Find and click download button
      const downloadBtn = await this.findDownloadButton();
      if (!downloadBtn) {
        // For audio, try to get source URL directly
        if (contentType === 'audio_overview') {
          const audioSrc = await this.getAudioSourceUrl();
          if (audioSrc) {
            return { success: true, filePath: audioSrc, mimeType: 'audio/wav' };
          }
        }
        throw new Error('Download button not found');
      }

      // Set up download handling and click
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });
      await downloadBtn.click();
      const download = await downloadPromise;

      // Save the file
      const suggestedName = download.suggestedFilename();
      const savePath = outputPath || path.join(CONFIG.dataDir, suggestedName);
      await download.saveAs(savePath);

      // Determine MIME type
      const mimeTypes: Record<string, string> = {
        audio_overview: 'audio/wav',
        video: 'video/mp4',
        infographic: 'image/png',
      };

      log.success(`  ✅ ${contentType} downloaded: ${savePath}`);
      return {
        success: true,
        filePath: savePath,
        mimeType: mimeTypes[contentType] || 'application/octet-stream',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Download failed: ${errorMsg}` };
    }
  }

  /**
   * Get panel configuration for a content type
   */
  private getContentPanelConfig(contentType: ContentType): {
    tabSelectors: string[];
    cardSelectors: string[];
  } {
    const configs: Record<string, { tabSelectors: string[]; cardSelectors: string[] }> = {
      audio_overview: {
        tabSelectors: [
          '[role="tab"]:has-text("Audio Overview")',
          '[role="tab"]:has-text("Audio")',
          'button:has-text("Audio Overview")',
          '[aria-label*="Audio"]',
        ],
        cardSelectors: [
          '.audio-overview-card',
          '[data-type="audio"]',
          'button:has-text("Deep Dive")',
        ],
      },
      video: {
        tabSelectors: [
          '[role="tab"]:has-text("Video")',
          'button:has-text("Video")',
          '[aria-label*="Video"]',
        ],
        cardSelectors: ['.video-card', '[data-type="video"]', 'video'],
      },
      infographic: {
        tabSelectors: [
          '[role="tab"]:has-text("Infographic")',
          'button:has-text("Infographic")',
          '[aria-label*="Infographic"]',
        ],
        cardSelectors: [
          '.infographic-card',
          '[data-type="infographic"]',
          'img[class*="infographic"]',
        ],
      },
      presentation: {
        tabSelectors: [
          '[role="tab"]:has-text("Presentation")',
          '[role="tab"]:has-text("Slides")',
          '[role="tab"]:has-text("Diaporama")',
          'button:has-text("Presentation")',
          'button:has-text("Slides")',
          '[aria-label*="Presentation"]',
          '[aria-label*="Slides"]',
        ],
        cardSelectors: [
          '.presentation-card',
          '.slides-card',
          '[data-type="presentation"]',
          '[data-type="slides"]',
        ],
      },
      data_table: {
        tabSelectors: [
          '[role="tab"]:has-text("Data Table")',
          '[role="tab"]:has-text("Table")',
          '[role="tab"]:has-text("Tableau")',
          'button:has-text("Data Table")',
          'button:has-text("Table")',
          '[aria-label*="Table"]',
          '[aria-label*="Data"]',
        ],
        cardSelectors: [
          '.data-table-card',
          '.table-card',
          '[data-type="data_table"]',
          '[data-type="table"]',
        ],
      },
    };
    return configs[contentType] || { tabSelectors: [], cardSelectors: [] };
  }

  /**
   * Navigate to content panel
   */
  private async navigateToContentPanel(config: {
    tabSelectors: string[];
    cardSelectors: string[];
  }): Promise<void> {
    // Try to click tab
    for (const selector of config.tabSelectors) {
      try {
        const tab = this.page.locator(selector).first();
        if (await tab.isVisible({ timeout: 500 })) {
          await tab.click();
          await randomDelay(500, 1000);
          break;
        }
      } catch {
        continue;
      }
    }

    // Try to click card
    for (const selector of config.cardSelectors) {
      try {
        const card = this.page.locator(selector).first();
        if (await card.isVisible({ timeout: 500 })) {
          await card.click();
          await randomDelay(500, 1000);
          break;
        }
      } catch {
        continue;
      }
    }
  }

  /**
   * Find download button on the page
   */
  private async findDownloadButton(): Promise<Locator | null> {
    const downloadSelectors = [
      'button:has(mat-icon:has-text("download"))',
      'button:has(mat-icon:has-text("file_download"))',
      'button:has(mat-icon:has-text("get_app"))',
      'button[aria-label*="Download"]',
      'button[aria-label*="Télécharger"]',
      'button[aria-label*="download"]',
      // Text-based patterns (bilingual via i18n)
      ...i18nSelectors('button:has-text("{text}")', 'buttons', 'download'),
      'a[download]',
      '.download-button',
      '[data-action="download"]',
    ];

    for (const selector of downloadSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        if (await btn.isVisible({ timeout: 500 })) {
          log.info(`  ✅ Found download button: ${selector}`);
          return btn;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Get audio source URL directly from audio element
   */
  private async getAudioSourceUrl(): Promise<string | null> {
    try {
      const audioEl = await this.page.$('audio');
      if (audioEl) {
        const src = await audioEl.getAttribute('src');
        if (src) {
          log.info(`  ✅ Audio source URL found: ${src}`);
          return src;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /**
   * Download audio content
   * @deprecated Use downloadContent('audio_overview', outputPath) instead
   */
  async downloadAudio(outputPath?: string): Promise<ContentDownloadResult> {
    log.info(`📥 Downloading audio...`);

    try {
      // First, navigate to the Audio Overview panel/tab
      log.info(`  📑 Looking for Audio Overview panel...`);
      const audioTabSelectors = [
        '[role="tab"]:has-text("Audio Overview")',
        '[role="tab"]:has-text("Audio")',
        'button:has-text("Audio Overview")',
        'button:has-text("Audio")',
        '[aria-label*="Audio"]',
      ];

      for (const selector of audioTabSelectors) {
        try {
          const tab = this.page.locator(selector).first();
          if (await tab.isVisible({ timeout: 500 })) {
            log.info(`  ✅ Found Audio tab: ${selector}`);
            await tab.click();
            await randomDelay(500, 1000);
            break;
          }
        } catch {
          continue;
        }
      }

      // Look for Audio Overview card/section and click it if needed
      const audioCardSelectors = [
        '.audio-overview-card',
        '[data-type="audio"]',
        'button:has-text("Deep Dive")',
        'button:has-text("Conversation")',
      ];

      for (const selector of audioCardSelectors) {
        try {
          const card = this.page.locator(selector).first();
          if (await card.isVisible({ timeout: 500 })) {
            log.info(`  ✅ Found Audio card: ${selector}`);
            await card.click();
            await randomDelay(500, 1000);
            break;
          }
        } catch {
          continue;
        }
      }

      // First try to open a menu (NotebookLM often has download in a three-dot menu)
      const menuTriggerSelectors = [
        'button:has(mat-icon:has-text("more_vert"))',
        'button:has(mat-icon:has-text("more_horiz"))',
        'button[aria-label*="More"]',
        'button[aria-label*="Options"]',
        'button[aria-label*="Menu"]',
        'button[aria-label*="plus"]',
        '.mat-mdc-menu-trigger',
        '[aria-haspopup="menu"]',
      ];

      for (const menuSelector of menuTriggerSelectors) {
        try {
          const menuBtn = this.page.locator(menuSelector).first();
          if (await menuBtn.isVisible({ timeout: 300 })) {
            log.info(`  🔍 Opening menu: ${menuSelector}`);
            await menuBtn.click();
            await randomDelay(300, 500);
            break;
          }
        } catch {
          continue;
        }
      }

      // Find download button (either direct or in menu) - bilingual via i18n
      const downloadSelectors = [
        // Menu item patterns (if menu was opened)
        ...i18nSelectors('[role="menuitem"]:has-text("{text}")', 'buttons', 'download'),
        ...i18nSelectors('mat-menu-item:has-text("{text}")', 'buttons', 'download'),
        '.mat-mdc-menu-item:has-text("Download")',
        // Material Design icon buttons
        'button:has(mat-icon:has-text("download"))',
        'button:has(mat-icon:has-text("file_download"))',
        'button:has(mat-icon:has-text("get_app"))',
        // Aria labels
        'button[aria-label*="Download"]',
        'button[aria-label*="Télécharger"]',
        'button[aria-label*="download"]',
        // Text patterns (bilingual via i18n)
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'download'),
        // Icon buttons near audio
        '.audio-controls button:has(mat-icon)',
        '.audio-player button:has(mat-icon)',
        // Generic download patterns
        'a[download]',
        '.download-button',
        '[data-action="download"]',
      ];

      let downloadBtn = null;
      for (const selector of downloadSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 500 })) {
            downloadBtn = btn;
            log.info(`  ✅ Found download button: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!downloadBtn) {
        // Try to get audio source directly from audio element
        log.info(`  🔍 No download button, looking for audio element...`);
        const audioEl = await this.page.$('audio');
        if (audioEl) {
          const src = await audioEl.getAttribute('src');
          if (src) {
            log.info(`  ✅ Audio source URL found: ${src}`);
            return {
              success: true,
              filePath: src,
              mimeType: 'audio/wav',
            };
          }
        }

        // Debug: list all buttons in the panel
        log.warning(`  ⚠️ Download button not found, listing panel buttons...`);
        try {
          const buttons = await this.page.locator('button').all();
          for (let i = 0; i < Math.min(buttons.length, 10); i++) {
            const text = await buttons[i].textContent();
            const aria = await buttons[i].getAttribute('aria-label');
            log.info(`  🔍 Button[${i}]: text="${text?.trim()}", aria="${aria}"`);
          }
        } catch {
          /* ignore */
        }

        throw new Error('Download button not found');
      }

      // Set up download handling
      const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

      await downloadBtn.click();

      const download = await downloadPromise;
      const suggestedName = download.suggestedFilename();

      const savePath = outputPath || path.join(CONFIG.dataDir, suggestedName);
      await download.saveAs(savePath);

      log.success(`  ✅ Audio downloaded: ${savePath}`);

      return {
        success: true,
        filePath: savePath,
        mimeType: 'audio/wav',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Download failed: ${errorMsg}` };
    }
  }

  /**
   * Export presentation to Google Slides
   * Finds and clicks the "Open in Slides" button to get the Google Slides URL
   */
  private async exportPresentationToGoogleSlides(): Promise<ContentDownloadResult> {
    log.info(`  📤 Exporting presentation to Google Slides...`);

    try {
      // Navigate to presentation panel
      const panelConfig = this.getContentPanelConfig('presentation');
      await this.navigateToContentPanel(panelConfig);

      // Look for "Open in Slides" or similar export button
      const exportSelectors = [
        'button:has-text("Open in Slides")',
        'button:has-text("Ouvrir dans Slides")',
        'button:has-text("Export to Slides")',
        'button:has-text("Google Slides")',
        'a[href*="docs.google.com/presentation"]',
        'button[aria-label*="Slides"]',
        'button[aria-label*="slides"]',
        'button:has(mat-icon:has-text("slideshow"))',
        // Also look for download as PDF option
        'button:has-text("Download PDF")',
        'button:has-text("Télécharger PDF")',
      ];

      for (const selector of exportSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            log.info(`  ✅ Found export button: ${selector}`);

            // Check if it's a direct link
            const href = await btn.getAttribute('href');
            if (href && href.includes('docs.google.com/presentation')) {
              log.success(`  ✅ Google Slides URL found: ${href}`);
              return {
                success: true,
                googleSlidesUrl: href,
                mimeType: 'application/vnd.google-apps.presentation',
              };
            }

            // Click the button and wait for navigation or new tab
            const [newPage] = await Promise.all([
              this.page
                .context()
                .waitForEvent('page', { timeout: 10000 })
                .catch(() => null),
              btn.click(),
            ]);

            if (newPage) {
              const newUrl = newPage.url();
              await newPage.close();
              if (newUrl.includes('docs.google.com/presentation')) {
                log.success(`  ✅ Google Slides URL: ${newUrl}`);
                return {
                  success: true,
                  googleSlidesUrl: newUrl,
                  mimeType: 'application/vnd.google-apps.presentation',
                };
              }
            }

            // Check current page URL
            await randomDelay(2000, 3000);
            const currentUrl = this.page.url();
            if (currentUrl.includes('docs.google.com/presentation')) {
              log.success(`  ✅ Navigated to Google Slides: ${currentUrl}`);
              return {
                success: true,
                googleSlidesUrl: currentUrl,
                mimeType: 'application/vnd.google-apps.presentation',
              };
            }
          }
        } catch {
          continue;
        }
      }

      return {
        success: false,
        error:
          'Could not find Google Slides export button. The presentation may not be ready or the export feature is not available.',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Export to Google Slides failed: ${errorMsg}` };
    }
  }

  /**
   * Export data table to Google Sheets
   * Finds and clicks the "Open in Sheets" button to get the Google Sheets URL
   */
  private async exportDataTableToGoogleSheets(): Promise<ContentDownloadResult> {
    log.info(`  📤 Exporting data table to Google Sheets...`);

    try {
      // Navigate to data table panel
      const panelConfig = this.getContentPanelConfig('data_table');
      await this.navigateToContentPanel(panelConfig);

      // Look for "Open in Sheets" or similar export button
      const exportSelectors = [
        'button:has-text("Open in Sheets")',
        'button:has-text("Ouvrir dans Sheets")',
        'button:has-text("Export to Sheets")',
        'button:has-text("Google Sheets")',
        'a[href*="docs.google.com/spreadsheets"]',
        'button[aria-label*="Sheets"]',
        'button[aria-label*="sheets"]',
        'button:has(mat-icon:has-text("table_chart"))',
        'button:has(mat-icon:has-text("grid_on"))',
      ];

      for (const selector of exportSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            log.info(`  ✅ Found export button: ${selector}`);

            // Check if it's a direct link
            const href = await btn.getAttribute('href');
            if (href && href.includes('docs.google.com/spreadsheets')) {
              log.success(`  ✅ Google Sheets URL found: ${href}`);
              return {
                success: true,
                googleSheetsUrl: href,
                mimeType: 'application/vnd.google-apps.spreadsheet',
              };
            }

            // Click the button and wait for navigation or new tab
            const [newPage] = await Promise.all([
              this.page
                .context()
                .waitForEvent('page', { timeout: 10000 })
                .catch(() => null),
              btn.click(),
            ]);

            if (newPage) {
              const newUrl = newPage.url();
              await newPage.close();
              if (newUrl.includes('docs.google.com/spreadsheets')) {
                log.success(`  ✅ Google Sheets URL: ${newUrl}`);
                return {
                  success: true,
                  googleSheetsUrl: newUrl,
                  mimeType: 'application/vnd.google-apps.spreadsheet',
                };
              }
            }

            // Check current page URL
            await randomDelay(2000, 3000);
            const currentUrl = this.page.url();
            if (currentUrl.includes('docs.google.com/spreadsheets')) {
              log.success(`  ✅ Navigated to Google Sheets: ${currentUrl}`);
              return {
                success: true,
                googleSheetsUrl: currentUrl,
                mimeType: 'application/vnd.google-apps.spreadsheet',
              };
            }
          }
        } catch {
          continue;
        }
      }

      return {
        success: false,
        error:
          'Could not find Google Sheets export button. The data table may not be ready or the export feature is not available.',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Export to Google Sheets failed: ${errorMsg}` };
    }
  }

  // ============================================================================
  // Notes Management
  // ============================================================================

  /**
   * Create a note in the NotebookLM Studio panel
   *
   * Notes are user-created annotations that appear in the notebook's Studio panel.
   * They allow you to save research findings, summaries, or key insights.
   *
   * @param input Note input with title and content
   * @returns NoteResult with success status
   */
  async createNote(input: NoteInput): Promise<NoteResult> {
    log.info(`📝 Creating note: "${input.title}"`);

    try {
      // Step 1: Navigate to Studio panel where notes are managed
      await this.navigateToStudio();
      await randomDelay(500, 1000);

      // Step 2: Look for "Add note" or "+" button in the Studio panel (bilingual via i18n)
      const addNoteSelectors = [
        // Primary selectors for Add Note button (bilingual via i18n)
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'addNote'),
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'newNote'),
        // Icon button patterns
        'button[aria-label*="Add note"]',
        'button[aria-label*="add note" i]',
        'button[aria-label*="Ajouter"]',
        'button[aria-label*="New note"]',
        // Material Design patterns
        'button:has(mat-icon:has-text("add"))',
        'button:has(mat-icon:has-text("note_add"))',
        'button:has(mat-icon:has-text("post_add"))',
        '.mat-mdc-icon-button[aria-label*="note" i]',
        '.mat-mdc-icon-button[aria-label*="add" i]',
        // Studio panel specific
        '[class*="studio"] button:has(mat-icon:has-text("add"))',
        '[class*="notes"] button:has(mat-icon:has-text("add"))',
        // Generic add patterns in notes section
        '.notes-section button',
        '.note-list button.add',
        '[data-testid*="add-note"]',
        '[data-action="add-note"]',
      ];

      let addButtonFound = false;
      for (const selector of addNoteSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            log.info(`  ✅ Found Add note button: ${selector}`);
            await btn.scrollIntoViewIfNeeded();
            await btn.click({ force: true, timeout: 5000 });
            addButtonFound = true;
            await randomDelay(500, 1000);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!addButtonFound) {
        // Debug: log available buttons
        log.warning(`  ⚠️ Add note button not found, checking available elements...`);
        await this.debugStudioElements();
        return {
          success: false,
          error: 'Could not find Add note button in Studio panel',
          status: 'failed',
        };
      }

      // Step 3: Wait for note editor dialog/panel to appear
      await randomDelay(500, 1000);

      // Step 4: Find and fill the title input
      const titleSelectors = [
        // Common title input patterns
        'input[placeholder*="Title"]',
        'input[placeholder*="title"]',
        'input[placeholder*="Titre"]',
        'input[placeholder*="titre"]',
        'input[placeholder*="Note title"]',
        'input[name="title"]',
        'input[aria-label*="title" i]',
        // Material Design inputs
        '.mat-form-field input',
        'mat-form-field input',
        // Dialog/modal specific
        '[role="dialog"] input[type="text"]:first-of-type',
        '.note-editor input:first-of-type',
        '.note-form input:first-of-type',
        // Generic text input in note context
        '[class*="note"] input[type="text"]',
      ];

      let titleInput = null;
      for (const selector of titleSelectors) {
        try {
          const input = this.page.locator(selector).first();
          if (await input.isVisible({ timeout: 1000 })) {
            titleInput = input;
            log.info(`  ✅ Found title input: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (titleInput) {
        await titleInput.fill(input.title);
        log.info(`  ✅ Title entered: "${input.title}"`);
        await randomDelay(300, 500);
      } else {
        log.warning(`  ⚠️ Title input not found, proceeding without title`);
      }

      // Step 5: Find and fill the content textarea
      const contentSelectors = [
        // Textarea patterns
        'textarea[placeholder*="content"]',
        'textarea[placeholder*="Content"]',
        'textarea[placeholder*="note"]',
        'textarea[placeholder*="Note"]',
        'textarea[placeholder*="Contenu"]',
        'textarea[placeholder*="Write"]',
        'textarea[placeholder*="write"]',
        'textarea[name="content"]',
        'textarea[aria-label*="content" i]',
        'textarea[aria-label*="note" i]',
        // Material Design
        '.mat-form-field textarea',
        'mat-form-field textarea',
        // Dialog/modal specific
        '[role="dialog"] textarea',
        '.note-editor textarea',
        '.note-form textarea',
        // Rich text editor patterns
        '[contenteditable="true"]',
        '.ProseMirror',
        '.ql-editor',
        // Generic textarea in note context
        '[class*="note"] textarea',
      ];

      let contentInput = null;
      for (const selector of contentSelectors) {
        try {
          const input = this.page.locator(selector).first();
          if (await input.isVisible({ timeout: 1000 })) {
            contentInput = input;
            log.info(`  ✅ Found content input: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (contentInput) {
        // Check if it's a contenteditable element
        const isContentEditable = await contentInput.getAttribute('contenteditable');
        if (isContentEditable === 'true') {
          await contentInput.click();
          await this.page.keyboard.type(input.content);
        } else {
          await contentInput.fill(input.content);
        }
        log.info(`  ✅ Content entered (${input.content.length} chars)`);
        await randomDelay(300, 500);
      } else {
        log.warning(`  ⚠️ Content input not found`);
        return {
          success: false,
          error: 'Could not find content input field',
          status: 'failed',
        };
      }

      // Step 6: Save the note by clicking Save/Done button (bilingual via i18n)
      const saveSelectors = [
        // Primary save buttons (bilingual via i18n)
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'save'),
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'done'),
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'create'),
        ...i18nSelectors('button:has-text("{text}")', 'buttons', 'add'),
        // Icon buttons
        'button:has(mat-icon:has-text("check"))',
        'button:has(mat-icon:has-text("save"))',
        'button:has(mat-icon:has-text("done"))',
        // Submit button
        'button[type="submit"]',
        // Material Design primary button
        'button.mat-flat-button',
        'button.mdc-button--raised',
        'button[color="primary"]',
        // Dialog actions
        '[role="dialog"] button:not(:has-text("Cancel")):not(:has-text("Annuler"))',
        '.mat-dialog-actions button:not(:has-text("Cancel"))',
        '.mdc-dialog__actions button:not(:has-text("Cancel"))',
      ];

      let saveButtonFound = false;
      for (const selector of saveSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 500 })) {
            log.info(`  ✅ Found save button: ${selector}`);

            // Check if button is enabled before clicking
            const isEnabled = await btn.isEnabled();
            log.info(`  ℹ️ Button enabled: ${isEnabled}`);

            // Use force click with short timeout to avoid blocking
            await btn.click({ force: true, timeout: 5000 });
            log.info(`  ✅ Clicked save button`);
            saveButtonFound = true;

            // Wait for dialog to close (max 5 seconds - faster feedback)
            try {
              await this.page.waitForSelector('[role="dialog"]', {
                state: 'hidden',
                timeout: 5000,
              });
              log.info(`  ✅ Dialog closed after save`);
            } catch {
              // Dialog might not close - that's okay, we clicked
              log.info(`  ⚠️ Dialog still visible after click`);
            }
            await randomDelay(300, 500);
            break;
          }
        } catch (e) {
          log.debug(`  ℹ️ Selector ${selector} failed: ${e}`);
          continue;
        }
      }

      if (!saveButtonFound) {
        // Try pressing Enter as fallback
        log.info(`  ⌨️ No save button found, pressing Enter as fallback`);
        await this.page.keyboard.press('Enter');

        // Wait for dialog to close
        try {
          await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });
        } catch {
          // Continue anyway
        }
        await randomDelay(500, 1000);
      }

      // Step 7: Verify note was created by checking for its presence
      await randomDelay(1000, 2000);

      // Look for the note in the list
      const noteVerifySelectors = [
        `[class*="note"]:has-text("${input.title.substring(0, 20)}")`,
        `.note-item:has-text("${input.title.substring(0, 20)}")`,
        `[data-note-title="${input.title}"]`,
      ];

      for (const selector of noteVerifySelectors) {
        try {
          const note = this.page.locator(selector).first();
          if (await note.isVisible({ timeout: 2000 })) {
            log.success(`  ✅ Note created successfully: "${input.title}"`);
            return {
              success: true,
              noteTitle: input.title,
              status: 'created',
            };
          }
        } catch {
          continue;
        }
      }

      // If we can't verify but no errors occurred, assume success
      log.success(`  ✅ Note creation completed: "${input.title}"`);
      return {
        success: true,
        noteTitle: input.title,
        status: 'created',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Note creation failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        status: 'failed',
      };
    }
  }

  /**
   * Debug helper to log Studio panel elements
   */
  private async debugStudioElements(): Promise<void> {
    try {
      // Log all buttons in the Studio panel
      const studioButtons = await this.page
        .locator('[class*="studio"] button, [class*="Studio"] button')
        .all();
      log.info(`  🔍 DEBUG: Found ${studioButtons.length} buttons in Studio panel`);

      for (let i = 0; i < Math.min(studioButtons.length, 10); i++) {
        const btn = studioButtons[i];
        const ariaLabel = await btn.getAttribute('aria-label');
        const text = await btn.textContent();
        const classes = await btn.getAttribute('class');
        log.info(
          `  🔍 Button[${i}]: aria="${ariaLabel}", text="${text?.trim()}", class="${classes?.substring(0, 50)}"`
        );
      }

      // Also check for any visible buttons on the page
      const allButtons = await this.page.locator('button').all();
      log.info(`  🔍 Total buttons on page: ${allButtons.length}`);
    } catch (e) {
      log.warning(`  ⚠️ Debug failed: ${e}`);
    }
  }

  // ============================================================================
  // Save Chat to Note
  // ============================================================================

  /**
   * Save the current chat/discussion to a note
   *
   * This method extracts all messages from the NotebookLM chat/discussion panel
   * and creates a note with the chat summary.
   *
   * @param input Optional input with custom title
   * @returns SaveChatToNoteResult with success status and message count
   */
  async saveChatToNote(input: SaveChatToNoteInput = {}): Promise<SaveChatToNoteResult> {
    const title = input.title || 'Chat Summary';
    log.info(`💬 Saving chat to note: "${title}"`);

    // Overall timeout for the entire operation (60 seconds)
    const OPERATION_TIMEOUT = 60000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Save chat to note timed out after 60 seconds')),
        OPERATION_TIMEOUT
      );
    });

    try {
      // Wrap the operation with a timeout
      return await Promise.race([this.performSaveChatToNote(title), timeoutPromise]);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Failed to save chat to note: ${errorMsg}`);
      return {
        success: false,
        noteTitle: title,
        status: 'failed',
        error: errorMsg,
      };
    }
  }

  /**
   * Internal method to perform the save chat to note operation
   */
  private async performSaveChatToNote(title: string): Promise<SaveChatToNoteResult> {
    try {
      // Step 1: Navigate to Discussion panel to access chat messages
      await this.navigateToDiscussion();
      await randomDelay(500, 1000);

      // Step 2: Extract chat messages (with shorter timeout for individual ops)
      const chatMessages = await this.extractChatMessages();

      if (chatMessages.length === 0) {
        return {
          success: false,
          noteTitle: title,
          status: 'failed',
          error: 'No chat messages found to save',
        };
      }

      log.info(`  📊 Extracted ${chatMessages.length} messages from chat`);

      // Step 3: Format messages into note content
      const noteContent = this.formatChatAsNote(chatMessages, title);

      // Step 4: Create the note using existing createNote method
      const noteResult = await this.createNote({
        title,
        content: noteContent,
      });

      if (noteResult.success) {
        log.success(`  ✅ Chat saved to note: "${title}" (${chatMessages.length} messages)`);
        return {
          success: true,
          noteTitle: title,
          status: 'created',
          messageCount: chatMessages.length,
        };
      } else {
        return {
          success: false,
          noteTitle: title,
          status: 'failed',
          error: noteResult.error || 'Failed to create note',
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Failed to save chat to note: ${errorMsg}`);
      return {
        success: false,
        noteTitle: title,
        status: 'failed',
        error: errorMsg,
      };
    }
  }

  /**
   * Extract chat messages from the Discussion panel
   *
   * @returns Array of message objects with role (user/assistant) and content
   */
  private async extractChatMessages(): Promise<
    Array<{ role: 'user' | 'assistant'; content: string }>
  > {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    try {
      // Selectors for user messages (questions)
      const userMessageSelectors = [
        // NotebookLM user message patterns
        '.user-message',
        '[data-role="user"]',
        '[class*="user-message"]',
        '[class*="user_message"]',
        '.chat-message.user',
        '.message.user',
        // Material Design chat patterns
        '.mat-chat-user-message',
        '.mdc-chat-user-message',
        // Generic patterns
        '[data-message-role="user"]',
        '[data-sender="user"]',
      ];

      // Selectors for AI messages (responses)
      const aiMessageSelectors = [
        // NotebookLM AI response patterns
        '.ai-message',
        '.assistant-message',
        '[data-role="assistant"]',
        '[data-role="model"]',
        '[class*="ai-message"]',
        '[class*="assistant-message"]',
        '[class*="model-message"]',
        '.chat-message.assistant',
        '.chat-message.ai',
        '.message.assistant',
        // Material Design patterns
        '.mat-chat-ai-message',
        '.mdc-chat-ai-message',
        // Generic patterns
        '[data-message-role="assistant"]',
        '[data-message-role="model"]',
        '[data-sender="assistant"]',
        '[data-sender="model"]',
        // Markdown response container (common in NotebookLM)
        '.response-container',
        '.markdown-body',
        '[class*="response"]',
      ];

      // Try to find all message containers in order
      const allMessageSelectors = [
        // Combined message container patterns
        '.chat-message',
        '.message-item',
        '[class*="message-container"]',
        '.messages-list > div',
        '.chat-scroll-container > div',
        '[role="listitem"]',
        // NotebookLM specific patterns
        '[class*="chat"] [class*="message"]',
        '[class*="discussion"] [class*="message"]',
      ];

      // First, try to find all messages in sequence
      for (const containerSelector of allMessageSelectors) {
        try {
          const messageContainers = await this.page.locator(containerSelector).all();
          if (messageContainers.length > 0) {
            log.info(
              `  🔍 Found ${messageContainers.length} message containers with: ${containerSelector}`
            );

            for (const container of messageContainers) {
              if (!(await container.isVisible())) continue;

              const text = await container.textContent();
              if (!text || text.trim().length === 0) continue;

              // Determine if user or AI message based on class/attributes
              const classes = (await container.getAttribute('class')) || '';
              const role =
                (await container.getAttribute('data-role')) ||
                (await container.getAttribute('data-sender')) ||
                '';

              const isUser = /user|human|question/i.test(classes) || /user|human/i.test(role);
              const isAI =
                /ai|assistant|model|response|answer/i.test(classes) ||
                /assistant|model/i.test(role);

              if (isUser) {
                messages.push({ role: 'user', content: text.trim() });
              } else if (isAI) {
                messages.push({ role: 'assistant', content: text.trim() });
              }
            }

            if (messages.length > 0) {
              break;
            }
          }
        } catch {
          continue;
        }
      }

      // Fallback: Try to extract user and AI messages separately
      if (messages.length === 0) {
        log.info(`  🔍 Trying fallback: separate user/AI message extraction...`);

        // Extract user messages
        for (const selector of userMessageSelectors) {
          try {
            const userMsgs = await this.page.locator(selector).all();
            for (const msg of userMsgs) {
              if (await msg.isVisible()) {
                const text = await msg.textContent();
                if (text && text.trim().length > 0) {
                  messages.push({ role: 'user', content: text.trim() });
                }
              }
            }
            if (messages.length > 0) break;
          } catch {
            continue;
          }
        }

        // Extract AI messages
        for (const selector of aiMessageSelectors) {
          try {
            const aiMsgs = await this.page.locator(selector).all();
            for (const msg of aiMsgs) {
              if (await msg.isVisible()) {
                const text = await msg.textContent();
                if (text && text.trim().length > 0) {
                  // Check if we already have this message (to avoid duplicates)
                  const exists = messages.some((m) => m.content === text.trim());
                  if (!exists) {
                    messages.push({ role: 'assistant', content: text.trim() });
                  }
                }
              }
            }
            if (messages.filter((m) => m.role === 'assistant').length > 0) break;
          } catch {
            continue;
          }
        }
      }

      // Last resort: Use snapshotAllResponses utility for AI responses
      if (messages.filter((m) => m.role === 'assistant').length === 0) {
        log.info(`  🔍 Using snapshotAllResponses for AI messages...`);
        const aiResponses = await snapshotAllResponses(this.page);
        for (const response of aiResponses) {
          if (response && response.trim().length > 0) {
            messages.push({ role: 'assistant', content: response.trim() });
          }
        }
      }

      log.info(
        `  📊 Total extracted: ${messages.filter((m) => m.role === 'user').length} user, ${messages.filter((m) => m.role === 'assistant').length} AI messages`
      );
    } catch (error) {
      log.warning(`  ⚠️ Error extracting chat messages: ${error}`);
    }

    return messages;
  }

  /**
   * Format extracted chat messages as a note
   *
   * @param messages Array of chat messages
   * @param title Note title
   * @returns Formatted note content
   */
  private formatChatAsNote(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    title: string
  ): string {
    const lines: string[] = [];

    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`*Saved from NotebookLM chat on ${new Date().toLocaleString()}*`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const msg of messages) {
      if (msg.role === 'user') {
        lines.push(`**User:**`);
        lines.push(msg.content);
        lines.push('');
      } else {
        lines.push(`**NotebookLM:**`);
        lines.push(msg.content);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`*${messages.length} messages total*`);

    return lines.join('\n');
  }

  // ============================================================================
  // Note to Source Conversion
  // ============================================================================

  /**
   * Convert a note to a source document in NotebookLM
   *
   * This feature allows users to convert an existing note into a source,
   * making the note content available for RAG queries. The method:
   * 1. Finds the note by title or ID in the Studio panel
   * 2. Attempts to use NotebookLM's native "Convert to source" feature if available
   * 3. Falls back to extracting note content and creating a text source if not
   *
   * @param input Note identification (title or ID)
   * @returns NoteToSourceResult with source information
   */
  async convertNoteToSource(input: NoteToSourceInput): Promise<NoteToSourceResult> {
    const { noteTitle, noteId } = input;

    log.info(`📄 Converting note to source: "${noteTitle || noteId}"`);

    try {
      // Step 1: Navigate to Studio panel where notes are located
      await this.navigateToStudio();
      await randomDelay(500, 1000);

      // Step 2: Find the note in the Studio panel
      const noteElement = await this.findNoteElement(noteTitle, noteId);

      if (!noteElement) {
        return {
          success: false,
          error: `Note not found: "${noteTitle || noteId}"`,
        };
      }

      log.info(`  ✅ Found note: "${noteTitle || noteId}"`);

      // Step 3: Click on the note to select it
      await noteElement.click();
      await randomDelay(300, 500);

      // Step 4: Try to find and use native "Convert to source" or "Add to sources" option
      const nativeConversionSuccess = await this.tryNativeNoteToSourceConversion(noteElement);

      if (nativeConversionSuccess) {
        log.success(`  ✅ Note converted to source using native feature`);
        return {
          success: true,
          sourceName: noteTitle || noteId,
        };
      }

      // Step 5: Fallback - Extract note content and create a text source
      log.info(
        `  ℹ️ Native conversion not available, using fallback (extract + add as text source)`
      );

      const noteContent = await this.extractNoteContent(noteElement, noteTitle);

      if (!noteContent) {
        return {
          success: false,
          error: 'Could not extract note content for conversion',
        };
      }

      // Create a text source with the note content
      const sourceTitle = `[Note] ${noteTitle || 'Converted Note'}`;
      const sourceResult = await this.addSource({
        type: 'text',
        text: noteContent,
        title: sourceTitle,
      });

      if (sourceResult.success) {
        log.success(`  ✅ Note converted to source: "${sourceTitle}"`);
        return {
          success: true,
          sourceId: sourceResult.sourceId,
          sourceName: sourceResult.sourceName || sourceTitle,
        };
      } else {
        return {
          success: false,
          error: sourceResult.error || 'Failed to create source from note content',
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`  ❌ Note to source conversion failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Find a note element in the Studio panel by title or ID
   */
  private async findNoteElement(
    noteTitle?: string,
    noteId?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<import('patchright').ElementHandle<any> | null> {
    // Selectors for note items in the Studio panel
    const noteItemSelectors = [
      '.note-item',
      '[data-item="note"]',
      '.notes-list-item',
      '[class*="note-list"] > div',
      '[class*="note-list"] > li',
      '[class*="Note"] > div',
      '[class*="notes"] > div',
      'mat-list-item:has([class*="note"])',
      '.mat-list-item:has([class*="note"])',
      '[role="listitem"]:has([class*="note"])',
      // Studio panel specific
      '[class*="studio"] [class*="card"]',
      '[class*="Studio"] [class*="card"]',
    ];

    for (const selector of noteItemSelectors) {
      try {
        const elements = await this.page.$$(selector);

        for (const el of elements) {
          // Check by data-id attribute
          if (noteId) {
            const dataId = await el.getAttribute('data-id');
            if (dataId === noteId) {
              return el;
            }
            const dataNote = await el.getAttribute('data-note-id');
            if (dataNote === noteId) {
              return el;
            }
          }

          // Check by title text content
          if (noteTitle) {
            const textContent = await el.textContent();
            if (textContent && textContent.toLowerCase().includes(noteTitle.toLowerCase())) {
              return el;
            }

            // Also check specific title elements
            try {
              const titleText = await el.$eval(
                '.note-title, .title, [class*="title"], [class*="name"], h3, h4',
                (e) => e.textContent?.trim() || ''
              );
              if (titleText.toLowerCase().includes(noteTitle.toLowerCase())) {
                return el;
              }
            } catch {
              // Element doesn't have a title child
            }
          }
        }
      } catch {
        continue;
      }
    }

    // Fallback: look for any card or item with matching text
    try {
      const searchText = noteTitle || noteId || '';
      const fallbackSelectors = [
        `[class*="note"]:has-text("${searchText.substring(0, 30)}")`,
        `[class*="card"]:has-text("${searchText.substring(0, 30)}")`,
        `:has-text("${searchText.substring(0, 30)}")`,
      ];

      for (const selector of fallbackSelectors) {
        try {
          const el = await this.page.$(selector);
          if (el) {
            return el;
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Ignore fallback errors
    }

    return null;
  }

  /**
   * Try to use NotebookLM's native "Convert to source" or "Add to sources" feature
   */
  private async tryNativeNoteToSourceConversion(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    noteElement: import('patchright').ElementHandle<any>
  ): Promise<boolean> {
    // First, try to find a menu button on the note
    const menuOpened = await this.openNoteMenu(noteElement);

    if (menuOpened) {
      // Look for "Convert to source", "Add to sources", or similar options
      const convertSelectors = [
        // English patterns
        'button:has-text("Convert to source")',
        'button:has-text("Add to sources")',
        'button:has-text("Make source")',
        'button:has-text("Save as source")',
        '[role="menuitem"]:has-text("Convert to source")',
        '[role="menuitem"]:has-text("Add to sources")',
        '[role="menuitem"]:has-text("source")',
        'mat-menu-item:has-text("source")',
        // French patterns
        'button:has-text("Convertir en source")',
        'button:has-text("Ajouter aux sources")',
        '[role="menuitem"]:has-text("source")',
        // Icon patterns
        'button:has(mat-icon:has-text("add_to_drive"))',
        'button:has(mat-icon:has-text("file_copy"))',
        '[role="menuitem"]:has(mat-icon:has-text("add"))',
      ];

      for (const selector of convertSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 500 })) {
            log.info(`  ✅ Found native convert option: ${selector}`);
            await btn.click();
            await randomDelay(1000, 2000);

            // Wait for potential confirmation or processing
            await this.waitForSourceProcessing('Note');
            return true;
          }
        } catch {
          continue;
        }
      }

      // Close menu if convert option wasn't found
      await this.page.keyboard.press('Escape');
      await randomDelay(200, 400);
    }

    // Also check for a direct "Convert" or "Add to sources" button on the note itself
    const directButtonSelectors = [
      'button:has-text("Convert")',
      'button:has-text("Add to sources")',
      'button[aria-label*="source" i]',
      'button[aria-label*="convert" i]',
    ];

    for (const selector of directButtonSelectors) {
      try {
        const btn = await noteElement.$(selector);
        if (btn && (await btn.isVisible())) {
          log.info(`  ✅ Found direct convert button on note: ${selector}`);
          await btn.click();
          await randomDelay(1000, 2000);
          await this.waitForSourceProcessing('Note');
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Open the menu for a note element
   */
  private async openNoteMenu(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    noteElement: import('patchright').ElementHandle<any>
  ): Promise<boolean> {
    const menuButtonSelectors = [
      // Material Design 3-dot menu button
      'button:has(mat-icon:has-text("more_vert"))',
      'button:has(mat-icon:has-text("more_horiz"))',
      'button[aria-label*="menu" i]',
      'button[aria-label*="options" i]',
      'button[aria-label*="actions" i]',
      'button[aria-label*="More" i]',
      'button[aria-label*="Plus" i]',
      '.mat-mdc-icon-button:has(mat-icon)',
      '[class*="menu-button"]',
      '[class*="more-button"]',
      '[data-action="menu"]',
      // Generic icon buttons
      'button.mat-icon-button',
      'button.mdc-icon-button',
    ];

    // First, try to find the menu button within the note element
    for (const selector of menuButtonSelectors) {
      try {
        const menuBtn = await noteElement.$(selector);
        if (menuBtn) {
          const isVisible = await menuBtn.isVisible();
          if (isVisible) {
            log.info(`  ✅ Found note menu button: ${selector}`);
            await menuBtn.click();
            await randomDelay(300, 500);
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    // Hover over the note to reveal hidden menu button
    log.info(`  🔍 Hovering to reveal note menu button...`);
    await noteElement.hover();
    await randomDelay(500, 800);

    // Try again after hover
    for (const selector of menuButtonSelectors) {
      try {
        const menuBtn = await noteElement.$(selector);
        if (menuBtn) {
          const isVisible = await menuBtn.isVisible();
          if (isVisible) {
            log.info(`  ✅ Found note menu button after hover: ${selector}`);
            await menuBtn.click();
            await randomDelay(300, 500);
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    // Try right-click as last resort
    try {
      await noteElement.click({ button: 'right' });
      await randomDelay(300, 500);
      // Check if a context menu appeared
      const contextMenu = await this.page.$('[role="menu"], .mat-menu-panel, .mdc-menu');
      if (contextMenu) {
        log.info(`  ✅ Opened context menu via right-click`);
        return true;
      }
    } catch {
      // Ignore right-click errors
    }

    return false;
  }

  /**
   * Extract the content of a note for fallback conversion
   */
  private async extractNoteContent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    noteElement: import('patchright').ElementHandle<any>,
    noteTitle?: string
  ): Promise<string | null> {
    try {
      // Method 1: Click the note to open it and extract content
      await noteElement.click();
      await randomDelay(500, 1000);

      // Look for expanded note content
      const contentSelectors = [
        // Note body/content areas
        '.note-content',
        '.note-body',
        '[class*="note-content"]',
        '[class*="noteContent"]',
        '[class*="note-body"]',
        // Expanded card content
        '[class*="expanded"] [class*="content"]',
        '[class*="detail"] [class*="content"]',
        // Text areas in note view
        '.note-text',
        '[class*="text-content"]',
        // ProseMirror or other rich text editors
        '.ProseMirror',
        '[contenteditable="true"]',
        // Generic content areas
        'article',
        '.content',
        '[role="article"]',
      ];

      for (const selector of contentSelectors) {
        try {
          const contentEl = await this.page.$(selector);
          if (contentEl && (await contentEl.isVisible())) {
            const content = await contentEl.textContent();
            if (content && content.trim().length > 10) {
              log.info(`  ✅ Extracted note content from: ${selector}`);
              // Format the content with the note title
              const formattedContent = noteTitle
                ? `# ${noteTitle}\n\n${content.trim()}`
                : content.trim();
              return formattedContent;
            }
          }
        } catch {
          continue;
        }
      }

      // Method 2: Try to extract from the note element itself
      const elementContent = await noteElement.textContent();
      if (elementContent && elementContent.trim().length > 20) {
        log.info(`  ✅ Extracted note content from element`);
        const formattedContent = noteTitle
          ? `# ${noteTitle}\n\n${elementContent.trim()}`
          : elementContent.trim();
        return formattedContent;
      }

      // Method 3: Look for inner HTML content
      try {
        const innerContent = await noteElement.$eval(
          'div, p, span',
          (el) => el.textContent?.trim() || ''
        );
        if (innerContent && innerContent.length > 20) {
          log.info(`  ✅ Extracted note content from inner elements`);
          const formattedContent = noteTitle ? `# ${noteTitle}\n\n${innerContent}` : innerContent;
          return formattedContent;
        }
      } catch {
        // Ignore extraction errors
      }

      log.warning(`  ⚠️ Could not extract note content`);
      return null;
    } catch (error) {
      log.warning(`  ⚠️ Error extracting note content: ${error}`);
      return null;
    }
  }
}
