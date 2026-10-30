# Roadmap

This document tracks planned features, recent implementations, and future ideas for the NotebookLM MCP Server.

## Current Version: v4.4.0

---

## Backlog

Sequenced into roughly two-week releases. The ordering is by value to an agent
divided by effort, with one exception: the security items come first regardless.

Sources for the imported items: a read of `teng-lin/notebooklm-py` v0.8.5
(`docs/rpc-reference.md`, `src/notebooklm/rpc/_identifiers.py`) and of
`jacob-bd/gemini-notebook-mcp-cli` v0.15.6 release notes and docs, 2026-10-18.
Both are MIT-ish prior art for protocol facts only — we write our own
implementation and cite the source in the code, per `.claude/CLAUDE.md`.

### Next — the one row the previous batch could not ship

| Tool                   | RPC id                       | Why it is still here                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Re-sync a stale source | `SYNC_DRIVE_SOURCE` (FLmJqe) | The singular refresh is rejected by the server — `teng-lin/notebooklm-py` records INVALID_ARGUMENT for every shape tried, on an account where the plural `dtT1F` accepts the same id. Exposing it would ship a tool that always fails, so `check_source_freshness` tells you a source is stale and the resync waits for the plural payload to be documented. |

### Then — new capabilities, highest value first

| Capability                                        | RPC id                         | Notes                                                                                         |
| ------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| Retry a failed artifact, same id                  | `Rytqqe`                       | Today a failed generation is final.                                                           |
| Quota meter and subscription tier                 | `EylDcb`, `ZwVcOc`             | Needed for long batch runs. Call `EylDcb` only when `SatQRc` reports metering enabled.        |
| Cancel a running answer or research               | `XgrPMd`, `Zbrupe`             | For research, cancel with the **report id**, not the task id — the task id is a silent no-op. |
| Copy a notebook, sources, or artifacts            | `te3DCe`, `R27wvc`, `mKDdke`   | No MCP server exposes these.                                                                  |
| Independent conversations per notebook            | —                              | The most repeated user request on the competitor's tracker.                                   |
| Suggested follow-ups, prompts, report formats     | `OcvKNc`, `otmP3b`, `ciyUvf`   | Three trivial calls.                                                                          |
| Async URL ingestion; append text to a source      | `X1snv`, `QsNTEd`              | ~0.65 s vs ~2 s per source.                                                                   |
| Chat configuration: goal, persona, length         | `s0tc2d` variant               |                                                                                               |
| Read and set the account output language          | `ZwVcOc`, `hT54vc`             | Account-global — warn the caller.                                                             |
| Notebook collections                              | label ids with discriminator 3 |                                                                                               |
| Synchronous source discovery (~10 results)        | `Es3dTe`                       |                                                                                               |
| Remove from "recently viewed"                     | `fejl7e`                       | Sometimes answers `[13]`; treat as success.                                                   |
| Tool groups, to cut the context an agent pays for | —                              | Competitor exposes 53 tools and lets callers disable groups. We expose 49 with no filter.     |

### Onboarding — the conversion half of being found

Being placed where people search is wasted if arriving is hard. The competitor
installs in three commands (`install`, `login`, `setup`), auto-detects ~12 MCP
clients, backs up each config before writing it, and ships a `doctor`. We ask
the user to edit their MCP client config by hand. Of 171 unique visitors in a
fortnight, 145 saw only the front page.

| Item                                                           | Note                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A `setup` command that writes the client config**            | Detect the installed clients, back up before writing. The single biggest drop-off we can address. |
| **Bounded re-auth budget**                                     | Theirs stops after 3 failures / 900 s with a specific diagnostic. Ours retries without a ceiling. |
| **Login that never replaces a good session with a failed one** | Theirs waits for the real cookie + CSRF for 300 s, and keeps the old session on failure.          |
| **Optional encryption of the stored session**                  | Ours sits in plain files — the same files the `add_source` hole could exfiltrate.                 |

