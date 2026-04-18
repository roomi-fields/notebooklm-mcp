# Test show_browser parameter
# This tests whether show_browser=true makes the browser visible

$baseUrl = "http://localhost:3000"
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"

Write-Host "=== Testing show_browser parameter ===" -ForegroundColor Cyan

# Test 1: Health check
Write-Host "`n[1] Health check..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
Write-Host "Server OK, authenticated: $($health.data.authenticated)"

# Test 2: Add source with show_browser=true
Write-Host "`n[2] Adding text source with show_browser=true..." -ForegroundColor Yellow
Write-Host "    EXPECTED: Browser window should appear (VISIBLE mode)" -ForegroundColor Green

$body = @{
    source_type = "text"
    text = "Debug test content - checking show_browser parameter"
    title = "Debug Test"
    notebook_url = $notebookUrl
    show_browser = $true
} | ConvertTo-Json

Write-Host "`nRequest body:"
Write-Host $body

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    Write-Host "`nResponse:"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response
}

Write-Host "`n=== Test complete ===" -ForegroundColor Cyan
Write-Host "Did a browser window appear? (Y/N)"
