# Test FULL: Report Formats (2 tests)
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
$formats = @("summary", "detailed")

$passed = 0
$failed = 0

foreach ($format in $formats) {
    Write-Host "`n=== Testing report_format = $format ===" -ForegroundColor Cyan

    $body = @{
        notebook_url = $notebookUrl
        content_type = "report"
        report_format = $format
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

Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Passed: $passed / $($formats.Count)"
