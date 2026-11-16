/**
 * Copying a notebook, sources or Studio artifacts (no network).
 *
 * Locks the three request shapes and reply offsets read from
 * teng-lin/notebooklm-py's recorded replies (tests/fixtures/rpc_golden/COPY_*),
 * and the one rule that matters most for a copy: it is not idempotent, so the
 * client must not replay it after a failure that could have followed the write.
 */
import {
  BatchExecuteClient,
  RpcError,
  RpcStatusError,
  RpcUnauthorizedError,
} from '../rpc/batchexecute.js';
import {
  CopyRpc,
  parseCopiedArtifacts,
  parseCopiedNotebook,
  parseCopiedSources,
} from '../rpc/copy-rpc.js';

const SRC_NB = '11111111-2222-3333-4444-555555555555';
const DST_NB = '99999999-8888-7777-6666-555555555555';
const CONTEXT = [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]];

/** A CopyRpc whose client returns `result` for every call, recording what was sent. */
function copyReturning(result: unknown) {
  const calls: Array<{ method: string; params: unknown; path: string; opts: unknown }> = [];
  const client = {
    call: async (method: string, params: unknown, path: string, opts: unknown) => {
      calls.push({ method, params, path, opts });
      return result;
    },
  };
  return { copy: new CopyRpc(client as never), calls };
}

describe('copy replies', () => {
  it('reads the new notebook id, title and sources from a CopyProject reply', () => {
    const reply = ['Thesis copy', [[['SRC_COPY_1'], 'Chapter 1.pdf']], 'NB_COPY_1'];
    expect(parseCopiedNotebook(reply, SRC_NB)).toEqual({
      id: 'NB_COPY_1',
      title: 'Thesis copy',
      url: 'https://notebooklm.google.com/notebook/NB_COPY_1',
      sources: [{ id: 'SRC_COPY_1', title: 'Chapter 1.pdf' }],
    });
  });

  it('refuses a CopyProject reply with no id, or one naming the source notebook', () => {
    expect(() => parseCopiedNotebook(['t', [], null], SRC_NB)).toThrow(/no notebook id/);
    expect(() => parseCopiedNotebook(['t', [], SRC_NB], SRC_NB)).toThrow(/not a copy/);
  });

  it('maps each original source id to its copy', () => {
    const reply = [
      [[['SRC_1'], [['SRC_2'], 'Python Programming', [null, null, null, null, 8], [null, 1]]]],
    ];
    expect(parseCopiedSources(reply)).toEqual([
      { originalId: 'SRC_1', newId: 'SRC_2', title: 'Python Programming' },
    ]);
  });

  it('maps each original artifact id (a bare string) to its copy', () => {
    const reply = [
      [
        [
          'ART_1',
          [
            'ART_2',
            'ML Quiz',
            4,
            [[['SRC_1'], null, 8]],
            1,
            null,
            null,
            null,
            null,
            null,
            [null, [1]],
          ],
        ],
      ],
    ];
    expect(parseCopiedArtifacts(reply)).toEqual([
      { originalId: 'ART_1', newId: 'ART_2', title: 'ML Quiz' },
    ]);
  });

  it('reads an empty or unexpected reply as no copies, not a crash', () => {
    expect(parseCopiedSources(null)).toEqual([]);
    expect(parseCopiedArtifacts([[]])).toEqual([]);
  });
});

describe('copy requests', () => {
  it('copies a notebook with [context, sourceId, title], scoped to the source', async () => {
    const { copy, calls } = copyReturning(['T', [], 'NB_COPY_1']);
    await copy.copyNotebook(SRC_NB, 'T');
    expect(calls[0]).toEqual({
      method: 'COPY_NOTEBOOK',
      params: [CONTEXT, SRC_NB, 'T'],
      path: `/notebook/${SRC_NB}`,
      opts: { idempotent: false },
    });
  });

  it('copies sources with [null, null, [[id]…], target]', async () => {
    const { copy, calls } = copyReturning([[]]);
    await copy.copySources(SRC_NB, ['S1', 'S2'], DST_NB);
    expect(calls[0].method).toBe('COPY_SOURCES');
    expect(calls[0].params).toEqual([null, null, [['S1'], ['S2']], DST_NB]);
    expect(calls[0].path).toBe(`/notebook/${SRC_NB}`);
    expect(calls[0].opts).toEqual({ idempotent: false });
  });

  it('copies artifacts with [context, [id…], target] — bare ids, not wrapped', async () => {
    const { copy, calls } = copyReturning([[]]);
    await copy.copyArtifacts(SRC_NB, ['A1'], DST_NB);
    expect(calls[0].method).toBe('COPY_ARTIFACTS');
    expect(calls[0].params).toEqual([CONTEXT, ['A1'], DST_NB]);
    expect(calls[0].opts).toEqual({ idempotent: false });
  });
});

describe('a non-idempotent call is never replayed after a write may have happened', () => {
  /** A client whose first callOnce throws `first`, and whose second succeeds. */
  function clientFailingOnceWith(first: Error) {
    const client = Object.create(BatchExecuteClient.prototype) as BatchExecuteClient;
    let attempts = 0;
    Object.assign(client, {
      bootstrap: async () => undefined,
      callOnce: async () => {
        attempts += 1;
        if (attempts === 1) throw first;
        return 'second attempt';
      },
    });
    return { client, attempts: () => attempts };
  }

  it('does not retry a lost reply, and says the write may have been applied', async () => {
    const { client, attempts } = clientFailingOnceWith(
      new RpcError('RPC "COPY_NOTEBOOK" response parse failed', 'COPY_NOTEBOOK')
    );
    await expect(client.call('COPY_NOTEBOOK', [], '/', { idempotent: false })).rejects.toThrow(
      /may already have been applied/
    );
    expect(attempts()).toBe(1);
  });

  it('still retries a sign-in bounce, which proves nothing was written', async () => {
    const { client, attempts } = clientFailingOnceWith(
      new RpcUnauthorizedError('RPC "COPY_NOTEBOOK" unauthorized (HTTP 401)', 'COPY_NOTEBOOK')
    );
    await expect(client.call('COPY_NOTEBOOK', [], '/', { idempotent: false })).resolves.toBe(
      'second attempt'
    );
    expect(attempts()).toBe(2);
  });

  it('still retries UNAUTHENTICATED (status 16)', async () => {
    const { client, attempts } = clientFailingOnceWith(
      new RpcStatusError('COPY_NOTEBOOK', 'te3DCe', 16)
    );
    await client.call('COPY_NOTEBOOK', [], '/', { idempotent: false });
    expect(attempts()).toBe(2);
  });

  it('leaves ordinary (idempotent) calls retrying as before', async () => {
    const { client, attempts } = clientFailingOnceWith(
      new RpcError('RPC "LIST_NOTEBOOKS" response parse failed', 'LIST_NOTEBOOKS')
    );
    await expect(client.call('LIST_NOTEBOOKS', [])).resolves.toBe('second attempt');
    expect(attempts()).toBe(2);
  });
});
