/**
 * NotebookLM internal `batchexecute` RPC transport.
 *
 * Speaks the same wire protocol as Google's own "Gemini Notebook" web app,
 * driving the documented-by-behaviour RPC endpoints directly over HTTP instead
 * of automating the DOM. This is immune to UI redesigns (the 2026-07 rebrand
 * broke every DOM selector; the RPCs were untouched).
 *
 * Auth is reused from the existing browser session: the caller supplies the
 * account cookies (from the persistent Playwright context / auto-reauth). Tokens
 * that gate each request (`at` CSRF, `f.sid` session, `bl` build label) are
 * bootstrapped once by scraping the authenticated homepage HTML.
 *
 * Wire format (verified against live traffic):
 *   POST {base}/_/LabsTailwindUi/data/batchexecute
 *        ?rpcids={id}&source-path={path}&bl={bl}&hl={hl}&rt=c[&f.sid={sid}]
 *   body: f.req=<urlenc([[[id, JSON(params), null, "generic"]]])>&at=<urlenc(csrf)>&
 *   resp: )]}'\n<size>\n<json chunk>...   (envelopes: ["wrb.fr", id, "<inner-json>", ...])
 */

import { log } from '../utils/logger.js';
import { resolveRpcId, resolveBuildLabel, type RpcName } from './rpc-ids.js';

const DEFAULT_HOST = 'notebooklm.google.com';
const QUERY_ENDPOINT =
  '/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface RpcCookie {
  name: string;
  value: string;
}

export interface BatchExecuteOptions {
  /** Account cookies (from the authenticated Playwright context). */
  cookies: RpcCookie[];
  /** Host the account is signed in on (personal → notebooklm.google.com; some Workspace tenants → notebook.google.com). */
  baseHost?: string;
  /** UI language for the `hl` param. */
  hl?: string;
}

