# Managing the Notebook Library

> Complete guide to the multi-notebook library system

---

## 📚 Overview

The **NotebookLM MCP HTTP Server** integrates a library system that allows you to manage multiple NotebookLM notebooks and easily switch between them.

**Key features:**

- ✅ Add multiple notebooks with automatic validation
- ✅ Switch between notebooks in a single request
- ✅ Live validation (verifies that the notebook actually exists)
- ✅ Duplicate protection
- ✅ Usage statistics per notebook
- ✅ Library search

---

## 🗂️ Library Structure

### library.json File

Location: `%LOCALAPPDATA%\notebooklm-mcp\Data\library.json`

```json
{
  "notebooks": [
    {
      "id": "parents-numerique",
      "url": "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
      "name": "Parents et Numérique",
      "description": "Conseils pour parents à l'ère du numérique",
      "topics": ["parentalité", "numérique", "éducation"],
      "content_types": ["documentation", "examples"],
      "use_cases": [
        "Conseils éducatifs à l'ère du numérique",
        "Questions sur la parentalité et les écrans"
      ],
      "added_at": "2025-11-22T08:49:16.735Z",
      "last_used": "2025-11-22T09:30:45.123Z",
      "use_count": 15,
      "tags": ["psychology", "french"]
    },
    {
      "id": "shakespeare",
      "url": "https://notebooklm.google.com/notebook/19bde485-a9c1-4809-8884-e872b2b67b44",
      "name": "Shakespeare",
      "description": "William Shakespeare - L'intégrale des pièces",
      "topics": ["littérature", "théâtre", "Shakespeare"],
      "content_types": ["documentation", "examples"],
      "use_cases": ["Recherche sur les œuvres de Shakespeare", "Analyse littéraire et citations"],
      "added_at": "2025-11-22T08:54:33.592Z",
      "last_used": "2025-11-22T08:54:39.064Z",
      "use_count": 3,
      "tags": ["psychology"]
    }
  ],
  "active_notebook_id": "parents-numerique",
  "last_modified": "2025-11-22T09:36:04.837Z",
  "version": "1.0.0"
}
```

### NotebookEntry Fields

| Field           | Type     | Description                          |
| --------------- | -------- | ------------------------------------ |
| `id`            | string   | Unique ID (slug generated from name) |
| `url`           | string   | NotebookLM URL (validated)           |
| `name`          | string   | Notebook name (unique)               |
| `description`   | string   | Complete description                 |
| `topics`        | string[] | List of covered topics               |
| `content_types` | string[] | Content types (docs, examples, etc.) |
| `use_cases`     | string[] | Recommended use cases                |
| `added_at`      | ISO date | Date added                           |
| `last_used`     | ISO date | Last used                            |
| `use_count`     | number   | Number of requests                   |
| `tags`          | string[] | Custom tags                          |

---

## 🚀 Getting Started Guide

### 1. Automatic Initialization

On first startup, the library is empty:

```json
{
  "notebooks": [],
  "active_notebook_id": null,
  "last_modified": "2025-11-22T08:00:00.000Z",
  "version": "1.0.0"
}
```

### 2. Add Your First Notebook

**Step 1: Get the NotebookLM URL**

1. Open https://notebooklm.google.com
2. Open your notebook
3. Copy the URL from the address bar

Expected format: `https://notebooklm.google.com/notebook/[id]`

**Step 2: Add the notebook**

```bash
curl -X POST http://localhost:3000/notebooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
    "name": "Parents et Numérique",
    "description": "Conseils pour parents à l'ère du numérique",
    "topics": ["parentalité", "numérique", "éducation"]
  }'
```

**PowerShell:**

