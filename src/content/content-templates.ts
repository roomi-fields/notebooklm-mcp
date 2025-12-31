/**
 * Content Templates Configuration
 *
 * Defines configuration for each content type in NotebookLM Studio:
 * - Button selectors to find the generation trigger
 * - Format selection selectors for sub-format options
 * - Exists selectors to detect if content already exists
 * - Chat prompt templates for fallback generation
 * - Wait timeouts for generation completion
 *
 * These configurations enable the generic ContentGenerator to handle
 * all content types uniformly while respecting their specific UI patterns.
 */

import type { ContentType, ContentGenerationInput, VideoStyle } from './types.js';

/**
 * Format selector configuration for content types with sub-formats
 */
export interface FormatSelectorConfig {
  /** Button/option selectors for this format */
  selectors: string[];
  /** Display name for logging */
  displayName: string;
}

/**
 * Style selector configuration for video visual styles
 */
export interface StyleSelectorConfig {
  /** Button/option selectors for this style */
  selectors: string[];
  /** Display name for logging */
  displayName: string;
}

/**
 * Configuration for a content type
 */
export interface ContentTypeConfig {
  /** Content type identifier */
  type: ContentType;

  /** Display name for logging */
  displayName: string;

  /**
   * CSS selectors to find the generation button in Studio
   * Ordered by priority (most specific first)
   */
  buttonSelectors: string[];

  /**
   * Format selection button selectors (keyed by format value)
   * Used after clicking main button to select format variant
   */
  formatSelectors?: Record<string, FormatSelectorConfig>;

  /**
   * Default format if none specified
   */
  defaultFormat?: string;

  /**
   * Style selection button selectors (keyed by style value)
   * Used for video visual styles (Nano Banana AI styles)
   */
  styleSelectors?: Record<string, StyleSelectorConfig>;

  /**
   * Default style if none specified (for video)
   */
  defaultStyle?: string;

  /**
   * Length selection button selectors (keyed by length value)
   * Used for presentation length options (short, default)
   */
  lengthSelectors?: Record<string, FormatSelectorConfig>;

  /**
   * Default length if none specified (for presentation)
   */
  defaultLength?: string;

  /**
   * Language selection selectors
   * Used to find and interact with the language dropdown/selector
   */
  languageSelectors?: {
    /** Selectors to open the language dropdown */
    dropdownTrigger: string[];
    /** Selectors for language options (use {language} placeholder) */
    optionPattern: string[];
  };

  /**
   * CSS selectors to detect if this content type already exists
   * Used to skip generation if content is already available
   */
  existsSelectors: string[];

  /**
   * Chat prompt template for fallback generation
   * Used when Studio button is not found
   * Supports {customInstructions}, {formatInstruction}, {languageInstruction}, and {styleInstruction} placeholders
   */
  chatPromptTemplate: string;

  /**
   * Format-specific prompt instructions
   * Keyed by format value, replaces {formatInstruction} placeholder
   */
  formatPrompts?: Record<string, string>;

  /**
   * Style-specific prompt instructions (for video)
   * Keyed by style value, replaces {styleInstruction} placeholder
   */
  stylePrompts?: Record<string, string>;

  /**
   * Maximum time to wait for content generation (in milliseconds)
   * Varies by content type (audio/video take longer)
   */
  waitTimeout: number;

  /**
   * Whether this content type produces downloadable media
   * (audio, video) vs text-based content (report, etc.)
   */
  isMedia: boolean;

  /**
   * Expected MIME type for downloadable content
   */
  mimeType?: string;

  /**
   * Whether this content type supports custom instructions/prompts
   * Most types do, but report and mindmap do not
   */
  supportsCustomInstructions: boolean;
}

/**
 * Common language selector configuration
 * Used across all content types that support language selection
 * NotebookLM supports 80+ languages for content generation
 */
