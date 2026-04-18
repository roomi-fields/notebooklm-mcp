# Quick test for add source with debug
$body = @{
    source_type = "text"
    text = "Debug test content - testing selectors"
    title = "Debug Test"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Testing add source..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180

if ($response.success) {
    Write-Host "SUCCESS" -ForegroundColor Green
} else {
    Write-Host "FAIL: $($response.error)" -ForegroundColor Red
}

$response | ConvertTo-Json -Depth 5
