/**
 * RPC-only extensions the DOM tool never exposed: mind maps and source labels.
 * Payloads/offsets are interop facts (ported, independent TS reimpl).
 */

import { BatchExecuteClient } from './batchexecute.js';

export interface MindMapResult {
  mindMapId: string | null;
  title: string;
  json: string;
}

export class MindMapRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /** Generate a mind map from sources, then persist it. Returns id + JSON. */
  async generateAndSave(
    notebookId: string,
    sourceIds: string[],
    title = 'Mind Map',
    opts: { language?: string; instructions?: string } = {}
  ): Promise<MindMapResult> {
    const sourcesNested = sourceIds.map((id) => [[id]]);
    // The third element of the config triple is the output language and the
    // second carries a free-text steer. Both were sent empty, so every mind map
    // came back in whatever language the request's `hl` implied — French nodes
    // for a Spanish notebook (issue #34). Slot positions read from
    // teng-lin/notebooklm-py's `build_mind_map_params` (MIT).
    const genParams = [
      sourcesNested,
      null,
      null,
      null,
      null,
      ['interactive_mindmap', [['[CONTEXT]', opts.instructions || '']], opts.language || 'en'],
      null,
      [2, null, [1]],
    ];
    const gen = (await this.client.call('GENERATE_MIND_MAP', genParams)) as unknown;
    const genInner = Array.isArray((gen as unknown[])?.[0])
      ? ((gen as unknown[])[0] as unknown[])
      : [];
    const json = typeof genInner[0] === 'string' ? genInner[0] : '';
    if (!json) throw new Error('mind map generation returned no JSON');

    const sourcesSimple = sourceIds.map((id) => [id]);
    const metadata = [2, null, null, 5, sourcesSimple];
    const saveParams = [notebookId, json, metadata, null, title];
    const saved = (await this.client.call(
      'SAVE_MIND_MAP',
      saveParams,
      `/notebook/${notebookId}`
    )) as unknown;
    const savedInner = Array.isArray((saved as unknown[])?.[0])
      ? ((saved as unknown[])[0] as unknown[])
      : [];
    const mindMapId = typeof savedInner[0] === 'string' ? savedInner[0] : null;
    return { mindMapId, title, json };
  }
}

export interface Label {
  id: string;
  name: string;
  emoji?: string;
  sourceCount: number;
}

/**
 * Request-options block at slot 0 of every label RPC.
 *
 * The live web client sends a longer capability envelope here, but the short
 * form is still accepted — checked directly, because the longer one was the
 * obvious suspect when these calls were failing and it was not the cause. The
 * cause was the id (see below); leaving this short keeps the fix to what was
 * actually verified.
 */
const LABEL_CLIENT_OPTIONS = [2];

export class LabelsRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /** List labels. Raw: `result[0] = [[name, [[srcId],…], labelId, emoji], …]`. */
  async list(notebookId: string): Promise<Label[]> {
    const result = (await this.client.call(
      'LABEL_LIST',
      [LABEL_CLIENT_OPTIONS, notebookId],
      `/notebook/${notebookId}`
    )) as unknown;
    return parseLabels(result, 0);
  }

  /** Create a label. Returns the updated label list. */
  async create(notebookId: string, name: string, emoji = ''): Promise<Label[]> {
    const result = (await this.client.call(
      'LABEL_CREATE',
      [LABEL_CLIENT_OPTIONS, notebookId, null, null, null, [[name, emoji]]],
      `/notebook/${notebookId}`
    )) as unknown;
    return parseLabels(result, 1);
  }

  /** Rename a label. */
  async rename(notebookId: string, labelId: string, newName: string): Promise<void> {
    await this.client.call(
      'LABEL_MUTATE',
      [[2], notebookId, labelId, [[[newName]]]],
      `/notebook/${notebookId}`
    );
  }

  /** Delete one or more labels. */
  async delete(notebookId: string, labelIds: string[]): Promise<void> {
    await this.client.call('LABEL_DELETE', [[2], notebookId, labelIds], `/notebook/${notebookId}`);
  }
}

export interface DiscoveredSource {
  url: string;
  title: string;
  description?: string;
}