export class RpcError extends Error {
  constructor(
    message: string,
    readonly rpcName: RpcName,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/** Thrown when a call yields no envelope for its rpc id — the tell-tale of a rotated (drifted) RPC id. */
export class RpcDriftError extends RpcError {
  constructor(rpcName: RpcName, id: string) {
    super(
      `RPC "${rpcName}" (${id}) is not in the response — the server answered ` +
        `without an envelope for this id, which means it no longer knows it. ` +
        `Hot-patch a rotated id via NOTEBOOKLM_RPC_OVERRIDES='{"${rpcName}":"<new-id>"}'.`,
      rpcName
    );
    this.name = 'RpcDriftError';
  }
}

/**
 * The canonical gRPC status codes the backend puts at index 5 of a `wrb.fr`
 * envelope when it refuses a call. Standard codes; the mapping is confirmed
 * against teng-lin/notebooklm-py's decoder (MIT).
 */
const GRPC_STATUS: Record<number, string> = {
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  10: 'ABORTED',
  11: 'OUT_OF_RANGE',
  12: 'UNIMPLEMENTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  15: 'DATA_LOSS',
  16: 'UNAUTHENTICATED',
};

/** What a refusal actually means for someone using this server. */
const STATUS_ADVICE: Record<number, string> = {
  5: 'the notebook, source or artifact does not exist (or is not visible to this account)',
  7:
    'this account may not do that on this notebook. Most often the notebook is ' +
    'shared with the account rather than owned by it — NotebookLM only lets you ' +
    'generate content in your own notebooks. A Workspace policy can also cause it',
  8: 'a quota is exhausted — NotebookLM caps generation per day',
  9: 'the notebook is not in a state that allows this (e.g. sources still processing)',
  12: 'NotebookLM no longer implements this operation',
  16: 'the session is no longer authenticated — run auth_setup',
};

/**
 * The server answered for this id, and refused.
 *
 * Distinct from {@link RpcDriftError} on purpose: a refusal carries an
 * envelope for the id, a rotated id carries none at all. Conflating them told
 * users to go hunting for a replacement id that was never the problem.
 */
/**
 * The request was turned away before the server acted on it (HTTP 401/403, or
 * a redirect to the Google sign-in page). Nothing was written, so this is the
 * one failure a non-idempotent call may safely retry after re-bootstrapping.
 */
export class RpcUnauthorizedError extends RpcError {}

export class RpcStatusError extends RpcError {
  constructor(
    rpcName: RpcName,
    id: string,
    readonly status: number
  ) {
    const label = GRPC_STATUS[status] ?? `status ${status}`;
    const advice = STATUS_ADVICE[status];
    super(
      `RPC "${rpcName}" (${id}) was refused by NotebookLM: ${label}` +
        (advice ? ` — ${advice}.` : '.'),
      rpcName
    );
    this.name = 'RpcStatusError';
  }
}

/** Sentinel thrown by the pure parser when the envelope carries a gRPC status. */
export class RpcStatusRefusal extends Error {
  constructor(readonly status: number) {
    super(`batchexecute refused with status ${status}`);
    this.name = 'RpcStatusRefusal';
  }
}

/** Sentinel thrown by the pure parser when the server returned an `er` error envelope. */
export class RpcServerError extends Error {
  constructor(readonly envelope: unknown) {
    super('batchexecute server error envelope');
    this.name = 'RpcServerError';
  }
}

/**
 * Parse an anti-XSSI-prefixed, chunked `batchexecute` response and return the
 * inner payload for `id`. Pure (no network) so it is unit-testable.
 * @returns the parsed inner value, or `undefined` if no envelope matched `id`
 *          (the tell-tale of a rotated rpc id). Throws {@link RpcServerError}
 *          if the server returned an `er` error envelope.
 */
export function parseBatchExecute(text: string, id: string): unknown {
  let body = text;
  if (body.startsWith(")]}'")) body = body.slice(4);

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || !line.startsWith('[')) continue; // skip byte-count / blank lines
    let chunk: unknown;
    try {
      chunk = JSON.parse(line);
    } catch {
      continue;
    }
    if (!Array.isArray(chunk)) continue;
    for (const env of chunk as unknown[]) {
      if (!Array.isArray(env)) continue;
      if (env[0] === 'wrb.fr' && env[1] === id) {
        if (typeof env[2] === 'string') return JSON.parse(env[2]);
        // The envelope is here but carries no data. Index 5 says why: a
        // one-element array holding a gRPC status code. Reading it is the
        // difference between "NotebookLM refused this" and the drift error we
        // used to raise, which sent people looking for a rotated id.
        const status = Array.isArray(env[5]) ? env[5][0] : undefined;
        if (typeof status === 'number' && status !== 0) throw new RpcStatusRefusal(status);
        return null; // present, empty, and not an error — a legitimately null result
      }
      if (env[0] === 'er') throw new RpcServerError(env);
    }
  }
  return undefined;
}

export class BatchExecuteClient {
  private readonly baseUrl: string;
  private readonly hl: string;
  private cookieHeader: string;
  private csrfToken = '';
  private sessionId = '';
  private buildLabel = resolveBuildLabel();
  private bootstrapped = false;
  private reqidCounter = 100000 + Math.floor(Date.now() % 800000);

  constructor(opts: BatchExecuteOptions) {
    const host = opts.baseHost?.trim() || DEFAULT_HOST;
    this.baseUrl = `https://${host}`;
    this.hl = opts.hl || 'en';
    this.cookieHeader = opts.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  /** Fetch the authenticated homepage once and extract the per-session tokens. */
  async bootstrap(force = false): Promise<void> {
    if (this.bootstrapped && !force) return;

    const res = await fetch(`${this.baseUrl}/?hl=${encodeURIComponent(this.hl)}`, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Cookie: this.cookieHeader },
      redirect: 'follow',
    });
    const finalUrl = res.url;
    if (/accounts\.google\.com/.test(finalUrl)) {
      throw new Error(
        'Not authenticated — homepage redirected to accounts.google.com (session expired).'
      );
    }
    const html = await res.text();

