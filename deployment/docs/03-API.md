# API Documentation - NotebookLM MCP HTTP Server

> Complete reference for all REST endpoints

---

## 🌐 Base URL

```
http://localhost:3000
```

Or for network access: `http://<SERVER-IP>:3000`

---

## 📡 Available Endpoints (22 total)

### Authentication
| Method | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/setup-auth` | First-time authentication |
| `POST` | `/de-auth` | Logout (clear credentials) |
| `POST` | `/re-auth` | Re-authenticate / switch account |
| `POST` | `/cleanup-data` | Clean all data (requires confirm) |

### Queries
| Method | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/health` | Server health check |
| `POST` | `/ask` | Ask a question to NotebookLM |

### Notebooks
| Method | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/notebooks` | List all notebooks |
| `POST` | `/notebooks` | Add a notebook manually |
| `POST` | `/notebooks/auto-discover` | Auto-generate notebook metadata |
| `GET` | `/notebooks/search` | Search notebooks by query |
| `GET` | `/notebooks/stats` | Get library statistics |
| `GET` | `/notebooks/:id` | Get notebook details |
| `PUT` | `/notebooks/:id` | Update notebook metadata |
| `DELETE` | `/notebooks/:id` | Delete a notebook |
| `PUT` | `/notebooks/:id/activate` | Activate a notebook (set as default) |

### Sessions
| Method | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/sessions` | List active sessions |
| `POST` | `/sessions/:id/reset` | Reset session history |
| `DELETE` | `/sessions/:id` | Close a session |

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

| Parameter | Type | Required | Description |
|-----------|------|--------|-------------|
| `question` | string | ✅ Yes | The question to ask |
| `notebook_id` | string | ❌ No | Notebook ID (or URL) |
| `notebook_url` | string | ❌ No | Direct notebook URL |
| `session_id` | string | ❌ No | Reuse an existing session |
| `show_browser` | boolean | ❌ No | Show Chrome (debug) |

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

| Parameter | Type | Required | Description |
|-----------|------|--------|-------------|
| `show_browser` | boolean | ❌ No | Show Chrome (default: true) |

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
        "url": "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
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
    "url": "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
    "name": "Parents and Digital",
    "description": "Advice for parents in the digital age",
    "topics": ["parenting", "digital", "education"]
  }'
```

**Body Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|--------|-------------|
| `url` | string | ✅ Yes | NotebookLM notebook URL |
| `name` | string | ✅ Yes | Notebook name (unique) |
| `description` | string | ✅ Yes | Description |
| `topics` | string[] | ✅ Yes | List of topics |
| `content_types` | string[] | ❌ No | Content types (default: `["documentation", "examples"]`) |
| `use_cases` | string[] | ❌ No | Use cases (auto-generated if absent) |
| `tags` | string[] | ❌ No | Tags |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "notebook": {
      "id": "parents-numerique",
      "name": "Parents and Digital",
      "description": "Advice for parents in the digital age",
      "url": "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
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
  "error": "A notebook with the name 'Parents and Digital' already exists.\n\nExisting notebook ID: parents-numerique\nURL: https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940\n\nPlease use a different name, or update the existing notebook instead.\nTo update: PUT /notebooks/parents-numerique with new data\nTo delete: DELETE /notebooks/parents-numerique"
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
    "name": "cnv-pratique-essentiels",
    "description": "Manuel CNV couvrant 4 étapes fondamentales. Inclut exercices d'auto-empathie et écoute.",
    "tags": [
      "cnv",
      "empathie",
      "communication",
      "besoins",
      "sentiments",
      "demandes",
      "conflits",
      "authenticité"
    ],
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
      "url": "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
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
      "url": "https://notebooklm.google.com/notebook/19bde485-a9c1-4809-8884-e872b2b67b44",
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
        "id": "9a580eee",
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

| Parameter | Type | Required | Description |
|-----------|------|--------|-------------|
| `show_browser` | boolean | ❌ No | Show browser window (default: true) |

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
- Recovery from rate limits (50 queries/day on free accounts)
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

| Parameter | Type | Required | Description |
|-----------|------|--------|-------------|
| `confirm` | boolean | ✅ Yes | Must be true to execute (false for preview) |
| `preserve_library` | boolean | ❌ No | Keep library.json file (default: false) |

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

| Parameter | Type | Required | Description |
|-----------|------|--------|-------------|
| `name` | string | ❌ No | New notebook name |
| `description` | string | ❌ No | New description |
| `topics` | string[] | ❌ No | New topics array |
| `use_cases` | string[] | ❌ No | New use cases array |

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

| Parameter | Type | Required | Description |
|-----------|------|--------|-------------|
| `query` | string | ✅ Yes | Search keyword |

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

| Code | Meaning | Description |
|------|---------------|-------------|
| `200` | OK | Successful request |
| `400` | Bad Request | Missing or invalid parameters |
| `401` | Unauthorized | Authentication required (if API key enabled) |
| `404` | Not Found | Resource not found |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Server overloaded (too many sessions) |

---

## 📊 Limits and Quotas

| Limit | Value | Configurable |
|--------|--------|--------------|
| **Concurrent sessions** | 10 | ✅ Yes (`MAX_SESSIONS`) |
| **Session timeout** | 15 min | ✅ Yes (`SESSION_TIMEOUT`) |
| **Request timeout** | 120 sec | ❌ No (hardcoded) |
| **Max question size** | Unlimited | ❌ No |
| **NotebookLM rate limit** | 50/day | ❌ No (Google limit) |

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
        "header": [{"key": "Content-Type", "value": "application/json"}],
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
