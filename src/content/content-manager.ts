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

import type { Page } from 'patchright';
import path from 'path';
import { existsSync } from 'fs';
import { randomDelay, realisticClick, humanType } from '../utils/stealth-utils.js';
import { log } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { waitForLatestAnswer, snapshotAllResponses, isErrorMessage } from '../utils/page-utils.js';
import type {
  SourceUploadInput,
  SourceUploadResult,
  ContentType,
  ContentGenerationInput,
  ContentGenerationResult,
  NotebookSource,
  GeneratedContent,
  NotebookContentOverview,
  ContentDownloadResult,
  AudioGenerationOptions,
} from './types.js';

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

    try {
      // Click "Add source" button
      await this.clickAddSource();

      // Wait for upload dialog
      await this.waitForUploadDialog();

      // Select upload type and upload
      switch (input.type) {
        case 'file':
          return await this.uploadFile(input);
        case 'url':
          return await this.uploadUrl(input);
        case 'text':
          return await this.uploadText(input);
        case 'google_drive':
          return await this.uploadGoogleDrive(input);
        case 'youtube':
          return await this.uploadYouTube(input);
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

    const addSourceSelectors = [
      // Material Design FAB button patterns
      'button[aria-label*="Add source"]',
      'button[aria-label*="Add"]',
      'button[aria-label*="Upload"]',
      'button[aria-label*="Ajouter"]',
      // Text-based patterns
      'button:has-text("Add source")',
      'button:has-text("Add sources")',
      'button:has-text("Ajouter")',
      // Icon button patterns (plus icon)
      'button:has(mat-icon:has-text("add"))',
      'button:has(mat-icon:has-text("upload"))',
      'button:has(svg[data-icon="plus"])',
      '[role="button"]:has-text("+")',
      // Material design specific
      '.mat-fab',
      '.mat-mini-fab',
      'button.mdc-fab',
      // Generic patterns
      '.add-source-button',
      '[data-testid*="add-source"]',
      '[data-test*="add-source"]',
      // NotebookLM specific panel header button
      '.sources-header button',
      '.source-list-header button',
      'header button:has(mat-icon)',
    ];

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

    // Debug: log page content to help identify the correct selector
    await this.debugPageContent();

    throw new Error('Could not find "Add source" button');
  }

  /**
   * Ensure we're on the Sources panel
   */
  private async ensureSourcesPanel(): Promise<void> {
    const sourcesTabSelectors = [
      'button[aria-label*="Sources"]',
      '[role="tab"]:has-text("Sources")',
      '.mat-tab-label:has-text("Sources")',
      'a:has-text("Sources")',
    ];

    for (const selector of sourcesTabSelectors) {
      try {
        const tab = this.page.locator(selector).first();
        if (await tab.isVisible({ timeout: 1000 })) {
          const isSelected = await tab.getAttribute('aria-selected');
          if (isSelected !== 'true') {
            log.info(`  📑 Clicking Sources tab: ${selector}`);
            await tab.click();
            await randomDelay(500, 1000);
          }
          return;
        }
      } catch {
        continue;
      }
    }
    // Sources panel might already be visible or not use tabs
    log.info(`  ℹ️ No Sources tab found, assuming already on sources panel`);
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
  private async uploadFile(input: SourceUploadInput): Promise<SourceUploadResult> {
    if (!input.filePath) {
      return { success: false, error: 'File path is required' };
    }

    // Path traversal protection: resolve and validate the path
    const resolvedPath = path.resolve(input.filePath);
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
      // Click on file upload option
      const fileTypeSelectors = [
        'button:has-text("Upload files")',
        'button:has-text("Importer des fichiers")',
        'button:has-text("Upload")',
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
        input.title || path.basename(input.filePath)
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
  private async uploadUrl(input: SourceUploadInput): Promise<SourceUploadResult> {
    if (!input.url) {
      return { success: false, error: 'URL is required' };
    }

    log.info(`  🌐 Adding URL: ${input.url}`);

    try {
      // Click on URL/Website option
      const urlTypeSelectors = [
        'button:has-text("Website")',
        'button:has-text("Site web")',
        'button:has-text("Link")',
        'button:has-text("URL")',
        'button:has-text("Web")',
        '[data-type="url"]',
        '[aria-label*="website"]',
        '[aria-label*="URL"]',
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
      }

      // Wait for input to appear after clicking option
      await randomDelay(500, 1000);

      // Find URL input (can be input OR textarea)
      log.info(`  🔍 Looking for URL input...`);
      const urlInputSelectors = [
        // French placeholders - input AND textarea
        'input[placeholder*="Collez"]',
        'textarea[placeholder*="Collez"]',
        'input[placeholder*="liens"]',
        'textarea[placeholder*="liens"]',
        // English placeholders
        'input[placeholder*="URL"]',
        'textarea[placeholder*="URL"]',
        'input[placeholder*="url"]',
        'textarea[placeholder*="url"]',
        'input[placeholder*="http"]',
        'textarea[placeholder*="http"]',
        'input[placeholder*="Paste"]',
        'textarea[placeholder*="Paste"]',
        'input[placeholder*="Enter"]',
        'textarea[placeholder*="Enter"]',
        'input[placeholder*="Coller"]',
        'textarea[placeholder*="Coller"]',
        'input[placeholder*="link"]',
        'textarea[placeholder*="link"]',
        'input[placeholder*="Link"]',
        'textarea[placeholder*="Link"]',
        'input[name="url"]',
        'input[type="url"]',
        '[role="dialog"] input[type="text"]',
        '[role="dialog"] input:not([type="hidden"])',
        '[role="dialog"] textarea',
        '.mat-dialog-content input',
        '.mat-dialog-content textarea',
        '.mdc-dialog__content input',
        '.mdc-dialog__content textarea',
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

      // Fallback: find any visible input or textarea in the dialog
      if (!urlInput) {
        log.info(`  🔍 Trying fallback: any visible input/textarea in dialog...`);
        try {
          // Try inputs first
          const allInputs = await this.page.locator('[role="dialog"] input').all();
          for (const input of allInputs) {
            if (await input.isVisible()) {
              urlInput = input;
              const placeholder = await input.getAttribute('placeholder');
              log.info(`  ✅ Found input via fallback: placeholder="${placeholder}"`);
              break;
            }
          }
          // Try textareas if no input found
          if (!urlInput) {
            const allTextareas = await this.page.locator('[role="dialog"] textarea').all();
            for (const textarea of allTextareas) {
              if (await textarea.isVisible()) {
                urlInput = textarea;
                const placeholder = await textarea.getAttribute('placeholder');
                log.info(`  ✅ Found textarea via fallback: placeholder="${placeholder}"`);
                break;
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Debug: list all inputs/textareas if still not found
      if (!urlInput) {
        log.warning(`  ⚠️ URL input not found, listing dialog elements...`);
        try {
          const inputs = await this.page
            .locator('[role="dialog"] input, [role="dialog"] textarea')
            .all();
          for (let i = 0; i < inputs.length; i++) {
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
          log.warning(`  ⚠️ Could not list dialog elements: ${e}`);
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
      const result = await this.waitForSourceProcessing(input.title || input.url);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `URL upload failed: ${errorMsg}` };
    }
  }

  /**
   * Upload text content
   */
  private async uploadText(input: SourceUploadInput): Promise<SourceUploadResult> {
    if (!input.text) {
      return { success: false, error: 'Text content is required' };
    }

    log.info(`  📝 Adding text content (${input.text.length} chars)`);

    try {
      // Click on paste text option
      const textTypeSelectors = [
        'button:has-text("Copied text")',
        'button:has-text("Paste text")',
        'button:has-text("Coller du texte")',
        'button:has-text("Text")',
        '[data-type="text"]',
        '[aria-label*="text"]',
      ];

      log.info(`  🔍 Looking for paste text option...`);
      let foundTextOption = false;
      for (const selector of textTypeSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 500 })) {
            log.info(`  ✅ Found text option: ${selector}`);
            await btn.click();
            await randomDelay(300, 500);
            foundTextOption = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!foundTextOption) {
        log.info(`  ℹ️ No text option found, assuming direct text input`);
      }

      // Find text input
      log.info(`  🔍 Looking for text input...`);
      const textInput = await this.page.waitForSelector('textarea', {
        state: 'visible',
        timeout: 5000,
      });

      if (!textInput) {
        throw new Error('Text input not found');
      }

      await textInput.fill(input.text);
      log.info(`  ✅ Text entered`);

      // Set title if provided
      log.info(`  🔍 Looking for title input...`);
      if (input.title) {
        const titleSelectors = [
          'input[placeholder*="title"]',
          'input[placeholder*="Title"]',
          'input[placeholder*="name"]',
          'input[placeholder*="Name"]',
          'input[name="title"]',
          'input[type="text"]:not([readonly])',
        ];

        for (const selector of titleSelectors) {
          try {
            const titleInput = this.page.locator(selector).first();
            if (await titleInput.isVisible({ timeout: 500 })) {
              await titleInput.fill(input.title);
              log.info(`  ✅ Title set: ${input.title}`);
              break;
            }
          } catch {
            continue;
          }
        }
      }

      await randomDelay(300, 500);

      // Click add button
      log.info(`  🔍 Looking for upload button...`);
      await this.clickUploadButton();

      // Wait for processing
      const result = await this.waitForSourceProcessing(input.title || 'Pasted text');

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Text upload failed: ${errorMsg}` };
    }
  }

  /**
   * Upload from Google Drive
   */
  private async uploadGoogleDrive(input: SourceUploadInput): Promise<SourceUploadResult> {
    if (!input.url) {
      return { success: false, error: 'Google Drive URL is required' };
    }

    log.info(`  📂 Adding Google Drive source: ${input.url}`);

    // Similar to URL upload but with Google Drive specific handling
    return await this.uploadUrl({ ...input, type: 'url' });
  }

  /**
   * Upload YouTube video
   */
  private async uploadYouTube(input: SourceUploadInput): Promise<SourceUploadResult> {
    if (!input.url) {
      return { success: false, error: 'YouTube URL is required' };
    }

    log.info(`  🎬 Adding YouTube video: ${input.url}`);

    try {
      // Click on YouTube option
      const ytSelectors = ['button:has-text("YouTube")', '[data-type="youtube"]'];

      for (const selector of ytSelectors) {
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

      const result = await this.waitForSourceProcessing(input.title || 'YouTube video');

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
      // Primary action buttons (most likely)
      'button.mdc-button--raised:has-text("Insert")',
      'button.mat-flat-button:has-text("Insert")',
      'button[color="primary"]:has-text("Insert")',
      // Generic text patterns
      'button:has-text("Insert")',
      'button:has-text("Insérer")',
      'button:has-text("Add")',
      'button:has-text("Ajouter")',
      'button:has-text("Upload")',
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

    // Debug: list all buttons in dialog
    log.warning(`  ⚠️ No upload button found, listing dialog buttons...`);
    try {
      const dialogButtons = await this.page.locator('[role="dialog"] button').all();
      for (let i = 0; i < Math.min(dialogButtons.length, 5); i++) {
        const text = await dialogButtons[i].textContent();
        log.info(`  🔍 Dialog button[${i}]: "${text?.trim()}"`);
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
   */
  private async waitForSourceProcessing(sourceName: string): Promise<SourceUploadResult> {
    log.info(`  ⏳ Waiting for source processing: ${sourceName}`);

    const timeout = 90000; // 1.5 minutes (sources can take time)
    const startTime = Date.now();

    // First, wait a bit for the dialog to close (indicates upload started)
    await randomDelay(2000, 3000);

    while (Date.now() - startTime < timeout) {
      // Check for errors in the dialog or page
      const errorSelectors = [
        '.error-message',
        '[role="alert"]:has-text("error")',
        '[role="alert"]:has-text("Error")',
        '.mdc-snackbar--error',
        '[class*="error"]',
      ];

      for (const errorSelector of errorSelectors) {
        try {
          const errorEl = this.page.locator(errorSelector).first();
          if (await errorEl.isVisible({ timeout: 500 })) {
            const errorText = await errorEl.textContent();
            return { success: false, error: errorText || 'Upload failed', status: 'failed' };
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
        await randomDelay(1000, 2000);

        // Check for source in the sources panel
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

        for (const selector of sourceListSelectors) {
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

        // If dialog closed but we can't find the source, assume success
        // (NotebookLM might still be processing in the background)
        log.info(`  ℹ️ Dialog closed, assuming source upload successful`);
        return { success: true, sourceName, status: 'processing' };
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
   * Generate content (audio overview only)
   *
   * NOTE: Only audio_overview is supported as it uses real Studio UI buttons.
   * Other content types (briefing_doc, study_guide, faq, timeline, table_of_contents)
   * were removed because they only sent chat prompts instead of clicking actual
   * NotebookLM Studio buttons - making them "fake" implementations.
   */
  async generateContent(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    log.info(`🎨 Generating content: ${input.type}`);

    try {
      if (input.type === 'audio_overview') {
        return await this.generateAudioOverview(input);
      }

      // Only audio_overview is supported
      return {
        success: false,
        contentType: input.type,
        error: `Unsupported content type: ${input.type}. Only 'audio_overview' is supported.`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`❌ Content generation failed: ${errorMsg}`);
      return { success: false, contentType: input.type, error: errorMsg };
    }
  }

  /**
   * Generate Audio Overview (podcast)
   *
   * NOTE (Dec 2024): NotebookLM UI has changed significantly.
   * Audio generation now works via chat requests or may require specific UI interaction.
   * This method attempts both approaches.
   */
  async generateAudioOverview(
    input: ContentGenerationInput,
    options?: AudioGenerationOptions
  ): Promise<ContentGenerationResult> {
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
            if (options?.customInstructions || input.customInstructions) {
              const instructions = options?.customInstructions || input.customInstructions;
              await this.addCustomInstructions(instructions!);
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

      if (options?.customInstructions || input.customInstructions) {
        prompt += `\n\nCustom instructions: ${options?.customInstructions || input.customInstructions}`;
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

    // Discussion might already be active or accessible
    log.info(`  ℹ️ Discussion panel should be accessible`);
  }

  /**
   * Navigate to Studio panel
   */
  private async navigateToStudio(): Promise<void> {
    // Updated selectors based on current NotebookLM UI (Dec 2024)
    // The tabs are: Sources | Discussion | Studio
    // Tab class: mdc-tab mat-mdc-tab mat-focus-indicator
    const studioSelectors = [
      'div.mdc-tab:has-text("Studio")', // Material Design tab with text
      '.mat-mdc-tab:has-text("Studio")', // Angular Material tab
      '[role="tab"]:has-text("Studio")', // Tab role with Studio text
      'div.mdc-tab >> text=Studio', // Playwright text selector
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

  /**
   * List all sources in the notebook
   */
  async listSources(): Promise<NotebookSource[]> {
    const sources: NotebookSource[] = [];

    try {
      const sourceElements = await this.page.$$(
        '.source-item, [data-item="source"], .sources-list-item'
      );

      for (const el of sourceElements) {
        try {
          const name = await el.$eval(
            '.source-name, .title',
            (e) => e.textContent?.trim() || 'Unknown'
          );
          const id = (await el.getAttribute('data-id')) || `source-${sources.length}`;

          sources.push({
            id,
            name,
            type: 'document',
            status: 'ready',
          });
        } catch {
          continue;
        }
      }
    } catch (error) {
      log.warning(`  ⚠️ Could not list sources: ${error}`);
    }

    return sources;
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
   * Download audio content
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

      // Find download button
      const downloadSelectors = [
        // Material Design icon buttons
        'button:has(mat-icon:has-text("download"))',
        'button:has(mat-icon:has-text("file_download"))',
        'button:has(mat-icon:has-text("get_app"))',
        // Aria labels
        'button[aria-label*="Download"]',
        'button[aria-label*="Télécharger"]',
        'button[aria-label*="download"]',
        // Text patterns
        'button:has-text("Download")',
        'button:has-text("Télécharger")',
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

}
