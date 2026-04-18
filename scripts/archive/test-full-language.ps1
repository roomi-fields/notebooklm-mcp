# Test FULL: Language option (1 test)
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"

Write-Host "`n=== Testing language = fr ===" -ForegroundColor Cyan

$body = @{
    notebook_url = $notebookUrl
    content_type = "presentation"
    language = "fr"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
    if ($response.success) {
        Write-Host "PASSED" -ForegroundColor Green
    } else {
        Write-Host "FAILED: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
