# Roadmap

This document tracks planned features, recent implementations, and future ideas for the NotebookLM MCP Server.

## Current Version: v1.4.0

---

## Upcoming

### v1.5.0 - Note & Source Management

**Priority: High** - Complete NotebookLM content management.

**Source Discovery:**

- [ ] Discover sources from Web (Fast mode)
- [ ] Discover sources from Web (Deep mode)
- [ ] Discover sources from Google Drive (Fast mode)
- [ ] Discover sources from Google Drive (Deep mode)

**Note Management:**

- [ ] Create notes (text input)
- [ ] Edit notes
- [ ] Delete notes
- [ ] Save chat response to note
- [ ] Convert note to source

**Source Management:**

- [ ] Delete sources

---

## Recently Implemented

### v1.4.0 - Content Management

- [x] Add sources (files, URLs, text, YouTube, Google Drive)
- [x] Generate content (Audio, Briefing, Study Guide, FAQ, Timeline)
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