export const COMMON_LANGUAGE_SELECTORS = {
  dropdownTrigger: [
    // Language dropdown triggers
    'button:has-text("Language")',
    'button:has-text("Select language")',
    '[aria-label*="language" i]',
    '[aria-label*="Language"]',
    'button:has(mat-icon:has-text("translate"))',
    'button:has(mat-icon:has-text("language"))',
    '[class*="language-selector"]',
    '[class*="language-dropdown"]',
    'mat-select[aria-label*="language" i]',
    // Material Design selects
    '.mat-mdc-select:has-text("Language")',
    '.mdc-select:has-text("Language")',
  ],
  optionPattern: [
    // Pattern with {language} placeholder
    '[role="option"]:has-text("{language}")',
    '[role="menuitem"]:has-text("{language}")',
    'mat-option:has-text("{language}")',
    '.mdc-list-item:has-text("{language}")',
    '[class*="option"]:has-text("{language}")',
    'li:has-text("{language}")',
  ],
};

/**
 * Video style selectors for Nano Banana AI visual styles
 */
export const VIDEO_STYLE_SELECTORS: Record<VideoStyle, StyleSelectorConfig> = {
  classroom: {
    selectors: [
      'button:has-text("Classroom")',
      'button:has-text("classroom")',
      '[role="option"]:has-text("Classroom")',
      '[role="menuitem"]:has-text("Classroom")',
      '[class*="style"]:has-text("Classroom")',
      'mat-option:has-text("Classroom")',
    ],
    displayName: 'Classroom',
  },
  documentary: {
    selectors: [
      'button:has-text("Documentary")',
      'button:has-text("documentary")',
      '[role="option"]:has-text("Documentary")',
      '[role="menuitem"]:has-text("Documentary")',
      '[class*="style"]:has-text("Documentary")',
      'mat-option:has-text("Documentary")',
    ],
    displayName: 'Documentary',
  },
  animated: {
    selectors: [
      'button:has-text("Animated")',
      'button:has-text("animated")',
      '[role="option"]:has-text("Animated")',
      '[role="menuitem"]:has-text("Animated")',
      '[class*="style"]:has-text("Animated")',
      'mat-option:has-text("Animated")',
    ],
    displayName: 'Animated',
  },
  corporate: {
    selectors: [
      'button:has-text("Corporate")',
      'button:has-text("corporate")',
      'button:has-text("Business")',
      '[role="option"]:has-text("Corporate")',
      '[role="menuitem"]:has-text("Corporate")',
      '[class*="style"]:has-text("Corporate")',
      'mat-option:has-text("Corporate")',
    ],
    displayName: 'Corporate',
  },
  cinematic: {
    selectors: [
      'button:has-text("Cinematic")',
      'button:has-text("cinematic")',
      '[role="option"]:has-text("Cinematic")',
      '[role="menuitem"]:has-text("Cinematic")',
      '[class*="style"]:has-text("Cinematic")',
      'mat-option:has-text("Cinematic")',
    ],
    displayName: 'Cinematic',
  },
  minimalist: {
    selectors: [
      'button:has-text("Minimalist")',
      'button:has-text("minimalist")',
      'button:has-text("Simple")',
      '[role="option"]:has-text("Minimalist")',
      '[role="menuitem"]:has-text("Minimalist")',
      '[class*="style"]:has-text("Minimalist")',
      'mat-option:has-text("Minimalist")',
    ],
    displayName: 'Minimalist',
  },
};

/**
 * Content type configurations for all Phase 1 content types
 *
 * Button selectors are based on NotebookLM Studio UI patterns:
 * - Material Design buttons with text
 * - Aria-label patterns for accessibility
 * - Icon-based buttons with mat-icon
 */