export class ResearchRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /** Start Fast web research. Returns the task id. sourceType 1=web, 2=drive. */
  async start(notebookId: string, query: string, sourceType = 1): Promise<string | null> {
    const result = (await this.client.call(
      'START_FAST_RESEARCH',
      [[query, sourceType], null, 1, notebookId],
      `/notebook/${notebookId}`
    )) as unknown;
    return Array.isArray(result) && typeof result[0] === 'string' ? result[0] : null;
  }

  /** Poll research; returns the task's discovered sources (empty until ready). */
  async poll(notebookId: string): Promise<{ taskId: string | null; sources: DiscoveredSource[] }> {
    let result = (await this.client.call(
      'POLL_RESEARCH',
      [null, null, notebookId],
      `/notebook/${notebookId}`
    )) as unknown;
    if (Array.isArray(result) && Array.isArray((result as unknown[])[0])) {
      result = (result as unknown[])[0];
    }
    const rows = Array.isArray(result) ? (result as unknown[]) : [];
    for (const task of rows) {
      if (!Array.isArray(task) || typeof task[0] !== 'string') continue; // skip timestamp rows
      const taskId = task[0];
      const info = Array.isArray(task[1]) ? (task[1] as unknown[]) : [];
      const bundle = Array.isArray(info[3]) ? (info[3] as unknown[]) : [];
      const rawSources = Array.isArray(bundle[0]) ? (bundle[0] as unknown[]) : [];
      const sources: DiscoveredSource[] = [];
      for (const s of rawSources) {
        if (!Array.isArray(s)) continue;
        const url = typeof s[0] === 'string' ? s[0] : '';
        const title = typeof s[1] === 'string' ? s[1] : '';
        if (!url && !title) continue;
        sources.push({ url, title, description: typeof s[2] === 'string' ? s[2] : undefined });
      }
      return { taskId, sources };
    }
    return { taskId: null, sources: [] };
  }

  /** Import discovered sources into the notebook. */
  async import(notebookId: string, taskId: string, sources: DiscoveredSource[]): Promise<void> {
    const sourceArray = sources.map((s) => [
      null,
      null,
      [s.url, s.title],
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      2,
    ]);
    await this.client.call(
      'IMPORT_RESEARCH',
      [null, [1], taskId, notebookId, sourceArray],
      `/notebook/${notebookId}`
    );
  }

  /**
   * Cancel an in-flight research run. `runId` is the task id from {@link start}
   * / {@link poll} — the same value `research_sources` returns, which is the
   * correct cancel id for Fast research (the report-id caveat is Deep-only).
   *
   * Fire-and-forget: the server keys the cancel on `runId` alone (the notebook
   * is routing only), replies empty, and does not validate the id, so an
   * unknown id is a silent no-op. A cancelled in-progress run turns FAILED
   * within a few seconds; confirm by polling.
   */
  async cancel(notebookId: string, runId: string): Promise<void> {
    await this.client.call('CANCEL_RESEARCH', [null, null, runId], `/notebook/${notebookId}`);
  }

  /** Start web research, poll until sources are found (or timeout), optionally import. */
  async discover(
    notebookId: string,
    query: string,
    opts: { import?: boolean; timeoutMs?: number } = {}
  ): Promise<{ taskId: string | null; sources: DiscoveredSource[]; imported: number }> {
    const taskId = await this.start(notebookId, query);
    const deadline = Date.now() + (opts.timeoutMs ?? 120000);
    let sources: DiscoveredSource[] = [];
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const p = await this.poll(notebookId);
      if (p.sources.length > 0) {
        sources = p.sources;
        break;
      }
    }
    let imported = 0;
    if (opts.import && taskId && sources.length > 0) {
      await this.import(notebookId, taskId, sources);
      imported = sources.length;
    }
    return { taskId, sources, imported };
  }
}

/**
 * Read a label list out of a response.
 *
 * The two calls wrap it differently: `LABEL_LIST` echoes the labels at index 0,
 * `LABEL_CREATE` at index 1 (documented in teng-lin/notebooklm-py's labels API,
 * MIT). Reading index 1 for both is why a successful listing still looked
 * empty.
 */
function parseLabels(result: unknown, index: number): Label[] {
  const raw = Array.isArray((result as unknown[])?.[index])
    ? ((result as unknown[])[index] as unknown[])
    : [];
  const out: Label[] = [];
  for (const l of raw) {
    if (!Array.isArray(l)) continue;
    const name = typeof l[0] === 'string' ? l[0] : '';
    const sources = Array.isArray(l[1]) ? (l[1] as unknown[]) : [];
    const id = typeof l[2] === 'string' ? l[2] : '';
    const emoji = typeof l[3] === 'string' ? l[3] : undefined;
    if (!id) continue;
    out.push({ id, name, emoji, sourceCount: sources.length });
  }
  return out;
}
