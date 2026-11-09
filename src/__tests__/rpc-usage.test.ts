/**
 * Unit tests for the live compute-meter usage decode (no network).
 *
 * The envelope is positional and elision-aware: a window omits whichever of
 * used/remaining is zero, and the meter is only read when the account bit is
 * on. These lock the positions (from teng-lin/notebooklm-py), the elision
 * derivation, the active-window selection, and the request payloads.
 */
import {
  UsageRpc,
  decodeMeteringEnabled,
  decodeQuotaSummary,
  type UsageSummary,
} from '../rpc/usage-rpc.js';

/** A `UsageRpc` whose client returns a queued result per call, recording params. */
function rpcReturning(...results: unknown[]) {
  const calls: Array<{ method: string; params: unknown; path?: string }> = [];
  let i = 0;
  const client = {
    call: async (method: string, params: unknown, path?: string) => {
      calls.push({ method, params, path });
      return results[i++];
    },
  };
  return { usage: new UsageRpc(client as never), calls };
}

/** Account envelope with the metering bit at account[4][6]. */
const account = (enabled: boolean | undefined) => {
  const premium: unknown[] = [];
  premium[6] = enabled;
  const acc: unknown[] = [];
  acc[4] = premium;
  return acc;
};

/** One window row: code at [4], reset [5], used [6], remaining [7]. */
const windowRow = (
  code: number,
  opts: { used?: number; remaining?: number; reset?: [number, number] } = {}
) => {
  const row: unknown[] = [];
  row[4] = code;
  if (opts.reset !== undefined) row[5] = opts.reset;
  if (opts.used !== undefined) row[6] = opts.used;
  if (opts.remaining !== undefined) row[7] = opts.remaining;
  return row;
};

/** One action row: code [0], hasQuota [1], deferred [2], costTier [3], estCost [5]. */
const actionRow = (
  code: number,
  opts: { quota?: boolean; deferred?: number; tier?: number; cost?: number } = {}
) => {
  const row: unknown[] = [];
  row[0] = code;
  if (opts.quota !== undefined) row[1] = opts.quota;
  if (opts.deferred !== undefined) row[2] = opts.deferred;
  if (opts.tier !== undefined) row[3] = opts.tier;
  if (opts.cost !== undefined) row[5] = opts.cost;
  return row;
};

/** Summary: status [0], windows [1], actions [3]. */
const summary = (status: number, windows: unknown[], actions: unknown[]) => {
  const s: unknown[] = [];
  s[0] = status;
  s[1] = windows;
  s[3] = actions;
  return s;
};

describe('decodeMeteringEnabled', () => {
  it('reads the bit as a bare account array', () => {
    expect(decodeMeteringEnabled(account(true))).toBe(true);
    expect(decodeMeteringEnabled(account(false))).toBe(false);
  });
  it('reads the bit when wrapped as [account]', () => {
    expect(decodeMeteringEnabled([account(true)])).toBe(true);
  });
  it('treats an absent bit as disabled', () => {
    expect(decodeMeteringEnabled(account(undefined))).toBe(false);
    expect(decodeMeteringEnabled(null)).toBe(false);
    expect(decodeMeteringEnabled([])).toBe(false);
  });
});

describe('decodeQuotaSummary', () => {
  it('decodes a ready summary with both windows and derives the elided halves', () => {
    const out = decodeQuotaSummary(
      summary(
        1,
        [
          windowRow(1, { used: 1.87, reset: [1_800_000_000, 0] }), // five-hour, remaining elided
          windowRow(2, { remaining: 99.9 }), // weekly, used elided
        ],
        [actionRow(18, { quota: true, tier: 2, cost: 0.5 })]
      )
    );
    expect(out.status).toBe('ready');
    const five = out.windows.find((w) => w.kind === 'five_hour')!;
    expect(five.used_percent).toBeCloseTo(1.87);
    expect(five.remaining_percent).toBeCloseTo(98.13); // 100 - used
    expect(five.resets_at).toBe(new Date(1_800_000_000_000).toISOString());
    const weekly = out.windows.find((w) => w.kind === 'weekly')!;
    expect(weekly.used_percent).toBeCloseTo(0.1); // 100 - remaining
    const qna = out.actions[0];
    expect(qna.kind).toBe('qna');
    expect(qna.has_sufficient_quota).toBe(true);
    expect(qna.cost_tier).toBe('medium');
    expect(qna.estimated_cost_percent).toBeCloseTo(0.5);
  });

  it('selects the five-hour window as active when weekly is not exhausted', () => {
    const out = decodeQuotaSummary(
      summary(1, [windowRow(1, { used: 40 }), windowRow(2, { used: 10 })], [])
    );
    expect(out.active_window?.kind).toBe('five_hour');
    expect(out.is_exhausted).toBe(false);
  });

  it('selects weekly as active once weekly usage reaches 100', () => {
    const out = decodeQuotaSummary(
      summary(1, [windowRow(1, { used: 40 }), windowRow(2, { used: 100 })], [])
    );
    expect(out.active_window?.kind).toBe('weekly');
    expect(out.is_exhausted).toBe(true);
  });

  it('maps an unknown action code to a null kind without dropping it', () => {
    const out = decodeQuotaSummary(summary(1, [], [actionRow(99, { quota: false })]));
    expect(out.actions[0].code).toBe(99);
    expect(out.actions[0].kind).toBeNull();
    expect(out.actions[0].has_sufficient_quota).toBe(false);
  });

  it('returns a skipped summary on status 2', () => {
    const out = decodeQuotaSummary(summary(2, [], []));
    expect(out.status).toBe('skipped');
    expect(out.active_window).toBeNull();
    expect(out.is_exhausted).toBeNull();
  });

  it('throws on a failed status', () => {
    expect(() => decodeQuotaSummary(summary(3, [], []))).toThrow(/failed/i);
  });

  it('throws on an unrecognised status (schema drift)', () => {
    expect(() => decodeQuotaSummary(summary(7, [], []))).toThrow(/status/i);
  });
});

describe('UsageRpc.getUsage', () => {
  it('skips the summary call and reports disabled when the meter is off', async () => {
    const { usage, calls } = rpcReturning(account(false));
    const out: UsageSummary = await usage.getUsage();
    expect(out.status).toBe('disabled');
    expect(out.metering_enabled).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET_ACCOUNT');
    expect(calls[0].params).toEqual([]);
  });

  it('calls the summary with [null] when the meter is on', async () => {
    const { usage, calls } = rpcReturning(
      account(true),
      summary(1, [windowRow(1, { used: 5 })], [])
    );
    const out = await usage.getUsage();
    expect(out.status).toBe('ready');
    expect(calls).toHaveLength(2);
    expect(calls[1].method).toBe('LIST_QUOTA_SUMMARY');
    expect(calls[1].params).toEqual([null]);
  });
});
