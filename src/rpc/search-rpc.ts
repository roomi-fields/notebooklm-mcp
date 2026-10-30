/**
 * Ranked passage retrieval across a notebook's sources.
 *
 * This is the one call that answers "where in my sources does this appear"
 * without paying for generation: no model runs, no quota is consumed, and the
 * reply is the indexed passages themselves rather than a written answer. For
 * an agent that already knows how to reason, retrieval is the expensive half
 * it cannot do itself.
 *
 * Protocol facts (payload shape, response positions, the fact that rank is
 * global across sources and lower is better) read from
 * `teng-lin/notebooklm-py` — `docs/android/source-search-evidence.md`,
 * `_web/params/sources.py` and `_web/rows/chunks.py`, MIT. The implementation
 * below is ours.
 *
 * ⚠️ `ASU5Oe` is registered by a lazily loaded frontend module, so it is
 * absent from the homepage bundle a drift scraper reads. A rotation of this id
 * therefore shows up as a failing call, not as a missing registration.
 */

import { BatchExecuteClient } from './batchexecute.js';

/** One indexed passage, as the notebook stored it. */
export interface RelevantPassage {
  /** The source the passage was indexed from. */
  sourceId: string;
  /** The passage text, with its parts joined in wire order. */
  text: string;
  /**
   * Position in the ranking, global across every source in the reply.
   * **Lower is better**, and 0 is a legitimate best rank.
   */
  rank: number;
  /** Character offsets into the source's full text, when the server gave them. */
  start: number | null;
  end: number | null;
}

/** A non-negative integer, or null — the server sends nothing else here. */
function offset(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * The passage text lives four levels down: content → text → parts → strings.
 * A passage whose parts are not all strings is one we cannot render honestly,
 * so it is dropped rather than half-joined.
 */
function passageText(chunk: unknown[]): string | null {
  const content = chunk[0];
  if (!Array.isArray(content)) return null;
  const text = content[0];
  if (!Array.isArray(text)) return null;
  const parts = text[0];
  if (!Array.isArray(parts) || parts.length === 0) return null;
  if (!parts.every((p): p is string => typeof p === 'string')) return null;
  return parts.join('') || null;
}

/**
 * The first span, as `[start, end]`. The server omits a leading zero rather
 * than sending it, so a span starting at the very beginning arrives with its
 * start slot absent — which reads here as "no offsets" rather than as 0,
 * because inventing a 0 we were not told is how a quote gets attributed to the
 * wrong place in a long document.
 */
function passageSpan(chunk: unknown[]): { start: number | null; end: number | null } {
  const spans = chunk[2];
  if (!Array.isArray(spans) || spans.length === 0) return { start: null, end: null };
  const span = spans[0];
  if (!Array.isArray(span)) return { start: null, end: null };
  const start = offset(span[1]);
  const end = offset(span[2]);
  if (start === null || end === null || start > end) return { start: null, end: null };
  return { start, end };
}

export class SearchRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /**
   * Search the notebook's indexed sources for passages matching `query`.
   *
   * With no `sourceIds` the whole notebook is searched; with them, only those
   * sources. A notebook whose sources are still being indexed answers with no
   * passages, which is an empty result and not an error.
   *
   * @param limit  keep at most this many passages, best rank first. The server
   *               does not take a limit, so this trims the decoded reply — the
   *               point being the agent's context budget, not the round trip.
   */
  async searchPassages(
    notebookId: string,
    query: string,
    options: { sourceIds?: string[]; limit?: number } = {}
  ): Promise<RelevantPassage[]> {
    const { sourceIds = [], limit } = options;

    // Fields 1 and 2 are the notebook and the query, field 3 is unused, and
    // field 4 is the retrieval-options message whose only populated member is
    // mode 1. Field 5 is the source filter and is omitted entirely when empty:
    // an empty filter message is not the same request as no filter.
    const params: unknown[] = [notebookId, query, null, [1]];
    if (sourceIds.length > 0) {
      params.push([sourceIds.map((id) => [id])]);
    }

    const result = (await this.client.call(
      'SEARCH_PASSAGES',
      params,
      `/notebook/${notebookId}`
    )) as unknown;

    // `[[sourceRow, ...]]`. A null or empty envelope is a legitimate "nothing
    // matched", so it must not be confused with a shape we failed to read.
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as unknown[]) : [];

    const passages: RelevantPassage[] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const sourceId = row[0];
      if (typeof sourceId !== 'string' || !sourceId) continue;
      const chunks = row[1];
      if (!Array.isArray(chunks)) continue;

      for (const chunk of chunks) {
        if (!Array.isArray(chunk)) continue;
        const text = passageText(chunk);
        if (text === null) continue;
        const rank = chunk[1];
        const { start, end } = passageSpan(chunk);
        passages.push({
          sourceId,
          text,
          rank: typeof rank === 'number' && Number.isInteger(rank) && rank >= 0 ? rank : 0,
          start,
          end,
        });
      }
    }

    // Rank is global across sources, so the reply is only sorted within each
    // source group; a caller taking the first N off the wire would get the
    // best of the first source rather than the best of the notebook.
    passages.sort((a, b) => a.rank - b.rank);
    return typeof limit === 'number' && limit > 0 ? passages.slice(0, limit) : passages;
  }
}