Not worth copying from them: the CLI/REPL, keychain integration, the
batch/pipeline/tag orchestration layer (an agent orchestrates itself), and
inter-process locks.

### API surface inconsistencies

Spotted while documenting the 45 endpoints against their handlers. None is
urgent; all are the kind of thing a caller discovers the hard way.

| Issue                                                              | Detail                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Two error conventions**                                          | The RPC extensions (study aid, mind map, research, labels, share, content deletion) return validation failures as **HTTP 200 with `success: false`**, while `/ask`, `/batch-to-vault`, `/notebooks/bulk-delete` and `/content/notes/get` return 400. Pick one. |
| **`PUT /notebooks/:id/share` with an empty body disables sharing** | It reads `req.body?.public === true`, so a malformed or empty request silently unshares a notebook instead of failing.                                                                                                                                         |
| **`DELETE /content/:contentId` always reports success**            | It returns `deleted: true` without reading back, unlike the notebook bulk delete, which verifies. We learned this lesson once already with the wrong-tile deletion bug.                                                                                        |
| **`/batch-to-vault` returns 400 for every failure**                | Including an unwritable output directory, which is a server-side condition, not a bad request.                                                                                                                                                                 |

### Live behaviours to re-test against the real service

| Question                                              | Why it matters                                                                                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Is our rate-limit detection obsolete?**             | Google appears to have replaced the fixed daily cap with two compute windows (rolling + weekly) carrying a percentage left and a reset time. Our detector still looks for daily-limit wording. |
| **Are our cookies device-bound in the RPC path?**     | Replaying cookies outside the browser reportedly fails with status 16 in ~16 s. Our RPC transport is a plain Node fetch with a Cookie header; the browser fallback may be masking this.        |
| **Do the unused RPC ids in `rpc-ids.ts` still work?** | Several have never been exercised. An id that rotated is cheaper to find now than during an incident.                                                                                          |
| **Video generation throttle**                         | ~6 in a row, then a 1-2 minute wait; status 8 means Google is throttling for hours, not that we failed.                                                                                        |
| **Large listings**                                    | Their artifact status listing reached 81 KB and broke agents; they paginate at 20. Check what ours returns on a full notebook.                                                                 |

### Correctness to verify against our own code

Each of these cost the other projects a release to learn.

- **Stream end**: the final chunk carries an explicit `isFinalResponse` flag at index 4. "Longest wins" is only a fallback — check what our answer detection actually uses.
- **Quiz and flashcards**: the `(quantity, difficulty)` pair was transposed in their client. Verify ours against the server echo.
- **Artifact status**: `1` queued, `2` running, `3` ready, `4` failed, `5` suggested. Two were inverted in their client for months. An artifact missing from a listing is **not** proof of deletion — wait for the timeout.
- **Deep research**: poll and import with the report id; the task id is not pollable.
- **Sharing**: a duplicate email succeeds with no effect, and a bulk removal naming one absent target silently ignores **all** of them. Read the state back.
- **Drive sources**: a deleted Drive file still reports "ready". The Drive status is a separate field.
- **Media download**: `googlevideo.com` throttles a single full transfer to ~32 KB/s; 8 MB ranges move the same file in about a second.

### Do not implement

Verified dead or no-op upstream — knowing this is worth as much as the rest.

- `Z8UXi` (synchronous CopySources): dead on both frontends.
- `zVGIdd` (synchronous CopyArtifacts): validates arity, copies nothing, reports success.
- `gzAChb` (GetQuota): never reports consumption; superseded by `EylDcb`.
- Batch forms of `WWINqb` and `V5N4be`: rejected, one id per call.
- Per-turn chat deletion: does not exist; `DELETE_CHAT_HISTORY` clears everything.

### Older items, still open

