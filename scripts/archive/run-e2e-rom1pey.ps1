# E2E Tests with account-c account using the notebook we just created
# Notebook: e2e-account-c-test (725d28e1-4284-4f36-99a2-b6693c2ebf13)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  E2E Tests - Rom1pey Account" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Activate the notebook
Write-Host "Activating e2e-account-c-test notebook..."
$activateResponse = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/e2e-account-c-test/activate" -Method PUT -TimeoutSec 30
Write-Host "Activated: $($activateResponse.success)"

# Verify active notebook
$notebooks = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method GET
Write-Host "Active: $($notebooks.data.active_notebook_id)"
Write-Host ""

$passed = 0
$failed = 0

# Test 1: Health check
Write-Host "=== TEST 1: Health ===" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health"
    if ($health.success -and $health.data.authenticated) {
        Write-Host "  PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAILED: Not authenticated" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 2: Ask question
Write-Host "`n=== TEST 2: Ask question ===" -ForegroundColor Yellow
try {
    $askBody = @{ question = "What is this notebook about?" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $askBody -TimeoutSec 90
    if ($response.success -and $response.data.answer) {
        Write-Host "  PASSED: Got response" -ForegroundColor Green
        Write-Host "  Answer: $($response.data.answer.Substring(0, [Math]::Min(100, $response.data.answer.Length)))..."
        $passed++
    } else {
        Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 3: Add URL source
Write-Host "`n=== TEST 3: Add URL source ===" -ForegroundColor Yellow
try {
    $urlBody = @{
        source_type = "url"
        url = "https://en.wikipedia.org/wiki/Hello_World"
    } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $urlBody -TimeoutSec 180
    if ($response.success) {
        Write-Host "  PASSED: URL source added" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 4: Add text source
Write-Host "`n=== TEST 4: Add text source ===" -ForegroundColor Yellow
try {
    $textBody = @{
        source_type = "text"
        text = "This is a test text source for E2E testing. It contains information about testing methodologies and best practices for automated tests."
        name = "E2E Test Text"
    } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $textBody -TimeoutSec 180
    if ($response.success) {
        Write-Host "  PASSED: Text source added" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 5: Get content list
Write-Host "`n=== TEST 5: Get content list ===" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content" -Method GET -TimeoutSec 90
    if ($response.success) {
        Write-Host "  PASSED: Got content list ($($response.data.sources.Count) sources)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $passed passed, $failed failed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
