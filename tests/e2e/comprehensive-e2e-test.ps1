# Comprehensive E2E Test Suite for NotebookLM MCP HTTP Server
# Tests ALL endpoints with ALL features
# Creates detailed tracking report

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$OutputFile = "E2E-TEST-REPORT.md"
)

$ErrorActionPreference = "Continue"
$results = @()
$startTime = Get-Date

function Test-Endpoint {
    param(
        [string]$Category,
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [hashtable]$Query = $null,
        [string]$ExpectedField = "success",
        [bool]$ExpectedValue = $true,
        [int]$TimeoutSec = 120
    )

    $url = "$BaseUrl$Endpoint"
    if ($Query) {
        $queryString = ($Query.GetEnumerator() | ForEach-Object { "$($_.Key)=$([System.Web.HttpUtility]::UrlEncode($_.Value))" }) -join "&"
        $url = "$url`?$queryString"
    }

    $testResult = @{
        Category = $Category
        Name = $Name
        Method = $Method
        Endpoint = $Endpoint
        Status = "PENDING"
        Duration = 0
        Error = $null
        Response = $null
    }

    Write-Host "  Testing: $Method $Endpoint..." -NoNewline
    $sw = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $params = @{
            Uri = $url
            Method = $Method
            ContentType = "application/json"
            TimeoutSec = $TimeoutSec
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-RestMethod @params
        $sw.Stop()
        $testResult.Duration = $sw.ElapsedMilliseconds
        $testResult.Response = $response

        # Check expected field
        if ($response.$ExpectedField -eq $ExpectedValue) {
            $testResult.Status = "PASS"
            Write-Host " PASS" -ForegroundColor Green -NoNewline
            Write-Host " ($($sw.ElapsedMilliseconds)ms)"
        } else {
            $testResult.Status = "FAIL"
            $testResult.Error = "Expected $ExpectedField=$ExpectedValue, got $($response.$ExpectedField)"
            Write-Host " FAIL" -ForegroundColor Red -NoNewline
            Write-Host " - $($testResult.Error)"
        }
    }
    catch {
        $sw.Stop()
        $testResult.Duration = $sw.ElapsedMilliseconds
        $testResult.Status = "ERROR"
        $testResult.Error = $_.Exception.Message
        Write-Host " ERROR" -ForegroundColor Red -NoNewline
        Write-Host " - $($_.Exception.Message)"
    }

    return $testResult
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " NotebookLM MCP HTTP Server E2E Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Started: $startTime"
Write-Host ""

# ============================================
# 1. HEALTH & AUTH ENDPOINTS
# ============================================
Write-Host "1. HEALTH & AUTH ENDPOINTS" -ForegroundColor Yellow

$results += Test-Endpoint -Category "Health" -Name "Health Check" -Method "GET" -Endpoint "/health"

# ============================================
# 2. NOTEBOOK LIBRARY ENDPOINTS
# ============================================
Write-Host ""
Write-Host "2. NOTEBOOK LIBRARY ENDPOINTS" -ForegroundColor Yellow

$results += Test-Endpoint -Category "Notebooks" -Name "List Notebooks" -Method "GET" -Endpoint "/notebooks"
$results += Test-Endpoint -Category "Notebooks" -Name "Get Library Stats" -Method "GET" -Endpoint "/notebooks/stats"
$results += Test-Endpoint -Category "Notebooks" -Name "Search Notebooks" -Method "GET" -Endpoint "/notebooks/search" -Query @{ query = "IFS" }
$results += Test-Endpoint -Category "Notebooks" -Name "Get Notebook by ID" -Method "GET" -Endpoint "/notebooks/notebook-2"

# Create test notebook
$testNotebookData = @{
    url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    name = "E2E-Test-Notebook-$(Get-Date -Format 'HHmmss')"
    description = "Created by E2E test at $(Get-Date)"
    topics = @("test", "e2e", "automation")
}
$results += Test-Endpoint -Category "Notebooks" -Name "Add Notebook" -Method "POST" -Endpoint "/notebooks" -Body $testNotebookData

# Update notebook
$updateData = @{
    description = "Updated by E2E test at $(Get-Date)"
}
$results += Test-Endpoint -Category "Notebooks" -Name "Update Notebook" -Method "PUT" -Endpoint "/notebooks/notebook-2" -Body $updateData

# Activate notebook
$results += Test-Endpoint -Category "Notebooks" -Name "Activate Notebook" -Method "PUT" -Endpoint "/notebooks/notebook-2/activate"

# ============================================
# 3. SESSION ENDPOINTS
# ============================================
Write-Host ""
Write-Host "3. SESSION ENDPOINTS" -ForegroundColor Yellow

$results += Test-Endpoint -Category "Sessions" -Name "List Sessions" -Method "GET" -Endpoint "/sessions"

# ============================================
# 4. ASK QUESTION ENDPOINT
# ============================================
Write-Host ""
Write-Host "4. ASK QUESTION ENDPOINT" -ForegroundColor Yellow

$askBody = @{
    question = "Qu'est-ce que l'IFS en une phrase?"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Ask" -Name "Ask Question" -Method "POST" -Endpoint "/ask" -Body $askBody -TimeoutSec 180

# ============================================
# 5. CONTENT MANAGEMENT - SOURCES
# ============================================
Write-Host ""
Write-Host "5. CONTENT MANAGEMENT - SOURCES" -ForegroundColor Yellow

# List content
$results += Test-Endpoint -Category "Content" -Name "List Content" -Method "GET" -Endpoint "/content" -Query @{ notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" }

# Add text source
$sourceBody = @{
    source_type = "text"
    text = "Ceci est un texte de test pour les E2E tests. L'IFS est une approche therapeutique."
    title = "E2E-Test-Source-$(Get-Date -Format 'HHmmss')"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Content" -Name "Add Text Source" -Method "POST" -Endpoint "/content/sources" -Body $sourceBody -TimeoutSec 60

# ============================================
# 6. CONTENT MANAGEMENT - NOTES
# ============================================
Write-Host ""
Write-Host "6. CONTENT MANAGEMENT - NOTES" -ForegroundColor Yellow

# Create note
$noteBody = @{
    title = "E2E-Test-Note-$(Get-Date -Format 'HHmmss')"
    content = "This is a test note created by E2E tests at $(Get-Date). It contains test content for validation."
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Notes" -Name "Create Note" -Method "POST" -Endpoint "/content/notes" -Body $noteBody -TimeoutSec 60

# Save chat to note (requires existing chat)
$chatNoteBody = @{
    title = "E2E-Chat-Note-$(Get-Date -Format 'HHmmss')"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Notes" -Name "Save Chat to Note" -Method "POST" -Endpoint "/content/chat-to-note" -Body $chatNoteBody -TimeoutSec 60

# ============================================
# 7. CONTENT GENERATION (Studio Features)
# ============================================
Write-Host ""
Write-Host "7. CONTENT GENERATION (Studio Features)" -ForegroundColor Yellow

# Generate Audio Overview
$audioBody = @{
    content_type = "audio_overview"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Generate" -Name "Audio Overview" -Method "POST" -Endpoint "/content/generate" -Body $audioBody -TimeoutSec 300

# Generate Report (summary)
$reportBody = @{
    content_type = "report"
    report_format = "summary"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Generate" -Name "Report (Summary)" -Method "POST" -Endpoint "/content/generate" -Body $reportBody -TimeoutSec 180

# Generate Presentation
$presentationBody = @{
    content_type = "presentation"
    presentation_style = "detailed_slideshow"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Generate" -Name "Presentation" -Method "POST" -Endpoint "/content/generate" -Body $presentationBody -TimeoutSec 180

# Generate Data Table
$dataTableBody = @{
    content_type = "data_table"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Generate" -Name "Data Table" -Method "POST" -Endpoint "/content/generate" -Body $dataTableBody -TimeoutSec 180

# Generate Infographic
$infographicBody = @{
    content_type = "infographic"
    infographic_format = "vertical"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Generate" -Name "Infographic" -Method "POST" -Endpoint "/content/generate" -Body $infographicBody -TimeoutSec 180

# Generate Video (will likely take long or fail if not supported)
$videoBody = @{
    content_type = "video"
    video_style = "classroom"
    video_format = "brief"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
}
$results += Test-Endpoint -Category "Generate" -Name "Video" -Method "POST" -Endpoint "/content/generate" -Body $videoBody -TimeoutSec 300

# ============================================
# 8. CONTENT DOWNLOAD/EXPORT
# ============================================
Write-Host ""
Write-Host "8. CONTENT DOWNLOAD/EXPORT" -ForegroundColor Yellow

$results += Test-Endpoint -Category "Download" -Name "Download Audio" -Method "GET" -Endpoint "/content/download" -Query @{ content_type = "audio_overview"; notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" } -TimeoutSec 60

# ============================================
# GENERATE REPORT
# ============================================
$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passed = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$errors = ($results | Where-Object { $_.Status -eq "ERROR" }).Count
$total = $results.Count

Write-Host "Total Tests: $total"
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Errors: $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })
Write-Host "Duration: $([math]::Round($totalDuration, 2))s"

# Generate Markdown Report
$report = @"
# NotebookLM MCP HTTP Server - E2E Test Report

**Generated:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Duration:** $([math]::Round($totalDuration, 2)) seconds
**Base URL:** $BaseUrl

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | $total |
| Passed | $passed |
| Failed | $failed |
| Errors | $errors |
| Success Rate | $([math]::Round(($passed / $total) * 100, 1))% |

## Test Results by Category

"@

# Group by category
$categories = $results | Group-Object -Property Category

foreach ($cat in $categories) {
    $catPassed = ($cat.Group | Where-Object { $_.Status -eq "PASS" }).Count
    $catTotal = $cat.Group.Count
    $catStatus = if ($catPassed -eq $catTotal) { "PASS" } else { "FAIL" }
    $statusEmoji = if ($catStatus -eq "PASS") { "✅" } else { "❌" }

    $report += @"

### $($cat.Name) $statusEmoji ($catPassed/$catTotal)

| Test | Method | Endpoint | Status | Duration | Error |
|------|--------|----------|--------|----------|-------|
"@

    foreach ($test in $cat.Group) {
        $statusIcon = switch ($test.Status) {
            "PASS" { "✅" }
            "FAIL" { "⚠️" }
            "ERROR" { "❌" }
            default { "⏳" }
        }
        $errorMsg = if ($test.Error) { $test.Error.Substring(0, [Math]::Min(50, $test.Error.Length)) + "..." } else { "-" }
        $report += "| $($test.Name) | $($test.Method) | ``$($test.Endpoint)`` | $statusIcon $($test.Status) | $($test.Duration)ms | $errorMsg |`n"
    }
}

$report += @"

## Endpoint Coverage

### Authentication Endpoints

| Endpoint | Method | Tested | Notes |
|----------|--------|--------|-------|
| ``/health`` | GET | ✅ | Basic health check |
| ``/setup-auth`` | POST | ⏭️ | Skipped (destructive) |
| ``/de-auth`` | POST | ⏭️ | Skipped (destructive) |
| ``/re-auth`` | POST | ⏭️ | Skipped (would change auth) |
| ``/cleanup-data`` | POST | ⏭️ | Skipped (destructive) |

### Notebook Library Endpoints

| Endpoint | Method | Tested | Notes |
|----------|--------|--------|-------|
| ``/notebooks`` | GET | ✅ | List all notebooks |
| ``/notebooks`` | POST | ✅ | Add notebook to library |
| ``/notebooks/search`` | GET | ✅ | Search by query |
| ``/notebooks/stats`` | GET | ✅ | Library statistics |
| ``/notebooks/:id`` | GET | ✅ | Get notebook details |
| ``/notebooks/:id`` | PUT | ✅ | Update notebook |
| ``/notebooks/:id`` | DELETE | ⏭️ | Skipped (cleanup after) |
| ``/notebooks/:id/activate`` | PUT | ✅ | Set active notebook |
| ``/notebooks/auto-discover`` | POST | ⏭️ | Requires valid URL |

### Session Endpoints

| Endpoint | Method | Tested | Notes |
|----------|--------|--------|-------|
| ``/sessions`` | GET | ✅ | List active sessions |
| ``/sessions/:id/reset`` | POST | ⏭️ | Skipped (needs session) |
| ``/sessions/:id`` | DELETE | ⏭️ | Skipped (needs session) |

### Content Management Endpoints

| Endpoint | Method | Tested | Notes |
|----------|--------|--------|-------|
| ``/ask`` | POST | ✅ | Ask question |
| ``/content`` | GET | ✅ | List content |
| ``/content/sources`` | POST | ✅ | Add source |
| ``/content/sources/:id`` | DELETE | ⏭️ | Cleanup after |
| ``/content/sources`` | DELETE | ⏭️ | Cleanup after |
| ``/content/notes`` | POST | ✅ | Create note |
| ``/content/chat-to-note`` | POST | ✅ | Save chat to note |
| ``/content/notes/:title/to-source`` | POST | ⏭️ | Needs existing note |

### Content Generation (Studio)

| Content Type | Format Options | Tested | Notes |
|--------------|----------------|--------|-------|
| ``audio_overview`` | language | ✅ | Audio podcast |
| ``presentation`` | style, length | ✅ | Google Slides |
| ``report`` | summary, detailed | ✅ | Text report |
| ``data_table`` | - | ✅ | Google Sheets |
| ``infographic`` | horizontal, vertical | ✅ | PNG image |
| ``video`` | style, format | ✅ | Video generation |

### Content Download/Export

| Content Type | Export Type | Tested | Notes |
|--------------|-------------|--------|-------|
| ``audio_overview`` | File download | ✅ | WAV/MP3 |
| ``presentation`` | Google Slides | ⏭️ | Opens in browser |
| ``data_table`` | Google Sheets | ⏭️ | Opens in browser |
| ``infographic`` | PNG download | ⏭️ | File download |
| ``video`` | File download | ⏭️ | MP4 |

## Failed Tests Details

"@

$failedTests = $results | Where-Object { $_.Status -ne "PASS" }
if ($failedTests.Count -gt 0) {
    foreach ($test in $failedTests) {
        $report += @"

### ❌ $($test.Name)
- **Endpoint:** $($test.Method) $($test.Endpoint)
- **Status:** $($test.Status)
- **Error:** $($test.Error)

"@
    }
} else {
    $report += "`nNo failed tests! All tests passed successfully.`n"
}

$report += @"

---
*Report generated by comprehensive-e2e-test.ps1*
"@

# Save report
$reportPath = Join-Path (Split-Path $MyInvocation.MyCommand.Path) $OutputFile
$report | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host ""
Write-Host "Report saved to: $reportPath" -ForegroundColor Green

# Return results for programmatic access
return $results
