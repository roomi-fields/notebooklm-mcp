# NotebookLM REST API reference — 56 HTTP endpoints

> **Coverage.** All 56 endpoints the server exposes are documented below, and
> the [OpenAPI 3.1 spec](pathname:///openapi.yaml) carries the same 56 —
> both checked against the routes declared in the code.

> Complete reference for the NotebookLM HTTP REST API. Citation-backed Q&A,
> Studio content generation, notebook library, multi-account, sessions.
>
> **OpenAPI 3.1 spec:** [openapi.yaml](pathname:///openapi.yaml) (importable in
> Postman, Insomnia, Bruno, Swagger UI). Source in the repo at
> [`deployment/docs/openapi.yaml`](https://github.com/roomi-fields/notebooklm-mcp/blob/main/deployment/docs/openapi.yaml).
>
> **Companion guides:** [REST batch pattern (1 000 questions overnight)](/batch-1000-questions) ·
> [n8n integration](/notebooklm-n8n) · [Multi-account rotation](/notebooklm-multi-account) ·
> [Compare with PleasePrompto/notebooklm-mcp v2.0.0](/compare)

---

## 🌐 Base URL

```
http://localhost:3000
```

Or for network access: `http://<SERVER-IP>:3000`

---

## Available Endpoints (56 total)

### Authentication

| Method | Endpoint        | Description                       |
| ------ | --------------- | --------------------------------- |
| `POST` | `/setup-auth`   | First-time authentication         |
| `POST` | `/de-auth`      | Logout (clear credentials)        |
| `POST` | `/re-auth`      | Re-authenticate / switch account  |
| `POST` | `/cleanup-data` | Clean all data (requires confirm) |

### Queries

| Method | Endpoint          | Description                                        |
| ------ | ----------------- | -------------------------------------------------- |
| `GET`  | `/`               | Server identity, version, docs link                |
| `GET`  | `/health`         | Server health check                                |
| `GET`  | `/utcp`           | UTCP tool manual (for UTCP clients)                |
| `POST` | `/ask`            | Ask a question to NotebookLM                       |
| `POST` | `/batch-to-vault` | Run many questions, write each answer to the vault |

### Notebooks

| Method   | Endpoint                        | Description                          |
| -------- | ------------------------------- | ------------------------------------ |
| `GET`    | `/notebooks`                    | List all notebooks                   |
| `POST`   | `/notebooks`                    | Add a notebook manually              |
| `POST`   | `/notebooks/create`             | Create a new notebook in NotebookLM  |
| `POST`   | `/notebooks/auto-discover`      | Auto-generate notebook metadata      |
| `GET`    | `/notebooks/scrape`             | Scrape notebooks from NotebookLM     |
| `POST`   | `/notebooks/import-from-scrape` | Bulk import scraped notebooks        |
| `GET`    | `/notebooks/search`             | Search notebooks by query            |
| `GET`    | `/notebooks/stats`              | Get library statistics               |
| `GET`    | `/notebooks/:id`                | Get notebook details                 |
| `PUT`    | `/notebooks/:id`                | Update notebook metadata             |
| `DELETE` | `/notebooks/:id`                | Delete a notebook                    |
| `DELETE` | `/notebooks/bulk-delete`        | Delete several notebooks in one call |
| `PUT`    | `/notebooks/:id/activate`       | Activate a notebook (set as default) |
| `GET`    | `/notebooks/:id/share`          | Read sharing status                  |
| `PUT`    | `/notebooks/:id/share`          | Toggle the public link               |
| `GET`    | `/notebooks/:id/labels`         | List source labels                   |
| `POST`   | `/notebooks/:id/labels`         | Create or delete source labels       |

### Sessions

| Method   | Endpoint              | Description           |
| -------- | --------------------- | --------------------- |
| `GET`    | `/sessions`           | List active sessions  |
| `POST`   | `/sessions/:id/reset` | Reset session history |
| `DELETE` | `/sessions/:id`       | Close a session       |

### Content Management

| Method   | Endpoint                              | Description                                   |
| -------- | ------------------------------------- | --------------------------------------------- |
| `POST`   | `/content/sources`                    | Add source/document to notebook               |
| `DELETE` | `/content/sources/:id`                | Delete source by ID                           |
| `DELETE` | `/content/sources`                    | Delete source by name (query param)           |
| `POST`   | `/content/generate`                   | Generate content (audio, video, report, etc.) |
| `GET`    | `/content/download`                   | Download/export content                       |
| `POST`   | `/content/notes`                      | Create a note in the notebook                 |
| `POST`   | `/content/chat-to-note`               | Save chat discussion to a note                |
| `POST`   | `/content/notes/:noteTitle/to-source` | Convert note to source                        |
| `GET`    | `/content`                            | List sources and generated content            |
| `DELETE` | `/content/:contentId`                 | Delete a generated Studio artifact            |
| `GET`    | `/notebooks/:id/sources`              | List a notebook's sources with their IDs      |
| `GET`    | `/notebooks/:id/sources/:sourceId`    | Read a source's full indexed text             |
| `POST`   | `/content/notes/list`                 | List the notebook's notes                     |
| `POST`   | `/content/notes/get`                  | Read one note, by title or ID                 |
| `POST`   | `/content/study-aid`                  | Generate flashcards or a quiz                 |
| `POST`   | `/content/mind-map`                   | Generate and save a mind map                  |
| `POST`   | `/content/research`                   | Discover web sources (Fast Research)          |

> **Note:** v1.5.0 consolidated content generation into `/content/generate` with all NotebookLM Studio features (audio_overview, video, infographic, report, presentation, data_table).

---

## 0. API Root

### `GET /`

Returns the server's identity, its version and a short, hand-maintained list of entry points.

Unlike `/health`, this route is not exempt from the token guard: when `NOTEBOOKLM_API_KEY` is set,
an unauthenticated call is rejected rather than answered with a reduced payload.

**Request:**

```bash
curl http://localhost:3000/
```

**Success Response (200):**

```json
{
  "name": "NotebookLM MCP HTTP Server",
  "version": "4.0.0",
  "endpoints": {
    "health": "GET /health",
    "ask": "POST /ask",
    "batch_to_vault": "POST /batch-to-vault",
    "setup_auth": "POST /setup-auth",
    "notebooks": "GET /notebooks",
    "sources": "GET /notebooks/:id/sources",
    "read_source": "GET /notebooks/:id/sources/:sourceId",
    "sessions": "GET /sessions"
  },
  "docs": "https://notebooklm.roomi-fields.com/"
}
```

Note the response shape: this is the only route that does not wrap its payload in
`{ "success": ..., "data": ... }`. The `endpoints` map is a fixed excerpt of eight routes, not a
discovery mechanism — the full list is the table at the top of this page and
[openapi.yaml](pathname:///openapi.yaml). The `version` field is read from `package.json` at
startup, so it is correct however the server was launched.

---

## 1. Health Check

### `GET /health`

Check server and authentication status.

**Request:**

```bash
curl http://localhost:3000/health
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "sessions": 2,
    "library_notebooks": 3,
    "context_age_hours": 0.25
  }
}
```

**Error Response (500):**

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Fields:**

- `authenticated` - Valid Google session
- `sessions` - Number of active sessions
- `library_notebooks` - Number of configured notebooks
- `context_age_hours` - Browser context age (hours)

### `GET /utcp`

The tool manual a [UTCP](https://www.utcp.io/) client reads before it calls
anything.

UTCP works the other way round from MCP: there is no protocol server. A client
reads this manual once, then calls the REST routes below natively, with no
intermediary. So the manual describes this same API — it is not a second way
into it, and nothing here is reachable only through it.

It is generated from `openapi.yaml` and kept in step by a release guard. The
call addresses it hands out are rebased on the address the request arrived at,
so one document serves a loopback install and a reverse-proxied one alike.
Each tool asks for the key as the `X-API-Key` header, which this server
accepts alongside the bearer form.

A client can also be pointed straight at the published specification — UTCP's
HTTP transport converts an OpenAPI document, in JSON or YAML, when what it
fetched is not a manual. Two caveats make the manual the better target: the
converter keeps only operations that carry an `operationId`, and it maps
`apiKey`, `basic` and `oauth2` security schemes but not the `http`/`bearer`
one the specification declares, so a converted manual calls everything
unauthenticated.

**Request:**

```bash
curl -H "X-API-Key: $NOTEBOOKLM_API_KEY" http://localhost:3000/utcp
```

**Success Response (200):**

```json
{
  "utcp_version": "1.0.0",
  "manual_version": "4.5.0",
  "tools": [
    {
      "name": "search_passages",
      "description": "Ranked passages from the notebook's index, without generating an answer",
      "tags": ["Notebooks"],
      "inputs": { "type": "object", "properties": { "id": { "type": "string" } } },
      "outputs": { "type": "object" },
      "tool_call_template": {
        "name": "search_passages",
        "call_template_type": "http",
        "http_method": "POST",
        "url": "http://localhost:3000/notebooks/{id}/search",
        "content_type": "application/json",
        "auth": {
          "auth_type": "api_key",
          "api_key": "${NOTEBOOKLM_API_KEY}",
          "var_name": "X-API-Key",
          "location": "header"
        },
        "body_field": "body"
      }
    }
  ]
}
```

`api_key` is published as the literal `${NOTEBOOKLM_API_KEY}`, which is how a
UTCP client asks for a value from its own environment. The key itself is never
in the document.

---

## 2. Ask Question

### `POST /ask`

Ask a question to NotebookLM and get a response.

**Request:**

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the main tips for parents?",
    "notebook_id": "parents-numerique"
  }'
```

**Body Parameters:**

| Parameter       | Type    | Required | Description                            |
| --------------- | ------- | -------- | -------------------------------------- |
| `question`      | string  | ✅ Yes   | The question to ask                    |
| `notebook_id`   | string  | ❌ No    | Notebook ID (or URL)                   |
| `notebook_url`  | string  | ❌ No    | Direct notebook URL                    |
| `session_id`    | string  | ❌ No    | Reuse an existing session              |
| `show_browser`  | boolean | ❌ No    | Show Chrome (debug)                    |
| `source_format` | string  | ❌ No    | Citation extraction format (see below) |

**Source Format Options:**

| Format      | Description                           | Example Output                              |
| ----------- | ------------------------------------- | ------------------------------------------- |
| `none`      | No extraction (default, fastest)      | `"text[1]..."`                              |
| `inline`    | Insert source text inline             | `"text[1: "source excerpt..."]..."`         |
| `footnotes` | Append sources at the end             | Answer + `---\n**Sources:**\n[1] text...`   |
| `json`      | Return sources as separate object     | `{ answer: "...", sources: { citations } }` |
| `expanded`  | Replace markers with full quoted text | `"text "full source quote..."..."`          |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "success",
    "question": "What advice for parents in the digital age?",
    "answer": "Empathy is a fundamental concept...",
    "session_id": "9a580eee",
    "notebook_url": "https://notebooklm.google.com/notebook/xxx",
    "session_info": {
      "age_seconds": 44,
      "message_count": 1,
      "last_activity": 1763737756057
    }
  }
}
```

**Success Response with Sources (200):**

When using `source_format` other than `none`:

```json
{
  "success": true,
  "data": {
    "status": "success",
    "question": "What is the main topic?",
    "answer": "The Self is the core essence[1: \"The Self is the seat of consciousness...\"]...",
    "session_id": "abc123",
    "notebook_url": "https://notebooklm.google.com/notebook/xxx",
    "session_info": { ... },
    "sources": {
      "format": "inline",
      "citations": [
        {
          "marker": "[1]",
          "number": 1,
          "sourceText": "The Self is the seat of consciousness that possesses the 8 C's..."
        }
      ],
      "extraction_success": true
    }
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Missing required field: question"
}
```

**Error Response (500):**

```json
{
  "success": false,
  "error": "Timeout waiting for response from NotebookLM"
}
```

**Response Time:** 30-60 seconds

**PowerShell Examples:**

```powershell
# Simple question
$body = @{
    question = "What are the main tips for parents?"
    notebook_id = "parents-numerique"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method Post -Body $body -ContentType "application/json"

# With existing session
$body = @{
    question = "Follow-up question"
    session_id = "9a580eee"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method Post -Body $body -ContentType "application/json"
```

---

## 2b. Batch Questions to Vault

### `POST /batch-to-vault`

Run a list of questions against one notebook and write each answer to disk as a markdown file plus
a JSON sidecar, ready for indexing by RTFM or any other markdown vault tool. Questions run
sequentially and reuse the same session, so each answer has the context of the previous ones.

**Request:**

```bash
curl -X POST http://localhost:3000/batch-to-vault \
  -H "Content-Type: application/json" \
  -d '{
    "questions": [
      "What is the central claim of the book?",
      "Which objections does the author anticipate?"
    ],
    "vault_dir": "/home/user/vault/nblm",
    "notebook_id": "ifs-therapy",
    "slug_prefix": "ifs",
    "sleep_between_ms": 2000
  }'
```

**Body Parameters:**

| Parameter          | Type     | Required | Description                                                         |
| ------------------ | -------- | -------- | ------------------------------------------------------------------- |
| `questions`        | string[] | ✅ Yes   | Non-empty list of questions, asked in order                         |
| `vault_dir`        | string   | ✅ Yes   | Output directory, created if missing                                |
| `notebook_id`      | string   | ❌ No    | Library notebook to query                                           |
| `notebook_url`     | string   | ❌ No    | Notebook URL, used instead of `notebook_id`                         |
| `slug_prefix`      | string   | ❌ No    | Prefix for every filename (default: none)                           |
| `source_format`    | string   | ❌ No    | `none`, `inline`, `footnotes`, `json`, `expanded` (default: `json`) |
| `sleep_between_ms` | number   | ❌ No    | Pause between questions, in milliseconds (default: `0`)             |
| `session_id`       | string   | ❌ No    | Reuse an existing session instead of opening a new one              |

Neither `notebook_id` nor `notebook_url` is required: without them the active notebook is used.

**File naming.** Each answer is written as `{slug}.md` and `{slug}.json`, where the slug is a
three-digit index followed by a slugified question, optionally prefixed — `ifs-001-what-is-the-...`.
Path separators and `..` sequences are stripped from `slug_prefix`, and it is truncated to 64
characters, so it can only ever contribute a filename component.

**Containment.** When `NOTEBOOKLM_VAULT_ROOT` is set, `vault_dir` must resolve inside it, and the
call fails otherwise. When the variable is unset, any writable path is accepted.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "vault_dir": "/home/user/vault/nblm",
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "session_id": "9a580eee",
    "notebook": {
      "id": "ifs-therapy",
      "url": "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000101"
    },
    "files": [
      {
        "question": "What is the central claim of the book?",
        "md_path": "/home/user/vault/nblm/ifs-001-what-is-the-central-claim-of-the-book.md",
        "json_path": "/home/user/vault/nblm/ifs-001-what-is-the-central-claim-of-the-book.json",
        "success": true,
        "citations_count": 7
      }
    ]
  }
}
```

A question that fails does not abort the batch: it is recorded in `files` with `success: false`, an
`error` message and empty paths, and the run continues. The `notebook.name` field is only present
when the answer carried one.

**Error Response (400):**

```json
{
  "success": false,
  "error": "Missing required field: vault_dir (absolute or relative directory path)"
}
```

A missing or empty `questions` array returns 400 in the same shape. A run that throws — an
unwritable directory, for instance — returns the error with status 400 as well, since the handler
maps any unsuccessful result to 400.

**Response Time:** 30–60 seconds per question, plus `sleep_between_ms` between them.

---

## 3. Setup Auth

### `POST /setup-auth`

Configure Google authentication (opens Chrome).

**Request:**

```bash
curl -X POST http://localhost:3000/setup-auth \
  -H "Content-Type: application/json" \
  -d '{
    "show_browser": true
  }'
