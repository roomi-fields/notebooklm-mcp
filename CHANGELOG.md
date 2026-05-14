# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-05-14

### Changed — tool names are now a dot-notation tree

Every tool was renamed from a flat `snake_case` list to a navigable
`namespace.action` tree (9 namespaces): `notebook.*`, `library.*`, `session.*`,
`source.*`, `content.*`, `note.*`, `auth.*`, `server.*`, `vault.*`. For
example `ask_question` → `notebook.ask`, `add_source` → `source.add`,
`list_sessions` → `session.list`, `get_health` → `server.health`,
`batch_to_vault` → `vault.batch`. `tools/list` now advertises only the
canonical names. This aligns with MCP naming best practice and is the reason
for the major version bump.

**Backward compatible — nothing breaks.** Both the stdio server and the HTTP
proxy still accept the legacy flat names as aliases: the dispatch layer
normalises any accepted name (canonical or legacy) before routing. Existing
scripts, Claude Code / Cursor / n8n configs, and batch jobs that hard-code the
old names keep working unchanged. New integrations should use the canonical
names — the legacy aliases are supported but no longer advertised.

The legacy ↔ canonical mapping lives in one place: `src/tools/tool-names.ts`.

### Added

- **MCP `annotations` on every tool** — accurate `readOnlyHint` /
  `destructiveHint` / `idempotentHint` / `openWorldHint` / `title` per tool,
  from a central table in `src/tools/index.ts`.
- **MCP `outputSchema` on every tool** — the shared `{ success, data?, error? }`
  result envelope every handler returns. The stdio dispatch now also returns
  `structuredContent` matching that schema, not just text.
