# Test FULL: Presentation Options (5 tests)
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
$passed = 0
$failed = 0

# Test presentation styles
$styles = @("detailed_slideshow", "presenter_notes")
foreach ($style in $styles) {
    Write-Host "`n=== Testing presentation_style = $style ===" -ForegroundColor Cyan

    $body = @{
        notebook_url = $notebookUrl
        content_type = "presentation"
        presentation_style = $style
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
        if ($response.success) {
            Write-Host "  PASSED" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $failed++
    }
    Start-Sleep -Seconds 3
}

# Test presentation lengths
$lengths = @("short", "default")
foreach ($length in $lengths) {
    Write-Host "`n=== Testing presentation_length = $length ===" -ForegroundColor Cyan

    $body = @{
        notebook_url = $notebookUrl
        content_type = "presentation"
        presentation_length = $length
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
        if ($response.success) {
            Write-Host "  PASSED" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $failed++
    }
    Start-Sleep -Seconds 3
}

# Test combined style + length
Write-Host "`n=== Testing presentation combo (style + length) ===" -ForegroundColor Cyan
$body = @{
    notebook_url = $notebookUrl
    content_type = "presentation"
    presentation_style = "detailed_slideshow"
    presentation_length = "short"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
    if ($response.success) {
        Write-Host "  PASSED" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
    $failed++
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Passed: $passed / 5"
Write-Host "Failed: $failed"