```powershell
$body = @{
    url = "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940"
    name = "Parents et Numérique"
    description = "Conseils pour parents à l'ère du numérique"
    topics = @("parentalité", "numérique", "éducation")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/notebooks" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

**⏱️ Warning:** Adding takes 15-30 seconds because the server validates that the notebook actually exists.

### 3. Add Other Notebooks

Repeat the operation for each notebook:

```powershell
# Shakespeare Notebook
$body = @{
    url = "https://notebooklm.google.com/notebook/19bde485-a9c1-4809-8884-e872b2b67b44"
    name = "Shakespeare"
    description = "William Shakespeare - L'intégrale des pièces"
    topics = @("littérature", "théâtre", "Shakespeare")
    tags = @("literature", "theater")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/notebooks" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

### 4. List Your Notebooks

```bash
curl http://localhost:3000/notebooks
```

**PowerShell:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/notebooks"
```

---

## 🎯 Usage

### Using the Active Notebook

If a notebook is marked as active (`active_notebook_id`), no need to specify the ID:

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Qu'\''est-ce que l'\''empathie?"
  }'
```

The server will automatically use the active notebook.

### Using a Specific Notebook

To use a specific notebook, use `notebook_id`:

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Quelles sont les principales pièces de Shakespeare?",
    "notebook_id": "shakespeare"
  }'
```

### Change the Active Notebook

```bash
curl -X PUT http://localhost:3000/notebooks/shakespeare/activate
```

**PowerShell:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/notebooks/shakespeare/activate" -Method Put
```

---

## ✅ Automatic Validations

### 1. URL Format

The server verifies that the URL is in NotebookLM format:

✅ **Valid:**

```
https://notebooklm.google.com/notebook/74912e55-34a4-4027-bdcc-8e89badd0efd
```

❌ **Invalid:**

```
https://example.com/notebook
https://notebooklm.google.com/
https://notebooklm.google.com/notebook/
```

### 2. Live Validation (Existence)

When adding, the server:

1. Creates a temporary session
2. Opens the notebook in headless Chrome
3. Verifies that the chat interface loads
4. Closes the temporary session

**Detected errors:**

- Non-existent notebook
- Notebook without access (permissions)
- Incorrect URL
- Invalid notebook ID

**Error example:**

```json
{
  "success": false,
  "error": "Invalid or inaccessible notebook.\n\nURL: https://notebooklm.google.com/notebook/invalid-id\n\nThe notebook page loaded but the chat interface was not found.\nThis usually means:\n- The notebook doesn't exist\n- You don't have access to this notebook\n- The notebook ID in the URL is incorrect\n\nPlease verify the URL by:\n1. Go to https://notebooklm.google.com\n2. Open the notebook manually\n3. Copy the exact URL from the address bar"
}
```

### 3. Duplicate Detection

The server blocks adding notebooks with the same name (case-insensitive):

```bash
# First add: OK
POST /notebooks {"name": "Parents et Numérique", ...}  # ✅

# Second add with same name: ERROR
POST /notebooks {"name": "parents et numérique", ...}  # ❌ (case-insensitive)
```

**Returned error:**

```json
{
  "success": false,
  "error": "A notebook with the name 'Parents et Numérique' already exists.\n\nExisting notebook ID: parents-numerique\nURL: https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940\n\nPlease use a different name, or update the existing notebook instead.\nTo update: PUT /notebooks/parents-numerique with new data\nTo delete: DELETE /notebooks/parents-numerique"
}
```

---

## 📊 Usage Statistics

### Automatic Counters

Each request to a notebook automatically increments:

- `use_count` - Total number of requests
- `last_used` - Last used timestamp

### Get Statistics

```bash
curl http://localhost:3000/notebooks
```

The response includes metadata for each notebook:

```json
{
  "success": true,
  "data": {
    "notebooks": [
      {
        "id": "parents-numerique",
        "name": "Parents et Numérique",
        "use_count": 42,
        "last_used": "2025-11-22T10:30:45.123Z",
        ...
      }
    ]
  }
}
```

### Most Used Notebook

The notebook with the most `use_count` appears in the health check:

```bash
curl http://localhost:3000/health
```

```json
{
  "success": true,
  "data": {
    "library_notebooks": 2,
    "most_used": "parents-numerique"
  }
}
```

---

## 🗑️ Notebook Management

### Delete a Notebook