```

**Body Parameters:**

| Parameter      | Type    | Required | Description                 |
| -------------- | ------- | -------- | --------------------------- |
| `show_browser` | boolean | ❌ No    | Show Chrome (default: true) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "success",
    "message": "Authentication setup completed successfully"
  }
}
```

---

## 4. List Notebooks

### `GET /notebooks`

List all notebooks configured in the library.

**Request:**

```bash
curl http://localhost:3000/notebooks
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebooks": [
      {
        "id": "parents-numerique",
        "name": "Parents and Digital",
        "description": "Advice for parents in the digital age",
        "url": "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000101",
        "topics": ["parenting", "digital", "education"],
        "use_cases": [
          "Educational advice in the digital age",
          "Questions about parenting and screens"
        ],
        "active": true
      }
    ],
    "count": 1
  }
}
```

---

## 5. Add Notebook

### `POST /notebooks`

Add a new notebook to the library.

**⚠️ Automatic validations:**

- ✅ Checks NotebookLM URL format
- ✅ Validates that the notebook actually exists (live check)
- ✅ Blocks duplicate names
- ✅ Creates a temporary session to test access

**Request:**

```bash
curl -X POST http://localhost:3000/notebooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000101",
    "name": "Parents and Digital",
    "description": "Advice for parents in the digital age",
    "topics": ["parenting", "digital", "education"]
  }'
```

**Body Parameters:**

