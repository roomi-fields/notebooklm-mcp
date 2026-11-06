/**
 * Studio content generation over the internal `batchexecute` RPC API.
 *
 * One RPC (`CREATE_STUDIO`) creates every artifact type via a type code + a
 * type-specific options blob placed at a fixed index of the `content` array;
 * `POLL_STUDIO` reports status and, when ready, the media URL / text content.
 * Payloads + offsets verified against the reference impl (interop facts).
 */

import { BatchExecuteClient } from './batchexecute.js';

export type StudioType =
  | 'audio_overview'
  | 'report'
  | 'video'
  | 'infographic'
  | 'presentation'
  | 'data_table'
  | 'flashcards'
  | 'quiz';

// type code + the `content`-array index its options blob sits at.
const TYPE_META: Record<StudioType, { code: number; optionIndex: number }> = {
  audio_overview: { code: 1, optionIndex: 6 },
  report: { code: 2, optionIndex: 7 },
  video: { code: 3, optionIndex: 8 },
  infographic: { code: 7, optionIndex: 14 },
  presentation: { code: 8, optionIndex: 16 }, // slide deck
  data_table: { code: 9, optionIndex: 18 },
  flashcards: { code: 4, optionIndex: 9 }, // type 4, subtype 1 in options
  quiz: { code: 4, optionIndex: 9 }, // type 4, subtype 2 in options
};

export interface StudioArtifact {
  id: string;
  typeCode: number;
  title: string;
  status: 'in_progress' | 'completed' | 'failed' | 'unknown';
  mediaUrl?: string;
  textContent?: string;
}

/** Where an artifact export lands. */
export type ExportTarget = 'docs' | 'sheets';

export interface ExportResult {
  artifactId: string;
  target: ExportTarget;
  /** The created document, or `null` when the reply carried no Drive link. */
  documentUrl: string | null;
}

export interface GenerateResult {
  artifactId: string | null;
  status: string;
  title?: string;
  mediaUrl?: string;
  textContent?: string;
}

/**
 * The capability blob a retry carries. It is type-agnostic — the same literal
 * is sent whatever the artifact is — and the trailing list is a static
 * artifact-type-code capability set, not a description of the artifact being
 * retried. Sent verbatim.
 */
const RETRY_OPTIONS: unknown[] = [
  2,
  null,
  null,
  [1, null, null, null, null, null, null, null, null, null, [1]],
  [[1, 4, 8, 2, 3, 6]],
];

