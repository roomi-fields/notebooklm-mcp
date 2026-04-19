# Navigate to NotebookLM home page with visible browser
# This will show all notebooks available to the current account (rom1pey)

Write-Host "=== Navigating to NotebookLM home ===" -ForegroundColor Cyan
Write-Host "Please look at the browser window to see the notebooks available" -ForegroundColor Yellow
Write-Host "Then copy one notebook URL and we'll add it to the library" -ForegroundColor Yellow

# We'll use a dummy notebook URL that redirects to home
# by using the notebooks endpoint with show_browser

$body = @{
    name = "temp-discover"
    url = "https://notebooklm.google.com"
    show_browser = $true
} | ConvertTo-Json

try {
    # This will fail but will open the browser to the home page
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "Expected error (home page doesn't have a specific notebook): $($_.Exception.Message)" -ForegroundColor Yellow
}