| Parameter       | Type     | Required | Description                                              |
| --------------- | -------- | -------- | -------------------------------------------------------- |
| `url`           | string   | ✅ Yes   | NotebookLM notebook URL                                  |
| `name`          | string   | ✅ Yes   | Notebook name (unique)                                   |
| `description`   | string   | ✅ Yes   | Description                                              |
| `topics`        | string[] | ✅ Yes   | List of topics                                           |
| `content_types` | string[] | ❌ No    | Content types (default: `["documentation", "examples"]`) |
| `use_cases`     | string[] | ❌ No    | Use cases (auto-generated if absent)                     |
| `tags`          | string[] | ❌ No    | Tags                                                     |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebook": {
      "id": "parents-numerique",
      "name": "Parents and Digital",
      "description": "Advice for parents in the digital age",
      "url": "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000101",
      "topics": ["parenting", "digital", "education"],
      "content_types": ["documentation", "examples"],
      "use_cases": ["Educational advice", "Digital parenting"],
      "added_at": "2025-11-22T08:49:16.735Z",
      "last_used": "2025-11-22T08:49:16.735Z",
      "use_count": 0,
      "tags": [],
      "active": false
    }
  }
}
```

**Possible Errors:**

**400 - Name already in use:**

```json
{
  "success": false,
  "error": "A notebook with the name 'Parents and Digital' already exists.\n\nExisting notebook ID: parents-numerique\nURL: https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000101\n\nPlease use a different name, or update the existing notebook instead.\nTo update: PUT /notebooks/parents-numerique with new data\nTo delete: DELETE /notebooks/parents-numerique"
}
```

**400 - Invalid URL:**

```json
{
  "success": false,
  "error": "Invalid NotebookLM URL: https://example.com\n\nExpected format: https://notebooklm.google.com/notebook/[notebook-id]\n\nExample: https://notebooklm.google.com/notebook/abc-123-def-456\n\nTo get the URL:\n1. Go to https://notebooklm.google.com\n2. Open your notebook\n3. Copy the URL from the address bar"
}
```

**400 - Notebook inaccessible:**

```json
{
  "success": false,
  "error": "Invalid or inaccessible notebook.\n\nURL: https://notebooklm.google.com/notebook/invalid-id\n\nThe notebook page loaded but the chat interface was not found.\nThis usually means:\n- The notebook doesn't exist\n- You don't have access to this notebook\n- The notebook ID in the URL is incorrect\n\nPlease verify the URL by:\n1. Go to https://notebooklm.google.com\n2. Open the notebook manually\n3. Copy the exact URL from the address bar"
}
```

**⏱️ Response Time:** 15-30 seconds (live validation)

---

## 6. Auto-Discover Notebook

### `POST /notebooks/auto-discover`

Automatically generate notebook metadata by querying NotebookLM itself.

**Request:**

```json
{
  "url": "https://notebooklm.google.com/notebook/abc123"
}
```

**Response (Success):**

```json
{
  "success": true,
  "notebook": {
    "id": "generated-uuid",
    "url": "https://notebooklm.google.com/notebook/abc123",
    "name": "auto-generated-notebook",
    "description": "Comprehensive guide covering key concepts. Includes practical exercises and examples.",
    "tags": ["topic1", "topic2", "learning", "examples", "exercises"],
    "auto_generated": true,
    "created_at": "2025-01-23T10:00:00Z"
  },
  "message": "Notebook auto-discovered and added to library"
}
```

**Response (Error):**

```json
{
  "error": "NotebookLM returned invalid metadata format",
  "details": "Invalid name format: \"Invalid Name\". Must be kebab-case, 3 words max."
}
```

**Errors:**

- `400 Bad Request`: Invalid URL format
- `404 Not Found`: Notebook not accessible
- `500 Internal Server Error`: NotebookLM query failed or returned invalid format
- `504 Gateway Timeout`: NotebookLM query timeout (>30s)

**How it works:**

1. System opens the specified notebook
2. Sends prompt to NotebookLM asking it to analyze its own content
3. NotebookLM responds with JSON containing name, description, and tags
4. System validates the metadata format
5. Saves notebook to library with auto-generated metadata

**Progressive Disclosure Pattern:**

This endpoint enables the **Level 0** of progressive disclosure:

- Metadata stored locally (lightweight, ~100 bytes per notebook)
- Loaded at startup for instant matching
- Deep queries to NotebookLM only when notebook is selected

Orchestrators (Claude Code, n8n, Cursor) can scan all notebook metadata without rate limit concerns, then query NotebookLM only for the most relevant notebook.

---

## 6b. Create Notebook

### `POST /notebooks/create`

Create a new empty notebook directly in NotebookLM.

**Request:**

```bash
curl -X POST http://localhost:3000/notebooks/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Notebook"
  }'
```

**Body Parameters:**

| Parameter      | Type    | Required | Description                                    |
| -------------- | ------- | -------- | ---------------------------------------------- |
| `name`         | string  | ❌ No    | Notebook name (auto-generated if not provided) |
| `show_browser` | boolean | ❌ No    | Show browser during creation                   |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebook_url": "https://notebooklm.google.com/notebook/abc123-def456",
    "name": "My New Notebook"
  }
}
```

**Note:** This creates the notebook in NotebookLM but does NOT add it to the local library. Use `POST /notebooks` or `POST /notebooks/auto-discover` to add it to the library after creation.

---

## 7. Get Notebook

### `GET /notebooks/:id`

Get details of a specific notebook.

**Request:**

```bash
curl http://localhost:3000/notebooks/parents-numerique
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebook": {
      "id": "parents-numerique",
      "name": "Parents and Digital",
      "description": "Advice for parents in the digital age",
      "url": "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000101",
      "topics": ["parenting", "digital", "education"],
      "active": true
    }
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "Notebook not found: parents-numerique"
}
```

---

## 8. Delete Notebook

### `DELETE /notebooks/:id`

Delete a notebook from the library.

**Request:**

```bash
curl -X DELETE http://localhost:3000/notebooks/parents-numerique
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Notebook removed successfully",
    "id": "parents-numerique"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "Notebook not found: parents-numerique"
}
```

**Behavior:**

- If the deleted notebook was active, the first remaining notebook automatically becomes active
- If it was the last notebook, `active_notebook_id` becomes `null`
- Sessions using this notebook remain open but are no longer linked to a library notebook

---

## 8b. Bulk Delete Notebooks

### `DELETE /notebooks/bulk-delete`

Delete several notebooks from NotebookLM itself, by UUID. This removes the notebooks from your
Google account; it is not the same as `DELETE /notebooks/:id`, which only drops an entry from the
local library.

Each deletion is verified against a fresh listing afterwards, so a notebook that is still present
is reported in `failed` rather than falsely claimed as deleted.

**Request:**

```bash
curl -X DELETE http://localhost:3000/notebooks/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{
    "notebook_ids": [
      "74912e55-34a4-4027-bdcc-8e89badd0efd",
      "c3ae2b1b-b362-46ae-9dc8-7b658a05955e"
    ]
  }'
```

**Body Parameters:**

| Parameter      | Type     | Required | Description                                                   |
| -------------- | -------- | -------- | ------------------------------------------------------------- |
| `notebook_ids` | string[] | ✅ Yes   | Non-empty list of NotebookLM notebook UUIDs                   |
| `show_browser` | boolean  | ❌ No    | Show Chrome during the fallback browser flow (default: false) |

`show_browser` only has an effect if the RPC path fails and the browser fallback runs; the RPC path
never opens a window.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "deleted": ["74912e55-34a4-4027-bdcc-8e89badd0efd"],
    "failed": ["c3ae2b1b-b362-46ae-9dc8-7b658a05955e"],
    "message": "Deleted 1 notebooks, 1 failed"
  }
}
```

The envelope stays `success: true` even when some or all of the IDs are in `failed` — read the two
arrays, not the flag.

**Error Response (400):**

```json
{
  "success": false,
  "error": "notebook_ids array is required"
}
```

---

## 9. Activate Notebook

### `PUT /notebooks/:id/activate`

Set a notebook as active (default notebook for requests without `notebook_id`).

**Request:**

```bash
curl -X PUT http://localhost:3000/notebooks/shakespeare/activate
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Notebook activated successfully",
    "notebook": {
      "id": "shakespeare",
      "name": "Shakespeare",
      "description": "William Shakespeare - Complete Works",
      "url": "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000102",
      "topics": ["literature", "theater", "Shakespeare"],
      "active": true,
      "last_used": "2025-11-22T10:30:45.123Z"
    }
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "Notebook not found: shakespeare"
}
```

**Behavior:**

- Updates `last_used` to current date/time
- Sets `active_notebook_id` in library.json
- Does not create a session (metadata only)

---

## 9b. Notebook Sharing

### `GET /notebooks/:id/share`

Read a notebook's sharing status: whether the public link is on, the link itself, and the list of
collaborators.

**Path Parameters:**

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `id`      | string | ✅ Yes   | NotebookLM notebook UUID |

**Request:**

```bash
curl http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/share
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "isPublic": true,
    "publicLink": "https://notebooklm.google.com/notebook/74912e55-34a4-4027-bdcc-8e89badd0efd",
    "collaborators": [{ "email": "colleague@example.com", "name": "A. Colleague" }]
  }
}
```

`publicLink` is absent when the notebook is restricted, and a collaborator's `name` is absent when
NotebookLM does not return one.

### `PUT /notebooks/:id/share`

Turn the public link on or off. The response is the resulting status, read back after the change,
in the same shape as the `GET`.

**Request:**

```bash
curl -X PUT http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/share \
  -H "Content-Type: application/json" \
  -d '{ "public": true }'
```

**Body Parameters:**

| Parameter | Type    | Required | Description                    |
| --------- | ------- | -------- | ------------------------------ |
| `public`  | boolean | ✅ Yes   | `true` enables the public link |

Strictly speaking the handler accepts a call without a body, but only the literal value `true`
enables the link: any other value, including a missing body, is read as `false` and turns sharing
off. Always send the field explicitly.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "isPublic": true,
    "publicLink": "https://notebooklm.google.com/notebook/74912e55-34a4-4027-bdcc-8e89badd0efd",
    "collaborators": []
  }
}
```

---

## 9c. Source Labels

Labels group a notebook's sources. Both routes return the notebook's full label list, so the `POST`
doubles as a read-after-write.

### `GET /notebooks/:id/labels`

List the labels defined on a notebook.

**Path Parameters:**

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `id`      | string | ✅ Yes   | NotebookLM notebook UUID |

**Request:**