- `smithery.yaml` + `mcpb/` bundle source — the server is now published on the
  [Smithery registry](https://smithery.ai/servers/roomifields/notebooklm-mcp).

### Security

- Resolve two new transitive advisories pulled in via
  `@modelcontextprotocol/sdk@1.26.0`: **`fast-uri ≤3.1.1`** (high — path
  traversal / host confusion, GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc) and
  **`hono ≤4.12.17`** (moderate — several, incl. cache cross-user leakage
  GHSA-p77w-8qqv-26rm). Added `overrides` for `fast-uri ^3.1.2` and
  `hono ^4.12.18`; `npm audit` reports `0 vulnerabilities`.

---

## [1.7.9] - 2026-05-06

### Security

- Resolve transitive moderate XSS advisory **GHSA-v2v4-37r5-5v8g** in `ip-address ≤10.1.0` (reachable via `@modelcontextprotocol/sdk@1.26.0` → `express-rate-limit@8.x` → `ip-address`). Added `overrides: { "ip-address": "^10.2.0" }` to `package.json` to force the patched version regardless of upstream re-resolution. `npm audit` now reports `0 vulnerabilities`. CI `security` job (audit gate) was failing on 1.7.8 because of this advisory; this release unblocks it.

---

## [1.7.8] - 2026-05-06

### Fixed (this time properly tested at runtime, MCP attached)

**`add_source` returned `Timeout waiting for source processing` for uploads that actually succeeded — false negative.**

Verified in a live MCP session against my own NotebookLM account. After the upload, `list_content` immediately reported the source as `status: "ready"` while `add_source` reported `success: false`. Root cause traced in `waitForSourceProcessing`: NotebookLM 2026 keeps the upload dialog open after a successful upload (it lets the user chain more uploads), and the count-based success detection in the polling loop was gated behind `if (!dialogVisible)` — so the loop ran for the full 90s timeout while the dialog stayed open, and the early success signal (the source-list count growing by 1) was never tripped. Fix: lift the count-based detection out of the dialog-state branch and run it on every poll cycle. As soon as the source-list count grows, return success regardless of whether NotebookLM has dismissed the dialog or not.

**Packaging: `dist/index.js` and `dist/stdio-http-proxy.js` were published in mode 644 (no executable bit) since at least 1.7.3.**

The shebang `#!/usr/bin/env node` was present, but without the executable bit npm-published archives only worked on systems where the npm install step happened to re-chmod (e.g. the `bin` symlink machinery). Sandbox bash environments that don't re-chmod silently failed with `Permission denied`. Fix: new `build:chmod-bin` step in the `build` script that explicitly chmod-755s both binaries before they get tarballed by `npm publish`. Verified locally — `ls -la dist/index.js` now shows `-rwxr-xr-x` after `npm run build`.

---

## [1.7.7] - 2026-05-06

### Defensive (not yet validated runtime)

**`add_source` `Could not find "Add source" button` — possibly fixed, definitely better diagnosed.**

Reported by an end-user agent against a freshly-created notebook. Root cause is uncertain without runtime visibility from a Claude Code session — but two things are now in place:

- **Selectors broadened** to cover the empty-notebook layout NotebookLM shows for fresh notebooks (centered "Upload sources" / "Choose files" CTA in EN, "Téléverser" / "Importer" in FR), in addition to the per-panel "+" button. Both aria-label and visible-text variants are tried.
- **Error is now actionable.** Previously the failure surfaced as just `Could not find "Add source" button`. The error now embeds a JSON dump of what the page contains: URL, document title, total button count, and up to 25 buttons with their `aria-label`, text content, mat-icon presence, class list, and visibility flag. Plus the path of the debug screenshot. So when this error reaches the calling agent, it can either pick the right selector itself or paste the dump back to a maintainer for a precise fix.

I do not have runtime access to a NotebookLM session in this environment, so I cannot confirm the broadened selectors actually resolve the error. If the issue persists, the enriched payload is designed to make the next iteration definitive instead of speculative.

---

## [1.7.6] - 2026-05-06

### Fixed

**Two bugs in tools that 1.7.4 exposed without runtime validation. Honest disclosure: I shipped both `create_notebook` and `delete_notebooks_from_nblm` in 1.7.4 without exercising them against a live NotebookLM session — only checked that the handler methods existed and the dispatch was wired. Both had latent issues that surfaced as soon as a real user ran them.**

#### `create_notebook`

Two regressions, both reported by an end-user agent that ran the tool against the live UI:

- The tool returned a transitional URL like `https://notebooklm.google.com/notebook/creating/c` instead of the final notebook URL. Root cause: the `waitForURL` regex (`/notebook\//`) matched the transitional URL immediately rather than waiting for the redirect to the UUID-based URL. **Fix:** require a full v4 UUID in the URL pattern, then wait for `networkidle` before reading the URL.
- The `name` parameter was silently ignored — every notebook came back as "Untitled notebook". Root cause: the rename used a generic `[contenteditable="true"], .notebook-title, h1` selector, took the first match (often the wrong element), typed via `Control+a`+`type`, and never verified the result. **Fix:** target ordered, specific selectors (aria-label / placeholder containing "title"/"Untitled"), use `fill` for `<input>` and `evaluate`+keystroke for contenteditable, then **read back the title** to verify the rename took. The tool now returns `name_applied: boolean` and `actual_name: string` so the caller knows whether to retry via the UI.

#### `delete_notebooks_from_nblm`

The handler used `button[aria-labelledby*="project-"]` as its primary selector — the same pattern that broke `list_notebooks_from_nblm` and was rewritten in 1.7.5. So the delete tool was very likely non-functional on the current NotebookLM DOM. **Fix:** locate each notebook tile through its stable `id="project-{UUID}-title"` element (a `page.evaluate()` walks up to the nearest card-like ancestor and stamps it with `data-nblm-target-card`), then resolve the menu button inside that marked card. Same id-pattern strategy that already powers `list_notebooks_from_nblm`.

### Process note

I am updating the project memory to require either a runtime smoke test or a full read of the handler implementation (selectors, `waitForURL`, post-action verification) before exposing any handler as a new MCP tool. Skipping that audit in 1.7.4 cost two extra releases.

---

## [1.7.5] - 2026-05-06

Three bugs reported by an end-user agent against 1.7.2–1.7.4. All three are fixed in this release.

### Fixed

**#1 — `/plugin marketplace update` + `/reload-plugins` did not actually upgrade the running MCP server (cache-poisoning by `npx -y` without a version pin).**

`mcpServers.notebooklm.args` was `["-y", "@roomi-fields/notebooklm-mcp"]`. Without a version specifier, `npx` reused the existing `_npx/<hash>/` cache regardless of which version the marketplace just refreshed to. Symptom: plugin manifest showed 1.7.4 but the live MCP server was still 1.7.2 and rejected newly-added tools (`create_notebook` etc.) with `Unknown tool`.

Fix: pin the version inside the args (`"@roomi-fields/notebooklm-mcp@1.7.5"`). `scripts/sync-version.mjs` now propagates the package version to both the manifest's `version` field AND the npx pin in `mcpServers.notebooklm.args`. The CI `version:check` validates both. From now on every release ships with a manifest that points npx at exactly the version the marketplace just resolved to.

**#2 — `list_notebooks_from_nblm` returned every notebook with `name: "Notebook"`.**

The Strategy 1 selector (`button[aria-labelledby*="project-"]`) no longer matches the current NotebookLM DOM, so it returned 0. The Strategy 2 fallback then scraped UUIDs out of the raw HTML and **hardcoded `name: 'Notebook'`** for each — making the API report N notebooks all named "Notebook" instead of an empty result or real titles.

Fix: replace the brittle button selector with a DOM-agnostic `page.evaluate()` that walks every element whose `id` matches `project-{UUID}-title` and reads its `textContent`. The id-based naming is intrinsic to NotebookLM's data model and stable across UI rewrites. Strategy 2 (raw HTML fallback) now returns `name: ''` for ids it can only discover from HTML — never the misleading hardcoded placeholder.

**#3 — `get_health.current_account` reported the previous account after `re_auth` succeeded with a different Google account.**

`handleReAuth` ran de-auth + `performSetup()` (manual browser login) but never touched the `current-account.txt` marker. Since `performSetup()` does not know which Google account the user picks during browser login, the marker stayed stale and `get_health` kept returning the old email.

Fix: new `AccountManager.clearCurrentAccountId()` method, called after a successful `re_auth`. `get_health` now truthfully omits `current_account` rather than returning a wrong value. Detecting the new account from the post-login browser state is a richer follow-up — for now we choose honest absence over misleading presence.

---

## [1.7.4] - 2026-05-06

### Added

**Two previously orphaned NotebookLM management tools are now exposed via MCP:**

- `create_notebook({ name?, show_browser? })` — creates a brand-new empty notebook directly in NotebookLM (no pre-existing share URL required, unlike `add_notebook` which only registers an already-created notebook into the local library). Returns the freshly minted `notebook_url` and `notebook_id` so the caller can chain `add_source`, `ask_question`, etc.
- `delete_notebooks_from_nblm({ notebook_ids[], show_browser? })` — bulk-delete notebooks at the NotebookLM UI level (not just from the local library). Returns `{ deleted, failed, message }`. Pair it with `list_notebooks_from_nblm` to discover IDs.

### Internal

Audited the full tool surface: 30 `ToolHandlers` methods are now aligned 1:1 with 30 tool definitions and 30 dispatch cases. No more declared-but-unwired tools, no more handlers without a tool definition.

---

## [1.7.3] - 2026-05-06

### Fixed

- `list_notebooks_from_nblm` MCP tool was declared in the tool list but missing from the dispatch switch in `src/index.ts`, so calling it returned `Unknown tool`. Added the missing case → the tool now resolves and runs `handleListNotebooksFromNblm`.

### Known orphans (not fixed in this patch)

- `handleCreateNotebook` and `handleDeleteNotebooksFromNblm` exist as `ToolHandlers` methods but are not exposed via either a tool definition or a switch case. They are unreachable today and have no effect on user-visible behaviour. A follow-up will decide whether to expose them or remove them.

---

## [1.7.2] - 2026-05-06

### Added

**Claude Code plugin manifest + cross-file version sync:**

- New `.claude-plugin/plugin.json` at the repo root — Claude Code plugin manifest (single source of truth for plugin metadata, including `mcpServers` config). Lets the [`roomi-fields/claude-plugins`](https://github.com/roomi-fields/claude-plugins) aggregated marketplace source this project directly via `source: github` instead of maintaining a duplicated wrapper.
- New `scripts/sync-version.mjs` + npm scripts `version:sync` / `version:check` — propagates `package.json.version` to the plugin manifest, `website/docusaurus.config.ts` (`softwareVersion`), and the README hero line. Uses an in-place regex replace for the plugin manifest so prettier-controlled formatting is preserved across releases (no phantom drift in CI).
- README: new "Option 0 — Claude Code marketplace" Quick Start section pointing at the aggregated marketplace one-liner.

### Changed

- `.github/workflows/release.yml`: added a "Verify version sync" step before build/publish — so a release can never ship with a stale plugin manifest or website badge.

### Fixed

- 1.7.1 was tagged but the publish failed when the version-sync check rejected a prettier-induced JSON-formatting drift. This release supersedes that aborted tag.

---

## [1.7.0] - 2026-05-06

### Added

**`batch_to_vault` is now a first-class MCP tool — no HTTP server required:**

- New MCP tool `batch_to_vault` exposed alongside `ask_question`, `add_source`, etc. Same parameters and output as the HTTP endpoint (`questions[]`, `vault_dir`, `notebook_id`/`notebook_url`, `slug_prefix`, `source_format`, `sleep_between_ms`, `session_id`). MCP clients (Claude Code, Cursor, Codex…) can now run a batch directly without starting `npm run start:http` or hitting `localhost:3000`.
- Shared helper `runBatchToVault` in `src/utils/vault-writer.ts` — single source of truth for the batch loop. Both the MCP tool (`ToolHandlers.handleBatchToVault`) and the HTTP `/batch-to-vault` endpoint call it with the same `askQuestion` injection. Eliminates the previous duplicated loop in `http-wrapper.ts`.

### Changed

- `POST /batch-to-vault` is now a thin wrapper over `ToolHandlers.handleBatchToVault`. Behaviour and response shape are unchanged; the implementation is just no longer duplicated.

---

## [1.6.0] - 2026-05-04

### Added

**RTFM integration — NotebookLM as one-shot ingestion, RTFM as retrieval layer:**

- `POST /batch-to-vault` endpoint: runs a list of questions and writes each answer as a markdown file (YAML frontmatter + answer + sources block) and a JSON sidecar in a vault directory, ready for ingestion by [RTFM](https://github.com/roomi-fields/rtfm) or any markdown vault tool (Obsidian, Foam, Dendron). Removes the 50-queries/day quota and 10–30s latency for repeat queries on academic / SOTA workflows.
- `src/utils/vault-writer.ts`: `formatAnswerMarkdown`, `formatAnswerJson`, `makeSlug` helpers with NFD-normalised slugs and YAML escape.
- `nblm-answer-v1` JSON Schema published at the canonical, immutable URL [https://schemas.roomi-fields.com/nblm-answer-v1.json](https://schemas.roomi-fields.com/nblm-answer-v1.json) (served as `application/schema+json` with open CORS, JSON-LD Dataset entry for AI-crawler discovery, 24h immutable cache). Source-of-truth copy in `schemas/nblm-answer-v1.json`.
- New documentation page [`14-RTFM-INTEGRATION.md`](./deployment/docs/14-RTFM-INTEGRATION.md) — full pattern, schema reference, RTFM wiring, recommended layout for academic batches, question-generation prompt.
- README: RTFM listed as the 4th Integration Option alongside MCP, HTTP REST, and Docker.

### Changed

- Root `/` endpoint now lists `batch_to_vault` in its endpoint registry.

---

## [1.5.9] - 2026-04-22

### Fixed

- Restore `mcpName` field in `package.json` (accidentally dropped during the 1.5.8 release). This field is required by the official MCP Registry to verify npm-package ownership; without it the registry refuses to update server metadata. v1.5.9 re-enables registry updates for `io.github.roomi-fields/notebooklm-mcp`.

---

## [1.5.8] - 2026-04-19

### Fixed

**NotebookLM UI adaptations for 2026 (PR #5 by @KhizarJamshaidIqbal):**

- `sanitizeResponseText()`: strip leaked Material-icon labels (`more_vert`, `more_horiz`) and adjacent citation artifacts from answer text
- `ensureDiscussionReady()` / `navigateToDiscussion()`: recover the Discussion panel before asking when the chat composer has been unmounted or disabled
- Count-based source detection: use `.single-source-container` row counts instead of relying on source names, so URL sources (which surface as page titles, not URLs) are still detected correctly
- New UI selectors for the "Add source" flow (`.cdk-overlay-pane`, `role=menu`, `role=menuitem`)
- Chat-input detection now skips visible-but-disabled composers
- Regression tests added in `src/__tests__/{page-utils,browser-session,content-manager}.test.ts`

### Added

**Doctor scripts (PR #6 by @KhizarJamshaidIqbal):**

- `npm run doctor:basic` — repo + build artifacts + Node engine check
- `npm run doctor:http` — `/health`, optional `/content` and `/ask` verification (pass `--notebook-url`)
- `.env.example` documenting the project's config knobs

### Security

- Credentials, personal paths, test-account emails, and real notebook UUIDs scrubbed from archived scripts and docs (PR #4 by @KhizarJamshaidIqbal and follow-up commits)
- Two tracked debug PNGs with literal Windows paths in their filenames removed from the index
- `npm audit fix` applied: hono 4.12.14, @hono/node-server 1.19.14, express-rate-limit 8.3.2, handlebars 4.7.9, brace-expansion, flatted, ip-address bumped to patched versions (no direct-dependency changes)

---

## [1.5.7] - 2026-02-26

### Fixed

**Citation Extraction:**

- Fixed `.highlighted` selector: use `.highlighted` class (not `i.highlighted`) for citation excerpt extraction
- Scoped citation button detection to last `.to-user-container .message-text-content` container — fixes multi-question sessions picking up buttons from all previous answers

### Changed

**Docker (PR #1 by @JulienCANTONI):**

- Dockerfile now builds TypeScript from source inside the container instead of copying pre-built `dist/`
- Multi-stage: install all deps → build → prune devDeps → install browser (cleaner CI/CD)
- `.dockerignore` updated to allow `src/` and `tsconfig*.json` for in-container build
- `docker-entrypoint.sh` now supports `PORT` env var (Render PaaS compatibility)

### Security

- Updated `@modelcontextprotocol/sdk` to fix vulnerabilities
- Updated `qs` dependency to fix prototype pollution vulnerability

---

## [1.5.6] - 2026-02-15

### Fixed

**Citation Extraction (Major Rewrite):**

- Rewrote citation excerpt extraction using `page.evaluate()` string expressions — eliminates all `ElementHandle` stale reference errors
- Source names extracted from `span[aria-label]` in a single DOM scan (100% reliable)
- Source excerpts extracted by clicking each citation → reading `i.highlighted` + parent `.paragraph` for full passage context
- Added `Escape` dismiss between each citation click to prevent stale highlight contamination
- Improved from ~50% to **97% success rate** (30/31 citations in real-world test)
- Removed all debug screenshots and verbose logging from production code

**Authentication & Session Recovery:**

- Fixed false "Authenticated" at startup: `verifyWithBrowser()` now does real browser navigation to NotebookLM to check if Google session is truly valid (not just local cookie expiry dates)
- Fixed mid-session `SESSION_EXPIRED`: auto-reauth now uses `AutoLoginManager` with stored credentials (fills email + password automatically), falls back to manual `performSetup()` if needed
- Fixed profile sync direction bug: after `performSetup()`, uses `syncMainToAccount()` (not the reverse) to avoid overwriting fresh auth with stale account cookies
- Fixed `setup-auth --force` flag to bypass cookie check and always open browser

**Port Management:**

- Added `EADDRINUSE` handling: detects ghost processes on port 3000, attempts auto-kill, provides clear error message if port cannot be freed

### Added

**Chrome Profile Auto-Sync:**

- `syncProfileToMain(accountId)`: copies account-specific state/profile → main `chrome_profile/`
- `syncMainToAccount(accountId)`: reverse sync after interactive re-auth
- Both called automatically at the right points in startup and mid-session flows

**Startup Browser Verification (Step 4):**

- New `verifyWithBrowser()` method launches headless browser, navigates to NotebookLM, checks actual URL
- If redirected to `accounts.google.com` → triggers auto-reauth with `AutoLoginManager` (automatic) or `performSetup()` (manual fallback)

---

## [1.5.5] - 2026-01-31

### Fixed

**Authentication State Path Mismatch (Critical Bug):**

- Fixed `/health` endpoint and session recovery checking wrong path for authentication cookies
- **Root cause:** Multi-account system saves cookies to `accounts/{id}/browser_state/state.json` but code was checking legacy global path `CONFIG.browserStateDir/state.json`
- Fixed in 4 files:
  - `src/startup/startup-manager.ts` - Now uses account-specific state path at startup
  - `src/tools/index.ts` - Health endpoint checks account-specific state with fallback
  - `src/session/shared-context-manager.ts` - Context recreation loads from correct path
  - `src/session/browser-session.ts` - Session recovery uses account-specific state
- All files maintain fallback to legacy AuthManager path for backward compatibility

**Health Endpoint Improvements:**

- Added `current_account` field to health response showing active account email
- Added `accountCheckDone` flag to ensure proper fallback to AuthManager in tests

### Added

**Windows Startup Scripts:**

- `scripts/start-server-hidden.vbs` - VBScript to launch HTTP server silently at Windows startup
- `scripts/stop-server.bat` - Batch script to stop running server processes
- `scripts/mcp-proxy-hidden.ps1` - PowerShell script for hidden window MCP proxy

**Claude Code MCP Integration:**

- Hidden window configuration for MCP stdio proxy in Claude Code projects
- Uses `powershell -WindowStyle Hidden` to avoid shell window popup on each tool call
- Example `.mcp.json` configuration in documentation

---

## [1.5.4] - 2026-01-07

### Fixed

**Citation Source Format (Critical Bug):**

- Fixed `source_format` parameter not being passed from HTTP `/ask` endpoint to handler
- The parameter was defined in the schema but never extracted from `req.body` in `http-wrapper.ts`
- All source formats now work correctly: `none`, `inline`, `footnotes`, `json`, `expanded`

**Citation Extraction:**

- Updated `CITATION_SELECTORS` for current NotebookLM DOM (January 2026):
  - Primary: `button.citation-marker`, `button.xap-inline-dialog.citation-marker`
  - Fallback selectors for backwards compatibility
- Updated `TOOLTIP_SELECTORS` for source text extraction:
  - Primary: `i.highlighted`, `.paragraph i.highlighted`
- New `extractSourceFromElement()` function extracts both:
  - `sourceName`: from `aria-label` attribute (e.g., "17: Filename.pdf")
  - `sourceText`: from hover tooltip content

**Docker/noVNC:**

- Fixed Xvfb startup error: `_XSERVTransmkdir: ERROR: euid != 0`
- Added `/tmp/.X11-unix` directory creation with proper permissions (1777) in Dockerfile
- Changed exposed port from 5900 (raw VNC) to 6080 (noVNC web interface) in docker-compose.yml

### Added

- E2E tests for `source_format` parameter: `[T15]`, `[T16]`, `[T17]` in `tests/e2e/tests/03-ask.test.ts`

---

## [1.5.3] - 2026-01-05

### Added

**Docker Deployment with noVNC:**

- noVNC integration for visual browser authentication in Docker
- Xvfb + x11vnc + websockify for headless display server
- Port 6080 for web-based VNC access
- `scripts/start-vnc.sh` - VNC services startup script
- `scripts/docker-entrypoint.sh` - Container entrypoint combining VNC + Node.js
- NAS deployment support (Synology, QNAP) with export/import workflow

**Bulk Import Endpoint:**

- `POST /notebooks/import-from-scrape` - Bulk import notebooks from NotebookLM scrape
- Options: `notebook_ids` (array) to filter, `auto_discover` (boolean) for AI metadata
- Scrapes all notebooks from account and adds them to library in one call

**New Configuration Options:**

- `browserChannel` config: `chromium` (default) or `chrome`
- `ENABLE_VNC` environment variable for Docker
- `NOVNC_PORT` environment variable (default: 6080)

### Fixed

**Docker Compatibility:**

- Fixed locale configuration to use `CONFIG.uiLocale` instead of hardcoded `en-US`
- Fixed browser channel for Docker (chromium vs chrome)
- Fixed patchright browser installation in Dockerfile
- Fixed `show_browser` parameter passing to `performSetup`
- Added Docker-specific Chrome flags (`--no-sandbox`, `--disable-setuid-sandbox`, etc.)
- Fixed `page.goto` timeouts with `waitUntil: 'domcontentloaded'`

**HTTP Server:**

- Added root endpoint (`/`) returning API info

---

## [1.5.2] - 2026-01-01

### Added

**Notebook Scraping from NotebookLM:**

- New `list_notebooks_from_nblm` tool to scrape real notebooks from NotebookLM homepage
- Uses correct button selectors (`button[aria-labelledby*="project-"]`) matching NotebookLM's actual HTML structure
- Returns notebook IDs, names, and URLs for all notebooks on the account

**Bulk Notebook Deletion:**

- New `delete_notebooks_from_nblm` tool for bulk notebook deletion
- New `DELETE /notebooks/bulk-delete` HTTP endpoint for batch deletion
- Support for protected notebook IDs that won't be deleted
- Progress tracking during deletion operations

### Fixed

**Tool Description Builder:**

- Fixed `TypeError: Cannot read properties of undefined (reading 'map')` in `buildAskQuestionDescription`
- Added defensive checks with optional chaining for `active.topics` and `active.use_cases`
- Fallback values when notebook metadata is incomplete

---

## [1.5.1] - 2026-01-01

### Added

**Multilingual UI Support (i18n):**

- New internationalization system for NotebookLM UI selectors
- Support for French (fr) and English (en) UI languages
- `NOTEBOOKLM_UI_LOCALE` environment variable to set UI language
- Locale files in `src/i18n/` with translated selectors for all UI elements
- `SelectorBuilder` class for generating bilingual selectors
- `tAll()` function to get translations in all supported languages
- Documentation: `docs/ADDING_A_LANGUAGE.md` for adding new languages

**Language/Account Switching:**

- New `scripts/switch-account-language.sh` script for automated language switching
- Automated Chrome profile cache deletion and re-authentication
- Syncs new profile to main profile after language change
- Visual verification with `--show` flag

**E2E Test Infrastructure:**

- Complete E2E test suite with 76 tests (75 pass, 1 skip)
- Test categories: Health, Notebooks, Ask, Sessions, Sources, Content, Notes, CRUD, Errors
- Support for QUICK mode (55 tests) and FULL mode (76 tests)
- Multi-account test configuration with per-account notebook URLs
- Test tracking in `tests/e2e/TRACKING.md`

### Changed

- Updated all test files to use `currentNotebooks` from config for proper account isolation
- Jest configuration updated for ESM support with `--testPathPatterns`

---

## [1.4.2] - 2025-12-29

### Removed

**Fake Content Generation Features:**

- Removed `generate_content` endpoint for FAQ, Study Guide, Briefing Doc, Timeline, and Table of Contents
- These features were NOT real NotebookLM integrations - they were just sending prompts to the chat
- The only REAL content generation NotebookLM supports is Audio Overview (podcast)
- Updated all documentation to honestly reflect actual capabilities

**What was fake:**

- `briefing_doc` - Was just asking NotebookLM chat to generate a summary
- `study_guide` - Was just asking NotebookLM chat to create study materials
- `faq` - Was just asking NotebookLM chat to generate FAQs
- `timeline` - Was just asking NotebookLM chat to create a timeline
- `table_of_contents` - Was just asking NotebookLM chat to create a TOC

**What is real:**

- Audio Overview generation - Uses NotebookLM's actual podcast feature
- Audio download - Downloads the real generated audio file
- Q&A with citations - Uses NotebookLM's actual chat with source citations
- Source management - Uses NotebookLM's actual source upload features

---

## [1.4.1] - 2025-12-29

### Fixed

**Source Upload UI Compatibility:**

- Fixed URL source upload with textarea support (NotebookLM uses textarea, not input)
- Fixed YouTube source upload with textarea support
- Added French UI locale support (placeholders: "Collez des liens", buttons: "Insérer")
- Improved fallback detection for input/textarea elements in dialogs
- Added debug logging for unrecognized dialog elements

**Audio Download Improvements:**

- Added navigation to Audio Overview panel before attempting download
- Added Material Design icon selectors (download, file_download, get_app)
- Added fallback to extract audio source URL directly from audio element
- Improved debug logging for download button detection

### Changed

**Updated UI selectors for NotebookLM:**

- Updated `navigateToStudio()` with new Material Design tab selectors
- NotebookLM now uses `mdc-tab` / `mat-mdc-tab` Angular Material components
- Added tab structure: Sources | Discussion | Studio

### Added

**Comprehensive E2E Test Suite:**

- Full E2E test coverage: 22/22 endpoints tested and passing
- PowerShell-based test runner: `tests/e2e/run-e2e-tests.ps1`
- Individual test scripts for each endpoint
- WSL-to-Windows compatible via `cmd.exe /c powershell`

**Fully Functional Features (All Verified E2E):**

- ✅ `ask_question` - Q&A with source citations
- ✅ `list_notebooks`, `select_notebook`, `search_notebooks` - Library management
- ✅ `list_content` - View sources and existing artifacts
- ✅ `add_source` - Add files, URLs, text, YouTube (all types working)
- ~~`generate_content`~~ - Removed in v1.4.2 (was fake - just chat prompts)
- ✅ `generate_audio` - Audio overview generation
- ✅ Session management - Create, reset, close sessions
- ✅ Authentication - setup_auth, re_auth, de_auth

---

## [1.4.0] - 2025-12-24

### Added

**Content Management Module:**

- New content management system for NotebookLM notebooks
- Source management:
  - `add_source` - Add files, URLs, text, YouTube videos, Google Drive documents
  - `list_content` - View all sources and generated content
- Content generation:
  - `generate_audio` - Create podcast-style audio overviews
  - ~~`generate_content`~~ - Removed in v1.4.2 (was fake - just chat prompts, not real NotebookLM features)
  - `download_audio` - Download generated audio files
- Full HTTP REST API support with 6 new endpoints
- Complete documentation in `10-CONTENT-MANAGEMENT.md`

**Multi-Account Management:**

- New account management system for multiple Google accounts
- Account switching: `switch_account`, `list_accounts`, `get_current_account`
- Dedicated session per account for parallel operations
- HTTP endpoints for account management
- Documentation in `MULTI_ACCOUNT_SYSTEM.md`

---

## [1.3.7] - 2025-12-16

### Added

**Source Citation Extraction:**

- New `source_format` parameter for `ask_question` tool with 5 options:
  - `none`: No extraction (default, fastest)
  - `inline`: Insert source text inline: `[1: "source excerpt..."]`
  - `footnotes`: Append sources at the end as footnotes
  - `json`: Return sources as separate object in response
  - `expanded`: Replace markers with full quoted source text
- New `src/utils/citation-extractor.ts` module for hover-based citation extraction
- Extracts source citations by hovering over citation markers in NotebookLM responses
- No additional API calls required - pure DOM interaction

### Fixed

**Citation Detection:**

- Fixed `findCitationsByRegex` returning empty results - now properly finds DOM elements
- Added multiple detection strategies: CSS selectors, data attributes, XPath fallback
- Fixed citation replacement for all occurrence (was only replacing first match)
- Added descending sort to avoid replacing `[1]` before `[10]`
- Handle NotebookLM's various citation formats:
  - Bracketed: `[1]`, `[2]`
  - Superscript: `text1,2` or `text3`
  - Stuck together: `text123` (citations 1, 2, 3)

---

## [1.3.6] - 2025-11-29

### Changed

**Documentation Restructure:**

- Simplified README.md from 765 to 165 lines (-78%)
- Extracted roadmap section into dedicated `ROADMAP.md` file
- README now focuses on Quick Start with links to detailed docs
- Better separation of concerns: README for overview, docs/ for details

### Added

- New `ROADMAP.md` file with planned features and version history

---

## [1.3.5] - 2025-11-27

### Added

**Quality Tooling & CI/CD:**

- Added Jest testing framework with comprehensive test suite (327 tests)
- Added ESLint configuration for code quality enforcement
- Added Prettier for consistent code formatting
- Added Husky + lint-staged for pre-commit hooks
- Added GitHub Actions CI workflow with multi-Node version testing (18.x, 20.x, 22.x)
- Added Codecov integration for coverage tracking
- Added type-coverage tool (99.01% coverage)

**Test Coverage:**

- Unit tests for `logger.ts` (100% coverage)
- Unit tests for `errors.ts` and error types
- Unit tests for `config.ts` parsing and validation
- Unit tests for `stealth-utils.ts` timing functions
- Unit tests for `cleanup-manager.ts` core functionality
- Unit tests for `page-utils.ts` selectors and utilities
- Type system tests for `ToolResult<T>` discriminated union

### Fixed

- Fixed Prettier formatting issues in README.md and test files
- Fixed code style consistency across all source files

---

## [1.3.4] - 2025-11-26

### Fixed

**CLI Scripts:**

- Fixed `de-auth.ts` CLI script: added missing implementation
- Improved page load wait logic in authentication flow

**Test Reliability:**

- Improved `test-auth.ps1` reliability: reduced from 9 tests to 7 focused tests
- Smart cleanup test that checks auth status before attempting restore
- Cleanup test now passes regardless of whether manual re-auth is needed
- Removed strict type validation tests that were testing unimplemented server-side validation

---

## [1.3.3] - 2025-01-26

### Security

**CORS Hardening:**

- Added CORS whitelist configuration via `CORS_ORIGINS` environment variable
- Default whitelist allows only localhost origins (ports 3000, 5678, 8080)
- Blocked external origins no longer receive CORS headers
- Supports wildcard `*` for development when explicitly configured

**Input Validation:**

- Added Zod schema validation for all HTTP endpoints
- Validates request bodies with detailed error messages
- Schemas: AskQuestionSchema, AddNotebookSchema, UpdateNotebookSchema, AutoDiscoverSchema, CleanupDataSchema, ShowBrowserSchema

**Express Route Security:**

- Fixed route ordering: static routes (`/notebooks/search`, `/notebooks/stats`) now correctly matched before parameterized routes (`/notebooks/:id`)
- Prevents route hijacking vulnerabilities

### Fixed

**Error Handling:**

- Replaced 30+ empty catch blocks with proper `log.debug()` logging
- Improved error visibility for debugging without breaking functionality

**Type Safety:**

- Refactored `ToolResult<T>` to discriminated union type for compile-time safety
- Fixed `ServerState` types with proper `Browser`, `SessionManager`, `AuthManager` types
- Added `JSONSchemaProperty` type for MCP tool input schemas
- Added config validation with constraint checking (min/max ranges, positive values)
- Fixed `parseProfileStrategy` to avoid unsafe `as any` type assertions

### Added

**Test Coverage (25 → 72 tests, +188%):**

- `test-validation.ps1` (18 tests) - Zod schema validation testing
- `test-auth.ps1` (8 tests) - Authentication endpoint testing
- `test-cors.ps1` (10 tests) - CORS configuration testing
- `test-sessions.ps1` (10 tests) - Session management testing
- Fixed `test-errors.ps1` pattern matching for Zod validation messages

---

## [1.3.2] - 2025-01-24

### Added

**Authentication Management:**

- New MCP tool `de_auth` for secure logout (clears all credentials without re-authenticating)
- Separation of concerns: `de_auth` (logout only), `re_auth` (logout + re-authenticate), `setup_auth` (first-time)
- HTTP API endpoints for complete authentication lifecycle:
  - `POST /de-auth` - Logout and clear credentials
  - `POST /re-auth` - Re-authenticate with different account
  - `POST /cleanup-data` - Clean all data (requires confirmation)

**HTTP API Feature Parity:**

- Added 7 missing endpoints to achieve 100% parity with MCP stdio tools
- Authentication: `/de-auth`, `/re-auth`, `/cleanup-data`
- Notebooks: `PUT /notebooks/:id`, `/notebooks/search`, `/notebooks/stats`
- Sessions: `POST /sessions/:id/reset`
- All 22 endpoints now available via both HTTP REST API and MCP stdio

**Documentation:**

- Complete API reference updated with all 22 endpoints in `deployment/docs/03-API.md`
- Added curl examples and request/response schemas for all new endpoints
- Categorized endpoints by type (Authentication, Queries, Notebooks, Sessions)

### Fixed

**Authentication Preservation:**

- Critical fix: `setup_auth` no longer erases existing authentication
- Added check for existing auth before clearing credentials
- Users can now switch between HTTP and MCP stdio modes without re-authenticating
- Preserves user experience when switching interfaces

**Code Quality:**

- Refactored `re_auth` to use `de_auth` internally (DRY principle)
- Improved separation of concerns in authentication flow
- Better error handling in HTTP wrapper

### Changed

**Version Synchronization:**

- Updated all version references across codebase to 1.3.2
- Synchronized versions in package.json, src/index.ts, src/http-wrapper.ts, README.md
- Consistent versioning across all documentation files

---

## [1.3.1] - 2025-01-24

### Added

**MCP Auto-Discovery Tool:**

- New MCP tool `auto_discover_notebook` for Claude Desktop/Cursor integration
- Automatically generates notebook metadata via NotebookLM (30 seconds vs 5 minutes)
- Zero-friction notebook addition: just provide URL, metadata is auto-generated
- Parity with HTTP API: MCP clients now have same auto-discovery capability

**Documentation:**

- Added `docs/CHROME_PROFILE_LIMITATION.md` documenting Chrome profile conflict
- Documented current limitation: HTTP and MCP stdio modes cannot run simultaneously
- Added roadmap for v1.4.0: Separate Chrome profiles by mode

### Fixed

**Critical Compatibility Fix:**

- Disabled `CompleteRequestSchema` handler causing crashes with Claude Desktop
- Fixed: "Server does not support completions" error on connection
- Claude Desktop now connects successfully without modifications

### Changed

**Tool Documentation:**

- Updated `add_notebook` tool to recommend `auto_discover_notebook` first
- Clarified when to use manual entry vs auto-discovery
- Added fallback workflow if auto-discovery fails

**README Updates:**

- Added warning about HTTP/stdio mode conflict (temporary until v1.4.0)
- Added Chrome profile limitation to roadmap as priority feature
- Updated feature descriptions to mention MCP auto-discovery availability

### Known Issues

**Chrome Profile Locking:**

- HTTP server and MCP stdio modes cannot run simultaneously
- Both modes use same Chrome profile, causing "resource busy" errors
- **Workaround:** Choose one mode at a time, or stop HTTP daemon before using Claude Desktop
- **Fix planned:** v1.4.0 will use separate Chrome profiles automatically

---

## [1.3.0] - 2025-01-23

### Added

**Auto-Discovery Feature:**

- New endpoint `POST /notebooks/auto-discover` for autonomous resource discovery
- Automatic metadata generation by querying NotebookLM itself
- Progressive disclosure pattern inspired by Claude Skills best practices
- Validation of auto-generated metadata (kebab-case names, description length, tags count)
- Retry logic for metadata generation (max 2 attempts with 2s delay)
- New field `auto_generated: boolean` in Notebook schema
- Complete documentation in `deployment/docs/07-AUTO-DISCOVERY.md`

**Key Benefits:**

- Autonomous resource discovery: Orchestrators can find relevant documentation without manual intervention
- Zero-friction notebook addition (30 seconds vs 5 minutes manual setup)
- Self-organizing documentation library
- Progressive disclosure pattern optimizes token usage and API rate limits

### Changed

**Documentation:**

- Updated API documentation with auto-discovery endpoint details
- Added progressive disclosure pattern explanation
- Enhanced README with auto-discovery feature showcase
- Version bumped to 1.3.0 across all package files

---

## [1.1.2-http] - 2025-01-21

### Added

**HTTP REST API Wrapper:**

- Express.js server exposing the MCP API via HTTP REST
- 8 documented REST endpoints (see [docs/03-API.md](./docs/03-API.md))
- CORS support for n8n/Zapier/Make integration
- Network configuration via environment variables (`HTTP_HOST`, `HTTP_PORT`)
- Listening on `0.0.0.0` by default for network access
- Enhanced logs with version, configuration, and available endpoints

**Complete Documentation:**

- Step-by-step installation guide ([docs/01-INSTALL.md](./docs/01-INSTALL.md))
- Configuration and security guide ([docs/02-CONFIGURATION.md](./docs/02-CONFIGURATION.md))
- Complete API reference ([docs/03-API.md](./docs/03-API.md))
- n8n integration guide with workflows ([docs/04-N8N-INTEGRATION.md](./docs/04-N8N-INTEGRATION.md))
- Troubleshooting guide ([docs/05-TROUBLESHOOTING.md](./docs/05-TROUBLESHOOTING.md))
- Quick start guide ([QUICK-START.md](./QUICK-START.md))
- Navigation index ([INDEX.md](./INDEX.md))

**PowerShell Automation Scripts:**

- `scripts/install.ps1` - Automated installation with checks
- `scripts/start-server.ps1` - Startup with pre-checks
- `scripts/stop-server.ps1` - Clean server shutdown
- `scripts/test-server.ps1` - Validation tests (health, notebooks, ask)

**Deployment Package:**

- Isolated and clean `deployment/` directory
- `PACKAGE-FILES.txt` file listing required files
- Ready for distribution via Git or npm

### Fixed

**Critical Bug - Windows Authentication:**

- **Issue:** chrome_profile/ remained empty after Google authentication
- **Cause:** Windows filesystem does not immediately flush writes
- **Solution:** Added a 5-second delay before closing Chrome
- **File:** `src/auth/auth-manager.ts` line 966
- **Impact:** Persistent authentication now works on Windows

**Bug - Streaming Detection:**

- **Issue:** Truncated responses or placeholders returned ("Getting the context...")
- **Cause:** Stability threshold too low (3 polls) and missing NotebookLM placeholders
- **Solution:**
  - Added NotebookLM placeholders ("getting the context", "loading", "please wait")
  - Increased stability threshold to 8 polls (~8 seconds)
- **File:** `src/utils/page-utils.ts` lines 51-53 and 210
- **Impact:** Complete and reliable responses (tested up to 5964 characters)

**Bug - System Text in Responses:**

- **Issue:** Each response contained "\n\nEXTREMELY IMPORTANT: Is that ALL you need..."
- **Cause:** `FOLLOW_UP_REMINDER` constant added after text cleanup
- **Solution:** Removed the constant and its usage
- **File:** `src/tools/index.ts` lines 30-31 and 791
- **Impact:** Clean responses, only NotebookLM content

### Changed

**Log Improvements:**

- Added server version in startup banner
- Display of configuration (Host, Port, network accessibility)
- List of available endpoints at startup
- Colored and structured logs via `utils/logger.ts`
- Format: `log.success()`, `log.info()`, `log.warning()`, `log.error()`, `log.dim()`

**Configuration:**

- Documented and standardized environment variables
- `.env` support with dotenv (optional)
- Sane defaults: `HTTP_HOST=0.0.0.0`, `HTTP_PORT=3000`, `HEADLESS=true`

**Compatibility:**

- Maintained 100% compatibility with original MCP stdio mode
- No breaking changes to existing features

---

## [1.1.2] - 2025-01-20

### Added

- Support for Claude Code as MCP client
- Improved documentation for installation

### Fixed

- Executable permissions for npm binary
- Reference in package.json

---

## [1.1.0] - 2025-01-15

Initial version of the original NotebookLM MCP Server project by Please Prompto!

### Added

- MCP server for NotebookLM via stdio protocol
- Persistent Google authentication
- Browser session management with Playwright
- Multi-notebook support via library
- Streaming detection with stability
- Stealth mode anti-detection
- MCP tools: ask_question, setup_auth, get_health, etc.

---

## Legend of Change Types

- **Added** - New features
- **Changed** - Changes to existing features
- **Deprecated** - Features soon to be removed
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

---

**Notes:**

The `1.1.2-http` version is a major extension of the original project that adds:

1. Complete HTTP REST API wrapper
2. Production-ready deployment package
3. Comprehensive documentation (5 guides + scripts)
4. Critical fixes for Windows
5. Ready for Git/npm publication

All changes respect the original MIT license and maintain compatibility with the original MCP stdio mode.
