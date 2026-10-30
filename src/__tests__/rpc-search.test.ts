/**
 * Unit tests for ranked passage retrieval (no network).
 *
 * The envelope is positional and undocumented by Google, and two of its
 * properties are easy to get wrong in a way no type checker catches: rank is
 * global across sources while the reply is grouped by source, and a span whose
 * start is zero arrives with the slot absent rather than set. These lock both,
 * plus the payload the server accepts.
 */
import { SearchRpc } from '../rpc/search-rpc.js';

/** A `SearchRpc` whose client returns `result` for every call, recording the params. */
function rpcReturning(result: unknown) {
  const calls: Array<{ method: string; params: unknown; path: string }> = [];
  const client = {
    call: async (method: string, params: unknown, path: string) => {
      calls.push({ method, params, path });
      return result;
    },
  };
  return { search: new SearchRpc(client as never), calls };
}

const NB = '11111111-2222-3333-4444-555555555555';
const SRC_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const SRC_B = 'bbbbbbbb-0000-0000-0000-000000000002';

/** One chunk row: `[[[[part, ...]]], rank, [[null, start, end]]]`. */
const chunk = (parts: string[], rank: number, span?: [number, number]) => [
  [[parts]],
  rank,
  span ? [[null, span[0], span[1]]] : [],
];

describe('SearchRpc.searchPassages — the request', () => {
  it('sends the notebook, the query and the retrieval mode, scoped to the notebook', async () => {
    const { search, calls } = rpcReturning([[]]);
    await search.searchPassages(NB, 'what is ikigai');

    expect(calls[0].method).toBe('SEARCH_PASSAGES');
    expect(calls[0].params).toEqual([NB, 'what is ikigai', null, [1]]);
    expect(calls[0].path).toBe(`/notebook/${NB}`);
  });

  it('omits the source filter entirely rather than sending an empty one', async () => {
    // An empty filter message is a different request from no filter, and the
    // server reads it as "match nothing".
    const { search, calls } = rpcReturning([[]]);
    await search.searchPassages(NB, 'q', { sourceIds: [] });
    expect((calls[0].params as unknown[]).length).toBe(4);
  });

  it('wraps each requested source id in its own list', async () => {
    const { search, calls } = rpcReturning([[]]);
    await search.searchPassages(NB, 'q', { sourceIds: [SRC_A, SRC_B] });
    expect((calls[0].params as unknown[])[4]).toEqual([[[SRC_A], [SRC_B]]]);
  });
});

describe('SearchRpc.searchPassages — the reply', () => {
  it('joins the text parts and keeps the source each passage came from', async () => {
    const { search } = rpcReturning([[[SRC_A, [chunk(['Ikigai ', 'means '], 0, [10, 24])]]]]);

    await expect(search.searchPassages(NB, 'q')).resolves.toEqual([
      { sourceId: SRC_A, text: 'Ikigai means ', rank: 0, start: 10, end: 24 },
    ]);
  });

  it('orders by rank across sources, not within each group', async () => {
    // The wire groups by source, so the best passage of the second source
    // arrives after the worst of the first. A caller taking the first result
    // off the wire would get the best of one source, not of the notebook.
    const { search } = rpcReturning([
      [
        [SRC_A, [chunk(['second'], 1), chunk(['fourth'], 3)]],
        [SRC_B, [chunk(['first'], 0), chunk(['third'], 2)]],
      ],
    ]);

    const passages = await search.searchPassages(NB, 'q');
    expect(passages.map((p) => p.text)).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it('keeps only the best passages when a limit is given', async () => {
    const { search } = rpcReturning([
      [
        [SRC_A, [chunk(['worst'], 9)]],
        [SRC_B, [chunk(['best'], 0)]],
      ],
    ]);
    await expect(
      search.searchPassages(NB, 'q', { limit: 1 }).then((p) => p.map((x) => x.text))
    ).resolves.toEqual(['best']);
  });

  it('treats rank 0 as the best rank, not as a missing one', async () => {
    const { search } = rpcReturning([[[SRC_A, [chunk(['top'], 0)]]]]);
    const [passage] = await search.searchPassages(NB, 'q');
    expect(passage.rank).toBe(0);
  });

  it('reports no offsets rather than inventing a zero when the span is absent', async () => {
    // The server omits a leading zero instead of sending it. Reading that as
    // "starts at 0" would attribute a quote to the top of a long document.
    const { search } = rpcReturning([[[SRC_A, [chunk(['no span here'], 1)]]]]);
    const [passage] = await search.searchPassages(NB, 'q');
    expect([passage.start, passage.end]).toEqual([null, null]);
  });

  it('refuses a span that runs backwards', async () => {
    const { search } = rpcReturning([[[SRC_A, [[[[['x']]], 1, [[null, 90, 12]]]]]]]);
    const [passage] = await search.searchPassages(NB, 'q');
    expect([passage.start, passage.end]).toEqual([null, null]);
  });

  it('drops a passage whose parts are not all text instead of half-joining it', async () => {
    const { search } = rpcReturning([
      [
        [
          SRC_A,
          [
            [[[['good text']]], 0, []],
            [[[['half', 7]]], 1, []],
          ],
        ],
      ],
    ]);
    const passages = await search.searchPassages(NB, 'q');
    expect(passages.map((p) => p.text)).toEqual(['good text']);
  });

  it('reads an empty notebook, a null reply and an unexpected shape as no passages', async () => {
    for (const reply of [[[]], [], null, [null], 'nonsense']) {
      const { search } = rpcReturning(reply);
      await expect(search.searchPassages(NB, 'q')).resolves.toEqual([]);
    }
  });

  it('skips a source row with no usable id', async () => {
    const { search } = rpcReturning([
      [
        [null, [chunk(['orphan'], 0)]],
        [SRC_B, [chunk(['kept'], 1)]],
      ],
    ]);
    const passages = await search.searchPassages(NB, 'q');
    expect(passages.map((p) => p.text)).toEqual(['kept']);
  });
});
