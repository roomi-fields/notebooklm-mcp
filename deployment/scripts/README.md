# Test and Configuration Scripts

> PowerShell scripts to test and configure the NotebookLM MCP HTTP Server

---

## 📋 Available Scripts

| Script            | Description                                     | Duration |
| ----------------- | ----------------------------------------------- | -------- |
| `setup-auth.ps1`  | Google authentication configuration             | 2-3 min  |
| `test-server.ps1` | Quick validation tests (3 basic tests)          | ~30 sec  |
| `test-api.ps1`    | Complete tests of all endpoints (success cases) | 5-10 min |
| `test-errors.ps1` | Error case tests                                | 2-5 min  |

---

## 🔐 setup-auth.ps1

Configures Google authentication to access NotebookLM.

### Usage

```powershell
.\deployment\scripts\setup-auth.ps1
```

### What happens

1. Checks if authentication already exists
   - If yes: asks for confirmation to reset
   - If no: continues
2. Opens Chrome (visible)
3. You must log in to Google and go to notebooklm.google.com
4. Close Chrome when you see your notebooks
5. The script verifies that the files have been created

### Created files

```
%LOCALAPPDATA%\notebooklm-mcp\Data\
├── chrome_profile\Default\Network\Cookies  (>10 KB)
└── browser_state\state.json                (16 cookies)
```

### Options

```powershell
# Interactive mode (default)
.\deployment\scripts\setup-auth.ps1

# Force reset without asking
.\deployment\scripts\setup-auth.ps1 -Force
```

---

## ⚡ test-server.ps1

Quick validation tests to verify that the server is working correctly.

### Prerequisites

- The HTTP server must be started

### Usage

```powershell
# Start the server in a first terminal
npm run start:http

# In a second terminal, run the quick test
.\deployment\scripts\test-server.ps1
```

### Tests performed (3)

1. ✅ GET /health - Server health
2. ✅ GET /notebooks - Notebook list
3. ⚠️ POST /ask - Ask a question (optional, requires auth + notebook)

### Options

```powershell
# Default server (localhost:3000)
.\deployment\scripts\test-server.ps1

# Server on a different port
.\deployment\scripts\test-server.ps1 -BaseUrl "http://localhost:8080"

# Remote server
.\deployment\scripts\test-server.ps1 -BaseUrl "http://192.168.1.100:3000"
```

### Output

```
╔══════════════════════════════════════════════════════════╗
║  NotebookLM MCP - Quick Validation Tests                ║
╚══════════════════════════════════════════════════════════╝

Server tested: http://localhost:3000

Test 1: Health Check
  GET http://localhost:3000/health
  ✅ PASS - Server operational
     Authenticated: True
     Sessions: 0
     Notebooks: 2

Test 2: List Notebooks
  GET http://localhost:3000/notebooks
  ✅ PASS - Endpoint working
     Notebooks found: 2

Test 3: Ask Question (authentication + notebook required)
  POST http://localhost:3000/ask
  Using notebook: cnv
  ✅ PASS - Question processed
     Answer length: 42 chars
     Session ID: abc123

════════════════════════════════════════════════════════════

✅ ALL TESTS PASSED!

📖 Next steps:
   - Check API documentation: .\deployment\docs\03-API.md
   - Integrate with n8n: .\deployment\docs\04-N8N-INTEGRATION.md
```

### Duration

- **~30 seconds** if authenticated with notebooks
- **~5 seconds** if no notebooks (skip test 3)

### Use cases

**Quick check after installation:**

```powershell
npm run start:http
.\deployment\scripts\test-server.ps1
```

**CI/CD - Quick health check:**

```yaml
- name: Quick Health Check
  run: |
    npm run start:http &
    sleep 5
    pwsh -File deployment/scripts/test-server.ps1
```

---

## ✅ test-api.ps1

Complete tests of all API endpoints (success cases).

### Prerequisites

- The HTTP server must be started
- At least 1 configured notebook (for complete tests)

### Usage

```powershell
# Start the server in a first terminal
npm run start:http

# In a second terminal, run the tests
.\deployment\scripts\test-api.ps1
```

### Tests performed (10)

