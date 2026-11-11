/**
 * Unit test for cancelling a research run (no network).
 *
 * Locks the positional cancel shape — field 3 carries the run id, field 1 is
 * omitted — and the fire-and-forget contract: the server replies empty and does
 * not validate the id, so the call resolves regardless.
 */
import { ResearchRpc } from '../rpc/extensions-rpc.js';

/** A `ResearchRpc` whose client returns `result` for every call, recording params. */
function rpcReturning(result: unknown) {
  const calls: Array<{ method: string; params: unknown; path: string }> = [];
  const client = {
    call: async (method: string, params: unknown, path: string) => {
      calls.push({ method, params, path });
      return result;
    },
  };
  return { research: new ResearchRpc(client as never), calls };
}

const NB = '11111111-2222-3333-4444-555555555555';
const RUN = 'ffffffff-0000-1111-2222-333333333333';

describe('ResearchRpc.cancel', () => {
  it('sends [null, null, runId] scoped to the notebook', async () => {
    const { research, calls } = rpcReturning([]);
    await research.cancel(NB, RUN);
    expect(calls[0].method).toBe('CANCEL_RESEARCH');
    expect(calls[0].params).toEqual([null, null, RUN]);
    expect(calls[0].path).toBe(`/notebook/${NB}`);
  });

  it('resolves even when the server replies empty (fire-and-forget)', async () => {
    const { research } = rpcReturning([]);
    await expect(research.cancel(NB, RUN)).resolves.toBeUndefined();
  });
});
