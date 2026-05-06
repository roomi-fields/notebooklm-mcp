/**
 * Vault writer — formats NotebookLM answers as RTFM-ingestable markdown files
 *
 * Each answer is written as two artifacts:
 *   - {slug}.md   — markdown with YAML frontmatter (human + RTFM markdown parser)
 *   - {slug}.json — structured payload conforming to nblm-answer-v1 schema
 *
 * Schema URL: https://schemas.roomi-fields.com/nblm-answer-v1.json
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  AskQuestionResult,
  AskQuestionSuccess,
  Citation,
  ProgressCallback,
  SourceFormat,
  ToolResult,
} from '../types.js';

export interface NotebookMeta {
  id?: string;
  name?: string;
  url?: string;
}

export interface NblmAnswerPayload {
  $schema: string;
  type: 'nblm-answer';
  version: '1.0';
  asked_at: string;
  session_id: string | null;
  notebook: {
    id: string | null;
    name: string | null;
    url: string | null;
  };
  question: string;
  answer: {
    text: string;
    format: 'markdown';
  };
  citations: Array<{
    marker: string;
    number: number;
    source_name: string | null;
    source_text: string | null;
  }>;
  metadata: {
    tags: string[];
    extraction_success: boolean | null;
    citations_count: number;
    source_names: string[];
  };
}

export const NBLM_ANSWER_SCHEMA_URL = 'https://schemas.roomi-fields.com/nblm-answer-v1.json';

/**
 * Slugify a question into a filesystem-safe filename component.
 * Truncates to ~80 chars and prefixes with a zero-padded index.
 */
export function makeSlug(question: string, prefix: string, index: number): string {
  const base = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80)
    .replace(/-+$/, '')
    .replace(/^-+/, '');
  const idx = String(index + 1).padStart(3, '0');
  const cleanBase = base || 'question';
  return prefix ? `${prefix}-${idx}-${cleanBase}` : `${idx}-${cleanBase}`;
}

/**
 * Escape a string for safe use as a YAML scalar value.
 * Wraps in double quotes and escapes backslashes + double quotes.
 */
function yamlString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Format a NotebookLM answer as a vault-ready markdown document
 * with YAML frontmatter compatible with RTFM's markdown parser.
 */
export function formatAnswerMarkdown(
  data: AskQuestionSuccess,
  notebookMeta: NotebookMeta,
  askedAt: string
): string {
  const citations: Citation[] = data.sources?.citations ?? [];
  const sourceNames = Array.from(
    new Set(citations.map((c) => c.sourceName).filter((s): s is string => Boolean(s)))
  );

  const frontmatterLines: string[] = ['---'];
  frontmatterLines.push(`title: ${yamlString(data.question)}`);
  frontmatterLines.push(`type: nblm-answer`);
  frontmatterLines.push(`asked_at: ${askedAt}`);
  if (notebookMeta.id) frontmatterLines.push(`notebook_id: ${yamlString(notebookMeta.id)}`);
  if (notebookMeta.name) frontmatterLines.push(`notebook_name: ${yamlString(notebookMeta.name)}`);
  if (notebookMeta.url || data.notebook_url) {
    frontmatterLines.push(`notebook_url: ${yamlString(notebookMeta.url ?? data.notebook_url)}`);
  }
  if (data.session_id) frontmatterLines.push(`session_id: ${yamlString(data.session_id)}`);
  frontmatterLines.push(`citations_count: ${citations.length}`);
  if (sourceNames.length > 0) {
    frontmatterLines.push('sources:');
    for (const name of sourceNames) {
      frontmatterLines.push(`  - ${yamlString(name)}`);
    }
  }
  frontmatterLines.push('---');

  const sourcesBlock =
    citations.length > 0
      ? '\n\n## Sources\n\n' +
        citations
          .map((c) => {
            const name = c.sourceName ?? 'Unknown source';
            const text = (c.sourceText ?? '').trim();
            const quoted = text ? text.replace(/\r?\n/g, '\n> ') : '_(no excerpt)_';
            return `### [${c.number}] ${name}\n\n> ${quoted}`;
          })
          .join('\n\n')
      : '';

  const notebookLink =
    notebookMeta.url || data.notebook_url
      ? `\n\n> Asked on ${askedAt} against [${notebookMeta.name ?? 'NotebookLM notebook'}](${notebookMeta.url ?? data.notebook_url})`
      : '';

  return `${frontmatterLines.join('\n')}

# ${data.question}${notebookLink}

## Answer

${data.answer}${sourcesBlock}
`;
}

/**
 * Build the structured JSON payload (sidecar) for a NotebookLM answer.
 * Conforms to nblm-answer-v1 schema.
 */
