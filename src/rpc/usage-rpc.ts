/**
 * Live compute-meter usage (quota) over the internal batchexecute RPC API.
 *
 * NotebookLM's quota is compute-based: a single unified meter with a five-hour
 * window and a weekly window, each expressed as a percentage, plus a per-action
 * table saying whether each kind of work still has quota. There is no daily
 * cap and no balance — the server owns the percentages and the reset times.
 *
 * Two reads, both account-scoped (no notebook):
 *   - GET_ACCOUNT (`SatQRc`)        → whether the meter is even enabled for this
 *                                     account (`PremiumUserInfo.computeMeteringEnabled`).
 *   - LIST_QUOTA_SUMMARY (`EylDcb`) → the windows and the per-action table,
 *                                     only called when the meter is enabled.
 *
 * The frontend fetches the summary only when the account bit is true; we do the
 * same, because a direct call on a disabled account returns prices over empty
 * sliding windows. When the bit is false we report `disabled` without the second
 * call.
 *
 * Protocol (rpc ids, request shapes, positional field map, status codes) read
 * from teng-lin/notebooklm-py (MIT): `docs/adr/0037-live-usage-and-quota-api.md`,
 * `src/notebooklm/_web/usage.py`, `src/notebooklm/_web/rows/usage.py`. Our own
 * implementation; the positions are interop facts.
 */

import { BatchExecuteClient } from './batchexecute.js';

export type UsageStatus = 'disabled' | 'ready' | 'skipped' | 'failed';

export type UsageWindowKind = 'five_hour' | 'weekly' | 'unknown';

export type UsageCostTier = 'low' | 'medium' | 'high' | 'very_high';

export interface UsageWindow {
  /** Rolling window this row measures. */
  kind: UsageWindowKind;
  /** Raw window code (1 five-hour, 2 weekly), kept for forward codes. */
  code: number;
  /** Percent of the window already spent, 0–100, or null if the server elided both halves. */
  used_percent: number | null;
  /** Percent of the window still available, 0–100, or null. */
  remaining_percent: number | null;
  /** When this window resets, ISO 8601 UTC, or null. */
  resets_at: string | null;
}

export interface UsageAction {
  /** Raw action code (1–22 at time of writing). */
  code: number;
  /** Named action, or null for a code newer than this client knows. */
  kind: string | null;
  /** Whether this kind of work can still be started right now. */
  has_sufficient_quota: boolean;
  /** Relative cost band, or null when the server did not send one. */
  cost_tier: UsageCostTier | null;
  /** Literal count of deferred artifact generations left, or null. */
  remaining_deferred_artifact_generations: number | null;
  /** The server's current estimate of this action's cost, as a percent of budget, or null. */
  estimated_cost_percent: number | null;
}

export interface UsageSummary {
  status: UsageStatus;
  /** False only when the account's compute-meter bit is off. */
  metering_enabled: boolean;
  windows: UsageWindow[];
  actions: UsageAction[];
  /**
   * The window the frontend would display: weekly once weekly usage reaches
   * 100%, five-hour otherwise. Null unless status is `ready`.
   */
  active_window: UsageWindow | null;
  /** Whether the active window is spent. Null unless status is `ready`. */
  is_exhausted: boolean | null;
}

// --- positional field map (notebooklm-py _web/rows/usage.py) -----------------

const ACCOUNT_PREMIUM_INFO_POS = 4; // account field 5
const ACCOUNT_METERING_ENABLED_POS = 6; // premium-user-info field 7

const SUMMARY_STATUS_POS = 0;
const SUMMARY_WINDOWS_POS = 1;
const SUMMARY_ACTIONS_POS = 3;

const WINDOW_CODE_POS = 4;
const WINDOW_RESET_POS = 5;
const WINDOW_USED_POS = 6;
const WINDOW_REMAINING_POS = 7;

const ACTION_CODE_POS = 0;
const ACTION_HAS_QUOTA_POS = 1;
const ACTION_DEFERRED_POS = 2;
const ACTION_COST_TIER_POS = 3;
const ACTION_EST_COST_POS = 5;

const STATUS_BY_CODE: Record<number, UsageStatus> = { 1: 'ready', 2: 'skipped', 3: 'failed' };

const WINDOW_KIND_BY_CODE: Record<number, UsageWindowKind> = { 1: 'five_hour', 2: 'weekly' };

const COST_TIER_BY_CODE: Record<number, UsageCostTier> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'very_high',
};

/** Exact `UserAction` enum names 1..22 (notebooklm-py ADR-0037). */
const ACTION_KIND_BY_CODE: Record<number, string> = {
  1: 'audio_overview',
  2: 'video_overview',
  3: 'breakdowns_video',
  4: 'shorts_video',
  5: 'infographic',
  6: 'slides',
  7: 'reports',
  8: 'tables',
  9: 'flashcards',
  10: 'quiz',
  11: 'mindmap',
  12: 'canvas',
  13: 'slides_editing',
  14: 'flashcard_editing',
  15: 'deep_research',
  16: 'nos',
  17: 'fast_research',
  18: 'qna',
  19: 'nos_image_generation',
  20: 'guided_view',
  21: 'document_guide',
  22: 'suggestion_chips',
};

const UNIX_EPOCH_MS = 0;

