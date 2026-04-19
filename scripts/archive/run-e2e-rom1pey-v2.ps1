# E2E Tests v2 - Better order: add sources first, then ask questions
# Notebook: e2e-agent-tertiary-test (00000000-0000-0000-0000-000000000107)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  E2E Tests v2 - Rom1pey Account" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Activate the notebook
Write-Host "Activating e2e-agent-tertiary-test notebook..."
Invoke-RestMethod -Uri "http://localhost:3000/notebooks/e2e-agent-tertiary-test/activate" -Method PUT -TimeoutSec 30 | Out-Null
Write-Host "Active notebook: e2e-agent-tertiary-test"
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

# Test 2: Add text source FIRST (more reliable)
Write-Host "`n=== TEST 2: Add text source ===" -ForegroundColor Yellow
try {
    $textBody = @{
        source_type = "text"
        text = "This is a comprehensive test document about software testing and quality assurance. It covers unit testing, integration testing, end-to-end testing, and performance testing methodologies. Testing is essential for ensuring software reliability and user satisfaction."
        name = "E2E Test Document"
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

# Wait for source to be processed
Write-Host "`nWaiting 5 seconds for source processing..."
Start-Sleep -Seconds 5

# Test 3: Ask question (now that we have a source)
Write-Host "`n=== TEST 3: Ask question ===" -ForegroundColor Yellow
try {
    $askBody = @{ question = "What types of testing are mentioned in the sources?" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $askBody -TimeoutSec 120
    if ($response.success -and $response.data.answer) {
        Write-Host "  PASSED: Got response" -ForegroundColor Green
        $answerPreview = $response.data.answer.Substring(0, [Math]::Min(150, $response.data.answer.Length))
        Write-Host "  Answer: $answerPreview..."
        $passed++
    } else {
        Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 4: Add URL source
Write-Host "`n=== TEST 4: Add URL source ===" -ForegroundColor Yellow
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

# Test 5: Get content list
Write-Host "`n=== TEST 5: Get content list ===" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content" -Method GET -TimeoutSec 90
    if ($response.success) {
        $sourceCount = 0
        if ($response.data.sources) {
            $sourceCount = $response.data.sources.Count
        }
        Write-Host "  PASSED: Got content list ($sourceCount sources)" -ForegroundColor Green
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