| Feature                           | Description                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| **Scrape: reset to My Notebooks** | Navigate to "My Notebooks" before scraping (not shared view)          |
| **Scrape after auth**             | Option to auto-scrape notebooks after successful authentication       |
| **Persist scraped notebooks**     | Keep scraped notebooks across re-authentication                       |
| **Cleanup test notebooks**        | Delete unused notebooks in test accounts (100 limit reached)          |
| **Edit/Delete notes**             | Complete notes CRUD operations                                        |
| **Audio style selection**         | Debate, Critique, Brief summary, Deep dive                            |
| **Export formats**                | PDF/DOCX for reports, PDF/PPTX for presentations, CSV/XLSX for tables |

---

## Recently Implemented

### Unreleased - Ranked passage search

`search_passages` / `POST /notebooks/:id/search` return the indexed passages
matching a query, best rank first, without generating anything. It is the half
of research an agent cannot do for itself: retrieval costs no generation quota,
so an agent that reasons over evidence no longer has to buy prose to get at it.

Two facts the envelope makes easy to get wrong, both locked by tests: rank is
**global across sources** while the reply is grouped by source, so the wire
order is not the ranking; and a span starting at zero arrives with the slot
absent, which is reported as "no offsets" rather than guessed at 0 — inventing
that zero is how a quote gets attributed to the top of a long document.

Protocol details read from `teng-lin/notebooklm-py` (MIT), cited in the code.

### Unreleased - 8 tools for RPCs that were already implemented

Eight method ids sat in the table since v3 with nothing exposing them. The
protocol details came from reading `teng-lin/notebooklm-py` (MIT) rather than
from capturing traffic.

- [x] `rename_source` — rename one source in place
- [x] `check_source_freshness` — have URL / Drive sources drifted? whole notebook by default
- [x] `get_source_guide` — NotebookLM's own summary and key topics for one source
- [x] `get_notebook_summary` — the notebook's summary plus the questions it suggests
- [x] `get_chat_history` — read back the recorded questions and answers, newest first
- [x] `delete_chat_history` — the web UI's "Delete history"
- [x] `export_artifact` — export a finished artifact to Google Docs or Sheets
- [x] `revise_slide` — revise one slide instead of regenerating the deck

Two things the backlog had wrong, found by reading before writing: there is no
way to _list_ conversations (the server returns only the most recent id, and
ignores the limit it accepts), and there is no per-turn delete. The tools are
named for what the service does, not for what the entry hoped.

### v4.2.0 - Caller-supplied file paths are confined

`add_source`, `download_content` and the batch writer all take a path from the
caller. The data directory was an allowed root and holds the live Google
session, so a poisoned source could have the agent upload it into a notebook.
One shared guard now resolves before checking, follows symlinks, compares whole
segments, and refuses the session store whatever the roots allow. See
`src/utils/safe-paths.ts`.

### v3.0.0 - Dual transport (internal RPC API) + 5 new tools