export const CONTENT_CONFIGS: Record<ContentType, ContentTypeConfig> = {
  // ============================================================================
  // Audio Overview (existing, proven implementation)
  // ============================================================================
  audio_overview: {
    type: 'audio_overview',
    displayName: 'Audio Overview',
    buttonSelectors: [
      // Primary patterns
      'button:has-text("Audio")',
      'button:has-text("Generate audio")',
      'button:has-text("Deep Dive")',
      // Localized patterns
      'button:has-text("Audio Overview")',
      'button:has-text("Podcast")',
      // Aria patterns
      'button[aria-label*="audio" i]',
      'button[aria-label*="Audio"]',
      // Icon-based patterns
      'button:has(mat-icon:has-text("mic"))',
      'button:has(mat-icon:has-text("podcast"))',
      'button:has(mat-icon:has-text("headphones"))',
      // Card/section patterns
      '[class*="audio"] button',
      '.audio-overview button',
    ],
    languageSelectors: COMMON_LANGUAGE_SELECTORS,
    existsSelectors: [
      'audio',
      '.audio-player',
      '[class*="audio-overview"]',
      '[data-component="audio-player"]',
      '[class*="audio-card"]',
    ],
    chatPromptTemplate:
      'Create an audio overview (Deep Dive podcast) for this notebook.{languageInstruction} Generate a conversational podcast script that covers the main topics from all sources.{customInstructions}',
    waitTimeout: 600000, // 10 minutes (audio generation is slow)
    isMedia: true,
    mimeType: 'audio/wav',
    supportsCustomInstructions: true,
  },

  // ============================================================================
  // Video
  // ============================================================================
  video: {
    type: 'video',
    displayName: 'Video',
    buttonSelectors: [
      // Primary patterns
      'button:has-text("Video")',
      'button:has-text("Generate video")',
      'button:has-text("Create video")',
      // Aria patterns
      'button[aria-label*="video" i]',
      'button[aria-label*="Video"]',
      // Icon-based patterns
      'button:has(mat-icon:has-text("videocam"))',
      'button:has(mat-icon:has-text("movie"))',
      'button:has(mat-icon:has-text("play_circle"))',
      // Card/section patterns
      '[class*="video"] button',
      '.video-card button',
    ],
    formatSelectors: {
      brief: {
        selectors: [
          'button:has-text("Brief")',
          'button:has-text("brief")',
          '[role="option"]:has-text("Brief")',
          '[role="menuitem"]:has-text("Brief")',
          '.format-option:has-text("Brief")',
          '[class*="format"]:has-text("Brief")',
          'mat-option:has-text("Brief")',
        ],
        displayName: 'Brief',
      },
      explainer: {
        selectors: [
          'button:has-text("Explainer")',
          'button:has-text("explainer")',
          '[role="option"]:has-text("Explainer")',
          '[role="menuitem"]:has-text("Explainer")',
          '.format-option:has-text("Explainer")',
          '[class*="format"]:has-text("Explainer")',
          'mat-option:has-text("Explainer")',
        ],
        displayName: 'Explainer',
      },
    },
    defaultFormat: 'brief',
    styleSelectors: VIDEO_STYLE_SELECTORS,
    defaultStyle: 'animated',
    languageSelectors: COMMON_LANGUAGE_SELECTORS,
    existsSelectors: [
      'video',
      '.video-player',
      '[class*="video-overview"]',
      '[data-component="video-player"]',
      '[class*="video-card"][class*="ready"]',
    ],
    chatPromptTemplate:
      'Create a {formatInstruction} video for this notebook.{languageInstruction}{styleInstruction} {formatDescription}{customInstructions}',
    formatPrompts: {
      brief: 'BRIEF (short, 1-2 minute)',
      explainer: 'detailed EXPLAINER (comprehensive, 5-10 minute)',
    },
    stylePrompts: {
      classroom: 'Use a CLASSROOM style with educational whiteboard-style visuals.',
      documentary: 'Use a DOCUMENTARY style with news/documentary-like visuals.',
      animated: 'Use an ANIMATED style with colorful animated graphics.',
      corporate: 'Use a CORPORATE style with professional business visuals.',
      cinematic: 'Use a CINEMATIC style with film-like visual aesthetics.',
      minimalist: 'Use a MINIMALIST style with clean, simple visuals.',
    },
    waitTimeout: 600000, // 10 minutes (video generation can be slow)
    isMedia: true,
    mimeType: 'video/mp4',
    supportsCustomInstructions: true,
  },

  // ============================================================================
  // Infographic
  // ============================================================================
  infographic: {
    type: 'infographic',
    displayName: 'Infographic',
    buttonSelectors: [
      // Primary patterns
      'button:has-text("Infographic")',
      'button:has-text("Generate infographic")',
      'button:has-text("Create infographic")',
      // Aria patterns
      'button[aria-label*="infographic" i]',
      'button[aria-label*="Infographic"]',
      // Icon-based patterns
      'button:has(mat-icon:has-text("insert_chart"))',
      'button:has(mat-icon:has-text("analytics"))',
      'button:has(mat-icon:has-text("assessment"))',
      'button:has(mat-icon:has-text("bar_chart"))',
      // Card/section patterns
      '[class*="infographic"] button',
      '.infographic-card button',
    ],
    formatSelectors: {
      horizontal: {
        selectors: [
          'button:has-text("Horizontal")',
          'button:has-text("horizontal")',
          'button:has-text("Landscape")',
          '[role="option"]:has-text("Horizontal")',
          '[role="menuitem"]:has-text("Horizontal")',
          '.format-option:has-text("Horizontal")',
          '[class*="format"]:has-text("Horizontal")',
          'mat-option:has-text("Horizontal")',
        ],
        displayName: 'Horizontal',
      },
      vertical: {
        selectors: [
          'button:has-text("Vertical")',
          'button:has-text("vertical")',
          'button:has-text("Portrait")',
          '[role="option"]:has-text("Vertical")',
          '[role="menuitem"]:has-text("Vertical")',
          '.format-option:has-text("Vertical")',
          '[class*="format"]:has-text("Vertical")',
          'mat-option:has-text("Vertical")',
        ],
        displayName: 'Vertical',
      },
    },
    defaultFormat: 'horizontal',
    languageSelectors: COMMON_LANGUAGE_SELECTORS,
    existsSelectors: [
      '.infographic-viewer',
      '[class*="infographic-preview"]',
      '[class*="infographic-card"][class*="ready"]',
      'img[class*="infographic"]',
      '[data-component="infographic"]',
    ],
    chatPromptTemplate:
      'Create a {formatInstruction} infographic for this notebook.{languageInstruction} {formatDescription}{customInstructions}',
    formatPrompts: {
      horizontal: 'HORIZONTAL (landscape orientation, wide format)',
      vertical: 'VERTICAL (portrait orientation, tall format)',
    },
    waitTimeout: 300000, // 5 minutes
    isMedia: true,
    mimeType: 'image/png',
    supportsCustomInstructions: true,
  },

  // ============================================================================
  // Report (Briefing Document)
  // ============================================================================
  report: {
    type: 'report',
    displayName: 'Report',
    buttonSelectors: [
      // Primary patterns
      'button:has-text("Briefing")',
      'button:has-text("Report")',
      'button:has-text("Briefing doc")',
      'button:has-text("Briefing Document")',
      'button:has-text("Generate report")',
      // Aria patterns
      'button[aria-label*="briefing" i]',
      'button[aria-label*="report" i]',
      'button[aria-label*="Briefing"]',
      'button[aria-label*="Report"]',
      // Icon-based patterns
      'button:has(mat-icon:has-text("description"))',
      'button:has(mat-icon:has-text("article"))',
      'button:has(mat-icon:has-text("summarize"))',
      // Card/section patterns
      '[class*="briefing"] button',
      '[class*="report"] button',
      '.briefing-card button',
    ],
    formatSelectors: {
      summary: {
        selectors: [
          'button:has-text("Summary")',
          'button:has-text("summary")',
          'button:has-text("Brief")',
          '[role="option"]:has-text("Summary")',
          '[role="menuitem"]:has-text("Summary")',
          '.format-option:has-text("Summary")',
          '[class*="format"]:has-text("Summary")',
          'mat-option:has-text("Summary")',
        ],
        displayName: 'Summary',
      },
      detailed: {
        selectors: [
          'button:has-text("Detailed")',
          'button:has-text("detailed")',
          'button:has-text("Comprehensive")',
          'button:has-text("Full")',
          '[role="option"]:has-text("Detailed")',
          '[role="menuitem"]:has-text("Detailed")',
          '.format-option:has-text("Detailed")',
          '[class*="format"]:has-text("Detailed")',
          'mat-option:has-text("Detailed")',
        ],
        displayName: 'Detailed',
      },
    },
    defaultFormat: 'summary',
    languageSelectors: COMMON_LANGUAGE_SELECTORS,
    existsSelectors: [
      '.report-viewer',
      '[class*="briefing-preview"]',
      '[class*="report-card"][class*="ready"]',
      '[data-component="report"]',
      '[class*="briefing-doc"]',
    ],
    chatPromptTemplate:
      'Create a {formatInstruction} briefing document for this notebook.{languageInstruction} {formatDescription}',
    formatPrompts: {
      summary: 'SUMMARY (concise, 1-2 page executive brief)',
      detailed: 'DETAILED (comprehensive, in-depth analysis with all key findings)',
    },
    waitTimeout: 180000, // 3 minutes
    isMedia: false,
    supportsCustomInstructions: false, // Report does not support custom prompts
  },

  // ============================================================================
  // Presentation (Slides)
  // ============================================================================
  presentation: {
    type: 'presentation',
    displayName: 'Presentation',
    buttonSelectors: [
      // Primary patterns
      'button:has-text("Slides")',
      'button:has-text("Presentation")',
      'button:has-text("Generate slides")',
      'button:has-text("Create presentation")',
      'button:has-text("Diaporama")',
      // Aria patterns
      'button[aria-label*="slides" i]',
      'button[aria-label*="presentation" i]',
      'button[aria-label*="Slides"]',
      'button[aria-label*="Presentation"]',
      // Icon-based patterns
      'button:has(mat-icon:has-text("slideshow"))',
      'button:has(mat-icon:has-text("present_to_all"))',
      'button:has(mat-icon:has-text("co_present"))',
      // Card/section patterns
      '[class*="slides"] button',
      '[class*="presentation"] button',
      '.slides-card button',
    ],
    // Style: detailed_slideshow vs presenter_notes
    formatSelectors: {
      detailed_slideshow: {
        selectors: [
          'button:has-text("Detailed slideshow")',
          'button:has-text("Diaporama détaillé")',
          'button:has-text("detailed slideshow")',
          '[role="option"]:has-text("Detailed slideshow")',
          '[role="option"]:has-text("Diaporama détaillé")',
          '[role="menuitem"]:has-text("Detailed slideshow")',
          '.format-option:has-text("Detailed")',
          '[class*="format"]:has-text("Detailed slideshow")',
          'mat-option:has-text("Detailed slideshow")',
        ],
        displayName: 'Detailed Slideshow',
      },
      presenter_notes: {
        selectors: [
          'button:has-text("Presenter notes")',
          'button:has-text("Presenter slide")',
          'button:has-text("Diapositive du présentateur")',
          'button:has-text("presenter notes")',
          '[role="option"]:has-text("Presenter")',
          '[role="option"]:has-text("Diapositive du présentateur")',
          '[role="menuitem"]:has-text("Presenter")',
          '.format-option:has-text("Presenter")',
          '[class*="format"]:has-text("Presenter")',
          'mat-option:has-text("Presenter")',
        ],
        displayName: 'Presenter Notes',
      },
    },
    defaultFormat: 'detailed_slideshow',
    // Length: short vs default
    lengthSelectors: {
      short: {
        selectors: [
          'button:has-text("Short")',
          'button:has-text("Court")',
          'button:has-text("short")',
          '[role="option"]:has-text("Short")',
          '[role="option"]:has-text("Court")',
          '[role="menuitem"]:has-text("Short")',
          '.length-option:has-text("Short")',
          '[class*="length"]:has-text("Short")',
          'mat-option:has-text("Short")',
        ],
        displayName: 'Short',
      },
      default: {
        selectors: [
          'button:has-text("Default")',
          'button:has-text("Par défaut")',
          'button:has-text("Standard")',
          '[role="option"]:has-text("Default")',
          '[role="option"]:has-text("Par défaut")',
          '[role="menuitem"]:has-text("Default")',
          '.length-option:has-text("Default")',
          '[class*="length"]:has-text("Default")',
          'mat-option:has-text("Default")',
        ],
        displayName: 'Default',
      },
    },
    defaultLength: 'default',
    languageSelectors: COMMON_LANGUAGE_SELECTORS,
    existsSelectors: [
      '.presentation-viewer',
      '[class*="slides-preview"]',
      '[class*="presentation-card"][class*="ready"]',
      '[data-component="presentation"]',
      '[class*="slides-viewer"]',
    ],
    chatPromptTemplate:
      'Create a {formatInstruction} presentation for this notebook.{lengthInstruction}{languageInstruction} {formatDescription}{customInstructions}',
    formatPrompts: {
      detailed_slideshow: 'DETAILED SLIDESHOW with full visual slides',
      presenter_notes: 'PRESENTER NOTES style slides with speaker notes',
    },
    waitTimeout: 300000, // 5 minutes
    isMedia: true, // Can be exported to Google Slides/PDF
    mimeType: 'application/pdf', // Primary download format
    supportsCustomInstructions: true,
  },

  // ============================================================================
  // Data Table (exports to Google Sheets)
  // ============================================================================
  data_table: {
    type: 'data_table',
    displayName: 'Data Table',
    buttonSelectors: [
      // Primary patterns
      'button:has-text("Table")',
      'button:has-text("Data")',
      'button:has-text("Data table")',
      'button:has-text("Generate table")',
      'button:has-text("Tableau")',
      // Aria patterns
      'button[aria-label*="table" i]',
      'button[aria-label*="data" i]',
      'button[aria-label*="Table"]',
      'button[aria-label*="Data"]',
      // Icon-based patterns
      'button:has(mat-icon:has-text("table_chart"))',
      'button:has(mat-icon:has-text("grid_on"))',
      'button:has(mat-icon:has-text("view_list"))',
      // Card/section patterns
      '[class*="table"] button',
      '[class*="data-table"] button',
      '.table-card button',
    ],
    // No format selectors - data table has no sub-formats in UI
    languageSelectors: COMMON_LANGUAGE_SELECTORS,
    existsSelectors: [
      '.table-viewer',
      '[class*="data-table-preview"]',
      '[class*="table-card"][class*="ready"]',
      '[data-component="data-table"]',
      'table[class*="generated"]',
      // Google Sheets export button
      'button:has-text("Open in Sheets")',
      'button:has-text("Ouvrir dans Sheets")',
      'a[href*="docs.google.com/spreadsheets"]',
    ],
    chatPromptTemplate:
      'Create a data table for this notebook.{languageInstruction} Extract key data points, metrics, and facts into a structured table format.{customInstructions}',
    waitTimeout: 180000, // 3 minutes
    isMedia: true, // Exports to Google Sheets
    mimeType: 'application/vnd.google-apps.spreadsheet', // Google Sheets
    supportsCustomInstructions: true,
  },
};