```bash
curl http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/labels
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "labels": [
      {
        "id": "7f1c2d90-8b44-4a31-9a6e-5c0d2e8f1a33",
        "name": "Primary sources",
        "emoji": "📚",
        "sourceCount": 12
      },
      { "id": "a2b9e114-6d02-4c88-bf31-9e7a4c105d21", "name": "To review", "sourceCount": 0 }
    ]
  }
}
```

`emoji` is absent when the label has none.

### `POST /notebooks/:id/labels`

Create or delete labels.

**Request:**

```bash
curl -X POST http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/labels \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "name": "Primary sources",
    "emoji": "📚"
  }'
```

**Body Parameters:**

| Parameter   | Type     | Required | Description                                          |
| ----------- | -------- | -------- | ---------------------------------------------------- |
| `action`    | string   | ❌ No    | `list`, `create` or `delete` (default: `list`)       |
| `name`      | string   | ❌ No    | Label name. Required when `action` is `create`       |
| `emoji`     | string   | ❌ No    | Emoji shown beside the label (default: none)         |
| `label_ids` | string[] | ❌ No    | Labels to remove. Required when `action` is `delete` |

**Success Response (200):** same shape as the `GET` — the label list after the change.

**Error Response (200 with `success: false`):**

```json
{
  "success": false,
  "error": "name required to create a label"
}
```

A `delete` without `label_ids` returns `label_ids required to delete` in the same form. Note the
status code: these validation failures are carried in the body, not in the HTTP status, and the
route only returns 500 when the underlying call throws.

---

## 10. List Sessions

### `GET /sessions`

List all active browser sessions.

**Request:**

```bash
curl http://localhost:3000/sessions
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session-00000001",
        "notebook_url": "https://notebooklm.google.com/notebook/xxx",
        "message_count": 3,
        "age_seconds": 245,
        "inactive_seconds": 120,
        "last_activity": 1763737756057
      }
    ],
    "count": 1,
    "max_sessions": 10
  }
}
```

---

## 11. Close Session

### `DELETE /sessions/:id`

Close a specific browser session.

**Request:**

```bash
curl -X DELETE http://localhost:3000/sessions/9a580eee
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Session closed successfully",
    "session_id": "9a580eee"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "Session not found: 9a580eee"
}
```

---

## 12. De-authenticate (Logout)

### `POST /de-auth`

Logout by clearing all authentication data. Preserves notebook library.

**Request:**

```bash
curl -X POST http://localhost:3000/de-auth
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "de-authenticated",
    "message": "Successfully logged out. Use setup_auth or re_auth to authenticate again.",
    "authenticated": false
  }
}
```

**Use cases:**

- Security logout before shutting down
- Clearing credentials without re-authenticating
- Removing access temporarily

---

## 13. Re-authenticate

### `POST /re-auth`

Switch to a different Google account or re-authenticate after logout.

**Request:**

```bash
curl -X POST http://localhost:3000/re-auth \
  -H "Content-Type: application/json" \
  -d '{
    "show_browser": true
  }'
```

**Body Parameters:**

| Parameter      | Type    | Required | Description                         |
| -------------- | ------- | -------- | ----------------------------------- |
| `show_browser` | boolean | ❌ No    | Show browser window (default: true) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "authenticated",
    "message": "Successfully re-authenticated",
    "authenticated": true,
    "duration_seconds": 45.2
  }
}
```

**Use cases:**

- Switching Google accounts
- Recovery from usage limits (compute-based, refreshes every 5 hours)
- Fresh authentication after errors

---

## 14. Cleanup Data

### `POST /cleanup-data`

Deep cleanup of all NotebookLM MCP data files across 8 categories.

**⚠️ CRITICAL:** Close ALL Chrome/Chromium instances BEFORE running this!

**Request:**

```bash
# Preview first (confirm=false)
curl -X POST http://localhost:3000/cleanup-data \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": false,
    "preserve_library": true
  }'

# Execute cleanup (confirm=true)
curl -X POST http://localhost:3000/cleanup-data \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": true,
    "preserve_library": true
  }'
```

**Body Parameters:**

| Parameter          | Type    | Required | Description                                 |
| ------------------ | ------- | -------- | ------------------------------------------- |
| `confirm`          | boolean | ✅ Yes   | Must be true to execute (false for preview) |
| `preserve_library` | boolean | ❌ No    | Keep library.json file (default: false)     |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Cleanup completed successfully",
    "files_deleted": 47,
    "space_freed_mb": 156.8,
    "library_preserved": true
  }
}
```

---

## 15. Update Notebook

### `PUT /notebooks/:id`

Update notebook metadata (name, description, topics, etc.).

**Request:**

```bash
curl -X PUT http://localhost:3000/notebooks/n8n-workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "n8n Advanced Workflows",
    "description": "Advanced n8n workflow patterns and best practices",
    "topics": ["n8n", "automation", "workflows", "advanced"]
  }'
```

**Body Parameters:**

| Parameter     | Type     | Required | Description         |
| ------------- | -------- | -------- | ------------------- |
| `name`        | string   | ❌ No    | New notebook name   |
| `description` | string   | ❌ No    | New description     |
| `topics`      | string[] | ❌ No    | New topics array    |
| `use_cases`   | string[] | ❌ No    | New use cases array |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebook": {
      "id": "n8n-workflows",
      "name": "n8n Advanced Workflows",
      "description": "Advanced n8n workflow patterns and best practices",
      "topics": ["n8n", "automation", "workflows", "advanced"],
      "last_modified": "2025-01-24T12:00:00.000Z"
    }
  }
}
```

---

## 16. Search Notebooks

### `GET /notebooks/search?query=keyword`

Search notebooks by keyword in name, description, or topics.

**Request:**

```bash
curl "http://localhost:3000/notebooks/search?query=automation"
```

**Query Parameters:**

| Parameter | Type   | Required | Description    |
| --------- | ------ | -------- | -------------- |
| `query`   | string | ✅ Yes   | Search keyword |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebooks": [
      {
        "id": "n8n-workflows",
        "name": "n8n Advanced Workflows",
        "description": "Advanced n8n workflow patterns",
        "topics": ["n8n", "automation", "workflows"],
        "score": 0.95
      }
    ]
  }
}
```

---

## 17. Get Library Stats

### `GET /notebooks/stats`

Get statistics about the notebook library.

**Request:**

```bash
curl http://localhost:3000/notebooks/stats
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "total_notebooks": 5,
    "active_notebook_id": "n8n-workflows",
    "total_queries": 127,
    "most_used_notebook": {
      "id": "n8n-workflows",
      "name": "n8n Advanced Workflows",
      "use_count": 45
    },
    "recently_added": [
      {
        "id": "llm-dev",
        "name": "LLM Development",
        "added_at": "2025-01-24T10:00:00.000Z"
      }
    ]
  }
}
```

---

## 18. Reset Session

### `POST /sessions/:id/reset`

Reset a session's chat history while keeping the same session ID.

**Request:**

```bash
curl -X POST http://localhost:3000/sessions/9a580eee/reset
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "Session reset successfully",
    "session_id": "9a580eee",
    "previous_message_count": 12
  }
}
```

**Use cases:**

- Clean slate for new task without losing session context
- Starting fresh conversation in same notebook

---

## 🔒 HTTP Error Codes

| Code  | Meaning               | Description                                  |
| ----- | --------------------- | -------------------------------------------- |
| `200` | OK                    | Successful request                           |
| `400` | Bad Request           | Missing or invalid parameters                |
| `401` | Unauthorized          | Authentication required (if API key enabled) |
| `404` | Not Found             | Resource not found                           |
| `500` | Internal Server Error | Server error                                 |
| `503` | Service Unavailable   | Server overloaded (too many sessions)        |

---

## 15. Add Source to Notebook

### `POST /content/sources`

Add a document/source to a notebook. Supports multiple source types.

**Request:**

```bash
# Add URL source
curl -X POST http://localhost:3000/content/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "url",
    "url": "https://example.com/article",
    "notebook_url": "https://notebooklm.google.com/notebook/abc123"
  }'

# Add text content
curl -X POST http://localhost:3000/content/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "text",
    "text": "Your document content here...",
    "title": "My Document"
  }'

# Add YouTube video
curl -X POST http://localhost:3000/content/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "youtube",
    "url": "https://www.youtube.com/watch?v=VIDEO_ID"
  }'
```

**Body Parameters:**

| Parameter      | Type   | Required | Description                                            |
| -------------- | ------ | -------- | ------------------------------------------------------ |
| `source_type`  | string | ✅ Yes   | Type: `file`, `url`, `text`, `youtube`, `google_drive` |
| `file_path`    | string | ❌ No    | Local file path (for `file` type)                      |
| `url`          | string | ❌ No    | URL (for `url`, `youtube`, `google_drive` types)       |
| `text`         | string | ❌ No    | Text content (for `text` type)                         |
| `title`        | string | ❌ No    | Optional title for the source                          |
| `notebook_url` | string | ❌ No    | Target notebook URL                                    |
| `session_id`   | string | ❌ No    | Reuse existing session                                 |

**Success Response (200):**

```json
{
  "success": true,
  "sourceName": "My Document",
  "status": "ready"
}
```

---

## 15b. Delete Source from Notebook

### `DELETE /content/sources/:id`

Delete a source from a notebook by its ID.

**Request:**

```bash
curl -X DELETE "http://localhost:3000/content/sources/source-123?notebook_url=https://notebooklm.google.com/notebook/abc123"
```

