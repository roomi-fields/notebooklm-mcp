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
 * Source delete input
 */
export interface SourceDeleteInput {
  /** Source ID to delete */
  sourceId?: string;
  /** Source name to delete (alternative to sourceId) */
  sourceName?: string;
}

/**
 * Source delete result
 */
export interface SourceDeleteResult {
  success: boolean;
  /** ID of the deleted source */
  sourceId?: string;
  /** Name of the deleted source */
  sourceName?: string;
  error?: string;
}

/**
 * Content types that NotebookLM can generate
 *
 * Phase 1 Content Types (using real NotebookLM Studio UI buttons):
 * - audio_overview: Audio podcast/overview (Deep Dive conversation)
 * - video: Video content generation
 * - infographic: Visual infographic generation
 * - report: Briefing document/report generation
 * - presentation: Slides/presentation generation
 * - data_table: Data table generation
 */
export type ContentType =
  | 'audio_overview'
  | 'video'
  | 'infographic'
  | 'report'
  | 'presentation'
  | 'data_table';

/**
 * Video format options
 */
export type VideoFormat = 'brief' | 'explainer';

/**
 * Infographic format options
 */
export type InfographicFormat = 'horizontal' | 'vertical';

/**
 * Report format options
 */
export type ReportFormat = 'summary' | 'detailed';

/**
 * Presentation style options
 * - detailed_slideshow: Full slides with visuals and content
 * - presenter_notes: Slides with speaker notes
 */
export type PresentationStyle = 'detailed_slideshow' | 'presenter_notes';

/**
 * Presentation length options
 * - short: Condensed version
 * - default: Standard length
 */
export type PresentationLength = 'short' | 'default';

/**
 * Data table export format
 * NotebookLM exports data tables to Google Sheets
 */
export type DataTableExport = 'google_sheets';

/**
 * Video visual style options (via Nano Banana AI)
 * NotebookLM video supports 6 visual styles for video generation
 */
export type VideoStyle =
  | 'classroom' // Educational, whiteboard-style
  | 'documentary' // News/documentary style
  | 'animated' // Colorful animated graphics
  | 'corporate' // Professional business style
  | 'cinematic' // Film-like visual style
  | 'minimalist'; // Clean, simple visuals

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

  // ============================================================================
  // Type-specific options
  // ============================================================================

  /** Video format: 'brief' for short summary, 'explainer' for detailed explanation */
  videoFormat?: VideoFormat;

  /** Video visual style: 'classroom', 'documentary', 'animated', 'corporate', 'cinematic', 'minimalist' */
  videoStyle?: VideoStyle;

  /** Infographic format: 'horizontal' for landscape, 'vertical' for portrait */
  infographicFormat?: InfographicFormat;

  /** Report format: 'summary' for brief, 'detailed' for comprehensive */
  reportFormat?: ReportFormat;

  /** Presentation style: 'detailed_slideshow' for full slides, 'presenter_notes' for speaker notes */
  presentationStyle?: PresentationStyle;

  /** Presentation length: 'short' for condensed, 'default' for standard */
  presentationLength?: PresentationLength;
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
  /** Google Sheets URL (for data_table export) */
  googleSheetsUrl?: string;
  /** Google Slides URL (for presentation export) */
  googleSlidesUrl?: string;
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
  /** Google Sheets URL (for data_table) */
  googleSheetsUrl?: string;
  /** Google Slides URL (for presentation) */
  googleSlidesUrl?: string;
  /** PDF download URL (for presentation) */
  pdfUrl?: string;
  error?: string;
}

// ============================================================================
// Notes Types
// ============================================================================

/**
 * Note creation input
 *
 * Notes are user-created annotations in NotebookLM's Studio panel.
 * They allow you to save research findings, summaries, or key insights
 * directly within the notebook.
 */
export interface NoteInput {
  /** Title of the note */
  title: string;
  /** Content/body of the note (supports markdown formatting) */
  content: string;
}

/**
 * Note creation result
 */
export interface NoteResult {
  success: boolean;
  /** Title of the created note */
  noteTitle?: string;
  /** ID of the created note (if available) */
  noteId?: string;
  /** Status of the note */
  status?: 'created' | 'failed';
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Save Chat to Note Types
// ============================================================================

/**
 * Input for saving chat/discussion to a note
 */
export interface SaveChatToNoteInput {
  /** Custom title for the note (default: "Chat Summary") */
  title?: string;
}

/**
 * Result of saving chat to note
 */
export interface SaveChatToNoteResult {
  success: boolean;
  /** Title of the created note */
  noteTitle: string;
  /** Status of the operation */
  status: 'created' | 'failed';
  /** Number of messages extracted from chat */
  messageCount?: number;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Note to Source Conversion Types
// ============================================================================

/**
 * Input for converting a note to a source
 *
 * This feature allows users to convert an existing note into a source document
 * in NotebookLM, making the note content available for RAG queries.
 */
export interface NoteToSourceInput {
  /** Title of the note to convert (used to find the note) */
  noteTitle: string;
  /** Optional: ID of the note to convert (preferred over title if provided) */
  noteId?: string;
}

/**
 * Result of converting a note to a source
 */
export interface NoteToSourceResult {
  success: boolean;
  /** ID of the created source */
  sourceId?: string;
  /** Name of the created source */
  sourceName?: string;
  /** Error message if failed */
  error?: string;
}
