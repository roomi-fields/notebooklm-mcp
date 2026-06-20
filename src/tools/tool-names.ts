/**
 * Canonical (v2) tool names — a navigable `namespace_action` tree.
 *
 * v2.0.0 renamed every tool from an unstructured flat list to this tree. The
 * legacy flat names still work everywhere — both the stdio server and the HTTP
 * proxy accept them as aliases — but `tools/list` advertises only the canonical
 * names. Names use `_` (not `.`) as the separator: the MCP tool-name pattern
 * `^[a-zA-Z0-9_-]{1,64}$` forbids dots, and some clients (e.g. Claude Desktop)
 * reject dotted names outright.
 *
 * This module has no heavy imports on purpose: both `tools/index.ts` and the
 * lightweight `stdio-http-proxy.ts` import it.
 */

/** Legacy flat name (still used internally by handlers) → canonical v2 name. */
export const LEGACY_TO_CANONICAL: Record<string, string> = {
  // library_* — the local notebook library
  add_notebook: 'library_add',
  list_notebooks: 'library_list',
  get_notebook: 'library_get',
  select_notebook: 'library_select',
  update_notebook: 'library_update',
  remove_notebook: 'library_remove',
  search_notebooks: 'library_search',
  auto_discover_notebook: 'library_discover',
  get_library_stats: 'library_stats',
  // notebook_* — operations directly against NotebookLM
  ask_question: 'notebook_ask',
  create_notebook: 'notebook_create',
  delete_notebooks_from_nblm: 'notebook_delete',
  list_notebooks_from_nblm: 'notebook_list',
  // session_* — chat sessions
  list_sessions: 'session_list',
  close_session: 'session_close',
  reset_session: 'session_reset',
  // source_* — notebook sources
  add_source: 'source_add',
  delete_source: 'source_delete',
  // content_* — generated Studio content
  generate_content: 'content_generate',
  list_content: 'content_list',
  download_content: 'content_download',
  // note_* — Studio notes
  create_note: 'note_create',
  save_chat_to_note: 'note_save_chat',
  convert_note_to_source: 'note_to_source',
  // auth_* — Google authentication
  setup_auth: 'auth_setup',
  de_auth: 'auth_logout',
  re_auth: 'auth_switch',
  // server_* — server lifecycle
  get_health: 'server_health',
  cleanup_data: 'server_cleanup',
  // vault_* — offline answer caching
  batch_to_vault: 'vault_batch',
};

/** Canonical v2 name → legacy flat name. */
export const CANONICAL_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_TO_CANONICAL).map(([legacy, canonical]) => [canonical, legacy])
);

/** Resolve any accepted name (canonical or legacy) to the legacy name used internally. */
export function toLegacyName(name: string): string {
  return CANONICAL_TO_LEGACY[name] ?? name;
}

/** Resolve a legacy name to its canonical v2 name (unknown names pass through). */
export function toCanonicalName(name: string): string {
  return LEGACY_TO_CANONICAL[name] ?? name;
}