1. ✅ GET /health - Server health
2. ✅ GET /notebooks - Notebook list
3. ✅ GET /notebooks/:id - Notebook details
4. ✅ PUT /notebooks/:id/activate - Activate a notebook
5. ✅ POST /ask (without notebook_id) - Uses active notebook
6. ✅ GET /sessions - Session list
7. ✅ POST /ask (with session_id) - Continue a conversation
8. ✅ DELETE /sessions/:id - Close a session
9. ✅ POST /ask (with notebook_url) - Direct URL
10. ✅ DELETE /notebooks/:id - Delete a notebook

### Options

```powershell
# Default server (localhost:3000)
.\deployment\scripts\test-api.ps1

# Server on a different port
.\deployment\scripts\test-api.ps1 -BaseUrl "http://localhost:8080"

# Remote server
.\deployment\scripts\test-api.ps1 -BaseUrl "http://192.168.1.100:3000"
```

### Output

```
╔════════════════════════════════════════════════════════╗
║      NOTEBOOKLM MCP HTTP SERVER API TESTS             ║
╚════════════════════════════════════════════════════════╝

✓ Server accessible at http://localhost:3000

═══════════════════════════════════════════════════════
 [1/10] GET /health - Server health check
═══════════════════════════════════════════════════════
✓ Server healthy
...

╔════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                        ║
╚════════════════════════════════════════════════════════╝

Total tests: 10
Passed tests: 10
Failed tests: 0
Success rate: 100%

════════════════════════════════════════════════════════
  ✓ ALL TESTS PASSED SUCCESSFULLY!
════════════════════════════════════════════════════════
```

### Duration

- **Without configured notebooks:** ~1 minute (partial tests)
- **With notebooks:** ~5-10 minutes (complete tests with NotebookLM questions)

### Special behaviors

- **Skips tests** if no notebook is configured
- **Does not delete** your only notebook
- **Prefers to delete** test notebooks (suffix -1, -2, etc.)
- **Reuses data** between tests (session_id, notebook_id)

---

## ❌ test-errors.ps1

Error case tests (validation of error messages).

### Prerequisites

- The HTTP server must be started

### Usage

```powershell
# Start the server
npm run start:http

# Run error tests
.\deployment\scripts\test-errors.ps1
```

### Tests performed (12)

1. ❌ POST /ask - Missing question
2. ❌ POST /ask - Non-existent notebook_id
3. ❌ POST /ask - No configured notebook
4. ❌ POST /notebooks - Missing URL
5. ❌ POST /notebooks - Missing name
6. ❌ POST /notebooks - Invalid URL format
7. ❌ POST /notebooks - Name already in use (duplicate)
8. ❌ POST /notebooks - Inaccessible notebook (live validation)
9. ❌ GET /notebooks/:id - Non-existent notebook
10. ❌ DELETE /notebooks/:id - Non-existent notebook
11. ❌ PUT /notebooks/:id/activate - Non-existent notebook
12. ❌ DELETE /sessions/:id - Non-existent session

### Options

```powershell
# Default server (localhost:3000)
.\deployment\scripts\test-errors.ps1

# Remote server
.\deployment\scripts\test-errors.ps1 -BaseUrl "http://192.168.1.100:3000"
```

### Output

```
╔════════════════════════════════════════════════════════╗
║         ERROR CASE TESTS - HTTP API                    ║
╚════════════════════════════════════════════════════════╝

✓ Server accessible at http://localhost:3000

═══════════════════════════════════════════════════════
 [1/12] POST /ask - Error: missing question
═══════════════════════════════════════════════════════
✓ Expected error: Missing required field: question
✓ Correct error message (mentions 'question')
...

╔════════════════════════════════════════════════════════╗
║              ERROR TEST SUMMARY                        ║
╚════════════════════════════════════════════════════════╝

Total tests: 12
Passed tests: 10
Failed tests: 0
Skipped tests: 2
Success rate: 100%

════════════════════════════════════════════════════════
  ✓ ALL ERROR CASES ARE HANDLED CORRECTLY!
════════════════════════════════════════════════════════
```

### Duration

- **~2-5 minutes** (includes 1 live validation test that takes 15-30s)

### Skipped tests

Some tests may be skipped if conditions are not met:

- **Test 3** (no notebook): skipped if you have configured notebooks
- **Test 7** (duplicate): skipped if no notebook exists

---

## 🚀 Complete Test Workflow

### 1. Installation and Configuration

