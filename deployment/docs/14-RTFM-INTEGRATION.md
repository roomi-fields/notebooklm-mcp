# NotebookLM + RTFM — cache batch outputs as a searchable markdown vault

NotebookLM is brilliant at producing citation-backed answers, but it's slow (~10–30s per query) and rate-limited (50 queries per day per Google account on the free tier). For any workflow that re-asks similar questions over time — academic literature reviews, competitive intelligence pipelines, internal knowledge bases — querying NotebookLM live every time is the wrong architecture.

The pattern that scales: **NotebookLM as a one-shot ingestion layer, [RTFM](https://github.com/roomi-fields/rtfm) as the retrieval layer.** Run an exhaustive question set once, persist every answer (with citations, source titles, and excerpts) as markdown, then point your CLI agent at the vault for unlimited offline queries.

```
[Once per notebook, periodic]
  CLI agent generates an exhaustive question set
    → POST /batch-to-vault   (titles + excerpts, citations preserved)
      → vault/*.md + vault/*.json   (RTFM-ingestable)

[At will, unlimited, ~ms, offline]
  Agent → rtfm_search → rtfm_expand → answer
```

This page shows how to wire the two together.

## Why this beats querying NotebookLM live

| Concern           | Live NotebookLM             | NotebookLM → vault → RTFM      |
| ----------------- | --------------------------- | ------------------------------ |
| Latency per query | 10–30s                      | ~milliseconds                  |
| Quota             | 50/day per Google account   | Unlimited after one-shot batch |
| Repeat queries    | Cost a quota slot each time | Free                           |
| Offline           | No                          | Yes                            |
| Source citations  | Yes (titles + excerpts)     | Yes (preserved in markdown)    |
| Best for          | Fresh interpretation        | Re-querying ingested knowledge |

## What you need

- This project running locally: `npm run start:http` after `npm run setup-auth`. [Install guide](/install).
- [RTFM](https://github.com/roomi-fields/rtfm) installed and configured to point at your vault directory.
- A notebook with sources already attached. List them with `GET /notebooks/scrape`.
- A list of questions you want answered against that notebook.

## The endpoint

`POST /batch-to-vault` runs a list of questions and writes each answer as two artifacts in a vault directory:

- `{slug}.md` — markdown with YAML frontmatter, the answer body, and a "Sources" section with quoted excerpts. Indexable by any markdown vault tool (RTFM, Obsidian, Foam, Dendron…).
- `{slug}.json` — a structured payload conforming to the `nblm-answer-v1` schema (see [schema below](#nblm-answer-v1-json-schema)) for richer ingestion.

### Request

```bash
curl -X POST http://localhost:3000/batch-to-vault \
  -H 'Content-Type: application/json' \
  -d '{
    "questions": [
      "What is the OSBD process?",
      "How does NVC differentiate a need from a strategy?",
      "What is empathic listening in NVC?"
    ],
    "notebook_id": "notebook-1",
    "vault_dir": "/path/to/your/vault/cnv",
    "slug_prefix": "sota",
    "source_format": "json",
    "sleep_between_ms": 2000
  }'
```

### Parameters

| Field              | Required | Default  | Description                                                                                   |
| ------------------ | -------- | -------- | --------------------------------------------------------------------------------------------- |
| `questions`        | yes      | —        | Non-empty array of strings. Each question becomes one `.md` + one `.json` file.               |
| `vault_dir`        | yes      | —        | Destination directory. Created with `mkdir -p` if missing.                                    |
| `notebook_id`      | no       | active   | Library notebook id to query.                                                                 |
| `notebook_url`     | no       | —        | Direct NotebookLM URL (alternative to `notebook_id`).                                         |
| `slug_prefix`      | no       | `""`     | Prepended to each filename. Use to namespace per topic, e.g. `"sota"`, `"market-2026q2"`.     |
| `source_format`    | no       | `"json"` | Citation extraction mode. `"json"` is recommended for vault output (keeps titles + excerpts). |
| `sleep_between_ms` | no       | `0`      | Pause between questions to avoid hammering NotebookLM. 1500–3000ms is sane for batches > 20.  |
| `session_id`       | no       | new      | Reuse an existing session for context continuity across the batch.                            |

### Response

```json
{
  "success": true,
  "data": {
    "vault_dir": "/path/to/your/vault/cnv",
    "total": 3,
    "succeeded": 3,
    "failed": 0,
    "session_id": "5f1d8731",
    "notebook": {
      "id": "notebook-1",
      "url": "https://notebooklm.google.com/notebook/74912e55-..."
    },
    "files": [
      {
        "question": "What is the OSBD process?",
        "md_path": "/path/to/your/vault/cnv/sota-001-what-is-the-osbd-process.md",
        "json_path": "/path/to/your/vault/cnv/sota-001-what-is-the-osbd-process.json",
        "success": true,
        "citations_count": 16
      }
    ]
  }
}
```

## What gets written

### `{slug}.md`

```markdown
---
title: 'What is the OSBD process?'
type: nblm-answer
asked_at: 2026-05-04T13:30:00.000Z
notebook_id: 'notebook-1'
notebook_url: 'https://notebooklm.google.com/notebook/74912e55-...'
session_id: '5f1d8731'
citations_count: 16
sources:
  - 'Pratiquer la Communication NonViolente_F.Keller.pdf'
  - 'CNV et OSBD : outils pour pratiquer la communication bienveillante'
  - "Rapport d'analyse systémique sur les cursus de formation en CNV"
---

# What is the OSBD process?

> Asked on 2026-05-04T13:30:00.000Z against [CNV - Communication NonViolente](https://notebooklm.google.com/notebook/...)

## Answer

OSBD is the four-step acronym at the core of Nonviolent Communication...

## Sources

### [1] CNV et OSBD : outils pour pratiquer la communication bienveillante

> Ce mode de communication est un choix conscient...

### [2] Pratiquer la Communication NonViolente_F.Keller.pdf

> Observation Je décris, de manière neutre, la situation...
```

The frontmatter is standard YAML — every markdown indexer (RTFM, Obsidian, Foam) reads it natively. The body has stable section headings (`## Answer`, `## Sources`) so a parser can lift the answer text and citation excerpts independently.

### `{slug}.json`

A structured sidecar conforming to [`nblm-answer-v1`](#nblm-answer-v1-json-schema). Use it when your indexer wants typed access to citations, source positions, or session metadata without re-parsing the markdown.

## Pointing RTFM at the vault

[RTFM](https://github.com/roomi-fields/rtfm) is an MCP-native retrieval layer with FTS5 + semantic search over markdown vaults, wikilink resolution, and progressive disclosure for AI agents. It speaks the same markdown convention `/batch-to-vault` writes, so wiring is essentially "point and index":

```bash
# 1. Generate the vault from NotebookLM
curl -X POST http://localhost:3000/batch-to-vault -d '{...}'

# 2. Index it with RTFM
rtfm index /path/to/your/vault/cnv

# 3. Search from your CLI agent (or any MCP client)
rtfm search "OSBD process" --top 5
rtfm expand sota-001-what-is-the-osbd-process
```

Inside an MCP client (Claude Code, Cursor, Codex), the same flow becomes a two-tool pattern: `rtfm_search` to surface the relevant cached answer, `rtfm_expand` to read the full markdown with citations preserved. No NotebookLM call needed for repeat queries.

When new sources land in the notebook, re-run `/batch-to-vault` to refresh the cache.

## Recommended layout for academic / SOTA workflows

```
~/research-vault/
├── cnv/                          # one notebook → one folder
│   ├── sota-001-...md
│   ├── sota-001-...json
│   ├── sota-002-...md
│   └── sota-002-...json
├── ifs-therapy/
│   ├── sota-001-...md
│   └── ...
└── attachment-theory/
    └── ...
```

Each folder maps to one NotebookLM notebook. `slug_prefix` per topic keeps filenames sortable and unique. RTFM indexes the whole tree and resolves cross-folder wikilinks if you add them.

## Question generation

The matching pattern on the input side: ask Claude (or any LLM) to generate an exhaustive question set for a topic before you batch them.

```
You are preparing a SOTA (state of the art) document on {topic} from a NotebookLM
notebook containing {N sources}. Generate {K} questions that, taken together,
extract everything a domain expert would want to know:

- Foundational definitions and key concepts
- Historical context and lineage
- Core mechanisms / processes
- Distinctions vs adjacent fields
- Empirical evidence and limitations
- Practical applications
- Open debates and research gaps

Output as a JSON array of strings, no commentary.
```

Save the output as `questions.json`, then:

```bash
curl -X POST http://localhost:3000/batch-to-vault \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --slurpfile q questions.json --arg dir ~/research-vault/cnv \
        '{questions: $q[0], notebook_id: "notebook-1", vault_dir: $dir, slug_prefix: "sota", sleep_between_ms: 2000}')"
```

For batches above ~50 questions, multi-account rotation kicks in automatically when a quota is hit. See [Multi-account rotation](/notebooklm-multi-account).

## `nblm-answer-v1` JSON schema

Sidecar `{slug}.json` files conform to this schema. Stable across releases under SemVer; breaking changes will bump the major version.

> **Canonical URL** (resolvable, served as `application/schema+json` with CORS): [schemas.roomi-fields.com/nblm-answer-v1.json](https://schemas.roomi-fields.com/nblm-answer-v1.json) — fetch from any JSON Schema validator. The version below mirrors the canonical document.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.roomi-fields.com/nblm-answer-v1.json",
  "title": "NotebookLM Answer (nblm-answer-v1)",
  "description": "Structured sidecar payload produced by notebooklm-mcp /batch-to-vault. Encodes a single NotebookLM answer with citations, source positions, and session metadata for typed ingestion by retrieval systems (e.g. RTFM).",
  "type": "object",
  "required": ["type", "version", "asked_at", "question", "answer", "citations", "metadata"],
  "properties": {
    "$schema": { "type": "string", "format": "uri" },
    "type": { "const": "nblm-answer" },
    "version": { "const": "1.0" },
    "asked_at": { "type": "string", "format": "date-time" },
    "session_id": { "type": ["string", "null"] },
    "notebook": {
      "type": "object",
      "properties": {
        "id": { "type": ["string", "null"] },
        "name": { "type": ["string", "null"] },
        "url": { "type": ["string", "null"] }
      }
    },
    "question": { "type": "string" },
    "answer": {
      "type": "object",
      "required": ["text", "format"],
      "properties": {
        "text": { "type": "string" },
        "format": { "const": "markdown" }
      }
    },
    "citations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["marker", "number"],
        "properties": {
          "marker": { "type": "string", "description": "Display marker, e.g. \"[1]\"" },
          "number": { "type": "integer", "minimum": 1 },
          "source_name": { "type": ["string", "null"] },
          "source_text": {
            "type": ["string", "null"],
            "description": "Highlighted excerpt from the cited source"
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "tags": { "type": "array", "items": { "type": "string" } },
        "extraction_success": { "type": ["boolean", "null"] },
        "citations_count": { "type": "integer", "minimum": 0 },
        "source_names": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

## See also

- [Run 1 000 questions overnight](/batch-1000-questions) — the larger batch pattern with auto-reauth and rotation
- [Multi-account rotation](/notebooklm-multi-account) — how quotas and TOTP auto-reauth work
- [REST API reference](/notebooklm-rest-api) — full endpoint surface (33 endpoints + `/batch-to-vault`)
- [RTFM on GitHub](https://github.com/roomi-fields/rtfm) — the retrieval layer
