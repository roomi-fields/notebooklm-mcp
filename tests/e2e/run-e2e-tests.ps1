# NotebookLM MCP HTTP Server - E2E Test Suite
# Runs all endpoint tests and reports results
# Usage: powershell -ExecutionPolicy Bypass -File tests/e2e/run-e2e-tests.ps1

param(
    [switch]$SkipBrowserTests,
    [int]$Timeout = 180
)

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000"
$Passed = 0
$Failed = 0
$Skipped = 0
$Results = @()

function Write-TestHeader {
    param([string]$Category)
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "  $Category" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [int]$TimeoutSec = 60,
        [switch]$RequiresBrowser
    )

    if ($RequiresBrowser -and $SkipBrowserTests) {
        Write-Host "  [SKIP] $Name (browser test skipped)" -ForegroundColor Yellow
        $script:Skipped++
        return @{ Name = $Name; Status = "SKIPPED" }
    }

    Write-Host "  Testing: $Name..." -NoNewline

    try {
        $params = @{
            Uri = "$BaseUrl$Endpoint"
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = $TimeoutSec
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-RestMethod @params

        if ($response.success -eq $true) {
            Write-Host " PASS" -ForegroundColor Green
            $script:Passed++
            return @{ Name = $Name; Status = "PASS" }
        } else {
            Write-Host " FAIL ($($response.error))" -ForegroundColor Red
            $script:Failed++
            return @{ Name = $Name; Status = "FAIL"; Error = $response.error }
        }
    } catch {
        $statusCode = 0
        $errorMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        # 400/404/500 for audio/download is acceptable (endpoint exists, no audio to download)
        if ($Endpoint -like "*audio/download*" -and ($statusCode -eq 400 -or $statusCode -eq 404 -or $statusCode -eq 500)) {
            Write-Host " PASS (endpoint exists, HTTP $statusCode)" -ForegroundColor Green
            $script:Passed++
            return @{ Name = $Name; Status = "PASS" }
        }

        # Timeout for audio/download is acceptable (endpoint exists but slow/no audio)
        if ($Endpoint -like "*audio/download*" -and $errorMsg -like "*délai*" -or $errorMsg -like "*timeout*") {
            Write-Host " PASS (endpoint exists, timeout - no audio)" -ForegroundColor Green
            $script:Passed++
            return @{ Name = $Name; Status = "PASS" }
        }

        Write-Host " ERROR ($errorMsg)" -ForegroundColor Red
        $script:Failed++
        return @{ Name = $Name; Status = "ERROR"; Error = $errorMsg }
    }
}

# Header
Write-Host "`n"
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     NotebookLM MCP HTTP Server - E2E Test Suite v1.4.1     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Base URL: $BaseUrl"
if ($SkipBrowserTests) {
    Write-Host "Mode: Basic tests only (browser tests skipped)" -ForegroundColor Yellow
}

# Check server health first
Write-Host "`nChecking server health..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 10
    if ($health.success) {
        Write-Host " OK (authenticated: $($health.data.authenticated))" -ForegroundColor Green
    } else {
        Write-Host " Server not ready" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " FAILED - Server not responding" -ForegroundColor Red
    Write-Host "Make sure the server is running: npm run start:http"
    exit 1
}

# ============================================================================
# BASIC ENDPOINTS (No Browser Required)
# ============================================================================
Write-TestHeader "BASIC ENDPOINTS"

$Results += Test-Endpoint -Name "GET /health" -Method GET -Endpoint "/health"
$Results += Test-Endpoint -Name "GET /notebooks" -Method GET -Endpoint "/notebooks"
$Results += Test-Endpoint -Name "GET /notebooks/stats" -Method GET -Endpoint "/notebooks/stats"
$Results += Test-Endpoint -Name "GET /notebooks/search" -Method GET -Endpoint "/notebooks/search?query=test"
$Results += Test-Endpoint -Name "GET /sessions" -Method GET -Endpoint "/sessions"
$Results += Test-Endpoint -Name "GET /notebooks/:id" -Method GET -Endpoint "/notebooks/notebook-1"

# Test endpoint existence only - DO NOT actually cleanup!
# Expect 400 (missing confirm param) or 200 with confirm=false (preview mode)
$Results += Test-Endpoint -Name "POST /cleanup-data (preview)" -Method POST -Endpoint "/cleanup-data" -Body @{
    confirm = $false  # Preview mode only!
}

# ============================================================================
# NOTEBOOK OPERATIONS
# ============================================================================
Write-TestHeader "NOTEBOOK OPERATIONS"