```bash
curl -X DELETE http://localhost:3000/notebooks/parents-numerique
```

**Behavior:**

- Removes the notebook from library.json
- If it was the active notebook, automatically selects the first remaining notebook
- Open sessions on this notebook remain active

### Notebook Details

```bash
curl http://localhost:3000/notebooks/parents-numerique
```

Returns all metadata:

```json
{
  "success": true,
  "data": {
    "notebook": {
      "id": "parents-numerique",
      "url": "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940",
      "name": "Parents et Numérique",
      "description": "Conseils pour parents à l'ère du numérique",
      "topics": ["parentalité", "numérique", "éducation"],
      "content_types": ["documentation", "examples"],
      "use_cases": ["Conseils éducatifs", "Parentalité numérique", ...],
      "added_at": "2025-11-22T08:49:16.735Z",
      "last_used": "2025-11-22T09:30:45.123Z",
      "use_count": 42,
      "tags": ["psychology", "french"]
    }
  }
}
```

---

## 🔍 Library Search

### Search by Name, Description, Topics

Search is not yet exposed via the HTTP API, but it exists in the code:

```typescript
// In src/library/notebook-library.ts:441
searchNotebooks(query: string): NotebookEntry[]
```

Searches in:

- Notebook name
- Description
- Topics
- Tags

**Coming in a future version:** `GET /notebooks/search?q=empathie`

---

## 💡 Use Cases

### 1. Multi-Project Workspace

You work on multiple projects with different notebooks:

```json
{
  "notebooks": [
    {"id": "projet-a", "name": "Projet A - API Documentation", ...},
    {"id": "projet-b", "name": "Projet B - User Research", ...},
    {"id": "projet-c", "name": "Projet C - Technical Specs", ...}
  ]
}
```

Switch easily according to context:

```bash
# Work on Project A
curl -X PUT http://localhost:3000/notebooks/projet-a/activate

# Ask questions (will use Project A)
curl -X POST http://localhost:3000/ask -d '{"question": "..."}'

# Switch to Project B
curl -X PUT http://localhost:3000/notebooks/projet-b/activate
```

### 2. Multi-Language Documentation

Notebooks for different languages:

```json
{
  "notebooks": [
    {"id": "docs-fr", "name": "Documentation Française", ...},
    {"id": "docs-en", "name": "English Documentation", ...},
    {"id": "docs-es", "name": "Documentación Española", ...}
  ]
}
```

### 3. Knowledge Domains

Notebooks by area of expertise:

```json
{
  "notebooks": [
    {
      "id": "psychology",
      "name": "Psychology Resources",
      "topics": ["mindfulness", "therapy", "CBT"]
    },
    { "id": "tech", "name": "Tech Documentation", "topics": ["React", "Node", "TypeScript"] },
    { "id": "business", "name": "Business Knowledge", "topics": ["marketing", "sales"] }
  ]
}
```

### 4. Environments (Dev/Staging/Prod)

Different notebooks for different environments:

```json
{
  "notebooks": [
    {"id": "dev-kb", "name": "Dev Knowledge Base", ...},
    {"id": "staging-kb", "name": "Staging Knowledge Base", ...},
    {"id": "prod-kb", "name": "Production Knowledge Base", ...}
  ]
}
```

---

## 🔧 Advanced Configuration

### Manually Edit library.json

Location: `%LOCALAPPDATA%\notebooklm-mcp\Data\library.json`

```powershell
# Open in an editor
code "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json"

# Or notepad
notepad "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json"
```

**⚠️ Warning:**

- Respect the JSON format (validate with a linter)
- Restart the server after manual modification
- Manual modifications do not go through validations

### Export/Import the Library

**Export:**

```powershell
Copy-Item "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json" `
    -Destination "D:\backup\library-backup.json"
```

**Import:**

```powershell
Copy-Item "D:\backup\library-backup.json" `
    -Destination "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json"
```

### Reset the Library

```powershell
# Backup first
Copy-Item "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json" `
    -Destination "$env:LOCALAPPDATA\notebooklm-mcp\Data\library-backup.json"