/**
 * Get configuration for a content type
 * @param type Content type
 * @returns Configuration or undefined if not found
 */
export function getContentConfig(type: ContentType): ContentTypeConfig | undefined {
  return CONTENT_CONFIGS[type];
}

/**
 * Get all supported content types
 * @returns Array of content type identifiers
 */
export function getSupportedContentTypes(): ContentType[] {
  return Object.keys(CONTENT_CONFIGS) as ContentType[];
}

/**
 * Check if a content type is supported
 * @param type Content type to check
 * @returns True if supported
 */
export function isContentTypeSupported(type: string): type is ContentType {
  return type in CONTENT_CONFIGS;
}

/**
 * Format descriptions for each content type, providing detailed instructions
 */
const FORMAT_DESCRIPTIONS: Record<ContentType, Record<string, string>> = {
  audio_overview: {},
  video: {
    brief:
      'Generate a structured video script that provides a quick, concise summary of the main topics. Keep it focused and punchy.',
    explainer:
      'Generate a comprehensive, educational video script that thoroughly explains each topic with examples and details.',
  },
  infographic: {
    horizontal:
      'Design the infographic in landscape orientation (wide format) suitable for presentations and widescreen displays.',
    vertical:
      'Design the infographic in portrait orientation (tall format) suitable for social media, mobile viewing, and print.',
  },
  report: {
    summary:
      'Write a concise executive summary that captures the essential findings and key takeaways.',
    detailed:
      'Write a comprehensive report with thorough analysis, detailed findings, supporting evidence, and recommendations.',
  },
  presentation: {
    detailed_slideshow:
      'Create a full visual slideshow with graphics, diagrams, and formatted content on each slide.',
    presenter_notes: 'Create slides with comprehensive speaker notes for the presenter.',
  },
  data_table: {},
};

