# Roadmap

This document tracks planned features, recent implementations, and future ideas for the NotebookLM MCP Server.

## Current Version: v1.4.2

---

## Upcoming

### v1.5.0 - Studio Complete

**Priority: High** - Complete NotebookLM Studio features.

**Audio Overviews (partial - needs options):**

- [x] Generate audio overview (basic)
- [x] Download audio file
- [ ] Audio style selection: Debate, Critique, Brief summary, Deep dive
- [ ] Tone customization (humor, formality)
- [ ] Length/duration control
- [ ] Language selection (80+ languages)

**Video Overviews (NEW):**

- [ ] Generate video overview
- [ ] Format selection: Brief, Explainer
- [ ] Visual style selection (6 styles via Nano Banana AI)
- [ ] Download video file

**Mind Maps (NEW):**

- [ ] Generate mind map from sources
- [ ] Expand/collapse nodes
- [ ] Download as image (PNG/SVG)

**Reports (TODO - need REAL UI automation):**

- [ ] Generate briefing doc (basic)
- [ ] Full report generation (2,000-3,000 words)
- [ ] Section customization
- [ ] Download as PDF/DOCX

**Infographics (NEW):**

- [ ] Generate infographic
- [ ] Format: Horizontal (16:9) for LinkedIn/blogs
- [ ] Format: Vertical (9:16) for Instagram/TikTok
- [ ] Download as image

**Slide Decks / Presentations (NEW):**

- [ ] Generate presentation
- [ ] AI-generated images (Nano Banana Pro)
- [ ] Theme/style selection
- [ ] Download as PDF/PPTX

**Study Resources (TODO - need REAL UI automation):**

- [ ] Generate study guide (basic)
- [ ] Generate FAQ
- [ ] Generate timeline
- [ ] Generate table of contents
- [ ] Generate quiz with questions
- [ ] Generate flashcards
- [ ] Key terms extraction
- [ ] Download all formats

**Download & Export (PRIORITY):**

- [ ] Universal download for ALL content types
- [ ] Dynamic format detection from UI
- [ ] Endpoint: `GET /content/download?type=...&format=...`

**Note Management:**

- [ ] Create notes (text input)
- [ ] Edit notes
- [ ] Delete notes
- [ ] Save chat response to note
- [ ] Convert note to source

**Source Management:**

- [ ] Delete individual sources
- [ ] Bulk delete sources
- [ ] Edit source metadata

**Source Discovery:**

- [ ] Discover sources from Web (Fast mode)
- [ ] Discover sources from Web (Deep mode)
- [ ] Discover sources from Google Drive (Fast mode)
- [ ] Discover sources from Google Drive (Deep mode)

---

## Recently Implemented

### v1.4.0 - Content Management

- [x] Add sources (files, URLs, text, YouTube, Google Drive)
- [x] Generate audio overview (clicks real Studio buttons)
- [x] Download audio files
- [x] List sources and content
- [x] Multi-account support

> **Note:** v1.4.x initially claimed support for generating Study Guide, FAQ, Timeline, Table of Contents, and Briefing Doc. These were **fake implementations** that only sent prompts to the chat interface instead of clicking the real Studio buttons. They have been removed and moved back to TODO status. Only audio overview generation uses real UI automation.

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