function at(value: unknown, pos: number): unknown {
  return Array.isArray(value) && pos < value.length ? value[pos] : undefined;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function nonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * Read `PremiumUserInfo.computeMeteringEnabled`. The GetAccount response has
 * appeared both as `[account]` and as a bare account array, so three nestings
 * are tried; anything but an explicit `true` is treated as disabled.
 */
export function decodeMeteringEnabled(raw: unknown): boolean {
  const candidates = [raw, at(raw, 0), at(at(raw, 0), 0)];
  for (const account of candidates) {
    const premium = at(account, ACCOUNT_PREMIUM_INFO_POS);
    const enabled = at(premium, ACCOUNT_METERING_ENABLED_POS);
    if (typeof enabled === 'boolean') return enabled;
  }
  return false;
}

/** Decode a JSPB `Timestamp` pair `[seconds, nanos]` to an ISO 8601 UTC string, or null. */
function decodeResetTimestamp(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const seconds = raw[0];
  const nanos = raw.length > 1 ? raw[1] : 0;
  if (typeof seconds !== 'number' || !Number.isInteger(seconds)) return null;
  if (typeof nanos !== 'number' || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1e9) {
    return null;
  }
  const ms = UNIX_EPOCH_MS + seconds * 1000 + Math.floor(nanos / 1e6);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * A used/remaining pair where the server elides whichever half is zero: an
 * unused window omits `used` (0), an exhausted one omits `remaining` (0). When
 * exactly one is present the other is derived as `100 - present`.
 */
function resolvePercents(
  usedRaw: unknown,
  remainingRaw: unknown
): { used: number | null; remaining: number | null } {
  const used = finiteNumber(usedRaw);
  const remaining = finiteNumber(remainingRaw);
  if (used !== null && remaining !== null) return { used, remaining };
  if (used !== null) return { used, remaining: 100 - used };
  if (remaining !== null) return { used: 100 - remaining, remaining };
  return { used: null, remaining: null };
}

function decodeWindow(row: unknown): UsageWindow | null {
  if (!Array.isArray(row)) return null;
  const code = at(row, WINDOW_CODE_POS);
  if (typeof code !== 'number') return null;
  const { used, remaining } = resolvePercents(
    at(row, WINDOW_USED_POS),
    at(row, WINDOW_REMAINING_POS)
  );
  return {
    kind: WINDOW_KIND_BY_CODE[code] ?? 'unknown',
    code,
    used_percent: used,
    remaining_percent: remaining,
    resets_at: decodeResetTimestamp(at(row, WINDOW_RESET_POS)),
  };
}

function decodeAction(row: unknown): UsageAction | null {
  if (!Array.isArray(row)) return null;
  const code = at(row, ACTION_CODE_POS);
  if (typeof code !== 'number') return null;
  const hasQuota = at(row, ACTION_HAS_QUOTA_POS);
  const costTier = at(row, ACTION_COST_TIER_POS);
  return {
    code,
    kind: ACTION_KIND_BY_CODE[code] ?? null,
    // Absent availability normalizes to false, matching the frontend.
    has_sufficient_quota: hasQuota === true,
    cost_tier: typeof costTier === 'number' ? (COST_TIER_BY_CODE[costTier] ?? null) : null,
    remaining_deferred_artifact_generations: nonNegativeInt(at(row, ACTION_DEFERRED_POS)),
    estimated_cost_percent: finiteNumber(at(row, ACTION_EST_COST_POS)),
  };
}

/**
 * Decode a ListQuotaSummary response into the public summary. Throws on a
 * FAILED status or a status this client does not recognise (schema drift),
 * rather than returning a confidently-wrong empty reading.
 */
export function decodeQuotaSummary(raw: unknown): UsageSummary {
  const statusCode = at(raw, SUMMARY_STATUS_POS);
  const status = typeof statusCode === 'number' ? STATUS_BY_CODE[statusCode] : undefined;
  if (status === 'failed') {
    throw new Error('NotebookLM reported the quota read failed (status 3)');
  }
  if (status === 'skipped') {
    return {
      status: 'skipped',
      metering_enabled: true,
      windows: [],
      actions: [],
      active_window: null,
      is_exhausted: null,
    };
  }
  if (status !== 'ready') {
    throw new Error(`Unexpected quota summary status: ${JSON.stringify(statusCode)}`);
  }

  const windowsRaw = at(raw, SUMMARY_WINDOWS_POS);
  const actionsRaw = at(raw, SUMMARY_ACTIONS_POS);
  const windows = Array.isArray(windowsRaw)
    ? windowsRaw.map(decodeWindow).filter((w): w is UsageWindow => w !== null)
    : [];
  const actions = Array.isArray(actionsRaw)
    ? actionsRaw.map(decodeAction).filter((a): a is UsageAction => a !== null)
    : [];

  const weekly = windows.find((w) => w.kind === 'weekly');
  const fiveHour = windows.find((w) => w.kind === 'five_hour');
  const active =
    weekly && (weekly.used_percent ?? 0) >= 100 ? weekly : (fiveHour ?? weekly ?? null);
  const isExhausted = active ? (active.used_percent ?? 0) >= 100 : null;

  return {
    status: 'ready',
    metering_enabled: true,
    windows,
    actions,
    active_window: active,
    is_exhausted: isExhausted,
  };
}

const DISABLED_SUMMARY: UsageSummary = {
  status: 'disabled',
  metering_enabled: false,
  windows: [],
  actions: [],
  active_window: null,
  is_exhausted: null,
};

export class UsageRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /**
   * Read the live compute-meter usage. Returns a `disabled` summary without the
   * second call when the account has no meter; otherwise the windows and the
   * per-action table.
   */
  async getUsage(): Promise<UsageSummary> {
    const account = await this.client.call('GET_ACCOUNT', []);
    if (!decodeMeteringEnabled(account)) return { ...DISABLED_SUMMARY };
    const summary = await this.client.call('LIST_QUOTA_SUMMARY', [null]);
    return decodeQuotaSummary(summary);
  }
}
