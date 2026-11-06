/**
 * Unit tests for retrying a failed artifact (no network).
 *
 * The point of the call is that the id SURVIVES: a caller holding a reference
 * to the failed artifact keeps it. Deleting and regenerating would mint a new
 * one, so the test that matters most is the one asserting the id came back
 * unchanged — and that a reply with no row is refused rather than reported as
 * a queued retry, which would send the caller polling an artifact nobody
 * re-queued.
 */
import { StudioRpc } from '../rpc/studio-rpc.js';

function rpcReturning(result: unknown) {
  const calls: Array<{ method: string; params: unknown; path: string }> = [];
  const client = {
    call: async (method: string, params: unknown, path: string) => {
      calls.push({ method, params, path });
      return result;
    },
  };
  return { studio: new StudioRpc(client as never), calls };
}

function rpcThrowing(error: Error) {
  const client = {
    call: async () => {
      throw error;
    },
  };
  return new StudioRpc(client as never);
}

const NB = '11111111-2222-3333-4444-555555555555';
const ART = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/** An artifact row: id, title, type, …, status at slot 4. */
const row = (id: string, status: number) => [id, 'Briefing doc', 2, null, status];

describe('StudioRpc.retryArtifact', () => {
  it('sends the artifact id behind the fixed options blob, scoped to the notebook', async () => {
    const { studio, calls } = rpcReturning([row(ART, 1)]);
    await studio.retryArtifact(NB, ART);

    expect(calls[0].method).toBe('RETRY_ARTIFACT');
    expect(calls[0].path).toBe(`/notebook/${NB}`);
    const params = calls[0].params as unknown[];
    expect(params[1]).toBe(ART);
    // The blob is type-agnostic and sent verbatim; its trailing list is a
    // static capability set, not a description of this artifact.
    expect(params[0]).toEqual([
      2,
      null,
      null,
      [1, null, null, null, null, null, null, null, null, null, [1]],
      [[1, 4, 8, 2, 3, 6]],
    ]);
  });

  it('keeps the same id and reports the artifact back in progress', async () => {
    // This is the whole reason the call exists. A new id here would mean
    // every reference the caller holds has silently gone stale.
    const { studio } = rpcReturning([row(ART, 1)]);
    await expect(studio.retryArtifact(NB, ART)).resolves.toEqual({
      artifactId: ART,
      status: 'in_progress',
    });
  });

  it('sends the same blob whatever the artifact type', async () => {
    const { studio, calls } = rpcReturning([[ART, 'Audio overview', 1, null, 1]]);
    await studio.retryArtifact(NB, ART);
    const audioBlob = (calls[0].params as unknown[])[0];

    const second = rpcReturning([[ART, 'Infographic', 7, null, 1]]);
    await second.studio.retryArtifact(NB, ART);
    expect((second.calls[0].params as unknown[])[0]).toEqual(audioBlob);
  });

  it('refuses a reply with no artifact row instead of claiming a retry', async () => {
    for (const reply of [[], [null], null, [[]], 'nonsense']) {
      const { studio } = rpcReturning(reply);
      await expect(studio.retryArtifact(NB, ART)).rejects.toThrow('did not accept the retry');
    }
  });

  it('names the artifact in that refusal, so the caller knows which one', async () => {
    const { studio } = rpcReturning([]);
    await expect(studio.retryArtifact(NB, ART)).rejects.toThrow(ART);
  });

  it('lets a server refusal through rather than swallowing it', async () => {
    // A rate limit or a non-retryable artifact arrives as a thrown status.
    // Converting that into a successful-looking result would hide a quota
    // problem behind an artifact that never moves.
    const studio = rpcThrowing(new Error('RESOURCE_EXHAUSTED'));
    await expect(studio.retryArtifact(NB, ART)).rejects.toThrow('RESOURCE_EXHAUSTED');
  });

  it('reports a row that comes back already failed as failed, not as queued', async () => {
    const { studio } = rpcReturning([row(ART, 4)]);
    await expect(studio.retryArtifact(NB, ART)).resolves.toEqual({
      artifactId: ART,
      status: 'failed',
    });
  });
});