    // CSRF (`at`): WIZ_global_data.SNlM0e (fallback FdrFJe). Session: FdrFJe. Build label: cfb2h.
    const csrf = html.match(/"SNlM0e":"([^"]+)"/)?.[1] || html.match(/"FdrFJe":"([^"]+)"/)?.[1];
    const sid = html.match(/"FdrFJe":"([^"]+)"/)?.[1];
    const bl = html.match(/"cfb2h":"([^"]+)"/)?.[1];

    if (!csrf) {
      throw new Error(
        'Could not extract CSRF token (SNlM0e) from homepage — auth or DOM-blob shape changed.'
      );
    }
    this.csrfToken = csrf;
    if (sid) this.sessionId = sid;
    if (bl) this.buildLabel = bl; // live build label beats the fallback
    this.bootstrapped = true;
    log.info(`  🔑 RPC transport bootstrapped (bl=${this.buildLabel}${sid ? ', sid ✓' : ''})`);
  }

  /**
   * Call a batchexecute RPC and return its parsed inner result.
   * @param name    logical RPC name (id resolved through overrides)
   * @param params  the RPC params array (JSON-encoded into f.req)
   * @param sourcePath  `source-path` query param (e.g. `/notebook/{id}`)
   */
  async call(
    name: RpcName,
    params: unknown,
    sourcePath = '/',
    opts: { idempotent?: boolean } = {}
  ): Promise<unknown> {
    await this.bootstrap();
    try {
      return await this.callOnce(name, params, sourcePath);
    } catch (err) {
      // One retry after re-bootstrapping — covers an expired CSRF/session token.
      if (err instanceof RpcDriftError) throw err;
      // A refusal is a verdict, not a hiccup: retrying a PERMISSION_DENIED or an
      // exhausted quota just costs a round trip. UNAUTHENTICATED is the one
      // exception — that is exactly the stale-token case the retry exists for.
      if (err instanceof RpcStatusError && err.status !== 16) throw err;
      // A write that is not idempotent (a copy) must not be replayed after a
      // failure that may have happened *after* the server committed it — a lost
      // response would become a duplicate. Only a sign-in bounce proves nothing
      // was written.
      const provenUnwritten =
        err instanceof RpcUnauthorizedError || (err instanceof RpcStatusError && err.status === 16);
      if (opts.idempotent === false && !provenUnwritten) {
        throw new RpcError(
          `RPC "${name}" failed and may already have been applied (${(err as Error).message}). ` +
            'Not retried automatically: check the target before trying again.',
          name,
          err
        );
      }
      log.warning(
        `  ↻ RPC "${name}" failed (${(err as Error).message}); re-bootstrapping and retrying once...`
      );
      await this.bootstrap(true);
      return await this.callOnce(name, params, sourcePath);
    }
  }

  /**
   * Fetch a binary resource (e.g. a Studio media URL) using the account
   * cookies, **following redirects manually** so the Cookie header survives
   * cross-origin hops. Node's `fetch` drops Cookie on cross-origin redirects,
   * and Studio media URLs 302 from google.com to googleusercontent.com — a
   * plain `redirect:'follow'` then lands unauthenticated on an HTML consent
   * page instead of the bytes. All hops here are Google-owned, so re-sending
   * the cookies is safe.
   */
  async fetchBinary(
    url: string,
    timeoutMs = 180000
  ): Promise<{ bytes: Buffer; contentType: string }> {
    let current = url;
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(current, {
        headers: { 'User-Agent': USER_AGENT, Cookie: this.cookieHeader },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new Error(`redirect ${res.status} without Location`);
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) throw new Error(`download HTTP ${res.status} for ${current.slice(0, 80)}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      return { bytes, contentType: res.headers.get('content-type') || 'application/octet-stream' };
    }
    throw new Error('too many redirects fetching media URL');
  }

  /**
   * POST to the streaming query endpoint (`GenerateFreeFormStreamed`, distinct
   * from batchexecute) and return the raw response text for the caller to
   * parse. `innerParams` is the query params array; the wire wraps it as
   * `f.req=[null, JSON(innerParams)]`.
   */
  async postQueryStreamed(innerParams: unknown, timeoutMs = 120000): Promise<string> {
    await this.bootstrap();
    const doPost = async (): Promise<Response> => {
      this.reqidCounter += 100000;
      const query = new URLSearchParams({
        bl: this.buildLabel,
        hl: this.hl,
        _reqid: String(this.reqidCounter),
        rt: 'c',
      });
      if (this.sessionId) query.set('f.sid', this.sessionId);
      const url = `${this.baseUrl}${QUERY_ENDPOINT}?${query.toString()}`;
      const fReq = [null, JSON.stringify(innerParams)];
      const body =
        `f.req=${encodeURIComponent(JSON.stringify(fReq))}` +
        (this.csrfToken ? `&at=${encodeURIComponent(this.csrfToken)}` : '') +
        '&';
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Origin: this.baseUrl,
          Referer: `${this.baseUrl}/`,
          'X-Same-Domain': '1',
          'X-Goog-Csrf-Token': this.csrfToken,
          'User-Agent': USER_AGENT,
          Cookie: this.cookieHeader,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    };

    let res = await doPost();
    if (res.status === 401 || res.status === 403 || /accounts\.google\.com/.test(res.url)) {
      await this.bootstrap(true);
      res = await doPost();
    }
    if (!res.ok) {
      throw new Error(`Query endpoint HTTP ${res.status}`);
    }
    return res.text();
  }

  private async callOnce(name: RpcName, params: unknown, sourcePath: string): Promise<unknown> {
    const id = resolveRpcId(name);

    const query = new URLSearchParams({
      rpcids: id,
      'source-path': sourcePath,
      bl: this.buildLabel,
      hl: this.hl,
      rt: 'c',
    });
    if (this.sessionId) query.set('f.sid', this.sessionId);
    const url = `${this.baseUrl}/_/LabsTailwindUi/data/batchexecute?${query.toString()}`;

    const fReq = [[[id, JSON.stringify(params), null, 'generic']]];
    const body =
      `f.req=${encodeURIComponent(JSON.stringify(fReq))}` +
      (this.csrfToken ? `&at=${encodeURIComponent(this.csrfToken)}` : '') +
      '&';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Origin: this.baseUrl,
        Referer: `${this.baseUrl}/`,
        'X-Same-Domain': '1',
        'X-Goog-Csrf-Token': this.csrfToken,
        'User-Agent': USER_AGENT,
        Cookie: this.cookieHeader,
      },
      body,
    });

    const text = await res.text();
    if (res.status === 401 || res.status === 403 || /accounts\.google\.com/.test(res.url)) {
      throw new RpcUnauthorizedError(`RPC "${name}" unauthorized (HTTP ${res.status})`, name);
    }
    if (!res.ok) {
      throw new RpcError(`RPC "${name}" HTTP ${res.status}: ${text.slice(0, 200)}`, name);
    }

    let payload: unknown;
    try {
      payload = parseBatchExecute(text, id);
    } catch (e) {
      if (e instanceof RpcStatusRefusal) {
        throw new RpcStatusError(name, id, e.status);
      }
      if (e instanceof RpcServerError) {
        throw new RpcError(`RPC "${name}" server error`, name, e.envelope);
      }
      throw new RpcError(`RPC "${name}" response parse failed`, name, e);
    }
    // No envelope for this id at all → the id almost certainly rotated. A
    // refusal never reaches here: it carries an envelope and throws above.
    if (payload === undefined) throw new RpcDriftError(name, id);
    return payload;
  }
}
