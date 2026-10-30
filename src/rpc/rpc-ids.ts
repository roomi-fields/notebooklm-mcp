/**
 * NotebookLM internal `batchexecute` RPC IDs.
 *
 * These are the method IDs Google's own NotebookLM / "Gemini Notebook" web app
 * sends to `/_/LabsTailwindUi/data/batchexecute`. Driving them directly (instead
 * of automating the DOM) is immune to UI redesigns like the 2026-07 rebrand.
 *
 * ⚠️ Google rotates these IDs without notice (a UI-version bump can change them).
 * When that happens the affected call returns an RPC-drift error; hot-patch a
 * rotated id at runtime via the `NOTEBOOKLM_RPC_OVERRIDES` env var (JSON object
 * mapping the constant name to the new id) — no release needed. Example:
 *   NOTEBOOKLM_RPC_OVERRIDES='{"LIST_NOTEBOOKS":"abc123"}'
 *
 * Protocol reference: the open-source `jacob-bd/gemini-notebook-mcp-cli`
 * (Python) documents the same ids; the ids themselves are interop facts.
 */

export const RPC_IDS = {
  // Notebooks
  LIST_NOTEBOOKS: 'wXbhsf',
  GET_NOTEBOOK: 'rLM1Ne',
  CREATE_NOTEBOOK: 'CCqFvf',
  RENAME_NOTEBOOK: 's0tc2d',
  DELETE_NOTEBOOK: 'WWINqb',

  // Sources
  ADD_SOURCE: 'izAoDd', // URL / text / Drive (legacy)
  ADD_SOURCE_URL_V2: 'ozz5Z', // URL source (new rollout)
  ADD_SOURCE_FILE: 'o4cbdc', // register file for resumable upload
  GET_SOURCE: 'hizoJc',
  CHECK_SOURCE_FRESHNESS: 'yR9Yof',
  SYNC_DRIVE_SOURCE: 'FLmJqe',
  DELETE_SOURCE: 'tGMBJ',
  RENAME_SOURCE: 'b7Wfje',
  // Registered by a lazily loaded module, so it never appears in the homepage
  // bundle a drift scraper reads — a rotation here surfaces as a failing call.
  SEARCH_PASSAGES: 'ASU5Oe',

  // Chat / conversation
  GET_CONVERSATIONS: 'hPTbtc',
  GET_CONVERSATION_TURNS: 'khqZz',
  DELETE_CHAT_HISTORY: 'J7Gthc',
  GET_SUMMARY: 'VfAZjd',
  GET_SOURCE_GUIDE: 'tr032e',

  // Research (source discovery)
  START_FAST_RESEARCH: 'Ljjv0c',
  START_DEEP_RESEARCH: 'QA9ei',
  POLL_RESEARCH: 'e3bVqc',
  IMPORT_RESEARCH: 'LBwxtb',

  // Studio content (audio / video overview share one create+poll)
  CREATE_STUDIO: 'R7cb6c',
  POLL_STUDIO: 'gArtLc',
  DELETE_STUDIO: 'V5N4be',
  RENAME_ARTIFACT: 'rc3d8d',
  GET_INTERACTIVE_HTML: 'v9rmvd', // quiz / flashcard HTML
  REVISE_SLIDE_DECK: 'KmcKPe',

  // Mind maps
  GENERATE_MIND_MAP: 'yyryJe',
  SAVE_MIND_MAP: 'CYK0Xb',
  LIST_MIND_MAPS: 'cFji9',
  DELETE_MIND_MAP: 'AH0mwd',

  // Notes (share ids with mind maps, differ by params)
  CREATE_NOTE: 'CYK0Xb',
  GET_NOTES: 'cFji9',
  UPDATE_NOTE: 'cYAfTb',
  DELETE_NOTE: 'AH0mwd',

  // Labels
  LABEL_LIST: 'I3xc3c', // GetLabels — listing is its own RPC, NOT a mode of create
  LABEL_CREATE: 'agX4Bc', // CreateLabel (manual create + AI grouping)
  LABEL_MUTATE: 'le8sX',
  LABEL_DELETE: 'GyzE7e',

  // Sharing
  SHARE_NOTEBOOK: 'QDyure',
  GET_SHARE_STATUS: 'JFMDGd',

  // Export (to Google Docs / Sheets)
  EXPORT_ARTIFACT: 'Krh3pd',
} as const;

export type RpcName = keyof typeof RPC_IDS;

/** Build label (`bl` query param). Rotates with UI versions; env-overridable. */
export const BL_FALLBACK = 'boq_labs-tailwind-frontend_20260108.06_p0';

/**
 * Resolve the effective RPC id for a name, applying `NOTEBOOKLM_RPC_OVERRIDES`.
 * Unknown override keys are ignored (never silently disables a call).
 */
export function resolveRpcId(name: RpcName): string {
  const raw = process.env.NOTEBOOKLM_RPC_OVERRIDES?.trim();
  if (raw) {
    try {
      const overrides = JSON.parse(raw) as Record<string, string>;
      if (overrides && typeof overrides === 'object' && typeof overrides[name] === 'string') {
        return overrides[name];
      }
    } catch {
      // malformed override JSON → ignore, fall back to the built-in id
    }
  }
  return RPC_IDS[name];
}

/** Effective build label: env override → fallback constant. */
export function resolveBuildLabel(): string {
  return process.env.NOTEBOOKLM_BL?.trim() || BL_FALLBACK;
}
