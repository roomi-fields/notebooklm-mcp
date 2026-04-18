# Test FULL: Video format = brief
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"

Write-Host "`n=== FULL TEST: Video Format = brief ===" -ForegroundColor Cyan

$body = @{
    notebook_url = $notebookUrl
    content_type = "video"
    video_format = "brief"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    if ($response.success) {
        Write-Host "PASSED" -ForegroundColor Green
        Write-Host "Response: $($response.data | ConvertTo-Json -Depth 3)"
    } else {
        Write-Host "FAILED: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