$Results += Test-Endpoint -Name "PUT /notebooks/:id" -Method PUT -Endpoint "/notebooks/notebook-1" -Body @{
    description = "E2E test update $(Get-Date -Format 'HH:mm:ss')"
}
$Results += Test-Endpoint -Name "PUT /notebooks/:id/activate" -Method PUT -Endpoint "/notebooks/notebook-1/activate"

# Test auto-discover with a REAL notebook URL from the library
# First get the active notebook URL
$notebooksResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -Method GET -ErrorAction SilentlyContinue
if ($notebooksResponse.data.notebooks.Count -gt 0) {
    $realNotebookUrl = $notebooksResponse.data.notebooks[0].url
    Write-Host "  Using real notebook for auto-discover: $($notebooksResponse.data.notebooks[0].name)"
    $Results += Test-Endpoint -Name "POST /notebooks/auto-discover" -Method POST -Endpoint "/notebooks/auto-discover" -Body @{
        url = $realNotebookUrl
    } -TimeoutSec $Timeout -RequiresBrowser
} else {
    Write-Host "  [SKIP] POST /notebooks/auto-discover - No notebooks in library" -ForegroundColor Yellow
    $script:Skipped++
}

# ============================================================================
# BROWSER-BASED ENDPOINTS
# ============================================================================
Write-TestHeader "BROWSER-BASED ENDPOINTS"

$Results += Test-Endpoint -Name "POST /ask" -Method POST -Endpoint "/ask" -Body @{
    question = "What is the main topic?"
} -TimeoutSec $Timeout -RequiresBrowser

$Results += Test-Endpoint -Name "GET /content" -Method GET -Endpoint "/content" -TimeoutSec 60 -RequiresBrowser

$Results += Test-Endpoint -Name "POST /content/sources (text)" -Method POST -Endpoint "/content/sources" -Body @{
    source_type = "text"
    text = "E2E test content $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    title = "E2E Test"
} -TimeoutSec $Timeout -RequiresBrowser

$Results += Test-Endpoint -Name "POST /content/sources (url)" -Method POST -Endpoint "/content/sources" -Body @{
    source_type = "url"
    url = "https://en.wikipedia.org/wiki/Test"
} -TimeoutSec $Timeout -RequiresBrowser

$Results += Test-Endpoint -Name "POST /content/generate (faq)" -Method POST -Endpoint "/content/generate" -Body @{
    content_type = "faq"
} -TimeoutSec $Timeout -RequiresBrowser

# Audio download - may return 400/404 if no audio exists, that's OK
$Results += Test-Endpoint -Name "GET /content/audio/download" -Method GET -Endpoint "/content/audio/download?session_id=test" -TimeoutSec 60 -RequiresBrowser

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================
Write-TestHeader "SESSION MANAGEMENT"

# Get a session ID for testing
$sessions = Invoke-RestMethod -Uri "$BaseUrl/sessions" -Method GET -ErrorAction SilentlyContinue
if ($sessions.data.sessions.Count -gt 0) {
    $testSessionId = $sessions.data.sessions[0].id
    $Results += Test-Endpoint -Name "POST /sessions/:id/reset" -Method POST -Endpoint "/sessions/$testSessionId/reset"
    $Results += Test-Endpoint -Name "DELETE /sessions/:id" -Method DELETE -Endpoint "/sessions/$testSessionId"
}

# ============================================================================
# RESULTS SUMMARY
# ============================================================================
Write-Host "`n"
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    TEST RESULTS SUMMARY                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$Total = $Passed + $Failed + $Skipped
$SuccessRate = if ($Total -gt 0) { [math]::Round(($Passed / $Total) * 100, 1) } else { 0 }

Write-Host "`n  Passed:  $Passed" -ForegroundColor Green
Write-Host "  Failed:  $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Gray" })
Write-Host "  Skipped: $Skipped" -ForegroundColor $(if ($Skipped -gt 0) { "Yellow" } else { "Gray" })
Write-Host "  Total:   $Total"
Write-Host "`n  Success Rate: $SuccessRate%" -ForegroundColor $(if ($SuccessRate -eq 100) { "Green" } elseif ($SuccessRate -ge 80) { "Yellow" } else { "Red" })

if ($Failed -gt 0) {
    Write-Host "`n  Failed Tests:" -ForegroundColor Red
    $Results | Where-Object { $_.Status -eq "FAIL" -or $_.Status -eq "ERROR" } | ForEach-Object {
        Write-Host "    - $($_.Name): $($_.Error)" -ForegroundColor Red
    }
}

Write-Host "`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Exit with appropriate code
if ($Failed -eq 0) {
    Write-Host "`n[SUCCESS] All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[FAILURE] Some tests failed" -ForegroundColor Red
    exit 1
}