/**
 * Length descriptions for presentation
 */
const LENGTH_DESCRIPTIONS: Record<string, string> = {
  short: 'Keep the presentation concise (5-8 slides).',
  default: 'Create a standard-length presentation (10-15 slides).',
};

/**
 * Get the format/style value from ContentGenerationInput based on content type
 * @param input Content generation input
 * @returns Format value or undefined
 */
export function getFormatFromInput(input: ContentGenerationInput): string | undefined {
  switch (input.type) {
    case 'video':
      return input.videoFormat;
    case 'infographic':
      return input.infographicFormat;
    case 'report':
      return input.reportFormat;
    case 'presentation':
      return input.presentationStyle;
    case 'data_table':
      return undefined; // No format options for data table
    default:
      return undefined;
  }
}

/**
 * Get the length value from ContentGenerationInput (for presentation)
 * @param input Content generation input
 * @returns Length value or undefined
 */
export function getLengthFromInput(input: ContentGenerationInput): string | undefined {
  if (input.type === 'presentation') {
    return input.presentationLength;
  }
  return undefined;
}

/**
 * Build a chat prompt from template, format, and custom instructions
 * @param config Content type configuration
 * @param input Content generation input (contains format options)
 * @param customInstructions Optional custom instructions to include (fallback if not in input)
 * @returns Formatted prompt string
 */