export class StudioRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /** Build the sparse `content` array: [null,null,type,sources,…,options]. */
  private buildContent(type: StudioType, sourcesNested: unknown, options: unknown): unknown[] {
    const { code, optionIndex } = TYPE_META[type];
    const content: unknown[] = new Array(optionIndex + 1).fill(null);
    content[2] = code;
    content[3] = sourcesNested;
    content[optionIndex] = options;
    return content;
  }

  private optionsFor(
    type: StudioType,
    sourcesSimple: unknown,
    lang: string,
    focus: string
  ): unknown {
    switch (type) {
      case 'audio_overview':
        // [null, [focus, length=2, null, sources, lang, null, format=1]]
        return [null, [focus || '', 2, null, sourcesSimple, lang, null, 1]];
      case 'video': {
        // video_options = [null, null, inner]; inner explainer(1) appends style=1
        const inner: unknown[] = [sourcesSimple, lang, focus || '', null, 1, 1];
        return [null, null, inner];
      }
      case 'report':
        // [null, [title, desc, null, sources, lang, prompt, null, true]]
        return [
          null,
          [
            'Briefing Doc',
            'Overview of your sources, with key facts and citations',
            null,
            sourcesSimple,
            lang,
            focus || 'Create a comprehensive briefing document based on the provided sources.',
            null,
            true,
          ],
        ];
      case 'infographic':
        // [[focus, lang, null, orientation=1, detail=2, style=1]]
        return [[focus || null, lang, null, 1, 2, 1]];
      case 'presentation':
        // [[focus, lang, format=1, length=3]]
        return [[focus || null, lang, 1, 3]];
      case 'data_table':
        // [null, [description, lang]]
        return [null, [focus || '', lang]];
      case 'flashcards':
        // [null, [subtype=1, null, focus, null,null,null, [difficulty=2, count]]]
        return [null, [1, null, focus || null, null, null, null, [2, 2]]];
      case 'quiz':
        // [null, [subtype=2, null, focus, null,null,null,null, [count, difficulty=2]]]
        return [null, [2, null, focus || null, null, null, null, null, [2, 2]]];
    }
  }

  /** Trigger creation. Returns the new artifact id + initial status. */
  async create(
    notebookId: string,
    type: StudioType,
    sourceIds: string[],
    opts: { language?: string; focus?: string } = {}
  ): Promise<{ artifactId: string | null; status: string }> {
    const lang = opts.language || 'en';
    const focus = opts.focus || '';
    const sourcesNested = sourceIds.map((id) => [[id]]);
    const sourcesSimple = sourceIds.map((id) => [id]);
    const options = this.optionsFor(type, sourcesSimple, lang, focus);
    const content = this.buildContent(type, sourcesNested, options);
    const params = [[2], notebookId, content];

    const result = (await this.client.call(
      'CREATE_STUDIO',
      params,
      `/notebook/${notebookId}`
    )) as unknown;
    const artifact = Array.isArray(result) ? (result[0] as unknown) : undefined;
    const artifactId =
      Array.isArray(artifact) && typeof artifact[0] === 'string' ? artifact[0] : null;
    return { artifactId, status: normalizeStatus(artifact) };
  }

  /**
   * Delete a Studio artifact.
   *
   * `DELETE_STUDIO` sat in the id table unused since v3: content could be
   * generated and listed but never removed, so a notebook accumulated every
   * draft anyone ever asked for.
   *
   * Single id only — batch shapes were probed and rejected by the server,
   * per teng-lin/notebooklm-py (MIT), which is also where the `[[2], id]`
   * payload comes from. A null result means success, so it is not treated as
   * an error.
   *
   * Does **not** cover note-backed mind maps: those live in the notes system
   * and need `DELETE_NOTE`, and deleting one only clears it rather than
   * removing the row.
   */
  async deleteArtifact(notebookId: string, artifactId: string): Promise<void> {
    await this.client.call('DELETE_STUDIO', [[2], artifactId], `/notebook/${notebookId}`);
  }

  /**
   * Retry a failed artifact in place — the web UI's "Retry" button.
   *
   * The failed artifact is NOT deleted and NOT replaced: the same id is kept
   * and the row goes back to in-progress, so anything already holding that id
   * (a poll loop, a saved reference, a download that will be retried) keeps
   * working. That is the whole reason to prefer this over deleting and
   * regenerating, which mints a new id and orphans every reference to the old.
   *
   * Payload shape and the fixed options blob read from
   * `teng-lin/notebooklm-py` (`_web/artifacts.py::retry_failed`, MIT), which
   * validated it across video, audio and infographic artifacts.
   *
   * A server-side refusal — rate limit, quota, or an artifact the backend will
   * not retry — arrives as a thrown RPC status rather than a result, so it
   * reaches the caller as an error. A retry that is accepted can still fail
   * again later on Google's side; that shows up as a terminal failed status on
   * a subsequent poll, and whether to retry once more is the caller's call.
   */
  async retryArtifact(
    notebookId: string,
    artifactId: string
  ): Promise<{ artifactId: string; status: StudioArtifact['status'] }> {
    const result = (await this.client.call(
      'RETRY_ARTIFACT',
      [RETRY_OPTIONS, artifactId],
      `/notebook/${notebookId}`
    )) as unknown;

    const row = Array.isArray(result) ? (result[0] as unknown) : undefined;
    const id = Array.isArray(row) && typeof row[0] === 'string' ? row[0] : null;
    if (!id) {
      // No row back means the backend did not take the retry. Reporting that
      // as a queued retry would have the caller poll an artifact that is
      // still failed and conclude the retry had simply not worked yet.
      throw new Error(
        `NotebookLM did not accept the retry of artifact ${artifactId} ` +
          `(it may not be retryable, or the feature is unavailable on this account)`
      );
    }
    return { artifactId: id, status: normalizeStatus(row) };
  }

  /**
   * Export a finished artifact to Google Docs or Sheets.
   *
   * Payload from teng-lin/notebooklm-py (MIT, `_web/artifacts.py::_send_export`):
   * `[null, artifactId, content, title, type]` with 1 = Docs, 2 = Sheets. The
   * reply carries the new document somewhere inside a positional envelope that
   * no reference documents, so we search it for the Drive link rather than
   * index into a slot we have not seen — and report `null` when there is none,
   * instead of handing back a URL we invented.
   */
  async exportArtifact(
    notebookId: string,
    artifactId: string,
    target: ExportTarget,
    title: string
  ): Promise<ExportResult> {
    const result = (await this.client.call(
      'EXPORT_ARTIFACT',
      [null, artifactId, null, title, target === 'sheets' ? 2 : 1],
      `/notebook/${notebookId}`
    )) as unknown;
    return { artifactId, target, documentUrl: findDriveUrl(result) };
  }

  /**
   * Revise one slide of an existing slide deck from a prompt.
   *
   * `slideIndex` is zero-based. The call is an async kickoff like generation:
   * it returns the deck's new status, and the revised slide appears on a later
   * poll. Payload from the same MIT reference (`build_revise_slide_params`).
   */
  async reviseSlide(
    notebookId: string,
    artifactId: string,
    slideIndex: number,
    prompt: string
  ): Promise<{ artifactId: string; status: StudioArtifact['status'] }> {
    if (!Number.isInteger(slideIndex) || slideIndex < 0) {
      throw new Error(`slide_index must be a non-negative integer, got ${slideIndex}`);
    }
    const result = (await this.client.call(
      'REVISE_SLIDE_DECK',
      [[2], artifactId, [[[slideIndex, prompt]]]],
      `/notebook/${notebookId}`
    )) as unknown;
    const row = Array.isArray(result) ? (result[0] as unknown) : undefined;
    return { artifactId, status: normalizeStatus(row) };
  }

  /** Poll all Studio artifacts (id, type, status, title, media/text when ready). */
  async poll(notebookId: string): Promise<StudioArtifact[]> {
    const params = [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'];
    const result = (await this.client.call(
      'POLL_STUDIO',
      params,
      `/notebook/${notebookId}`
    )) as unknown;
    const list = Array.isArray((result as unknown[])?.[0])
      ? ((result as unknown[])[0] as unknown[])
      : Array.isArray(result)
        ? (result as unknown[])
        : [];
    const out: StudioArtifact[] = [];
    for (const a of list) {
      if (!Array.isArray(a) || a.length < 5) continue;
      const id = typeof a[0] === 'string' ? a[0] : '';
      if (!id) continue;
      const typeCode = typeof a[2] === 'number' ? a[2] : -1;
      out.push({
        id,
        typeCode,
        title: typeof a[1] === 'string' ? a[1] : '',
        status: normalizeStatus(a),
        mediaUrl: extractMediaUrl(a, typeCode),
        textContent: extractTextContent(a, typeCode),
      });
    }
    return out;
  }

  /**
   * Create then poll until the new artifact is completed/failed (or timeout).
   * Returns the artifact with its media URL / text content when ready.
   */
  async generate(
    notebookId: string,
    type: StudioType,
    sourceIds: string[],
    opts: { language?: string; focus?: string; timeoutMs?: number; pollMs?: number } = {}
  ): Promise<GenerateResult> {
    const { artifactId, status } = await this.create(notebookId, type, sourceIds, opts);
    if (status === 'completed' || status === 'failed') {
      return { artifactId, status };
    }
    const deadline = Date.now() + (opts.timeoutMs ?? 900000);
    const pollMs = opts.pollMs ?? 5000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollMs));
      const artifacts = await this.poll(notebookId);
      const mine = artifactId
        ? artifacts.find((a) => a.id === artifactId)
        : artifacts.find((a) => a.typeCode === TYPE_META[type].code);
      if (mine && (mine.status === 'completed' || mine.status === 'failed')) {
        return {
          artifactId: mine.id,
          status: mine.status,
          title: mine.title,
          mediaUrl: mine.mediaUrl,
          textContent: mine.textContent,
        };
      }
    }
    return { artifactId, status: 'timeout' };
  }
}

