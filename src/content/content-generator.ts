/**
 * Generic Content Generator
 *
 * Provides a unified approach for generating all content types in NotebookLM Studio.
 * This class reuses existing patterns from ContentManager and stealth utilities
 * to interact with the NotebookLM UI reliably.
 *
 * Key features:
 * - Generic content generation flow that works for all content types
 * - Button discovery with multiple fallback selectors
 * - Chat-based fallback when Studio buttons are not available
 * - Streaming-aware response waiting
 *
 * This is the foundation for Phase 1 content types:
 * - audio_overview, video, infographic, report, presentation, data_table
 */

import type { Page } from 'patchright';
import { randomDelay, realisticClick, humanType } from '../utils/stealth-utils.js';
import { waitForLatestAnswer, snapshotAllResponses, isErrorMessage } from '../utils/page-utils.js';
import { log } from '../utils/logger.js';
import type { ContentType, ContentGenerationInput, ContentGenerationResult } from './types.js';
import {
  type ContentTypeConfig,
  getContentConfig,
  buildChatPrompt,
  getFormatFromInput,
} from './content-templates.js';

/**
 * Result of finding a button in the UI
 */
interface ButtonFindResult {
  found: boolean;
  selector?: string;
}

/**
 * Result of waiting for content generation
 */
interface ContentWaitResult {
  source: 'studio' | 'chat';
  content?: string;
  ready: boolean;
  error?: string;
}

/**
 * Generic Content Generator for NotebookLM Studio
 *
 * This class provides a unified content generation flow that:
 * 1. Navigates to the Studio panel
 * 2. Checks if content already exists
 * 3. Finds and clicks the generation button
 * 4. Falls back to chat-based generation if needed
 * 5. Waits for content completion with streaming detection
 */