export function buildChatPrompt(
  config: ContentTypeConfig,
  inputOrInstructions?: ContentGenerationInput | string,
  customInstructions?: string
): string {
  let prompt = config.chatPromptTemplate;

  // Handle both old signature (config, customInstructions) and new signature (config, input, customInstructions)
  let format: string | undefined;
  let length: string | undefined;
  let instructions: string | undefined;
  let language: string | undefined;
  let videoStyle: string | undefined;
  let input: ContentGenerationInput | undefined;

  if (typeof inputOrInstructions === 'string') {
    // Old signature: buildChatPrompt(config, customInstructions)
    instructions = inputOrInstructions;
  } else if (inputOrInstructions) {
    // New signature: buildChatPrompt(config, input, customInstructions)
    input = inputOrInstructions;
    format = getFormatFromInput(input);
    length = getLengthFromInput(input);
    instructions = customInstructions || input.customInstructions;
    language = input.language;
    videoStyle = input.videoStyle;
  }

  // Use default format if not specified
  if (!format && config.defaultFormat) {
    format = config.defaultFormat;
  }

  // Use default length if not specified
  if (!length && config.defaultLength) {
    length = config.defaultLength;
  }

  // Replace {formatInstruction} with format-specific text
  if (format && config.formatPrompts && config.formatPrompts[format]) {
    prompt = prompt.replace('{formatInstruction}', config.formatPrompts[format]);
  } else {
    // Fallback: remove placeholder if no format
    prompt = prompt.replace('{formatInstruction}', config.displayName.toLowerCase());
  }

  // Replace {formatDescription} with detailed description
  const formatDescriptions = FORMAT_DESCRIPTIONS[config.type];
  if (format && formatDescriptions && formatDescriptions[format]) {
    prompt = prompt.replace('{formatDescription}', formatDescriptions[format]);
  } else {
    prompt = prompt.replace('{formatDescription}', '');
  }

  // Replace {lengthInstruction} with length-specific text (for presentation)
  if (length && LENGTH_DESCRIPTIONS[length]) {
    prompt = prompt.replace('{lengthInstruction}', ` ${LENGTH_DESCRIPTIONS[length]}`);
  } else {
    prompt = prompt.replace('{lengthInstruction}', '');
  }

  // Replace {languageInstruction} with language-specific text
  if (language) {
    prompt = prompt.replace('{languageInstruction}', ` Generate the content in ${language}.`);
  } else {
    // Default: remove placeholder (English is assumed)
    prompt = prompt.replace('{languageInstruction}', '');
  }

  // Replace {styleInstruction} with video style-specific text
  if (videoStyle && config.stylePrompts && config.stylePrompts[videoStyle]) {
    prompt = prompt.replace('{styleInstruction}', ` ${config.stylePrompts[videoStyle]}`);
  } else if (
    config.defaultStyle &&
    config.stylePrompts &&
    config.stylePrompts[config.defaultStyle]
  ) {
    // Use default style if none specified
    prompt = prompt.replace('{styleInstruction}', ` ${config.stylePrompts[config.defaultStyle]}`);
  } else {
    prompt = prompt.replace('{styleInstruction}', '');
  }

  // Replace {customInstructions}
  if (instructions) {
    prompt = prompt.replace('{customInstructions}', `\n\nCustom instructions: ${instructions}`);
  } else {
    prompt = prompt.replace('{customInstructions}', '');
  }

  return prompt;
}