export function formatAnswerJson(
  data: AskQuestionSuccess,
  notebookMeta: NotebookMeta,
  askedAt: string
): NblmAnswerPayload {
  const citations: Citation[] = data.sources?.citations ?? [];
  const sourceNames = Array.from(
    new Set(citations.map((c) => c.sourceName).filter((s): s is string => Boolean(s)))
  );

  return {
    $schema: NBLM_ANSWER_SCHEMA_URL,
    type: 'nblm-answer',
    version: '1.0',
    asked_at: askedAt,
    session_id: data.session_id ?? null,
    notebook: {
      id: notebookMeta.id ?? null,
      name: notebookMeta.name ?? null,
      url: notebookMeta.url ?? data.notebook_url ?? null,
    },
    question: data.question,
    answer: {
      text: data.answer,
      format: 'markdown',
    },
    citations: citations.map((c) => ({
      marker: c.marker,
      number: c.number,
      source_name: c.sourceName ?? null,
      source_text: c.sourceText ?? null,
    })),
    metadata: {
      tags: [],
      extraction_success: data.sources?.extraction_success ?? null,
      citations_count: citations.length,
      source_names: sourceNames,
    },
  };
}

export interface BatchToVaultArgs {
  questions: string[];
  vault_dir: string;
  notebook_id?: string;
  notebook_url?: string;
  slug_prefix?: string;
  source_format?: SourceFormat;
  sleep_between_ms?: number;
  session_id?: string;
}

export interface BatchToVaultFileResult {
  question: string;
  md_path: string;
  json_path: string;
  success: boolean;
  citations_count: number;
  error?: string;
}

export interface BatchToVaultResult {
  vault_dir: string;
  total: number;
  succeeded: number;
  failed: number;
  session_id?: string;
  notebook: NotebookMeta;
  files: BatchToVaultFileResult[];
}

export type AskQuestionFn = (
  args: {
    question: string;
    session_id?: string;
    notebook_id?: string;
    notebook_url?: string;
    source_format?: SourceFormat;
  },
  sendProgress?: ProgressCallback
) => Promise<ToolResult<AskQuestionResult>>;

interface BatchLogger {
  info?: (msg: string) => void;
  error?: (msg: string) => void;
}

/**
 * Run a batch of questions and persist each answer as `{slug}.md` + `{slug}.json`
 * in `vault_dir`. Shared between the HTTP `/batch-to-vault` endpoint and the
 * `batch_to_vault` MCP tool — the only difference between callers is the
 * `askQuestion` function passed in (both wrap `ToolHandlers.handleAskQuestion`).
 */
export async function runBatchToVault(
  args: BatchToVaultArgs,
  askQuestion: AskQuestionFn,
  logger?: BatchLogger
): Promise<BatchToVaultResult> {
  const {
    questions,
    vault_dir,
    notebook_id,
    notebook_url,
    slug_prefix = '',
    source_format = 'json',
    sleep_between_ms = 0,
    session_id,
  } = args;

  const absVaultDir = path.resolve(vault_dir);
  await fs.mkdir(absVaultDir, { recursive: true });

  const results: BatchToVaultFileResult[] = [];
  let currentSession: string | undefined = session_id;
  const notebookMeta: NotebookMeta = {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    logger?.info?.(`[${i + 1}/${questions.length}] ${String(q).substring(0, 80)}`);

    try {
      const askResult = await askQuestion({
        question: q,
        session_id: currentSession,
        notebook_id,
        notebook_url,
        source_format,
      });

      if (!askResult?.success || !askResult.data || askResult.data.status !== 'success') {
        const errMsg =
          askResult?.error ||
          (askResult?.data && 'error' in askResult.data ? askResult.data.error : 'Unknown error');
        results.push({
          question: q,
          md_path: '',
          json_path: '',
          success: false,
          citations_count: 0,
          error: errMsg,
        });
        continue;
      }

      const data = askResult.data as AskQuestionSuccess;
      if (data.session_id) currentSession = data.session_id;
      if (!notebookMeta.url && data.notebook_url) notebookMeta.url = data.notebook_url;
      if (!notebookMeta.id && notebook_id) notebookMeta.id = notebook_id;

      const askedAt = new Date().toISOString();
      const slug = makeSlug(q, slug_prefix, i);
      const mdPath = path.join(absVaultDir, `${slug}.md`);
      const jsonPath = path.join(absVaultDir, `${slug}.json`);

      const markdown = formatAnswerMarkdown(data, notebookMeta, askedAt);
      const jsonPayload = formatAnswerJson(data, notebookMeta, askedAt);

      await fs.writeFile(mdPath, markdown, 'utf-8');
      await fs.writeFile(jsonPath, JSON.stringify(jsonPayload, null, 2), 'utf-8');

      results.push({
        question: q,
        md_path: mdPath,
        json_path: jsonPath,
        success: true,
        citations_count: data.sources?.citations.length ?? 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger?.error?.(`[${i + 1}] failed: ${msg}`);
      results.push({
        question: q,
        md_path: '',
        json_path: '',
        success: false,
        citations_count: 0,
        error: msg,
      });
    }

    if (sleep_between_ms > 0 && i < questions.length - 1) {
      await new Promise((r) => setTimeout(r, sleep_between_ms));
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return {
    vault_dir: absVaultDir,
    total: questions.length,
    succeeded,
    failed: questions.length - succeeded,
    session_id: currentSession,
    notebook: notebookMeta,
    files: results,
  };
}