**Path Parameters:**

| Parameter | Type   | Required | Description                 |
| --------- | ------ | -------- | --------------------------- |
| `id`      | string | Yes      | The unique ID of the source |

**Query Parameters:**

| Parameter      | Type   | Required | Description            |
| -------------- | ------ | -------- | ---------------------- |
| `notebook_url` | string | No       | Target notebook URL    |
| `session_id`   | string | No       | Reuse existing session |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "sourceId": "source-123",
    "sourceName": "My Document"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "Source not found: source-123"
}
```

### `DELETE /content/sources` (Alternative)

Delete a source by name using query parameters. Useful when you know the source name but not the ID.

**Request:**

```bash
curl -X DELETE "http://localhost:3000/content/sources?source_name=My%20Document"
```

**Query Parameters:**

| Parameter      | Type   | Required | Description                            |
| -------------- | ------ | -------- | -------------------------------------- |
| `source_id`    | string | No\*     | The unique ID of the source            |
| `source_name`  | string | No\*     | The name of the source (partial match) |
| `notebook_url` | string | No       | Target notebook URL                    |
| `session_id`   | string | No       | Reuse existing session                 |

\*At least one of `source_id` or `source_name` is required.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "sourceId": "source-123",
    "sourceName": "My Document"
  }
}
```

**Notes:**

- The `source_name` parameter supports partial matching (case-insensitive)
- Use `list_content` first to find source IDs and names
- This action is irreversible - the source will be permanently removed

---

## 16. Generate Content

### `POST /content/generate`

Generate content using NotebookLM Studio features. Supports audio overview, video, infographic, report, presentation, and data table generation.

> **Note:** v1.5.0 consolidated all content generation into this single endpoint.

**Request:**

```bash
# Generate a video (brief format)
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "video",
    "video_format": "brief",
    "video_style": "documentary",
    "language": "French",
    "custom_instructions": "Focus on key takeaways"
  }'

# Generate a presentation (detailed slideshow, short length)
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "presentation",
    "presentation_style": "detailed_slideshow",
    "presentation_length": "short",
    "language": "English"
  }'

# Generate a data table (exports to Google Sheets)
curl -X POST http://localhost:3000/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "data_table",
    "language": "English"
  }'
```

**Body Parameters:**

| Parameter             | Type   | Required | Description                                                                            |
| --------------------- | ------ | -------- | -------------------------------------------------------------------------------------- |
| `content_type`        | string | ✅ Yes   | Type: `audio_overview`, `video`, `infographic`, `report`, `presentation`, `data_table` |
| `custom_instructions` | string | ❌ No    | Custom focus/prompt (not available for `report`)                                       |
| `language`            | string | ❌ No    | Output language (80+ supported)                                                        |
| `video_style`         | string | ❌ No    | Visual style for video (see below)                                                     |
| `video_format`        | string | ❌ No    | Video format: `brief` (default), `explainer`                                           |
| `infographic_format`  | string | ❌ No    | Infographic format: `horizontal` (default), `vertical`                                 |
| `report_format`       | string | ❌ No    | Report format: `summary` (default), `detailed`                                         |
| `presentation_style`  | string | ❌ No    | Style: `detailed_slideshow` (default), `presenter_notes`                               |
| `presentation_length` | string | ❌ No    | Length: `short`, `default`                                                             |
| `notebook_url`        | string | ❌ No    | Target notebook URL                                                                    |
| `session_id`          | string | ❌ No    | Reuse existing session                                                                 |

**Content Types and Export Options:**

| Content Type     | Options                               | Custom Prompt | Export Type        |
| ---------------- | ------------------------------------- | ------------- | ------------------ |
| `audio_overview` | language only                         | ✅ Yes        | WAV file           |
| `video`          | `brief`/`explainer` + 6 visual styles | ✅ Yes        | MP4 file           |
| `infographic`    | `horizontal`/`vertical`               | ✅ Yes        | PNG file           |
| `report`         | `summary`/`detailed`                  | ❌ No         | Text (in response) |
| `presentation`   | style + length options                | ✅ Yes        | Google Slides      |
| `data_table`     | language only                         | ✅ Yes        | Google Sheets      |

> **Note:** `report` does not support custom prompts - only format and language options are available.

**Presentation Style Options:**

| Style                | Description                          |
| -------------------- | ------------------------------------ |
| `detailed_slideshow` | Full slides with visuals and content |
| `presenter_notes`    | Slides with speaker notes            |

**Presentation Length Options:**

| Length    | Description             |
| --------- | ----------------------- |
| `short`   | Condensed (5-8 slides)  |
| `default` | Standard length (10-15) |

**Video Visual Styles:**

| Style         | Description                    |
| ------------- | ------------------------------ |
| `classroom`   | Educational whiteboard style   |
| `documentary` | Professional documentary style |
| `animated`    | Motion graphics and animations |
| `corporate`   | Business presentation style    |
| `cinematic`   | Film-quality dramatic style    |
| `minimalist`  | Clean, simple visuals          |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "type": "video",
    "status": "ready",
    "message": "Video generated successfully"
  }
}
```

**Note:** Media generation can take several minutes. Use `/content/download` to retrieve files or export URLs.

---

## 16b. Generate a Study Aid

### `POST /content/study-aid`

Generate flashcards or a quiz from every source in the notebook. This is a Studio artifact type the
browser-driven `/content/generate` never exposed, so it is available over the internal API only.

The call blocks until generation finishes, polling every five seconds for up to fifteen minutes.

**Request:**

```bash
curl -X POST http://localhost:3000/content/study-aid \
  -H "Content-Type: application/json" \
  -d '{
    "notebook_id": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "kind": "flashcards",
    "focus": "Concentrate on the terminology introduced in chapter 3"
  }'
```

**Body Parameters:**

| Parameter      | Type   | Required | Description                                                         |
| -------------- | ------ | -------- | ------------------------------------------------------------------- |
| `kind`         | string | ✅ Yes   | `flashcards` or `quiz`                                              |
| `notebook_url` | string | ❌ No    | Notebook URL                                                        |
| `notebook_id`  | string | ❌ No    | Notebook UUID, used instead of `notebook_url`                       |
| `focus`        | string | ❌ No    | Free-text steer for the generator (default: none)                   |
| `language`     | string | ❌ No    | Output language (default: the server's configured content language) |

With neither `notebook_url` nor `notebook_id`, the active notebook is used. An unrecognised
`language` is refused rather than silently replaced.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "title": "Flashcards: Nonviolent Communication",
    "artifactId": "3f0b9c21-7a4e-4d55-9f12-6c8e0a1b2d34"
  }
}
```

**Error Response (200 with `success: false`):**

```json
{
  "success": false,
  "data": { "status": "timeout", "artifactId": "3f0b9c21-7a4e-4d55-9f12-6c8e0a1b2d34" },
  "error": "Generation timeout"
}
```

The payload is still present when generation does not complete, so you can retrieve the artifact
later with `GET /content`. Other failures — `kind must be 'flashcards' or 'quiz'`, `No notebook
specified`, `notebook has no sources` — come back the same way, with no `data`.

Generation requires a notebook you own: NotebookLM refuses Studio creation on a notebook merely
shared with you.

**Response Time:** 1–5 minutes.

---

## 16c. Generate a Mind Map

### `POST /content/mind-map`

Generate a mind map from the notebook's sources and save it to the notebook. The response carries
the map itself as a JSON string, so you can render it without a second call.

**Request:**

```bash
curl -X POST http://localhost:3000/content/mind-map \
  -H "Content-Type: application/json" \
  -d '{
    "notebook_id": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "title": "NVC overview",
    "focus": "Organise around the four steps"
  }'
```

**Body Parameters:**

| Parameter      | Type   | Required | Description                                                         |
| -------------- | ------ | -------- | ------------------------------------------------------------------- |
| `notebook_url` | string | ❌ No    | Notebook URL                                                        |
| `notebook_id`  | string | ❌ No    | Notebook UUID, used instead of `notebook_url`                       |
| `title`        | string | ❌ No    | Title of the saved map (default: `Mind Map`)                        |
| `focus`        | string | ❌ No    | Free-text steer for the generator (default: none)                   |
| `language`     | string | ❌ No    | Output language (default: the server's configured content language) |

With neither `notebook_url` nor `notebook_id`, the active notebook is used.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "mindMapId": "5d8a1c33-0e67-4b92-8c41-72f5b0a9e118",
    "title": "NVC overview",
    "json": "{\"nodes\":[{\"id\":\"root\",\"label\":\"Nonviolent Communication\"}]}"
  }
}
```

`json` is the raw mind-map document as returned by NotebookLM, kept as a string; its internal
structure is not normalised by this server, so treat the example above as illustrative only.
`mindMapId` is `null` when the map was generated but the save step returned no identifier.

**Error Response (200 with `success: false`):**

```json
{
  "success": false,
  "error": "notebook has no sources"
}
```

As with the study aid, the notebook must be one you own.

---

## 16d. Research Web Sources

### `POST /content/research`

Run NotebookLM's Fast Research against the open web and return the sources it finds, optionally
importing them into the notebook in the same call.

The call starts the research task and then polls every five seconds for up to two minutes. If
nothing has been found by then it returns an empty list rather than an error.

**Request:**

```bash
curl -X POST http://localhost:3000/content/research \
  -H "Content-Type: application/json" \
  -d '{
    "notebook_id": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "query": "empirical studies on nonviolent communication in schools",
    "import": false
  }'
