/**
 * NotebookLM / Gemini Notebook host handling.
 *
 * NotebookLM is reachable at TWO hosts that Google keeps in sync via redirects:
 *   notebooklm.google.com   (Google's documented canonical host)
 *   notebook.google.com     (the "Gemini Notebook" alias)
 *
 * Which host an AUTHENTICATED session actually lands on is account-dependent:
 *  - Personal accounts generally resolve to notebooklm.google.com.
 *  - Some Workspace tenants resolve to notebook.google.com (the service-session
 *    cookie OSID/__Secure-OSID is bound there); notebooklm.google.com then
 *    redirects to it via a passive-auth hop.
 *
 * Therefore we must NOT hardcode a single navigation host — doing so forces the
 * other tenant through a fragile accounts.google.com re-auth detour, which is the
 * "session expired server-side" symptom. Instead:
 *  - DETECT the app by accepting BOTH hosts (isNotebookHost / isNotebookUrl),
 *  - NAVIGATE using the URL as the user supplied it (it comes from their own
 *    address bar = their resolved host) and follow Google's redirect,
 *  - for host-less entry navigation (homepage/scrape) use the documented
 *    canonical host and accept landing on either.
 *
 * isNotebookUrl parses the URL so a notebook host inside a query param (e.g. the
 * sign-in `continue=` value on accounts.google.com) does NOT falsely match.
 */

/** Hosts that identify the notebook web app (both are valid). */
const NOTEBOOK_HOSTS: readonly string[] = ['notebooklm.google.com', 'notebook.google.com'];

/** Google's documented canonical host — used only for host-less entry navigation. */
export const NOTEBOOK_PRIMARY_HOST = 'notebooklm.google.com';

/** Canonical base URL for entry navigation (homepage/scrape). Redirects are followed. */
export const NOTEBOOK_BASE_URL = `https://${NOTEBOOK_PRIMARY_HOST}/`;

/** True if the given hostname is one of the notebook app hosts. */
export function isNotebookHost(hostname: string): boolean {
  return NOTEBOOK_HOSTS.includes(hostname);
}

/**
 * Appends `hl=<locale>` to a notebook app URL so the UI renders in the locale
 * the text-based selectors expect. Google renders the app in the ACCOUNT's
 * language by default, which silently breaks every text selector when the
 * account language differs from NOTEBOOKLM_UI_LOCALE (seen 2026-07-27: Spanish
 * account → "Crear nuevo" ≠ buttons.create "Create"). Non-notebook URLs and
 * URLs that already carry an hl param are returned unchanged.
 */
export function withUiLocale(url: string, locale: string | undefined): string {
  if (!locale) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (!isNotebookHost(parsed.hostname) || parsed.searchParams.has('hl')) {
      return url;
    }
    parsed.searchParams.set('hl', locale);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * True if the given string is a URL whose host is a notebook app host.
 * Parses the URL so query params like `?continue=https://notebooklm.google.com/`
 * on an accounts.google.com sign-in page do NOT falsely match.
 */
export function isNotebookUrl(url: string): boolean {
  try {
    return isNotebookHost(new URL(url).hostname);
  } catch {
    return false;
  }
}
