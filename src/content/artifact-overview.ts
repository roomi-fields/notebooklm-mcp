/**
 * Turning Studio artifact rows into the content overview callers read.
 *
 * This lived inline in `list_content` and quietly dropped everything that was
 * not finished: `filter(a => a.status === 'completed')`. So a generation that
 * failed simply vanished from the listing, which made the failure
 * indistinguishable from never having asked — and made `retry_content`
 * unusable, since a caller cannot retry an id it was never shown.
 *
 * `GeneratedContent.status` has carried `'generating' | 'ready' | 'failed'`
 * all along. The filter was narrower than the type it was filling.
 */

import type { ContentType, GeneratedContent } from './types.js';
import type { StudioArtifact } from '../rpc/studio-rpc.js';

/** Studio's numeric artifact types, as our own content names. */
export const ARTIFACT_TYPE_NAMES: Record<number, ContentType> = {
  1: 'audio_overview',
  2: 'report',
  3: 'video',
  7: 'infographic',
  8: 'presentation',
  9: 'data_table',
};

/** How an artifact's RPC status reads in the overview. */
function overviewStatus(status: StudioArtifact['status']): GeneratedContent['status'] | null {
  if (status === 'completed') return 'ready';
  if (status === 'failed') return 'failed';
  if (status === 'in_progress') return 'generating';
  // 'unknown' means we could not read the row's status slot. Guessing either
  // way would be worse than leaving the row out: calling it ready invites a
  // download that cannot work, calling it failed invites a pointless retry.
  return null;
}

/**
 * Map polled artifacts to the overview's generated-content entries.
 *
 * Artifacts of a type we have no name for are left out — the overview is
 * typed by content name, and inventing one would put a row in the listing
 * that no other tool could act on.
 *
 * @param createdAt timestamp for rows the RPC does not date. Passed in rather
 *                  than read from the clock so a caller can keep a listing
 *                  stable, and so this stays testable.
 */
export function toGeneratedContent(
  artifacts: StudioArtifact[],
  createdAt: string
): GeneratedContent[] {
  const out: GeneratedContent[] = [];
  for (const a of artifacts) {
    const type = ARTIFACT_TYPE_NAMES[a.typeCode];
    if (!type) continue;
    const status = overviewStatus(a.status);
    if (!status) continue;
    out.push({
      id: a.id,
      type,
      name: a.title || String(type),
      status,
      createdAt,
      // Only a finished artifact has anything to hand over. A half-written
      // media URL on an in-progress row is a download that fails later.
      url: status === 'ready' ? a.mediaUrl : undefined,
      content: status === 'ready' ? a.textContent : undefined,
    });
  }
  return out;
}
