# Test FULL: All Video Styles (6 tests)
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
$styles = @("classroom", "documentary", "animated", "corporate", "cinematic", "minimalist")

$passed = 0
$failed = 0

foreach ($style in $styles) {
    Write-Host "`n=== Testing video_style = $style ===" -ForegroundColor Cyan

    $body = @{
        notebook_url = $notebookUrl
        content_type = "video"
        video_style = $style
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

    # Small delay between tests to avoid rate limiting
    Start-Sleep -Seconds 3
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Passed: $passed / $($styles.Count)" -ForegroundColor $(if($passed -eq $styles.Count) {"Green"} else {"Yellow"})
Write-Host "Failed: $failed" -ForegroundColor $(if($failed -eq 0) {"Green"} else {"Red"})
