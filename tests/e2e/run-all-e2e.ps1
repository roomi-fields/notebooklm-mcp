# NotebookLM MCP - Complete E2E Test Suite
# Runs all endpoint tests and reports results

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000"
$Results = @()
$Passed = 0
$Failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [int]$Timeout = 30
    )

    Write-Host "`n=== TEST: $Name ===" -ForegroundColor Cyan

    try {
        $params = @{
            Uri = "$BaseUrl$Endpoint"
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = $Timeout
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-RestMethod @params

        if ($response.success -eq $true) {
            Write-Host "  PASSED" -ForegroundColor Green
            $script:Passed++
            return @{ Name = $Name; Status = "PASSED"; Response = $response }
        } else {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            $script:Failed++
            return @{ Name = $Name; Status = "FAILED"; Error = $response.error }
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $script:Failed++
        return @{ Name = $Name; Status = "ERROR"; Error = $_.ToString() }
    }
}

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  NotebookLM MCP E2E Test Suite v1.4.2" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "`nStarting tests at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

# ============================================================================
# HEALTH & BASIC ENDPOINTS (No Browser Required)
# ============================================================================
Write-Host "`n--- HEALTH & BASIC ENDPOINTS ---" -ForegroundColor Magenta

$Results += Test-Endpoint -Name "GET /health" -Method GET -Endpoint "/health"
$Results += Test-Endpoint -Name "GET /notebooks" -Method GET -Endpoint "/notebooks"
$Results += Test-Endpoint -Name "GET /notebooks/stats" -Method GET -Endpoint "/notebooks/stats"
$Results += Test-Endpoint -Name "GET /notebooks/search" -Method GET -Endpoint "/notebooks/search?query=test"
$Results += Test-Endpoint -Name "GET /sessions" -Method GET -Endpoint "/sessions"

# ============================================================================
# NOTEBOOK OPERATIONS
# ============================================================================
Write-Host "`n--- NOTEBOOK OPERATIONS ---" -ForegroundColor Magenta

$Results += Test-Endpoint -Name "GET /notebooks/:id" -Method GET -Endpoint "/notebooks/notebook-1"
$Results += Test-Endpoint -Name "PUT /notebooks/:id (update)" -Method PUT -Endpoint "/notebooks/notebook-1" -Body @{
    description = "Updated via E2E test at $(Get-Date -Format 'HH:mm:ss')"
}
$Results += Test-Endpoint -Name "PUT /notebooks/:id/activate" -Method PUT -Endpoint "/notebooks/notebook-1/activate"

# ============================================================================
# BROWSER-BASED ENDPOINTS (Require Authentication)
# ============================================================================
Write-Host "`n--- BROWSER-BASED ENDPOINTS ---" -ForegroundColor Magenta

# Ask question
$Results += Test-Endpoint -Name "POST /ask" -Method POST -Endpoint "/ask" -Body @{
    question = "What is the main topic?"
} -Timeout 120

# List content
$Results += Test-Endpoint -Name "GET /content" -Method GET -Endpoint "/content" -Timeout 60

# Add text source
$Results += Test-Endpoint -Name "POST /content/sources (text)" -Method POST -Endpoint "/content/sources" -Body @{
    source_type = "text"
    content = "This is a test source added via E2E testing at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'). It contains sample content for validation purposes."
    title = "E2E Test Source"
} -Timeout 120

# Add URL source
$Results += Test-Endpoint -Name "POST /content/sources (url)" -Method POST -Endpoint "/content/sources" -Body @{
    source_type = "url"
    url = "https://en.wikipedia.org/wiki/Nonviolent_Communication"
} -Timeout 180

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================
Write-Host "`n--- SESSION MANAGEMENT ---" -ForegroundColor Magenta

# Get active sessions first
$sessions = Invoke-RestMethod -Uri "$BaseUrl/sessions" -Method GET
if ($sessions.data.sessions.Count -gt 0) {
    $sessionId = $sessions.data.sessions[0].id
    $Results += Test-Endpoint -Name "POST /sessions/:id/reset" -Method POST -Endpoint "/sessions/$sessionId/reset"
}

# ============================================================================
# RESULTS SUMMARY
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

Write-Host "`nPassed: $Passed" -ForegroundColor Green
Write-Host "Failed: $Failed" -ForegroundColor Red
Write-Host "Total:  $($Passed + $Failed)"

$SuccessRate = if (($Passed + $Failed) -gt 0) { [math]::Round(($Passed / ($Passed + $Failed)) * 100, 1) } else { 0 }
Write-Host "`nSuccess Rate: $SuccessRate%"

if ($Failed -gt 0) {
    Write-Host "`nFailed Tests:" -ForegroundColor Red
    $Results | Where-Object { $_.Status -ne "PASSED" } | ForEach-Object {
        Write-Host "  - $($_.Name): $($_.Error)" -ForegroundColor Red
    }
}

Write-Host "`nCompleted at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Return exit code based on results
if ($Failed -eq 0) {
    exit 0
} else {
    exit 1
}