```

**Body Parameters:**

| Parameter      | Type    | Required | Description                                                 |
| -------------- | ------- | -------- | ----------------------------------------------------------- |
| `query`        | string  | ✅ Yes   | What to research                                            |
| `notebook_url` | string  | ❌ No    | Notebook URL                                                |
| `notebook_id`  | string  | ❌ No    | Notebook UUID, used instead of `notebook_url`               |
| `import`       | boolean | ❌ No    | Add the discovered sources to the notebook (default: false) |

With neither `notebook_url` nor `notebook_id`, the active notebook is used.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "taskId": "task-9f3c1a7e",
    "imported": 0,
    "sources": [
      {
        "url": "https://example.org/nvc-in-schools",
        "title": "Nonviolent Communication in Schools: a review",
        "description": "A 2023 review of classroom interventions."
      }
    ]
  }
}
```

`description` is absent when the result carried none. `imported` is the number of sources actually
added, and stays `0` unless `import` was `true`. `taskId` is `null` when the poll found no task.

**Error Response (200 with `success: false`):**

```json
{
  "success": false,
  "error": "query is required"
}
```

**Response Time:** up to 2 minutes.

---

## 17b. Download/Export Content

### `GET /content/download`

Download or export generated content. Supports file downloads (audio, video, infographic) and Google exports (presentation, data_table).

**Request:**

```bash
# Download video file
curl "http://localhost:3000/content/download?content_type=video&output_path=/path/to/video.mp4"

# Download infographic
curl "http://localhost:3000/content/download?content_type=infographic&output_path=/path/to/image.png"

# Export presentation to Google Slides (returns URL)
curl "http://localhost:3000/content/download?content_type=presentation"

# Export data table to Google Sheets (returns URL)
curl "http://localhost:3000/content/download?content_type=data_table"
```

**Query Parameters:**

| Parameter      | Type   | Required | Description                                                                  |
| -------------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `content_type` | string | ✅ Yes   | Type: `audio_overview`, `video`, `infographic`, `presentation`, `data_table` |
| `output_path`  | string | ❌ No    | Local path to save file (for downloadable types)                             |
| `notebook_url` | string | ❌ No    | Target notebook URL                                                          |
| `session_id`   | string | ❌ No    | Reuse existing session                                                       |

**Export Types:**

| Content Type     | Export Type   | Output                        |
| ---------------- | ------------- | ----------------------------- |
| `audio_overview` | File download | WAV file                      |
| `video`          | File download | MP4 file                      |
| `infographic`    | File download | PNG file                      |
| `presentation`   | Google Slides | `googleSlidesUrl` in response |
| `data_table`     | Google Sheets | `googleSheetsUrl` in response |

**Note:** `report` is text-only and returned in the `/content/generate` response (no export option).

**Success Response - File Download (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "filePath": "/path/to/video.mp4",
    "mimeType": "video/mp4"
  }
}
```

**Success Response - Google Slides Export (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "googleSlidesUrl": "https://docs.google.com/presentation/d/abc123",
    "mimeType": "application/vnd.google-apps.presentation"
  }
}
```

**Success Response - Google Sheets Export (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "googleSheetsUrl": "https://docs.google.com/spreadsheets/d/xyz789",
    "mimeType": "application/vnd.google-apps.spreadsheet"
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Content type 'report' is not exportable. Report content is text-based and returned in the generation response."
}
```

---

## 18. List Content

### `GET /content`

List all sources and generated content in a notebook.

**Request:**

```bash
curl "http://localhost:3000/content?notebook_url=https://notebooklm.google.com/notebook/abc123"
```

**Query Parameters:**

| Parameter      | Type   | Required | Description            |
| -------------- | ------ | -------- | ---------------------- |
| `notebook_url` | string | ❌ No    | Target notebook URL    |
| `session_id`   | string | ❌ No    | Reuse existing session |

**Success Response (200):**

```json
{
  "success": true,
  "sources": [
    {
      "id": "source-1",
      "name": "Introduction Document",
      "type": "document",
      "status": "ready"
    }
  ],
  "generatedContent": [
    {
      "id": "audio-overview",
      "type": "audio_overview",
      "name": "Audio Overview",
      "status": "ready",
      "createdAt": "2025-12-24T10:30:00Z"
    }
  ],
  "sourceCount": 3,
  "hasAudioOverview": true
}
```

---

## 18b. Delete Generated Content

### `DELETE /content/:contentId`

Delete one generated Studio artifact — a report, an audio overview, a mind map, a study aid — by its
ID. The IDs come from `GET /content`.

**Path Parameters:**

| Parameter   | Type   | Required | Description                  |
| ----------- | ------ | -------- | ---------------------------- |
| `contentId` | string | ✅ Yes   | ID of the artifact to delete |

**Query Parameters:**

| Parameter      | Type   | Required | Description                                   |
| -------------- | ------ | -------- | --------------------------------------------- |
| `notebook_url` | string | ❌ No    | Notebook URL                                  |
| `notebook_id`  | string | ❌ No    | Notebook UUID, used instead of `notebook_url` |

The notebook is passed in the query string, not in a body. With neither parameter, the active
notebook is used.

**Request:**

```bash
curl -X DELETE \
  "http://localhost:3000/content/3f0b9c21-7a4e-4d55-9f12-6c8e0a1b2d34?notebook_id=74912e55-34a4-4027-bdcc-8e89badd0efd"
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "contentId": "3f0b9c21-7a4e-4d55-9f12-6c8e0a1b2d34",
    "deleted": true
  }
}
```

`deleted` is always `true` on a successful call: the deletion is not verified against a fresh
listing afterwards, unlike `DELETE /notebooks/bulk-delete`.

**Error Response (200 with `success: false`):**

```json
{
  "success": false,
  "error": "No notebook specified (notebook_url or notebook_id)"
}
```

---

## 19. Download/Export Content

### `GET /content/download`

Download or export generated content from NotebookLM.

**Request:**

```bash
# Download audio
curl "http://localhost:3000/content/download?content_type=audio_overview&output_path=/path/to/audio.mp3"

# Download video
curl "http://localhost:3000/content/download?content_type=video&output_path=/path/to/video.mp4"

# Export presentation (returns Google Slides URL)
curl "http://localhost:3000/content/download?content_type=presentation"

# Export data table (returns Google Sheets URL)
curl "http://localhost:3000/content/download?content_type=data_table"
```

**Query Parameters:**

| Parameter      | Type   | Required | Description                                                                  |
| -------------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `content_type` | string | ✅ Yes   | Type: `audio_overview`, `video`, `infographic`, `presentation`, `data_table` |
| `output_path`  | string | ❌ No    | Local path to save file (for audio, video, infographic)                      |
| `notebook_url` | string | ❌ No    | Target notebook URL                                                          |
| `session_id`   | string | ❌ No    | Reuse existing session                                                       |

**Success Response - File Download (200):**

```json
{
  "success": true,
  "filePath": "/path/to/audio.mp3",
  "mimeType": "audio/mpeg",
  "size": 1234567
}
```

**Success Response - Export (200):**

```json
{
  "success": true,
  "googleSlidesUrl": "https://docs.google.com/presentation/d/...",
  "googleSheetsUrl": "https://docs.google.com/spreadsheets/d/..."
}
```

**Note:** Report content is text-based and returned directly in the `/content/generate` response.

---

## 20. Create Note

### `POST /content/notes`

Create a note in the NotebookLM Studio panel. Notes are user-created annotations that appear in your notebook alongside sources, allowing you to save research findings, summaries, key insights, or any custom content.

**Request:**

```bash
curl -X POST http://localhost:3000/content/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Key Findings Summary",
    "content": "## Main Points\n\n1. First important finding\n2. Second key insight\n3. Conclusion and next steps"
  }'
```

**Body Parameters:**

| Parameter      | Type   | Required | Description                                  |
| -------------- | ------ | -------- | -------------------------------------------- |
| `title`        | string | ✅ Yes   | Title of the note                            |
| `content`      | string | ✅ Yes   | Content/body of the note (supports markdown) |
| `notebook_url` | string | ❌ No    | Target notebook URL                          |
| `session_id`   | string | ❌ No    | Reuse existing session                       |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "noteTitle": "Key Findings Summary",
    "status": "created"
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Missing required field: title"
}
```

**Use Cases:**

- Save research summaries from NotebookLM conversations
- Create custom annotations for specific sections
- Store key quotes and references
- Build a structured outline from notebook content

---

## 20b. List Notes

### `POST /content/notes/list`

List the notes saved in the notebook's Studio panel, with their titles and the short detail line
NotebookLM shows beneath each one.

This route is browser-driven: it opens or reuses a session, scrolls the Studio panel to force the
older notes to load, and reads them from the page. Expect seconds, not milliseconds, and expect it
to be sensitive to NotebookLM interface changes.

**Request:**

```bash
curl -X POST http://localhost:3000/content/notes/list \
  -H "Content-Type: application/json" \
  -d '{
    "notebook_url": "https://notebooklm.google.com/notebook/74912e55-34a4-4027-bdcc-8e89badd0efd"
  }'
```

**Body Parameters:**

| Parameter      | Type   | Required | Description               |
| -------------- | ------ | -------- | ------------------------- |
| `notebook_url` | string | ❌ No    | Target notebook URL       |
| `session_id`   | string | ❌ No    | Reuse an existing session |

