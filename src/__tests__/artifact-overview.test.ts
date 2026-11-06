/**
 * The content listing used to drop everything that was not finished.
 *
 * `list_content` filtered on `status === 'completed'`, so a failed generation
 * disappeared from the listing entirely: indistinguishable from never having
 * been asked for, and its id unreachable — which left `retry_content` with
 * nothing to be called with. `GeneratedContent.status` had carried
 * `generating | ready | failed` all along; the filter was narrower than the
 * type it was filling.
 */

import { describe, it, expect } from '@jest/globals';
import { toGeneratedContent, ARTIFACT_TYPE_NAMES } from '../content/artifact-overview.js';
import type { StudioArtifact } from '../rpc/studio-rpc.js';

const AT = '2026-11-06T00:00:00.000Z';

const artifact = (over: Partial<StudioArtifact> = {}): StudioArtifact => ({
  id: 'id-1',
  typeCode: 2,
  title: 'Briefing doc',
  status: 'completed',
  ...over,
});

describe('toGeneratedContent', () => {
  it('keeps a failed artifact, with its id, so it can be retried', () => {
    const out = toGeneratedContent([artifact({ id: 'failed-1', status: 'failed' })], AT);
    expect(out).toEqual([
      {
        id: 'failed-1',
        type: 'report',
        name: 'Briefing doc',
        status: 'failed',
        createdAt: AT,
        url: undefined,
        content: undefined,
      },
    ]);
  });

  it('reports one still running as generating rather than hiding it', () => {
    const out = toGeneratedContent([artifact({ status: 'in_progress' })], AT);
    expect(out.map((c) => c.status)).toEqual(['generating']);
  });

  it('hands over a URL and text only for a finished artifact', () => {
    const [ready] = toGeneratedContent(
      [artifact({ status: 'completed', mediaUrl: 'https://x/a.m4a', textContent: 'body' })],
      AT
    );
    expect([ready.url, ready.content]).toEqual(['https://x/a.m4a', 'body']);

    // An in-progress row can carry a half-written media URL; handing it over
    // produces a download that fails later, for no stated reason.
    const [running] = toGeneratedContent(
      [artifact({ status: 'in_progress', mediaUrl: 'https://x/partial.m4a' })],
      AT
    );
    expect(running.url).toBeUndefined();
  });

  it('leaves out a row whose status could not be read', () => {
    // Guessing is worse either way: "ready" invites a download that cannot
    // work, "failed" invites a pointless retry.
    expect(toGeneratedContent([artifact({ status: 'unknown' })], AT)).toEqual([]);
  });

  it('leaves out an artifact type the overview has no name for', () => {
    expect(toGeneratedContent([artifact({ typeCode: 99 })], AT)).toEqual([]);
  });

  it('names every type the Studio generator can produce', () => {
    expect(Object.values(ARTIFACT_TYPE_NAMES).sort()).toEqual([
      'audio_overview',
      'data_table',
      'infographic',
      'presentation',
      'report',
      'video',
    ]);
  });

  it('falls back to the type as a name when the artifact has no title', () => {
    const [c] = toGeneratedContent([artifact({ title: '' })], AT);
    expect(c.name).toBe('report');
  });

  it('keeps the three states side by side, in order', () => {
    const out = toGeneratedContent(
      [
        artifact({ id: 'a', status: 'completed' }),
        artifact({ id: 'b', status: 'failed' }),
        artifact({ id: 'c', status: 'in_progress' }),
      ],
      AT
    );
    expect(out.map((c) => [c.id, c.status])).toEqual([
      ['a', 'ready'],
      ['b', 'failed'],
      ['c', 'generating'],
    ]);
  });
});