export class ContentGenerator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Generate content of any supported type
   *
   * @param input Content generation input with type and options
   * @returns Content generation result
   */
  async generate(input: ContentGenerationInput): Promise<ContentGenerationResult> {
    const config = getContentConfig(input.type);

    if (!config) {
      return {
        success: false,
        contentType: input.type,
        error: `Unsupported content type: ${input.type}`,
      };
    }

    log.info(`Generating ${config.displayName}...`);

    try {
      // Step 1: Navigate to Studio panel
      await this.navigateToStudio();
      await this.page.waitForTimeout(1000);

      // Step 2: Check if content already exists
      const exists = await this.checkContentExists(config);
      if (exists) {
        log.info(`  ${config.displayName} already exists`);
        return {
          success: true,
          contentType: input.type,
          status: 'ready',
        };
      }

      // Step 3: Try to find and click the generation button
      const buttonResult = await this.findButton(config.buttonSelectors);

      if (buttonResult.found && buttonResult.selector) {
        log.info(`  Found ${config.displayName} button: ${buttonResult.selector}`);

        // Click the button to start generation
        await realisticClick(this.page, buttonResult.selector, true);
        log.info(`  Clicked ${config.displayName} button`);

        // Step 3.5: Handle format selection if this content type has format options
        const formatSelected = await this.selectFormat(input, config);
        if (formatSelected) {
          log.info(`  Format selected successfully`);
        }

        // Step 3.6: Handle language selection if specified
        const languageSelected = await this.selectLanguage(input, config);
        if (languageSelected) {
          log.info(`  Language selected successfully`);
        }

        // Step 3.7: Handle style selection for video content
        const styleSelected = await this.selectStyle(input, config);
        if (styleSelected) {
          log.info(`  Style selected successfully`);
        }

        log.info(`  Started ${config.displayName} generation via Studio button`);

        // Wait for generation to complete
        const waitResult = await this.waitForContentGeneration(input.type, config);

        if (waitResult.ready) {
          log.success(`  ${config.displayName} generated successfully via Studio`);
          return {
            success: true,
            contentType: input.type,
            status: 'ready',
            textContent: waitResult.content,
          };
        } else if (waitResult.error) {
          log.error(`  ${config.displayName} generation failed: ${waitResult.error}`);
          return {
            success: false,
            contentType: input.type,
            status: 'failed',
            error: waitResult.error,
          };
        }
      }

      // Step 4: Fallback to chat-based generation
      log.info(`  No Studio button found, trying chat-based approach...`);
      return await this.generateViaChatFallback(input, config);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Content generation failed: ${errorMsg}`);
      return {
        success: false,
        contentType: input.type,
        error: errorMsg,
      };
    }
  }

  // ============================================================================
  // Navigation Methods (reused from ContentManager patterns)
  // ============================================================================

  /**
   * Navigate to the Studio panel in NotebookLM
   * Uses the same approach as ContentManager.navigateToStudio()
   */
  async navigateToStudio(): Promise<void> {
    // Updated selectors based on current NotebookLM UI (Dec 2024)
    // The tabs are: Sources | Discussion | Studio
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
            log.info(`  Clicked Studio tab`);
          } else {
            log.info(`  Studio tab already active`);
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
        log.info(`  Studio tab accessed via tab list`);
        return;
      }
    } catch {
      // Continue to fallback
    }

    log.warning(`  Could not find Studio tab, content generation may fail`);
  }

  /**
   * Navigate to the Discussion panel (chat)
   * Uses the same approach as ContentManager.navigateToDiscussion()
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
            log.info(`  Clicked Discussion tab`);
          } else {
            log.info(`  Discussion tab already active`);
          }
          return;
        }
      } catch {
        continue;
      }
    }

    // Discussion might already be active or accessible
    log.info(`  Discussion panel should be accessible`);
  }

  // ============================================================================
  // Button Discovery
  // ============================================================================

  /**
   * Find a button using multiple selectors
   * Tries each selector in order and returns the first visible match
   *
   * @param selectors Array of CSS selectors to try
   * @returns Result with found status and matching selector
   */
  async findButton(selectors: string[]): Promise<ButtonFindResult> {
    for (const selector of selectors) {
      try {
        const button = this.page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          return { found: true, selector };
        }
      } catch {
        continue;
      }
    }

    return { found: false };
  }

  // ============================================================================
  // Format Selection
  // ============================================================================

  /**
   * Select format option after clicking the main content button
   * Looks for format selection UI (buttons, dropdowns, options) and clicks the appropriate one
   *
   * @param input Content generation input with format options
   * @param config Content type configuration
   * @returns True if a format was selected, false if no format UI found
   */
  private async selectFormat(
    input: ContentGenerationInput,
    config: ContentTypeConfig
  ): Promise<boolean> {
    // Check if this content type has format options
    if (!config.formatSelectors) {
      return false;
    }

    // Get the format value from input
    const format = getFormatFromInput(input);
    const effectiveFormat = format || config.defaultFormat;

    if (!effectiveFormat) {
      log.info(`  No format specified and no default, skipping format selection`);
      return false;
    }

    // Get selectors for this format
    const formatConfig = config.formatSelectors[effectiveFormat];
    if (!formatConfig) {
      log.warning(`  Unknown format '${effectiveFormat}' for ${config.displayName}`);
      return false;
    }

    log.info(`  Looking for ${formatConfig.displayName} format option...`);

    // Wait a moment for the format selection UI to appear after clicking main button
    await randomDelay(500, 1000);

    // Try to find and click the format button
    const formatButtonResult = await this.findButton(formatConfig.selectors);

    if (formatButtonResult.found && formatButtonResult.selector) {
      log.info(`  Found ${formatConfig.displayName} format button: ${formatButtonResult.selector}`);
      await realisticClick(this.page, formatButtonResult.selector, true);
      await randomDelay(300, 600);
      log.info(`  Selected ${formatConfig.displayName} format`);
      return true;
    }

    // Format button not found - this is normal if UI doesn't have format selection
    log.info(`  No format selection UI found, proceeding with default`);
    return false;
  }

  // ============================================================================
  // Style Selection (Video)
  // ============================================================================

  /**
   * Select video style option after clicking the main content button
   * Looks for style selection UI (buttons, dropdowns, options) and clicks the appropriate one
   *
   * @param input Content generation input with style options
   * @param config Content type configuration
   * @returns True if a style was selected, false if no style UI found
   */
  private async selectStyle(
    input: ContentGenerationInput,
    config: ContentTypeConfig
  ): Promise<boolean> {
    // Check if this content type has style options (only video)
    if (!config.styleSelectors || input.type !== 'video') {
      return false;
    }

    // Get the style value from input or use default
    const style = input.videoStyle || config.defaultStyle;
    if (!style) {
      log.info(`  No style specified and no default, skipping style selection`);
      return false;
    }

    // Get selectors for this style
    const styleConfig = config.styleSelectors[style];
    if (!styleConfig) {
      log.warning(`  Unknown style '${style}' for ${config.displayName}`);
      return false;
    }

    log.info(`  Looking for ${styleConfig.displayName} style option...`);

    // Wait a moment for the style selection UI to appear
    await randomDelay(300, 600);

    // Try to find and click the style button
    const styleButtonResult = await this.findButton(styleConfig.selectors);

    if (styleButtonResult.found && styleButtonResult.selector) {
      log.info(`  Found ${styleConfig.displayName} style button: ${styleButtonResult.selector}`);
      await realisticClick(this.page, styleButtonResult.selector, true);
      await randomDelay(300, 600);
      log.info(`  Selected ${styleConfig.displayName} style`);
      return true;
    }

    // Style button not found - this is normal if UI doesn't have style selection
    log.info(`  No style selection UI found, proceeding with default`);
    return false;
  }

  // ============================================================================
  // Language Selection
  // ============================================================================

  /**
   * Select language option for content generation
   * Opens the language dropdown and selects the specified language
   *
   * @param input Content generation input with language option
   * @param config Content type configuration
   * @returns True if a language was selected, false if no language UI found
   */
  private async selectLanguage(
    input: ContentGenerationInput,
    config: ContentTypeConfig
  ): Promise<boolean> {
    // Check if this content type has language options and a language is specified
    if (!config.languageSelectors || !input.language) {
      return false;
    }

    log.info(`  Looking for language selector (${input.language})...`);

    // Try to open the language dropdown
    const dropdownResult = await this.findButton(config.languageSelectors.dropdownTrigger);
    if (!dropdownResult.found || !dropdownResult.selector) {
      log.info(`  No language dropdown found, proceeding with default`);
      return false;
    }

    // Click to open dropdown
    await realisticClick(this.page, dropdownResult.selector, true);
    await randomDelay(500, 800);

    // Build language-specific selectors by replacing {language} placeholder
    const languageSelectors = config.languageSelectors.optionPattern.map((s) =>
      s.replace('{language}', input.language!)
    );

    // Try to find and click the language option
    const languageResult = await this.findButton(languageSelectors);
    if (languageResult.found && languageResult.selector) {
      await realisticClick(this.page, languageResult.selector, true);
      await randomDelay(300, 600);
      log.info(`  Selected language: ${input.language}`);
      return true;
    }

    // Language option not found - close dropdown by pressing Escape
    log.info(`  Language '${input.language}' not found in dropdown`);
    await this.page.keyboard.press('Escape');
    return false;
  }

  // ============================================================================
  // Content Existence Check
  // ============================================================================

  /**
   * Check if content of the specified type already exists
   *
   * @param config Content type configuration
   * @returns True if content exists
   */
  private async checkContentExists(config: ContentTypeConfig): Promise<boolean> {
    for (const selector of config.existsSelectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 500 })) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  // ============================================================================
  // Content Generation Waiting
  // ============================================================================

  /**
   * Wait for content generation to complete
   * Monitors the UI for completion indicators or errors
   *
   * @param type Content type being generated
   * @param config Content type configuration
   * @returns Wait result with status and optional content
   */
  async waitForContentGeneration(
    _type: ContentType,
    config: ContentTypeConfig
  ): Promise<ContentWaitResult> {
    log.info(
      `  Waiting for ${config.displayName} generation (up to ${config.waitTimeout / 60000} minutes)...`
    );

    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < config.waitTimeout) {
      // Check for errors
      const errorEl = await this.page.$('.error-message, [role="alert"]:has-text("error")');
      if (errorEl) {
        const errorText = await errorEl.textContent();
        return {
          source: 'studio',
          ready: false,
          error: errorText || `${config.displayName} generation failed`,
        };
      }

      // Check if content now exists
      const exists = await this.checkContentExists(config);
      if (exists) {
        return {
          source: 'studio',
          ready: true,
        };
      }

      // Check for progress indicators
      const progressEl = await this.page.$('[role="progressbar"], .progress-bar, .loading');
      if (progressEl) {
        const progress = await progressEl.getAttribute('aria-valuenow');
        if (progress) {
          log.info(`  Generation progress: ${progress}%`);
        }
      }

      await this.page.waitForTimeout(pollInterval);
    }

    return {
      source: 'studio',
      ready: false,
      error: `Timeout waiting for ${config.displayName} generation after ${config.waitTimeout / 1000}s`,
    };
  }

  // ============================================================================
  // Chat-Based Fallback
  // ============================================================================

  /**
   * Generate content using chat-based fallback when Studio button is not available
   *
   * @param input Content generation input
   * @param config Content type configuration
   * @returns Content generation result
   */
  private async generateViaChatFallback(
    input: ContentGenerationInput,
    config: ContentTypeConfig
  ): Promise<ContentGenerationResult> {
    try {
      // Navigate to Discussion panel
      await this.navigateToDiscussion();

      // Build the prompt with format and custom instructions
      // Pass the full input so format options are included in the prompt
      const prompt = buildChatPrompt(config, input);

      // Send the chat message
      await this.sendChatMessage(prompt);

      // Wait for response using the proven page-utils approach
      const result = await this.waitForChatResponse(config);

      if (result.ready && result.content) {
        log.success(`  ${config.displayName} generated via chat fallback`);
        return {
          success: true,
          contentType: input.type,
          status: 'ready',
          textContent: result.content,
        };
      }

      return {
        success: false,
        contentType: input.type,
        status: 'failed',
        error: result.error || `Failed to generate ${config.displayName} via chat`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        contentType: input.type,
        error: `Chat fallback failed: ${errorMsg}`,
      };
    }
  }

  /**
   * Send a message in the chat interface
   * Uses the same approach as ContentManager.sendChatMessage()
   *
   * @param message Message to send
   */
  private async sendChatMessage(message: string): Promise<void> {
    log.info(`  Sending chat message: "${message.substring(0, 50)}..."`);

    // Find the chat input (same approach as BrowserSession.findChatInput)
    const chatInputSelectors = [
      'textarea.query-box-input', // PRIMARY - same as Python implementation
      'textarea[aria-label*="query"]',
      'textarea[aria-label*="Zone de requete"]',
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
          log.info(`  Found chat input: ${selector}`);
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

    // Type the message with human-like behavior
    log.info(`  Typing message with human-like behavior...`);
    await humanType(this.page, inputSelector, message, {
      withTypos: false, // No typos for prompts to avoid confusion
      wpm: 150, // Faster typing for long prompts
    });

    // Small pause before submitting
    await randomDelay(500, 1000);

    // Submit with Enter key
    log.info(`  Submitting message...`);
    await this.page.keyboard.press('Enter');

    // Small pause after submit
    await randomDelay(1000, 1500);

    log.info(`  Message sent`);
  }

  /**
   * Wait for chat response with streaming detection
   * Uses the proven waitForLatestAnswer from page-utils
   *
   * @param config Content type configuration
   * @returns Wait result with content
   */
  private async waitForChatResponse(config: ContentTypeConfig): Promise<ContentWaitResult> {
    log.info(
      `  Waiting for ${config.displayName} response (up to ${config.waitTimeout / 60000} minutes)...`
    );

    // Scroll to bottom to ensure we see all messages
    await this.scrollChatToBottom();

    // Snapshot existing chat responses to ignore them
    const existingResponses = await snapshotAllResponses(this.page);
    log.info(`  Ignoring ${existingResponses.length} existing chat responses`);

    // Use the proven logic from page-utils
    const response = await waitForLatestAnswer(this.page, {
      question: '', // Empty question since we already sent the message
      timeoutMs: config.waitTimeout,
      pollIntervalMs: 2000, // Poll every 2 seconds
      ignoreTexts: existingResponses,
      debug: true, // Enable debug to see what's happening
    });

    // Check if response is an error message from NotebookLM
    if (response && isErrorMessage(response)) {
      log.error(`  NotebookLM returned an error: "${response}"`);
      return {
        source: 'chat',
        ready: false,
        error: `NotebookLM error: ${response}`,
      };
    }

    if (response && response.length > 50) {
      log.success(`  Content received (${response.length} chars)`);
      return {
        source: 'chat',
        ready: true,
        content: response,
      };
    }

    return {
      source: 'chat',
      ready: false,
      error: `Timeout waiting for ${config.displayName} response`,
    };
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
          log.debug(`  Scrolled chat to bottom using ${selector}`);
          return;
        }
      }

      // Fallback: scroll the whole page
      await this.page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
      log.debug(`  Scrolled page to bottom (fallback)`);
    } catch (error) {
      log.debug(`  Could not scroll: ${error}`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ContentGenerator instance for a page
 *
 * @param page Playwright page instance
 * @returns ContentGenerator instance
 */
export function createContentGenerator(page: Page): ContentGenerator {
  return new ContentGenerator(page);
}

// Note: CONTENT_CONFIGS, getContentConfig, buildChatPrompt, getFormatFromInput
// are exported from content-templates.ts and re-exported via index.ts
