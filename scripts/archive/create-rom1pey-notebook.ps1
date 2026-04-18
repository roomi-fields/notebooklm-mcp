# Create a new notebook with the current account (rom1pey)
Write-Host "=== Creating new notebook with rom1pey account ===" -ForegroundColor Cyan

$body = @{
    name = "E2E-Test-Rom1pey"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Calling POST /notebooks/create with visible browser..."
Write-Host "Please watch the browser window!" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/create" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
    Write-Host "`nSUCCESS!" -ForegroundColor Green
    Write-Host "Notebook URL: $($response.data.notebook_url)"
    Write-Host "Notebook ID: $($response.data.notebook_id)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
