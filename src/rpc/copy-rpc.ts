/**
 * Copy a notebook, or some of its sources or Studio artifacts, into another
 * notebook — three RPCs no other MCP server exposes.
 *
 * Request shapes and response offsets are interop facts read from
 * teng-lin/notebooklm-py (MIT): `_web/params/notebooks.py`
 * (`build_copy_notebook_params`), `_web/params/sources.py`
 * (`build_copy_sources_params`), `_web/params/artifacts.py`
 * (`build_copy_artifacts_params`) and the recorded replies in
 * `tests/fixtures/rpc_golden/COPY_*.json`. Independent implementation.
 *
 * None of the three is idempotent: a replay after a lost reply makes a second
 * copy. Every call therefore goes out with `idempotent: false`, which keeps the
 * client from retrying anything but a sign-in bounce.
 */

import { BatchExecuteClient } from './batchexecute.js';
import { NOTEBOOK_PRIMARY_HOST } from '../utils/notebook-domain.js';

/**
 * The request-context wrapper the copy RPCs lead with. Same block the
 * Gemini-3.5 rollout made mandatory for create / add-source.
 */
function requestContext(): unknown[] {
  return [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]];
}

export interface CopiedItem {
  /** The id in the source notebook. */
  originalId: string;
  /** The id of the new copy in the target notebook. */
  newId: string;
  title: string;
}

export interface CopiedNotebook {
  id: string;
  title: string;
  url: string;
  /** The sources the new notebook starts with (new ids). */
  sources: Array<{ id: string; title: string }>;
}

/**
 * `CopyProject` reply: `[title, [[[sourceId], sourceTitle], …], newNotebookId]`.
 * A reply that names no id, or names the source notebook again, is not a copy.
 */
export function parseCopiedNotebook(result: unknown, sourceNotebookId: string): CopiedNotebook {
  const row = Array.isArray(result) ? (result as unknown[]) : [];
  const id = typeof row[2] === 'string' ? row[2] : '';
  if (!id) throw new Error('CopyProject reply carried no notebook id');
  if (id === sourceNotebookId) {
    throw new Error('CopyProject reply named the source notebook, not a copy');
  }
  const sources: Array<{ id: string; title: string }> = [];
  for (const s of Array.isArray(row[1]) ? (row[1] as unknown[]) : []) {
    if (!Array.isArray(s)) continue;
    const sid = Array.isArray(s[0]) && typeof s[0][0] === 'string' ? (s[0][0] as string) : '';
    if (!sid) continue;
    sources.push({ id: sid, title: typeof s[1] === 'string' ? s[1] : '' });
  }
  return {
    id,
    title: typeof row[0] === 'string' ? row[0] : '',
    url: `https://${NOTEBOOK_PRIMARY_HOST}/notebook/${id}`,
    sources,
  };
}

/**
 * `CopySourcesAsync` reply: `[[ [[originalId], [[newId], title, …]], … ]]` —
 * one pair per copied source, original id first.
 */
export function parseCopiedSources(result: unknown): CopiedItem[] {
  const pairs = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as unknown[]) : [];
  const out: CopiedItem[] = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair)) continue;
    const original = Array.isArray(pair[0]) ? pair[0][0] : undefined;
    const copy = Array.isArray(pair[1]) ? (pair[1] as unknown[]) : [];
    const newId = Array.isArray(copy[0]) ? copy[0][0] : undefined;
    if (typeof original !== 'string' || typeof newId !== 'string') continue;
    out.push({ originalId: original, newId, title: typeof copy[1] === 'string' ? copy[1] : '' });
  }
  return out;
}

/**
 * `CopyArtifactsAsync` reply: `[[ [originalId, [newId, title, type, …]], … ]]` —
 * the artifact ids are bare strings, unlike the source ids.
 */
export function parseCopiedArtifacts(result: unknown): CopiedItem[] {
  const pairs = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as unknown[]) : [];
  const out: CopiedItem[] = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair)) continue;
    const original = pair[0];
    const copy = Array.isArray(pair[1]) ? (pair[1] as unknown[]) : [];
    const newId = copy[0];
    if (typeof original !== 'string' || typeof newId !== 'string') continue;
    out.push({ originalId: original, newId, title: typeof copy[1] === 'string' ? copy[1] : '' });
  }
  return out;
}

export class CopyRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /** Copy a whole notebook — sources and Studio artifacts — under a new title. */
  async copyNotebook(notebookId: string, title: string): Promise<CopiedNotebook> {
    const result = await this.client.call(
      'COPY_NOTEBOOK',
      [requestContext(), notebookId, title],
      `/notebook/${notebookId}`,
      { idempotent: false }
    );
    return parseCopiedNotebook(result, notebookId);
  }

  /** Copy sources of `notebookId` into `targetNotebookId`. */
  async copySources(
    notebookId: string,
    sourceIds: string[],
    targetNotebookId: string
  ): Promise<CopiedItem[]> {
    const result = await this.client.call(
      'COPY_SOURCES',
      [null, null, sourceIds.map((id) => [id]), targetNotebookId],
      `/notebook/${notebookId}`,
      { idempotent: false }
    );
    return parseCopiedSources(result);
  }

  /** Copy Studio artifacts of `notebookId` into `targetNotebookId`. */
  async copyArtifacts(
    notebookId: string,
    artifactIds: string[],
    targetNotebookId: string
  ): Promise<CopiedItem[]> {
    const result = await this.client.call(
      'COPY_ARTIFACTS',
      [requestContext(), [...artifactIds], targetNotebookId],
      `/notebook/${notebookId}`,
      { idempotent: false }
    );
    return parseCopiedArtifacts(result);
  }
}