Without `notebook_url` the active notebook is used, then the configured default notebook. Note that
this route takes a URL only — unlike the Studio routes above, it has no `notebook_id` parameter.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "notes": [
      {
        "id": "note-4b21",
        "title": "Key Findings Summary",
        "details": "3 sources · 12 Jan"
      },
      { "title": "Open questions" }
    ]
  }
}
```

Both `id` and `details` are optional: a note is only guaranteed to carry a `title`. The `data`
object repeats the `success` flag and carries an `error` string when the scrape fails.

---

## 20c. Read a Note

### `POST /content/notes/get`

Return the title and full text of one note, identified by title or by ID.

Browser-driven like the listing above: the note is located in the Studio panel, opened, and its text
read from the page.

**Request:**

```bash
curl -X POST http://localhost:3000/content/notes/get \
  -H "Content-Type: application/json" \
  -d '{
    "note_title": "Key Findings Summary"
  }'
```

**Body Parameters:**

| Parameter      | Type   | Required  | Description                                     |
| -------------- | ------ | --------- | ----------------------------------------------- |
| `note_title`   | string | ✅ One of | Title of the note to read                       |
| `note_id`      | string | ✅ One of | ID of the note, from `POST /content/notes/list` |
| `notebook_url` | string | ❌ No     | Target notebook URL                             |
| `session_id`   | string | ❌ No     | Reuse an existing session                       |

At least one of `note_title` and `note_id` must be present; the other is optional.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "title": "Key Findings Summary",
    "content": "## Main Points\n\n1. First important finding\n..."
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Missing required parameter: note_title or note_id"
}
```

A note that cannot be found returns 200 with `success: false` and
`Note not found: "Key Findings Summary"`.

## 21. Save Chat to Note

### `POST /content/chat-to-note`

Save the current chat discussion to a note. This captures the last response from NotebookLM and saves it as a note in the Studio panel.

**Request:**

```bash
curl -X POST http://localhost:3000/content/chat-to-note \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Summary of Key Points"
  }'
```

**Body Parameters:**

| Parameter      | Type   | Required | Description              |
| -------------- | ------ | -------- | ------------------------ |
| `title`        | string | ✅ Yes   | Title for the saved note |
| `notebook_url` | string | ❌ No    | Target notebook URL      |
| `session_id`   | string | ❌ No    | Reuse existing session   |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "noteTitle": "Summary of Key Points",
    "status": "saved"
  }
}
```

**Use Cases:**

- Capture important NotebookLM responses for later reference
- Build a collection of insights from multiple questions
- Create study notes from Q&A sessions

---

## 22. Convert Note to Source

### `POST /content/notes/:noteTitle/to-source`

Convert an existing note into a source. This makes the note content available as a citable source in the notebook.

**Request:**

```bash
curl -X POST "http://localhost:3000/content/notes/My%20Research%20Note/to-source" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Path Parameters:**

| Parameter   | Type   | Required | Description                   |
| ----------- | ------ | -------- | ----------------------------- |
| `noteTitle` | string | ✅ Yes   | URL-encoded title of the note |

**Body Parameters:**

| Parameter      | Type   | Required | Description            |
| -------------- | ------ | -------- | ---------------------- |
| `notebook_url` | string | ❌ No    | Target notebook URL    |
| `session_id`   | string | ❌ No    | Reuse existing session |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "noteTitle": "My Research Note",
    "status": "converted"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "error": "Note not found: My Research Note"
}
```

**Use Cases:**

- Promote important notes to be citable sources
- Include your own research as part of the notebook's knowledge base
- Make aggregated insights available for citation in future responses

---

## 23. Scrape Notebooks from NotebookLM

### `GET /notebooks/scrape`

Scrape all notebooks from the user's NotebookLM account.

**Request:**

```bash
curl "http://localhost:3000/notebooks/scrape?show_browser=true"
```

**Query Parameters:**

| Parameter      | Type    | Description                   |
| -------------- | ------- | ----------------------------- |
| `show_browser` | boolean | Show browser window for debug |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebooks": [
      {
        "id": "00000000-0000-0000-0000-000000000103",
        "name": "Internal Family Systems",
        "url": "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000103"
      }
    ],
    "total": 16,
    "message": "Found 16 notebooks in NotebookLM account"
  }
}
```

---

## 24. Bulk Import Scraped Notebooks

### `POST /notebooks/import-from-scrape`

Scrape notebooks from NotebookLM and bulk import them into the library.

**Request:**

```bash
curl -X POST http://localhost:3000/notebooks/import-from-scrape \
  -H "Content-Type: application/json" \
  -d '{"auto_discover": false}'
```

**Body Parameters:**

| Parameter       | Type     | Required | Description                            |
| --------------- | -------- | -------- | -------------------------------------- |
| `notebook_ids`  | string[] | No       | Filter: only import these notebook IDs |
| `auto_discover` | boolean  | No       | Use AI to generate metadata (slower)   |
| `show_browser`  | boolean  | No       | Show browser window for debug          |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "imported": [
      {
        "id": "00000000-0000-0000-0000-000000000103",
        "name": "Internal Family Systems",
        "status": "imported"
      }
    ],
    "errors": [],
    "total_scraped": 16,
    "total_imported": 16,
    "total_errors": 0
  }
}
```

**Use Cases:**

- Initial library setup: import all existing notebooks at once
- Sync new notebooks: re-run to import newly created notebooks
- Selective import: use `notebook_ids` to import specific notebooks only

---

## 25. List a Notebook's Sources

### `GET /notebooks/:id/sources`

Returns every source in the notebook with its ID and title. This is where the
source IDs used by `GET /notebooks/:id/sources/:sourceId` and
`DELETE /content/sources/:id` come from.

RPC-backed: no browser is started, and a 150-source notebook answers in about a
second.

**Example:**

```bash
curl http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/sources
```

**Response:**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "count": 153,
    "sources": [
      {
        "id": "c3ae2b1b-b362-46ae-9dc8-7b658a05955e",
        "title": "A Guide to Non-violent Communication - CultureAlly"
      }
    ]
  }
}
```

---

## 26. Read a Source's Full Text

### `GET /notebooks/:id/sources/:sourceId`

Returns the exact text NotebookLM indexed for that source — the content it
reasons over, which the web UI only ever shows you in fragments. Use it to quote
a source verbatim, to check what was really extracted from a PDF or a web page,
or to hand the raw material to another tool.

**Query parameters:**

| Parameter   | Values            | Default | Description                                                          |
| ----------- | ----------------- | ------- | -------------------------------------------------------------------- |
| `format`    | `text` \| `html`  | `text`  | `html` keeps headings, lists and links, but inlines images as base64 |
| `paginate`  | `true` \| `false` | `true`  | `false` returns the whole document in one response                   |
| `max_chars` | number            | `20000` | Page size. Ignored when `paginate=false`                             |
| `cursor`    | number            | `0`     | Where to resume — pass the `nextCursor` from the previous page       |

**Pagination.** Sources are long: the first PDF measured here ran to 157,716
characters. So by default you get one page at a time, and the response tells you
how to get the rest:

| Field        | Meaning                                                    |
| ------------ | ---------------------------------------------------------- |
| `totalChars` | Size of the whole document                                 |
| `pageChars`  | Size of this page                                          |
| `offset`     | Where this page starts                                     |
| `hasMore`    | Whether anything follows                                   |
| `nextCursor` | Pass back as `cursor` for the next page (absent when done) |
| `continue`   | Plain-language instruction for the next call (same)        |

Pages are cut at the nearest line break — the nearest tag close, in HTML — so a
page never ends mid-word. Concatenating every page reproduces the document
exactly; that round trip is verified against a live 157,716-character source.

`paginate=false` returns everything in one response, which is the right call for
a short source and an expensive one for a book.

**One more thing:** `html` is bigger than `text` — images are embedded as base64
data URIs, so the same PDF came back at 158 KB as text and 166 KB as HTML.

**Example:**

```bash
curl "http://localhost:3000/notebooks/74912e55-.../sources/c3ae2b1b-...?format=text"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "8e058298-b561-4b3a-954f-953075e30e37",
    "title": "All-in-Fully-Committing-to-a-Life-of-Nonviolence.pdf",
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "format": "text",
    "content": "All-in  Fully Committing to a Life of Nonviolence\n...",
    "totalChars": 157716,
    "pageChars": 19645,
    "offset": 0,
    "hasMore": true,
    "nextCursor": 19645,
    "continue": "Call read_source again with cursor: 19645 for the next 20000 characters. Pass paginate: false to get the whole document in one call instead."
  }
}
```

The MCP equivalents are `source_list` and `source_read`; `source_read` also
accepts `source_name` instead of an ID, and refuses to guess when the name
matches more than one source.

---

## 📊 Limits and Quotas

| Limit                     | Value     | Configurable               |
| ------------------------- | --------- | -------------------------- |
| **Concurrent sessions**   | 10        | ✅ Yes (`MAX_SESSIONS`)    |
| **Session timeout**       | 15 min    | ✅ Yes (`SESSION_TIMEOUT`) |
| **Request timeout**       | 120 sec   | ❌ No (hardcoded)          |
| **Max question size**     | Unlimited | ❌ No                      |
| **NotebookLM rate limit** | 50/day    | ❌ No (Google limit)       |

