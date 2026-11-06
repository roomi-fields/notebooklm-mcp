/**
 * Serving the UTCP manual.
 *
 * UTCP has no protocol server: a client reads a manual once, then calls this
 * REST API directly. The manual itself is generated from our OpenAPI
 * specification by `scripts/build-utcp-manual.mjs` and committed as
 * `deployment/docs/utcp.json`; a release guard fails if the two drift.
 *
 * The published file carries a placeholder base address, because the file is
 * written once and read by installs that answer on different addresses. This
 * module swaps it for the address the caller actually reached us on, so one
 * manual serves a loopback install and a reverse-proxied one alike.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/** Must match `BASE_PLACEHOLDER` in the generator. */
export const BASE_PLACEHOLDER = 'http://localhost:3000';

interface CallTemplate {
  url: string;
  [key: string]: unknown;
}

export interface UtcpTool {
  name: string;
  description: string;
  tool_call_template: CallTemplate;
  [key: string]: unknown;
}

export interface UtcpManual {
  utcp_version: string;
  manual_version: string;
  tools: UtcpTool[];
}

const MANUAL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'deployment',
  'docs',
  'utcp.json'
);

let cached: UtcpManual | null = null;

/**
 * Read the published manual, once per process.
 *
 * A missing file is a packaging fault, not a caller's mistake, so it surfaces
 * as a plain error rather than an empty manual — a manual with no tools reads
 * to a client as "this server exposes nothing", which is a lie we would then
 * have to debug from the client's side.
 */
export function loadManual(path: string = MANUAL_PATH): UtcpManual {
  if (cached) return cached;
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as UtcpManual;
  if (!Array.isArray(parsed.tools) || parsed.tools.length === 0) {
    throw new Error(`The UTCP manual at ${path} declares no tools.`);
  }
  cached = parsed;
  return parsed;
}

/** Forget the cached manual. For tests. */
export function resetManualCache(): void {
  cached = null;
}

/**
 * The manual with every call address rebased on `baseUrl`.
 *
 * Only the leading placeholder is replaced, and only at the start of the
 * address: a path that happened to contain the placeholder text further along
 * is left alone.
 */
export function rebaseManual(manual: UtcpManual, baseUrl: string): UtcpManual {
  const base = baseUrl.replace(/\/+$/, '');
  return {
    ...manual,
    tools: manual.tools.map((tool) => ({
      ...tool,
      tool_call_template: {
        ...tool.tool_call_template,
        url: tool.tool_call_template.url.startsWith(BASE_PLACEHOLDER)
          ? base + tool.tool_call_template.url.slice(BASE_PLACEHOLDER.length)
          : tool.tool_call_template.url,
      },
    })),
  };
}
