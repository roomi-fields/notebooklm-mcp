# Roadmap

This document tracks planned features, recent implementations, and future ideas for the NotebookLM MCP Server.

## Current Version: v1.5.3

---

## Backlog

### High Priority

| Feature                  | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| **/notebooks/:id/share** | API endpoint to share notebooks between accounts programmatically |

### Medium Priority

| Feature                    | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| **Cleanup test notebooks** | Delete unused notebooks in test accounts (100 limit reached) |
| **Source Discovery**       | Discover sources from Web/Drive (Fast/Deep modes)            |
| **Edit/Delete notes**      | Complete notes CRUD operations                               |

### Low Priority

| Feature                   | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| **Audio style selection** | Debate, Critique, Brief summary, Deep dive                            |
| **Export formats**        | PDF/DOCX for reports, PDF/PPTX for presentations, CSV/XLSX for tables |

---

## Upcoming

### v1.6.0 - Study & Learning Features

**Priority: Medium** - Add study-focused content types.

**Mind Maps:**

- [ ] Generate mind map from sources
- [ ] Expand/collapse nodes
- [ ] Download as image (PNG/SVG)

**Quiz:**

- [ ] Generate quiz with questions
- [ ] Question types (MCQ, true/false, open)
- [ ] Difficulty levels
- [ ] Export quiz

**Learning Cards (Flashcards):**

- [ ] Generate flashcards from sources
- [ ] Card format customization
- [ ] Spaced repetition support
- [ ] Export as Anki/Quizlet

---

## Recently Implemented

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