# Delete
Remove-Item "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json"

# Restart the server (will create an empty library)
```

---

## 🐛 Troubleshooting

### Problem: "Notebook not found in library"

**Cause:** No notebook configured or incorrect ID

**Solution:**

```bash
# List available notebooks
curl http://localhost:3000/notebooks

# Verify the exact ID
# Use notebook_url directly if needed
curl -X POST http://localhost:3000/ask \
  -d '{
    "question": "...",
    "notebook_url": "https://notebooklm.google.com/notebook/xxx"
  }'
```

### Problem: Validation fails during addition

**Cause:** Inaccessible notebook or invalid URL

**Solution:**

1. Verify that you are authenticated: `npm run setup-auth`
2. Test the URL manually in Chrome
3. Check notebook permissions (shared with your account?)
4. Copy the URL directly from the address bar

### Problem: "A notebook with the name 'X' already exists"

**Cause:** Duplicate name

**Solutions:**

```bash
# Option 1: Use a different name
curl -X POST http://localhost:3000/notebooks \
  -d '{"name": "Parents et Numérique v2", ...}'

# Option 2: Delete the old one
curl -X DELETE http://localhost:3000/notebooks/parents-numerique

# Option 3: Update the existing one (coming soon)
# PUT /notebooks/cnv
```

### Problem: Corrupted library.json

**Symptoms:** JSON errors at startup

**Solution:**

```powershell
# Restore from backup if available
Copy-Item "$env:LOCALAPPDATA\notebooklm-mcp\Data\library-backup.json" `
    -Destination "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json"

# Or delete and reset
Remove-Item "$env:LOCALAPPDATA\notebooklm-mcp\Data\library.json"
# Restart the server
```

---

## 📝 Complete Examples

### PowerShell Script: Add Multiple Notebooks

```powershell
#!/usr/bin/env pwsh

# Configuration
$baseUrl = "http://localhost:3000"

# List of notebooks to add
$notebooks = @(
    @{
        url = "https://notebooklm.google.com/notebook/505ee4b1-ad05-4673-a06b-1ec106c2b940"
        name = "Parents et Numérique"
        description = "Conseils pour parents à l'ère du numérique"
        topics = @("parentalité", "numérique", "éducation")
    },
    @{
        url = "https://notebooklm.google.com/notebook/19bde485-a9c1-4809-8884-e872b2b67b44"
        name = "Shakespeare"
        description = "William Shakespeare - L'intégrale des pièces"
        topics = @("littérature", "théâtre", "Shakespeare")
    }
)

# Add each notebook
foreach ($notebook in $notebooks) {
    Write-Host "Adding notebook: $($notebook.name)..." -ForegroundColor Cyan

    $body = $notebook | ConvertTo-Json

    try {
        $result = Invoke-RestMethod `
            -Uri "$baseUrl/notebooks" `
            -Method Post `
            -Body $body `
            -ContentType "application/json"

        Write-Host "✅ Added: $($result.data.notebook.id)" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}

# List all notebooks
Write-Host "`nNotebooks in library:" -ForegroundColor Cyan
$list = Invoke-RestMethod -Uri "$baseUrl/notebooks"
$list.data.notebooks | Format-Table id, name, use_count, active
```

### n8n Script: Workflow with Notebook Selection

```json
{
  "nodes": [
    {
      "name": "Select Notebook",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "PUT",
        "url": "http://localhost:3000/notebooks/{{$json[\"notebook_id\"]}}/activate"
      }
    },
    {
      "name": "Ask Question",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://localhost:3000/ask",
        "jsonParameters": true,
        "bodyParametersJson": {
          "question": "{{$json[\"question\"]}}"
        }
      }
    }
  ]
}
```

---

**Complete library guide!** ✅

For more information, see:

- [03-API.md](./03-API.md) - Complete API reference
- [01-INSTALL.md](./01-INSTALL.md) - Installation guide
- [05-TROUBLESHOOTING.md](./05-TROUBLESHOOTING.md) - Troubleshooting