### `POST /notebooks/:id/search`

Find the passages in a notebook's sources that match a query, ranked best first. RPC-backed (no browser).

This is retrieval, not question answering: nothing is generated, **no generation quota is spent**, and you get the indexed text itself with its offsets. Reach for it instead of `/ask` when you want the evidence rather than the prose.

**Body:**

| Field          | Type     | Notes                                                                                                 |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `query`        | string   | Required.                                                                                             |
| `source_ids`   | string[] | Restrict to these source UUIDs. Omit to search every source.                                          |
| `source_names` | string[] | Restrict by source title. An ambiguous title is an error naming the candidates, never a silent guess. |
| `limit`        | number   | Keep at most this many passages, best rank first.                                                     |

**Request:**

```bash
curl -X POST http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/search \
  -H "Content-Type: application/json" \
  -d '{"query": "how is ikigai defined", "limit": 2}'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "query": "how is ikigai defined",
    "count": 2,
    "passages": [
      {
        "sourceId": "0f1a...",
        "text": "Ikigai is described as the intersection of what you love and what the world needs.",
        "rank": 0,
        "start": 4821,
        "end": 4903
      }
    ]
  }
}
```

**Rank is global across sources and lower is better** — `0` is the best match in the notebook, not a missing value. `start` and `end` are character offsets into that source's full text (the same text `GET /content/sources/:id` returns), and both are `null` when the server did not report a span rather than being guessed at `0`.

A notebook whose sources are still being indexed returns no passages. That is an empty result, not an error.

---

### `GET /notebooks/:id/summary`

A notebook's own summary of its sources, plus the questions NotebookLM suggests asking. RPC-backed (no browser) — far cheaper than asking a question to find out what a notebook holds.

**Request:**

```bash
curl http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/summary
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "summary": "Six papers on retrieval-augmented generation, 2023-2026.",
    "suggestedTopics": [
      { "question": "What do they agree on?", "prompt": "Summarise the points of agreement" }
    ]
  }
}
```

A notebook NotebookLM has not summarised yet returns an empty `summary` and no topics.

---

### `GET /notebooks/:id/freshness`

Report whether URL and Drive sources have drifted from what they point at. Checks the whole notebook unless `source_id` narrows it.

**Query Parameters:**

| Parameter   | Type   | Required | Description                                   |
| ----------- | ------ | -------- | --------------------------------------------- |
| `source_id` | string | No       | Check only this source instead of all of them |

**Request:**

```bash
curl http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/freshness
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "checked": 3,
    "stale": 1,
    "sources": [
      { "id": "4b9e...", "stale": false },
      { "id": "7c21...", "stale": true },
      { "id": "9f08...", "stale": null }
    ]
  }
}
```

⚠️ `stale: null` means the server did not answer for that source — **not** that it is current. Treat it as unknown and check the source yourself before relying on it.

---

### `GET /notebooks/:id/chat`

Read back the questions and answers already recorded in a notebook, newest first. An agent resuming work can see what it already asked instead of paying to ask again.

**Query Parameters:**

| Parameter         | Type   | Required | Description                                          |
| ----------------- | ------ | -------- | ---------------------------------------------------- |
| `conversation_id` | string | No       | A specific conversation; defaults to the most recent |
| `limit`           | number | No       | Maximum turns, newest first (default 20)             |

**Request:**

```bash
curl "http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/chat?limit=4"
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "conversationId": "a1b2c3d4-...",
    "count": 2,
    "turns": [
      { "role": "question", "text": "What do these papers agree on?" },
      { "role": "answer", "text": "All six treat retrieval as..." }
    ]
  }
}
```

NotebookLM exposes only the most recent conversation per notebook; older ones cannot be listed. A notebook with no history answers `conversationId: null` and no turns.

---

### `DELETE /notebooks/:id/chat`

Clear a notebook's chat history — the web UI's "Delete history". NotebookLM has no per-turn delete, so the whole conversation goes. Afterwards the next question starts a fresh conversation.

**Query Parameters:**

| Parameter         | Type   | Required | Description                                          |
| ----------------- | ------ | -------- | ---------------------------------------------------- |
| `conversation_id` | string | No       | A specific conversation; defaults to the most recent |

**Request:**

```bash
curl -X DELETE http://localhost:3000/notebooks/74912e55-34a4-4027-bdcc-8e89badd0efd/chat
```

**Success Response (200):**

```json
{
  "success": true,
  "data": { "notebookId": "74912e55-...", "conversationId": "a1b2c3d4-...", "deleted": true }
}
```

Nothing to delete is reported as `deleted: false`, not as a failure.

---

### `PATCH /notebooks/:id/sources/:sourceId`

Rename one source in place.

**Request Body:**

| Field   | Type   | Required | Description   |
| ------- | ------ | -------- | ------------- |
| `title` | string | ✅ Yes   | The new title |

**Request:**

```bash
curl -X PATCH http://localhost:3000/notebooks/74912e55-.../sources/4b9e1f22-... \
  -H "Content-Type: application/json" \
  -d '{"title":"Chapter 4 — Retrieval"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-...",
    "sourceId": "4b9e1f22-...",
    "title": "Chapter 4 — Retrieval"
  }
}
```

A missing or empty `title` is a 400.

---

### `GET /notebooks/:id/sources/:sourceId/guide`

NotebookLM's own summary and key topics for a single source — what the source panel shows.

**Request:**

```bash
curl http://localhost:3000/notebooks/74912e55-.../sources/4b9e1f22-.../guide
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-...",
    "id": "4b9e1f22-...",
    "summary": "A 2024 survey of retrieval-augmented generation.",
    "keyTopics": ["retrieval", "citations", "evaluation"]
  }
}
```

A source NotebookLM has not summarised yet returns an empty `summary` and no topics.

---

### `POST /content/:artifactId/retry`

Retry a Studio generation that failed. RPC-backed.

**The artifact id survives.** It is not deleted and not replaced: the same id goes back to `generating`. That is the reason to prefer this over deleting and regenerating, which mints a new id and invalidates every reference you were holding — a saved id, a poll loop, a queued download.

**Request:**

```bash
curl -X POST http://localhost:3000/content/5d2c.../retry \
  -H "Content-Type: application/json" \
  -d '{"notebook_id": "74912e55-34a4-4027-bdcc-8e89badd0efd"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-34a4-4027-bdcc-8e89badd0efd",
    "contentId": "5d2c...",
    "status": "in_progress",
    "retried": true
  }
}
```

A refusal — rate limit, exhausted quota, or an artifact the backend will not retry — comes back as an error rather than a queued retry. An accepted retry can still fail again on Google's side; poll `GET /content` for the outcome, and whether to retry once more is your call.

Failed artifacts appear in `GET /content` with `status: "failed"`, which is where their ids come from. That listing previously showed only finished artifacts, so a failure was invisible and its id unreachable — see the changelog entry for the release that introduced this endpoint.

---

### `POST /content/:artifactId/export`

Export a finished Studio artifact to Google Docs or Google Sheets.

**Request Body:**

| Field         | Type   | Required | Description                                                |
| ------------- | ------ | -------- | ---------------------------------------------------------- |
| `notebook_id` | string | ✅ Yes\* | Notebook UUID (`notebook_url` works instead)               |
| `target`      | string | No       | `docs` (default) or `sheets` — use sheets for a data table |
| `title`       | string | No       | Title of the created document (default `Export`)           |

**Request:**

```bash
curl -X POST http://localhost:3000/content/artifact-1/export \
  -H "Content-Type: application/json" \
  -d '{"notebook_id":"74912e55-...","target":"docs","title":"Literature review"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "notebookId": "74912e55-...",
    "artifactId": "artifact-1",
    "target": "docs",
    "documentUrl": "https://docs.google.com/document/d/abc123/edit"
  }
}
```

`documentUrl` is `null` when the reply carried no Drive link — the export may still have succeeded; check Drive.

---

### `POST /content/:artifactId/revise-slide`

Revise one slide of an existing deck from a prompt, instead of regenerating the whole presentation.

**Request Body:**

| Field         | Type   | Required | Description                                  |
| ------------- | ------ | -------- | -------------------------------------------- |
| `notebook_id` | string | ✅ Yes\* | Notebook UUID (`notebook_url` works instead) |
| `slide_index` | number | ✅ Yes   | Zero-based slide number                      |
| `prompt`      | string | ✅ Yes   | What to change on that slide                 |

**Request:**

```bash
curl -X POST http://localhost:3000/content/artifact-1/revise-slide \
  -H "Content-Type: application/json" \
  -d '{"notebook_id":"74912e55-...","slide_index":2,"prompt":"Cut the third bullet"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": { "notebookId": "74912e55-...", "artifactId": "artifact-1", "status": "in_progress" }
}
```

The call returns as soon as the revision is accepted; poll `GET /content` for the finished deck.

---

---

## 🧪 Postman Collection

**Import this collection:**

```json
{
  "info": {
    "name": "NotebookLM MCP API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "http://localhost:3000/health"
      }
    },
    {
      "name": "Ask Question",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/ask",
        "header": [{ "key": "Content-Type", "value": "application/json" }],
        "body": {
          "mode": "raw",
          "raw": "{\"question\":\"What advice for parents?\",\"notebook_id\":\"parents-numerique\"}"
        }
      }
    }
  ]
}
```

---

**Complete API Documentation!** ✅
