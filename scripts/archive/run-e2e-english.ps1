# E2E Tests with English account (rom1pey)
# Using notebook: rom1pey-english-test

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  E2E Tests - English Account (rom1pey)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify active notebook
Write-Host "Active notebook check..."
$notebooks = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method GET
Write-Host "Active: $($notebooks.data.active_notebook_id)"

$passed = 0
$failed = 0

# Test 1: Health check
Write-Host "`n=== TEST 1: Health ===" -ForegroundColor Yellow
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
    $askBody = @{ question = "What is this about?" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $askBody -TimeoutSec 60
    if ($response.success) {
        Write-Host "  PASSED: Got response" -ForegroundColor Green
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
        url = "https://en.wikipedia.org/wiki/Nonviolent_Communication"
    } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $urlBody -TimeoutSec 120
    if ($response.success) {
        Write-Host "  PASSED: Source added" -ForegroundColor Green
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
        text = "This is a test source for E2E testing. It contains some sample text about communication and testing."
        name = "E2E Test Text Source"
    } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $textBody -TimeoutSec 120
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
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content" -Method GET -TimeoutSec 60
    if ($response.success) {
        Write-Host "  PASSED: Got content list" -ForegroundColor Green
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