```powershell
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run build

# 3. Configure authentication
.\deployment\scripts\setup-auth.ps1
```

### 2. Add a Notebook

```powershell
# Start the server
npm run start:http

# In another terminal
$body = @{
    url = "https://notebooklm.google.com/notebook/YOUR-NOTEBOOK-ID"
    name = "My Notebook"
    description = "My notebook description"
    topics = @("topic1", "topic2")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/notebooks" `
    -Method Post -Body $body -ContentType "application/json"
```

### 3. Run the Tests

```powershell
# Success tests (5-10 min)
.\deployment\scripts\test-api.ps1

# Error tests (2-5 min)
.\deployment\scripts\test-errors.ps1
```

### 4. Expected Results

✅ **test-api.ps1**: 100% success (10/10 tests)
✅ **test-errors.ps1**: 100% success (10-12/12 tests)

---

## 🐛 Troubleshooting

### Error: "Unable to connect to server"

**Cause:** The server is not started

**Solution:**

```powershell
# Check that the server is running
Get-Process node

# If not, start it
npm run start:http
```

### Error: "No configured notebook"

**Cause:** Empty library

**Solution:** Add at least one notebook (see section 2 above)

### Skipped tests in test-api.ps1

**Normal** if you don't have configured notebooks. Tests that require notebooks will be skipped with an informative message.

### Skipped tests in test-errors.ps1

**Normal** depending on your configuration:

- "No notebook" test skipped if you have notebooks
- "Duplicate" test skipped if you don't have notebooks

### Port already in use

**Error:** `EADDRINUSE: address already in use`

**Solution:**

```powershell
# Change the port
$env:HTTP_PORT="8080"
npm run start:http

# Then test
.\deployment\scripts\test-api.ps1 -BaseUrl "http://localhost:8080"
```

---

## 📊 Exit Codes

The scripts return standard exit codes:

| Code | Meaning                  |
| ---- | ------------------------ |
| `0`  | All tests passed         |
| `1`  | At least one test failed |

**Usage in CI/CD:**

```powershell
# Run tests and capture exit code
.\deployment\scripts\test-api.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Tests failed!"
    exit 1
}
```

---

## 🎯 Best Practices

### Before Committing

```powershell
# 1. Build
npm run build

# 2. Test success
.\deployment\scripts\test-api.ps1

# 3. Test errors
.\deployment\scripts\test-errors.ps1

# 4. If everything is green, commit
git add .
git commit -m "your message"
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Run API Tests
  run: |
    npm run start:http &
    sleep 10
    pwsh -File deployment/scripts/test-api.ps1
    pwsh -File deployment/scripts/test-errors.ps1
```

### Production

**DO NOT run these tests in production**:

- Tests create/delete notebooks
- Tests create/close sessions
- Tests ask questions to NotebookLM

**To check health in production:**

```powershell
# Simple health check
Invoke-RestMethod -Uri "http://YOUR-SERVER:3000/health"
```

---

## 📝 Customization

### Modify Test Questions

In `test-api.ps1`, change the questions:

```powershell
# Line ~247
$body = @{
    question = "Your custom question"
} | ConvertTo-Json
```

### Add Tests

Copy the existing pattern:

```powershell
Write-TestHeader "Your new test" X $TotalTests

try {
    # Your test code
    $result = Invoke-RestMethod -Uri "$BaseUrl/your-endpoint"

    if ($result.success) {
        Write-Success "Test passed"
        $PassedTests++
    } else {
        Write-Error-Custom "Test failed"
        $FailedTests++
    }
} catch {
    Write-Error-Custom "Error: $_"
    $FailedTests++
}
```

### Custom Timeout

```powershell
# For long tests (NotebookLM questions)
$result = Invoke-RestMethod `
    -Uri "$BaseUrl/ask" `
    -Method Post `
    -Body $body `
    -ContentType "application/json" `
    -TimeoutSec 120  # 2 minutes
```

---

## 📖 Complete Documentation

For more information, see:

- [01-INSTALL.md](../docs/01-INSTALL.md) - Installation guide
- [03-API.md](../docs/03-API.md) - Complete API reference
- [05-TROUBLESHOOTING.md](../docs/05-TROUBLESHOOTING.md) - Troubleshooting

---

**Scripts created for NotebookLM MCP HTTP Server v1.1.2**
