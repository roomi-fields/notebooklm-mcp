/**
 * Content Management Types
 *
 * Type definitions for NotebookLM content operations:
 * - Document/source upload
 * - Content generation (audio, video, slides, etc.)
 * - Content retrieval and download
 */

/**
 * Supported source types for upload
 */
export type SourceType =
  | 'file' // Local file upload
  | 'url' // Web URL
  | 'text' // Plain text/paste
  | 'google_drive' // Google Drive link
  | 'youtube'; // YouTube video

/**
 * Source upload input
 */
export interface SourceUploadInput {
  /** Source type */
  type: SourceType;
  /** File path (for type='file') */
  filePath?: string;
  /** URL (for type='url', 'google_drive', 'youtube') */
  url?: string;
  /** Text content (for type='text') */
  text?: string;
  /** Optional title/name for the source */
  title?: string;
}

/**
 * Source upload result
 */
export interface SourceUploadResult {
  success: boolean;
  sourceId?: string;
  sourceName?: string;
  error?: string;
  /** Processing status */
  status?: 'processing' | 'ready' | 'failed';
}

/**
 * Content types that NotebookLM can generate
 *
 * NOTE: Only 'audio_overview' is supported as it uses real Studio UI buttons.
 * Other content types (briefing_doc, study_guide, faq, timeline, table_of_contents)
 * were removed because they only sent chat prompts instead of clicking actual
 * NotebookLM Studio buttons - making them "fake" implementations.
 */
export type ContentType = 'audio_overview'; // Audio podcast/overview (real UI interaction)

/**
 * Content generation input
 */
export interface ContentGenerationInput {
  /** Type of content to generate */
  type: ContentType;
  /** Optional custom instructions for generation */
  customInstructions?: string;
  /** Optional: specific sources to use (by ID or name) */
  sources?: string[];
  /** Language for generated content */
  language?: string;
}

/**
 * Content generation result
 */
export interface ContentGenerationResult {
  success: boolean;
  contentType: ContentType;
  /** Generated content ID */
  contentId?: string;
  /** Status of generation */
  status?: 'generating' | 'ready' | 'failed';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Error message if failed */
  error?: string;
  /** URL to access/download content */
  contentUrl?: string;
  /** Text content (for documents) */
  textContent?: string;
}

/**
 * Generated content item
 */
export interface GeneratedContent {
  id: string;
  type: ContentType;
  name: string;
  status: 'generating' | 'ready' | 'failed';
  createdAt: string;
  /** Duration in seconds (for audio/video) */
  duration?: number;
  /** Download URL */
  url?: string;
  /** Text content (for documents) */
  content?: string;
}

/**
 * Source item in notebook
 */
export interface NotebookSource {
  id: string;
  name: string;
  type: string;
  status: 'processing' | 'ready' | 'failed';
  /** Number of passages/chunks */
  passageCount?: number;
  addedAt?: string;
}

/**
 * Notebook content overview
 */
export interface NotebookContentOverview {
  sources: NotebookSource[];
  generatedContent: GeneratedContent[];
  /** Total source count */
  sourceCount: number;
  /** Has audio overview */
  hasAudioOverview: boolean;
}

/**
 * Audio generation options
 */
export interface AudioGenerationOptions {
  /** Custom focus/instructions for the audio */
  customInstructions?: string;
  /** Voices configuration (if supported) */
  voices?: {
    host1?: string;
    host2?: string;
  };
}

/**
 * Download result
 */
export interface ContentDownloadResult {
  success: boolean;
  /** Local file path where content was saved */
  filePath?: string;
  /** Content as base64 (for smaller files) */
  base64Content?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  size?: number;
  error?: string;
}
