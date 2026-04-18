# E2E Tests for Read-Only Endpoints
# Tests all GET endpoints and non-destructive operations

$baseUrl = "http://localhost:3000"
$results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [string]$Body = $null
    )

    Write-Host "`n[$Method] $Endpoint" -ForegroundColor Cyan

    try {
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = 30
        }

        if ($Body) {
            $params.Body = $Body
        }

        $response = Invoke-RestMethod @params
        $success = $response.success -eq $true

        if ($success) {
            Write-Host "  PASS" -ForegroundColor Green
        } else {
            Write-Host "  FAIL: $($response.error)" -ForegroundColor Red
        }

        return @{
            Name = $Name
            Endpoint = "$Method $Endpoint"
            Status = if ($success) { "PASS" } else { "FAIL" }
            Details = if ($success) { "OK" } else { $response.error }
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        return @{
            Name = $Name
            Endpoint = "$Method $Endpoint"
            Status = "ERROR"
            Details = $_.Exception.Message
        }
    }
}

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  E2E Tests - Read-Only Endpoints" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# 1. Health Check
$results += Test-Endpoint -Name "Health Check" -Method "GET" -Endpoint "/health"

# 2. List Notebooks
$results += Test-Endpoint -Name "List Notebooks" -Method "GET" -Endpoint "/notebooks"

# 3. Get Library Stats
$results += Test-Endpoint -Name "Library Stats" -Method "GET" -Endpoint "/notebooks/stats"

# 4. Search Notebooks
$results += Test-Endpoint -Name "Search Notebooks" -Method "GET" -Endpoint "/notebooks/search?query=test"

# 5. Get Specific Notebook (using known notebook ID from library)
$results += Test-Endpoint -Name "Get Notebook" -Method "GET" -Endpoint "/notebooks/notebook-2"

# 6. List Sessions
$results += Test-Endpoint -Name "List Sessions" -Method "GET" -Endpoint "/sessions"

# 7. Ask Question (using IFS notebook - read only operation)
Write-Host "`n[POST] /ask (CNV notebook)" -ForegroundColor Cyan
try {
    $askBody = @{
        question = "What is the main topic of this notebook?"
        notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000112"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/ask" -Method POST -ContentType "application/json" -Body $askBody -TimeoutSec 120

    if ($response.success) {
        Write-Host "  PASS - Answer received ($(($response.data.answer).Length) chars)" -ForegroundColor Green
        $results += @{
            Name = "Ask Question"
            Endpoint = "POST /ask"
            Status = "PASS"
            Details = "Answer: $(($response.data.answer).Substring(0, [Math]::Min(50, ($response.data.answer).Length)))..."
        }
    } else {
        Write-Host "  FAIL: $($response.error)" -ForegroundColor Red
        $results += @{
            Name = "Ask Question"
            Endpoint = "POST /ask"
            Status = "FAIL"
            Details = $response.error
        }
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
    $results += @{
        Name = "Ask Question"
        Endpoint = "POST /ask"
        Status = "ERROR"
        Details = $_.Exception.Message
    }
}

# 8. List Content (sources and generated content)
Write-Host "`n[GET] /content (list sources)" -ForegroundColor Cyan
try {
    $contentBody = @{
        notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000112"
    } | ConvertTo-Json

    # Note: This might need a session, let's try with notebook_url
    $response = Invoke-RestMethod -Uri "$baseUrl/content" -Method GET -TimeoutSec 60

    if ($response.success) {
        $sourceCount = ($response.data.sources | Measure-Object).Count
        Write-Host "  PASS - Found $sourceCount sources" -ForegroundColor Green
        $results += @{
            Name = "List Content"
            Endpoint = "GET /content"
            Status = "PASS"
            Details = "Sources: $sourceCount"
        }
    } else {
        Write-Host "  FAIL: $($response.error)" -ForegroundColor Red
        $results += @{
            Name = "List Content"
            Endpoint = "GET /content"
            Status = "FAIL"
            Details = $response.error
        }
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
    $results += @{
        Name = "List Content"
        Endpoint = "GET /content"
        Status = "ERROR"
        Details = $_.Exception.Message
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  RESULTS SUMMARY" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$passed = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$errors = ($results | Where-Object { $_.Status -eq "ERROR" }).Count

Write-Host "`nTotal: $($results.Count) tests"
Write-Host "  PASS:  $passed" -ForegroundColor Green
Write-Host "  FAIL:  $failed" -ForegroundColor Red
Write-Host "  ERROR: $errors" -ForegroundColor Yellow

Write-Host "`nDetailed Results:" -ForegroundColor Cyan
foreach ($r in $results) {
    $color = switch ($r.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        default { "Yellow" }
    }
    Write-Host "  [$($r.Status)] $($r.Name): $($r.Details)" -ForegroundColor $color
}
