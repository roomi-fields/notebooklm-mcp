/**
 * Configuration for NotebookLM MCP Server
 *
 * Config Priority (highest to lowest):
 * 1. Hardcoded Defaults (works out of the box!)
 * 2. Environment Variables (optional, for advanced users)
 * 3. Tool Parameters (passed by Claude at runtime)
 *
 * No config.json file needed - all settings via ENV or tool parameters!
 */

import envPaths from 'env-paths';
import { resolveContentLanguage, contentLanguageHint } from './utils/content-language.js';
import fs from 'fs';
import path from 'path';

// Cross-platform data paths (unified without -nodejs suffix)
// Linux: ~/.local/share/notebooklm-mcp/
// macOS: ~/Library/Application Support/notebooklm-mcp/
// Windows: %APPDATA%\notebooklm-mcp\
// IMPORTANT: Pass empty string suffix to disable envPaths' default '-nodejs' suffix!
const paths = envPaths('notebooklm-mcp', { suffix: '' });

/**
 * Google NotebookLM Auth URL (used by setup_auth)
 * This is the base Google login URL that redirects to NotebookLM
 */
export const NOTEBOOKLM_AUTH_URL =
  'https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fnotebooklm.google.com%2F&flowName=GlifWebSignIn&flowEntry=ServiceLogin';

export interface Config {
  // NotebookLM - optional, used for legacy default notebook
  notebookUrl: string;

  // Browser Settings
  headless: boolean;
  browserTimeout: number;
  viewport: { width: number; height: number };

  // Session Management
  maxSessions: number;
  sessionTimeout: number; // in seconds

  // Authentication
  autoLoginEnabled: boolean;
  loginEmail: string;
  loginPassword: string;
  autoLoginTimeoutMs: number;

  // Stealth Settings
  stealthEnabled: boolean;
  stealthRandomDelays: boolean;
  stealthHumanTyping: boolean;
  stealthMouseMovements: boolean;
  typingWpmMin: number;
  typingWpmMax: number;
  minDelayMs: number;
  maxDelayMs: number;

  // Paths
  configDir: string;
  dataDir: string;
  browserStateDir: string;
  chromeProfileDir: string;
  chromeInstancesDir: string;

  // Library Configuration (optional, for default notebook metadata)
  notebookDescription: string;
  notebookTopics: string[];
  notebookContentTypes: string[];
  notebookUseCases: string[];

  // Multi-instance profile strategy
  profileStrategy: 'auto' | 'single' | 'isolated';
  cloneProfileOnIsolated: boolean;
  cleanupInstancesOnStartup: boolean;
  cleanupInstancesOnShutdown: boolean;
  instanceProfileTtlHours: number;
  instanceProfileMaxCount: number;

  /**
   * Interface language the browser fallback is driven in.
   *
   * Limited to the four locales whose text selectors are translated. This is
   * about *reading* NotebookLM's UI — it must never decide what language a
   * generated artifact comes out in; that is `contentLanguage` (issue #34).
   */
  uiLocale: 'fr' | 'en' | 'de' | 'ja';

  /**
   * Default output language for generated content, as a BCP-47 code.
   * Overridden per call by the `language` argument. See utils/content-language.
   */
  contentLanguage: string;

  // Browser channel: 'chromium' (default, Docker compatible) or 'chrome' (local install)
  browserChannel: 'chromium' | 'chrome';
}

/**
 * Browser context locale + timezone for each supported UI locale.
 * Used to align the Playwright context with the forced NotebookLM UI language
 * (see withUiLocale / hl=). Keep the key set in sync with Config['uiLocale'].
 */
export const LOCALE_BROWSER_SETTINGS: Record<
  Config['uiLocale'],
  { locale: string; timezone: string }
> = {
  fr: { locale: 'fr-FR', timezone: 'Europe/Paris' },
  en: { locale: 'en-US', timezone: 'America/New_York' },
  de: { locale: 'de-DE', timezone: 'Europe/Berlin' },
  ja: { locale: 'ja-JP', timezone: 'Asia/Tokyo' },
};

/**
 * Default Configuration (works out of the box!)
 */