- [x] Data plane migrated to NotebookLM's internal `batchexecute` RPC API with automatic DOM fallback (10-100× faster, immune to UI rebrands)
- [x] `share_notebook` — read/set the public link + list collaborators
- [x] `generate_study_aid` — flashcards & quiz
- [x] `generate_mind_map` — interactive mind map, saved to the notebook
- [x] `manage_labels` — source-label CRUD
- [x] `research_sources` — web/Drive source discovery (fast/deep modes)
- [x] Interactive login as a CLI command (`notebooklm-mcp setup-auth`) for global / stdio installs — v3.0.1 (#27)

### v2.3.0 - "Gemini Notebook" rebrand support

- [x] Create / list / rename / delete, sources, and every Studio generation type re-verified against the rebuilt UI (#23, #21)

### v1.5.4 - Citation Source Format Fix

- [x] Fixed `source_format` parameter not passed from HTTP `/ask` endpoint (critical bug)
- [x] Updated citation selectors for current NotebookLM DOM (January 2026)
- [x] New `extractSourceFromElement()` extracts both `sourceName` and `sourceText`
- [x] Fixed Docker Xvfb permissions (`/tmp/.X11-unix`)
- [x] Changed docker-compose port from 5900 to 6080 (noVNC web interface)
- [x] Added E2E tests for source format functionality

### v1.5.3 - Docker & Bulk Import

- [x] Docker deployment with noVNC for visual Google authentication
- [x] `POST /notebooks/import-from-scrape` - Bulk import notebooks from scrape
- [x] Options: `notebook_ids` filter, `auto_discover` for AI metadata generation
- [x] Chrome flags for Docker compatibility (`--no-sandbox`, etc.)

### v1.5.2 - Notebook Discovery

- [x] `list_notebooks_from_nblm` tool - Scrape NotebookLM homepage for real notebook list
- [x] `GET /notebooks/scrape` endpoint with `?show_browser=true` option
- [x] MCP and HTTP support for notebook discovery

### v1.5.1 - Multilingual UI Support

- [x] i18n system for NotebookLM UI selectors (French and English)
- [x] `NOTEBOOKLM_UI_LOCALE` environment variable
- [x] Language switching script (`scripts/switch-account-language.sh`)
- [x] Complete E2E test suite (76 tests)
- [x] Documentation for adding new languages

### v1.5.0 - Studio Complete

- [x] Video overviews (Brief, Explainer formats + 6 visual styles)
- [x] Infographics (Horizontal 16:9, Vertical 9:16)
- [x] Presentations (styles: detailed_slideshow, presenter_notes + length options)
- [x] Data tables generation
- [x] Reports with format options (summary, detailed)
- [x] Download video, infographic, audio files
- [x] Export to Google Slides/Sheets
- [x] Notes management (create, chat-to-note, note-to-source)
- [x] Delete sources by name or ID
- [x] Language selection for generated content (80+ languages)
- [x] Custom instructions support for all content types

### v1.4.0 - Content Management

- [x] Add sources (files, URLs, text, YouTube, Google Drive)
- [x] Generate audio overview (clicks real Studio buttons)
- [x] Download audio files
- [x] List sources and content
- [x] Multi-account support

### v1.3.7 - Source Citation Extraction

- [x] 5 citation formats: none, inline, footnotes, json, expanded
- [x] Hover-based citation extraction from DOM

### v1.3.6 - Documentation Restructure

- [x] Simplified README.md from 765 to 165 lines (-78%)
- [x] Extracted roadmap into dedicated `ROADMAP.md` file
- [x] Better separation: README for overview, docs/ for details

### v1.3.5 - Quality Tooling

- [x] ESLint + Prettier configuration
- [x] Jest testing infrastructure with coverage
- [x] GitHub Actions CI workflow
- [x] Codecov integration

### v1.3.4 - Minor Fixes

- [x] Fix PowerShell `CursorPosition` error in test scripts (non-interactive terminal)
- [x] Add strict type validation for `show_browser` parameter (return 400 on invalid types)

### v1.3.2 - Auto-Discovery

**Autonomous Resource Discovery:**

- [x] Automatically generate notebook name, description, and tags via NotebookLM
- [x] Progressive disclosure pattern inspired by Claude Skills best practices
- [x] Zero-friction notebook addition (30 seconds vs 5 minutes)
- [x] Validation of auto-generated metadata (kebab-case, description length, tags count)
- [x] Orchestrators discover relevant documentation autonomously

**Details:** [Auto-Discovery Documentation](./deployment/docs/07-AUTO-DISCOVERY.md)

### v1.1.2 - Foundation

**PM2 Daemon Mode:**

- [x] Cross-platform process manager with auto-restart
- [x] Commands: `npm run daemon:start`, `daemon:logs`, `daemon:status`
- [x] Built-in log rotation and monitoring

**Multi-Notebook Library:**

- [x] Live validation of notebooks
- [x] Duplicate detection
- [x] Smart notebook selection

---

## Ideas & Proposals

Have an idea? [Open a discussion](https://github.com/roomi-fields/notebooklm-mcp/discussions) to suggest new features!

---

## Changelog

For detailed version history, see [CHANGELOG.md](./CHANGELOG.md).
