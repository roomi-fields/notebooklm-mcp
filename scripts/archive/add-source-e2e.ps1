# Add source to test notebook with proper cleanup
$testNotebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"

Write-Host "Adding text source to test notebook..." -ForegroundColor Cyan

$sourceBody = @{
    source_type = "text"
    title = "E2E Test Document"
    text = "# E2E Test Document`n`nThis is a test document for E2E testing.`n`n## Features`n- HTTP REST API`n- Browser automation`n- Multi-account support`n`n## Technical`n1. Express.js wrapper`n2. Playwright sessions`n3. Content manager"
    notebook_url = $testNotebookUrl
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $sourceBody -TimeoutSec 90
    Write-Host "Result:" -ForegroundColor Yellow
    $result | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Close all sessions after operation
Write-Host "`nCleaning up sessions..." -ForegroundColor Cyan
$sessions = Invoke-RestMethod -Uri "http://localhost:3000/sessions" -Method GET
foreach ($session in $sessions.data.sessions) {
    Write-Host "  Closing session $($session.id)..."
    Invoke-RestMethod -Uri "http://localhost:3000/sessions/$($session.id)" -Method DELETE -ErrorAction SilentlyContinue | Out-Null
}
Write-Host "Done." -ForegroundColor Green
