#!/usr/bin/env node

/**
 * Sync root CHANGELOG.md into website/docs/CHANGELOG.md with Docusaurus
 * frontmatter prepended. Runs before `npm run build` / `npm run start`.
 *
 * Single source of truth stays at the repo root; the website copy is
 * regenerated on every build so it can never drift.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(__dirname, '..');
const repoRoot = resolve(websiteRoot, '..');

const source = resolve(repoRoot, 'CHANGELOG.md');
const target = resolve(websiteRoot, 'docs', 'CHANGELOG.md');

const frontmatter = `---
title: Release history and per-version changelog
description: Detailed per-version changelog for the NotebookLM MCP + HTTP REST API server. Added, changed, fixed, and security notes for every release since 1.0.0.
keywords: [notebooklm mcp changelog, notebooklm release history, notebooklm mcp versions]
sidebar_position: 99
slug: /changelog
---

`;

let content = readFileSync(source, 'utf-8');

// Drop the first H1 "# Changelog" — Docusaurus uses the frontmatter title
// as the rendered H1, keeping both would duplicate the heading.
content = content.replace(/^#\s+Changelog\s*\n+/, '');

writeFileSync(target, frontmatter + content, 'utf-8');
console.log(`Synced CHANGELOG.md → ${target}`);
