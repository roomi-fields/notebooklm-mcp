/**
 * NotebookLM / Gemini Notebook domain handling.
 *
 * Google rebranded "NotebookLM" and moved the product from
 *   notebooklm.google.com  ->  notebook.google.com
 * The old host still resolves and issues redirects, but a session minted on the
 * new host is bounced through a passive-auth flow when a later navigation targets
 * the OLD host — which the tool used to do everywhere. That mismatch made valid
 * sessions look "expired server-side".
 *
 * This module centralises host handling so the rest of the codebase never
 * hardcodes a single domain again:
 *  - accept BOTH hosts when detecting "are we on the notebook app?"
 *  - always NAVIGATE to the new canonical host, and normalise any user-supplied
 *    URL onto it, so cookies are always checked against the host that minted them.
 */

/** Hosts that identify the notebook web app (old + new). */
const NOTEBOOK_HOSTS: readonly string[] = ['notebook.google.com', 'notebooklm.google.com'];

/** The canonical host to navigate to (post-rebrand). */
const NOTEBOOK_PRIMARY_HOST = 'notebook.google.com';

/** The canonical base URL to navigate to (post-rebrand). */
export const NOTEBOOK_BASE_URL = `https://${NOTEBOOK_PRIMARY_HOST}/`;

/** True if the given hostname is one of the notebook app hosts. */
export function isNotebookHost(hostname: string): boolean {
  return NOTEBOOK_HOSTS.includes(hostname);
}

/**
 * True if the given string is a URL whose host is a notebook app host.
 * Parses the URL so query params like `?continue=https://notebook.google.com/`
 * on an accounts.google.com sign-in page do NOT falsely match.
 */
export function isNotebookUrl(url: string): boolean {
  try {
    return isNotebookHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Rewrite a notebook URL onto the canonical (new) host.
 * Leaves non-notebook URLs and unparseable strings untouched.
 */
export function normalizeNotebookUrl(url: string): string {
  try {
    const u = new URL(url);
    if (isNotebookHost(u.hostname) && u.hostname !== NOTEBOOK_PRIMARY_HOST) {
      u.hostname = NOTEBOOK_PRIMARY_HOST;
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}