/** First Google Drive link anywhere in a positional envelope, or `null`. */
function findDriveUrl(node: unknown, depth = 0): string | null {
  if (typeof node === 'string') {
    return /^https:\/\/docs\.google\.com\//.test(node) ? node : null;
  }
  if (!Array.isArray(node) || depth > 20) return null;
  for (const child of node) {
    const found = findDriveUrl(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Status code at artifact[4]: 1=in_progress, 3=completed, 4=failed; audio 2+media=completed. */
function normalizeStatus(a: unknown): StudioArtifact['status'] {
  if (!Array.isArray(a) || a.length <= 4) return 'unknown';
  const code = a[4];
  if (code === 1) return 'in_progress';
  if (code === 3) return 'completed';
  if (code === 4) return 'failed';
  if (code === 2 && a[2] === 1 && extractAudioUrl(a)) return 'completed';
  return 'unknown';
}

function extractMediaUrl(a: unknown[], typeCode: number): string | undefined {
  if (typeCode === 1) return extractAudioUrl(a) ?? undefined;
  if (typeCode === 3 && Array.isArray(a[8]) && typeof (a[8] as unknown[])[3] === 'string') {
    return (a[8] as unknown[])[3] as string;
  }
  if (typeCode === 7 && Array.isArray(a[14])) {
    // [14][2][0][1][0]
    const img = ((((a[14] as unknown[])[2] as unknown[])?.[0] as unknown[])?.[1] as unknown[])?.[0];
    if (typeof img === 'string' && img.startsWith('http')) return img;
  }
  if (typeCode === 8 && Array.isArray(a[16])) {
    const o = a[16] as unknown[];
    if (typeof o[0] === 'string' && o[0].startsWith('http')) return o[0];
    if (typeof o[3] === 'string') return o[3];
  }
  return undefined;
}

function extractTextContent(a: unknown[], typeCode: number): string | undefined {
  if (typeCode === 2 && Array.isArray(a[7])) {
    const content = (a[7] as unknown[])[1];
    if (Array.isArray(content) && typeof content[0] === 'string') return content[0];
  }
  return undefined;
}

/** Audio URL at artifact[6][5]: prefer the `-dv` audio/mp4 CDN variant. */
function extractAudioUrl(a: unknown): string | null {
  if (!Array.isArray(a) || a.length <= 6) return null;
  const audioOptions = a[6];
  if (!Array.isArray(audioOptions)) return null;
  const media = audioOptions[5];
  if (Array.isArray(media)) {
    const isHttp = (it: unknown): it is unknown[] =>
      Array.isArray(it) && typeof it[0] === 'string' && (it[0] as string).startsWith('http');
    for (const it of media)
      if (isHttp(it) && it[2] === 'audio/mp4' && (it[0] as string).endsWith('-dv'))
        return it[0] as string;
    for (const it of media) if (isHttp(it) && it[2] === 'audio/mp4') return it[0] as string;
    for (const it of media) if (isHttp(it)) return it[0] as string;
  }
  if (typeof audioOptions[3] === 'string') return audioOptions[3];
  return null;
}
