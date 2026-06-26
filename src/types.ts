/**
 * Global type definitions for NotebookLM MCP Server
 */

/**
 * Source format options for citation display
 */
export type SourceFormat =
  | 'none' // No source extraction (default, fastest)
  | 'inline' // Insert source text inline: "text [1: source excerpt]"
  | 'footnotes' // Append sources at the end as footnotes
  | 'json' // Return sources as separate JSON object
  | 'expanded'; // Replace [1] with full quoted source text

/**
 * Extracted citation data
 */
export interface Citation {
  /** Citation marker (e.g., "[1]", "[2]") */
  marker: string;
  /** Citation number */
  number: number;
  /** Source text from hover tooltip */
  sourceText: string;
  /** Source name/title if available */
  sourceName?: string;
}

/**
 * Session information returned by the API
 */
export interface SessionInfo {
  id: string;
  created_at: number;
  last_activity: number;
  age_seconds: number;
  inactive_seconds: number;
  message_count: number;
  notebook_url: string;
}

/**
 * Source citations data
 */
export interface SourceCitations {
  /** Format used for extraction */
  format: SourceFormat;
  /** List of extracted citations */
  citations: Citation[];
  /** Whether extraction was successful */
  extraction_success: boolean;
  /** Error message if extraction failed */
  extraction_error?: string;
}

/**
 * Session info included in successful responses
 */
export interface AskSessionInfo {
  age_seconds: number;
  message_count: number;
  last_activity: number;
}

/**
 * Successful question result
 */
export interface AskQuestionSuccess {
  status: 'success';
  question: string;
  answer: string;
  notebook_url: string;
  session_id: string;
  session_info: AskSessionInfo;
  /** Extracted source citations (when source_format is not 'none') */
  sources?: SourceCitations;
}

/**
 * Error question result
 */
export interface AskQuestionError {
  status: 'error';
  question: string;
  error: string;
  notebook_url: string;
}

/**
 * Result from asking a question (discriminated union)
 * Use `result.status` to discriminate between success and error
 */
export type AskQuestionResult = AskQuestionSuccess | AskQuestionError;

/**
 * Tool call result for MCP (generic wrapper for tool responses)
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * JSON Schema property definition
 */
export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: readonly string[];
  items?: JsonSchemaProperty | { type: string };
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
}

/**
 * MCP Tool definition
 */
export interface Tool {
  name: string;
  title?: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  /** Shape of the structured result returned by the tool (the ToolResult envelope). */
  outputSchema?: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  /** Optional behaviour hints surfaced to MCP clients (read-only, destructive, etc.). */
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/**
 * Options for human-like typing
 */
export interface TypingOptions {
  wpm?: number; // Words per minute
  withTypos?: boolean;
}

/**
 * Options for waiting for answers
 */
export interface WaitForAnswerOptions {
  question?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  ignoreTexts?: string[];
  debug?: boolean;
}

/**
 * Progress callback function for MCP progress notifications
 */
export type ProgressCallback = (
  message: string,
  progress?: number,
  total?: number
) => Promise<void>;

/**
 * Global state for the server (legacy - prefer direct imports)
 * @deprecated Use direct imports of SessionManager and AuthManager instead
 */
export interface ServerState {
  playwright: unknown;
  sessionManager: unknown;
  authManager: unknown;
}

export interface NotebookNote {
  id?: string;
  title: string;
  details?: string;
}

export interface NoteListResult {
  success: boolean;
  notes: NotebookNote[];
  error?: string;
}

export interface NoteGetInput {
  noteTitle: string;
  noteId?: string;
}

export interface NoteGetResult {
  success: boolean;
  title: string;
  content: string;
  error?: string;
}