const DEFAULTS: Config = {
  // NotebookLM
  notebookUrl: '',

  // Browser Settings
  headless: true,
  browserTimeout: 600000, // 10 minutes (NotebookLM can be slow)
  // Wide enough for NotebookLM's desktop layout. At 1024px it switches to the
  // narrow layout (Sources / Chat / Studio tabs) where the "Add source" button
  // is hidden behind a tab and the header "+" is "Create notebook".
  viewport: { width: 1440, height: 900 },

  // Session Management
  maxSessions: 10,
  sessionTimeout: 900, // 15 minutes

  // Authentication
  autoLoginEnabled: false,
  loginEmail: '',
  loginPassword: '',
  autoLoginTimeoutMs: 120000, // 2 minutes

  // Stealth Settings
  stealthEnabled: true,
  stealthRandomDelays: true,
  stealthHumanTyping: true,
  stealthMouseMovements: true,
  typingWpmMin: 160,
  typingWpmMax: 240,
  minDelayMs: 100,
  maxDelayMs: 400,

  // Paths (cross-platform via env-paths)
  configDir: paths.config,
  dataDir: paths.data,
  browserStateDir: path.join(paths.data, 'browser_state'),
  chromeProfileDir: path.join(paths.data, 'chrome_profile'),
  chromeInstancesDir: path.join(paths.data, 'chrome_profile_instances'),

  // Library Configuration
  notebookDescription: 'General knowledge base',
  notebookTopics: ['General topics'],
  notebookContentTypes: ['documentation', 'examples'],
  notebookUseCases: ['General research'],

  // Multi-instance strategy
  profileStrategy: 'auto',
  cloneProfileOnIsolated: false,
  cleanupInstancesOnStartup: true,
  cleanupInstancesOnShutdown: true,
  instanceProfileTtlHours: 72,
  instanceProfileMaxCount: 20,

  // Interface language for the browser fallback. English is the default because
  // it is the one every account can render and the one most reports arrive in;
  // it used to be French, on the mistaken grounds that French was "the most
  // common Google Account language", and that default silently produced French
  // audio and French mind maps for Spanish notebooks (issue #34).
  uiLocale: 'en',

  // Output language for generated content. Independent of uiLocale by design.
  contentLanguage: 'en',

  // Browser channel: 'chromium' works in Docker, 'chrome' for local with Google Chrome installed
  browserChannel: 'chromium',
};

/**
 * Parse boolean from string (for env vars)
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  return defaultValue;
}

/**
 * Parse integer from string (for env vars)
 */
function parseInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse comma-separated array (for env vars)
 */
