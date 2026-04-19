---
title: Auto-discover NotebookLM notebook metadata from a URL
description: Use the auto_discover_notebook tool or /notebooks/auto-discover endpoint to extract notebook name, description, topics, and use cases from just a NotebookLM URL.
keywords:
  [
    notebooklm auto discovery,
    notebooklm metadata extraction,
    auto_discover_notebook,
    claude desktop auto discovery,
  ]
---

# Auto-Discovery Pattern

## Overview

Auto-Discovery enables autonomous resource discovery for AI orchestrators. Instead of manually cataloging notebooks, the system queries NotebookLM to generate its own metadata.

## Architecture

### Three-Level Progressive Disclosure

**Level 0 - Metadata Registry (Lightweight)**

```
library.json: 5KB for 50 notebooks
├── Loaded at startup
├── Cached in memory
└── Zero NotebookLM queries
```

**Level 1 - Contextual Matching (Local)**

```
User query → Tag/description matching → Relevant notebooks
Example: "gmail automation" → Match tags: ["gmail", "n8n", "automation"]
Cost: 0 NotebookLM queries (local only)
```

**Level 2 - Deep Query (Rate-Limited)**

```
Selected notebook → Query NotebookLM → Precise answer
Cost: 1 NotebookLM query (rate-limited by Google)
```

## For Orchestrators

### Claude Code

```typescript
// Autonomous workflow
User: "Build n8n Gmail workflow"

// Claude internally:
1. Scan library metadata (instant)
2. Match: "n8n-workflows-api" (tags: ["n8n", "gmail"])
3. Query NotebookLM: "Gmail node configuration?"
4. Implement with accurate info
```

### n8n

```yaml
# Workflow node
HTTP Request: GET /notebooks/match?task=gmail automation
→ Returns: relevant notebook

HTTP Request: POST /notebooks/{id}/ask
→ Query: "Available Gmail triggers?"
→ Response: precise documentation
```

### Cursor / IDEs

```typescript
// Context-aware matching
Developer: "How to use n8n API?"
→ MCP: find_relevant_notebook({ task: "n8n API" })
→ Match: "n8n-workflows-api"
→ Query notebook for details
```

## Metadata Generation

### Prompt to NotebookLM

The system sends this prompt to each notebook:

```
Analyze your complete content and respond ONLY in JSON format:
{
  "name": "kebab-case-name",
  "description": "Two sentences max.",
  "tags": ["8-10", "keywords", "covering", "concepts", "actions", "contexts"]
}
```

### Validation Rules

- **name**: 3 words max, kebab-case, no spaces
- **description**: 2 sentences, under 150 chars
- **tags**: 8-10 keywords (concepts + actions + contexts)

### Example Generated Metadata

```json
{
  "name": "n8n-workflows-api",
  "description": "Complete n8n API documentation covering workflow creation and node configuration. Includes authentication, webhooks, and error handling.",
  "tags": [
    "n8n",
    "api",
    "workflows",
    "automation",
    "webhooks",
    "nodes",
    "integration",
    "documentation"
  ]
}
```

## Benefits

### For Users

- **Zero friction**: 30 seconds to add notebook (vs 5 minutes manual)
- **No metadata expertise**: System generates relevant tags automatically
- **Scalable**: Works with 1 or 100 notebooks

### For Orchestrators

- **Autonomous discovery**: Find relevant docs without human guidance
- **Token efficient**: Metadata scan costs ~500 tokens (vs 50k+ full read)
- **Rate limit preservation**: 1 query per notebook add (vs N queries per research)

### For Product

- **Enhanced experience**: Auto-discovery enables frictionless notebook management
- **Scalable architecture**: Handles growing documentation libraries efficiently
- **Progressive disclosure**: Optimizes API usage and response times

## Comparison with Claude Skills

| Aspect            | Claude Skills            | NotebookLM Auto-Discovery |
| ----------------- | ------------------------ | ------------------------- |
| Metadata source   | SKILL.md file            | NotebookLM query          |
| Access cost       | Free (local files)       | Rate-limited (Google API) |
| Content depth     | Full docs bundled        | Query on-demand           |
| Discovery pattern | Read files progressively | Match → Query if needed   |
| Update mechanism  | Edit files               | Re-query notebook         |

**Key difference**: Skills are free/local, Notebooks are rate-limited/remote
→ **Auto-Discovery optimizes for minimal queries via smart metadata matching**

## Error Handling

### Common Issues

**Invalid metadata format**:

```json
{
  "error": "Invalid name format",
  "details": "Must be kebab-case, 3 words max"
}
```

→ System retries with same prompt (max 2 retries)

**NotebookLM timeout**:

```json
{
  "error": "NotebookLM query timeout",
  "hint": "Try again in a few seconds"
}
```

→ Rate limit hit, wait and retry

**Notebook not accessible**:

```json
{
  "error": "Notebook not found",
  "hint": "Check notebook URL and sharing settings"
}
```

→ Verify notebook is shared with "Anyone with link"

## Testing

### Test With Your Own Notebook

```bash
# Test with a specific notebook URL you can access
.\deployment\scripts\test-auto-discovery.ps1 -NotebookUrl "https://notebooklm.google.com/notebook/<your-notebook-id>"

# Or provide multiple notebook URLs through the environment
$env:AUTO_DISCOVERY_NOTEBOOKS = "https://notebooklm.google.com/notebook/<id-1>,https://notebooklm.google.com/notebook/<id-2>"
.\deployment\scripts\test-auto-discovery.ps1 -TestAll
```

### Expected Results

Each auto-discovery test should:

- ✅ Return 200 OK
- ✅ Generate valid kebab-case name (1-3 words)
- ✅ Generate description ≤150 chars
- ✅ Generate 8-10 relevant topics
- ✅ Set `auto_generated: true`
- ✅ Add notebook to library automatically

## Future Enhancements

### Phase 2: Smart Refresh

```typescript
PATCH /notebooks/:id/refresh
→ Re-query NotebookLM to update metadata if content changed
```

### Phase 3: Semantic Matching

```typescript
GET /notebooks/match?query=gmail&semantic=true
→ Use embeddings for advanced matching beyond tags
```

### Phase 4: Usage Analytics

```typescript
GET /notebooks/:id/related
→ "Notebooks often queried together"
```