function parseArray(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse profile strategy from string (for env vars)
 */
function parseProfileStrategy(
  value: string | undefined,
  defaultValue: Config['profileStrategy']
): Config['profileStrategy'] {
  if (!value) return defaultValue;
  const lower = value.toLowerCase();
  if (lower === 'auto' || lower === 'single' || lower === 'isolated') {
    return lower;
  }
  return defaultValue;
}

/**
 * Parse UI locale from string (for env vars)
 */
function parseLocale(
  value: string | undefined,
  defaultValue: Config['uiLocale']
): Config['uiLocale'] {
  if (!value) return defaultValue;
  const lower = value.toLowerCase();
  if (lower === 'fr' || lower === 'en' || lower === 'de' || lower === 'ja') {
    return lower;
  }
  // Say so. Discarding this in silence cost a user a long debugging session
  // (issue #34): they set NOTEBOOKLM_UI_LOCALE=es, got 'fr' back with no word
  // about it, and had no way to tell the setting had been ignored.
  console.error(
    `[notebooklm-mcp] NOTEBOOKLM_UI_LOCALE="${value}" is not a supported interface ` +
      `language (fr, en, de, ja) — falling back to "${defaultValue}". ` +
      `This only affects the language NotebookLM's UI is driven in; to choose the ` +
      `language of generated content use the tool's "language" argument or ` +
      `NOTEBOOKLM_CONTENT_LANGUAGE.`
  );
  return defaultValue;
}

/**
 * Parse the default output language for generated content (for env vars).
 *
 * Accepts a BCP-47 code or a language name; an unrecognised value is reported
 * rather than dropped, for the same reason parseLocale reports one.
 */
function parseContentLanguage(value: string | undefined, defaultValue: string): string {
  if (!value) return defaultValue;
  const resolved = resolveContentLanguage(value);
  if (resolved) return resolved;
  console.error(
    `[notebooklm-mcp] NOTEBOOKLM_CONTENT_LANGUAGE="${value}" was not recognised — ` +
      `falling back to "${defaultValue}". ${contentLanguageHint()}.`
  );
  return defaultValue;
}

/**
 * Apply environment variable overrides (legacy support)
 */
function applyEnvOverrides(config: Config): Config {
  // Support custom DATA_DIR for multiple instances
  // IMPORTANT: trim() to remove trailing spaces from Windows env vars
  const customDataDir = process.env.DATA_DIR?.trim();
  const dataDir = customDataDir || config.dataDir;

  return {
    ...config,
    // Data paths (recalculate if DATA_DIR is set)
    dataDir,
    browserStateDir: path.join(dataDir, 'browser_state'),
    chromeProfileDir: path.join(dataDir, 'chrome_profile'),
    chromeInstancesDir: path.join(dataDir, 'chrome_profile_instances'),
    // Override with env vars if present
    notebookUrl: process.env.NOTEBOOK_URL || config.notebookUrl,
    headless: parseBoolean(process.env.HEADLESS, config.headless),
    browserTimeout: parseInteger(process.env.BROWSER_TIMEOUT, config.browserTimeout),
    maxSessions: parseInteger(process.env.MAX_SESSIONS, config.maxSessions),
    sessionTimeout: parseInteger(process.env.SESSION_TIMEOUT, config.sessionTimeout),
    autoLoginEnabled: parseBoolean(process.env.AUTO_LOGIN_ENABLED, config.autoLoginEnabled),
    loginEmail: process.env.LOGIN_EMAIL || config.loginEmail,
    loginPassword: process.env.LOGIN_PASSWORD || config.loginPassword,
    autoLoginTimeoutMs: parseInteger(process.env.AUTO_LOGIN_TIMEOUT_MS, config.autoLoginTimeoutMs),
    stealthEnabled: parseBoolean(process.env.STEALTH_ENABLED, config.stealthEnabled),
    stealthRandomDelays: parseBoolean(
      process.env.STEALTH_RANDOM_DELAYS,
      config.stealthRandomDelays
    ),
    stealthHumanTyping: parseBoolean(process.env.STEALTH_HUMAN_TYPING, config.stealthHumanTyping),
    stealthMouseMovements: parseBoolean(
      process.env.STEALTH_MOUSE_MOVEMENTS,
      config.stealthMouseMovements
    ),
    typingWpmMin: parseInteger(process.env.TYPING_WPM_MIN, config.typingWpmMin),
    typingWpmMax: parseInteger(process.env.TYPING_WPM_MAX, config.typingWpmMax),
    minDelayMs: parseInteger(process.env.MIN_DELAY_MS, config.minDelayMs),
    maxDelayMs: parseInteger(process.env.MAX_DELAY_MS, config.maxDelayMs),
    notebookDescription: process.env.NOTEBOOK_DESCRIPTION || config.notebookDescription,
    notebookTopics: parseArray(process.env.NOTEBOOK_TOPICS, config.notebookTopics),
    notebookContentTypes: parseArray(
      process.env.NOTEBOOK_CONTENT_TYPES,
      config.notebookContentTypes
    ),
    notebookUseCases: parseArray(process.env.NOTEBOOK_USE_CASES, config.notebookUseCases),
    profileStrategy: parseProfileStrategy(
      process.env.NOTEBOOK_PROFILE_STRATEGY,
      config.profileStrategy
    ),
    cloneProfileOnIsolated: parseBoolean(
      process.env.NOTEBOOK_CLONE_PROFILE,
      config.cloneProfileOnIsolated
    ),
    cleanupInstancesOnStartup: parseBoolean(
      process.env.NOTEBOOK_CLEANUP_ON_STARTUP,
      config.cleanupInstancesOnStartup
    ),
    cleanupInstancesOnShutdown: parseBoolean(
      process.env.NOTEBOOK_CLEANUP_ON_SHUTDOWN,
      config.cleanupInstancesOnShutdown
    ),
    instanceProfileTtlHours: parseInteger(
      process.env.NOTEBOOK_INSTANCE_TTL_HOURS,
      config.instanceProfileTtlHours
    ),
    instanceProfileMaxCount: parseInteger(
      process.env.NOTEBOOK_INSTANCE_MAX_COUNT,
      config.instanceProfileMaxCount
    ),
    uiLocale: parseLocale(process.env.NOTEBOOKLM_UI_LOCALE, config.uiLocale),
    contentLanguage: parseContentLanguage(
      process.env.NOTEBOOKLM_CONTENT_LANGUAGE,
      config.contentLanguage
    ),
    browserChannel: parseBrowserChannel(process.env.BROWSER_CHANNEL, config.browserChannel),
  };
}

/**
 * Parse browser channel from string (chromium or chrome)
 */
function parseBrowserChannel(
  value: string | undefined,
  defaultValue: Config['browserChannel']
): Config['browserChannel'] {
  if (!value) return defaultValue;
  const lower = value.toLowerCase();
  if (lower === 'chrome') return 'chrome';
  return 'chromium'; // Default to chromium (Docker compatible)
}

/**
 * Build final configuration
 * Priority: Defaults → Environment Variables → Tool Parameters (at runtime)
 * No config.json files - everything via ENV or tool parameters!
 */
function buildConfig(): Config {
  return applyEnvOverrides(DEFAULTS);
}

/**
 * Global configuration instance
 */
export const CONFIG: Config = buildConfig();

/**
 * Ensure all required directories exist
 * NOTE: We do NOT create configDir - it's not needed!
 */
export function ensureDirectories(): void {
  const dirs = [
    CONFIG.dataDir,
    CONFIG.browserStateDir,
    CONFIG.chromeProfileDir,
    CONFIG.chromeInstancesDir,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Browser options that can be passed via tool parameters
 */
export interface BrowserOptions {
  show?: boolean;
  headless?: boolean;
  timeout_ms?: number;
  stealth?: {
    enabled?: boolean;
    random_delays?: boolean;
    human_typing?: boolean;
    mouse_movements?: boolean;
    typing_wpm_min?: number;
    typing_wpm_max?: number;
    delay_min_ms?: number;
    delay_max_ms?: number;
  };
  viewport?: {
    width?: number;
    height?: number;
  };
}

/**
 * Apply browser options to CONFIG (returns modified copy, doesn't mutate global CONFIG)
 */
export function applyBrowserOptions(options?: BrowserOptions, legacyShowBrowser?: boolean): Config {
  const config = { ...CONFIG };

  // Handle legacy show_browser parameter
  if (legacyShowBrowser !== undefined) {
    config.headless = !legacyShowBrowser;
  }

  // Apply browser_options (takes precedence over legacy parameter)
  if (options) {
    if (options.show !== undefined) {
      config.headless = !options.show;
    }
    if (options.headless !== undefined) {
      config.headless = options.headless;
    }
    if (options.timeout_ms !== undefined) {
      config.browserTimeout = options.timeout_ms;
    }
    if (options.stealth) {
      const s = options.stealth;
      if (s.enabled !== undefined) config.stealthEnabled = s.enabled;
      if (s.random_delays !== undefined) config.stealthRandomDelays = s.random_delays;
      if (s.human_typing !== undefined) config.stealthHumanTyping = s.human_typing;
      if (s.mouse_movements !== undefined) config.stealthMouseMovements = s.mouse_movements;
      if (s.typing_wpm_min !== undefined) config.typingWpmMin = s.typing_wpm_min;
      if (s.typing_wpm_max !== undefined) config.typingWpmMax = s.typing_wpm_max;
      if (s.delay_min_ms !== undefined) config.minDelayMs = s.delay_min_ms;
      if (s.delay_max_ms !== undefined) config.maxDelayMs = s.delay_max_ms;
    }
    if (options.viewport) {
      config.viewport = {
        width: options.viewport.width ?? config.viewport.width,
        height: options.viewport.height ?? config.viewport.height,
      };
    }
  }

  return config;
}

// Create directories on import
ensureDirectories();
