# Debug: Add text source with detailed logging
# This script tests adding a text source step by step

Write-Host "=== DEBUG: Add Text Source Step by Step ===" -ForegroundColor Cyan
Write-Host "Notebook: 00000000-0000-0000-0000-000000000109" -ForegroundColor Gray

# Step 1: Get initial source count
Write-Host "`n--- Step 1: Get initial source count ---" -ForegroundColor Yellow
$initialContent = Invoke-RestMethod -Uri "http://localhost:3000/content?notebook_url=https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" -Method GET
$initialCount = $initialContent.data.sources.Count
Write-Host "Initial source count: $initialCount" -ForegroundColor White

# Step 2: Add a text source with visible browser
Write-Host "`n--- Step 2: Adding text source with VISIBLE browser ---" -ForegroundColor Yellow
$body = @{
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    source_type = "text"
    text = "Ceci est un test de debug pour verifier l'ajout de source texte. Contenu de test avec suffisamment de texte pour etre valide."
    title = "DEBUG-SOURCE-$(Get-Date -Format 'HHmmss')"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Request body:" -ForegroundColor Gray
$body | ConvertFrom-Json | Format-List

$result = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
Write-Host "`nResult:" -ForegroundColor Gray
$result | ConvertTo-Json -Depth 5

# Step 3: Wait and check source count
Write-Host "`n--- Step 3: Waiting 10 seconds then checking source count ---" -ForegroundColor Yellow
Start-Sleep -Seconds 10

$finalContent = Invoke-RestMethod -Uri "http://localhost:3000/content?notebook_url=https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" -Method GET
$finalCount = $finalContent.data.sources.Count
Write-Host "Final source count: $finalCount" -ForegroundColor White

if ($finalCount -gt $initialCount) {
    Write-Host "`n✅ SUCCESS: Source count increased from $initialCount to $finalCount" -ForegroundColor Green
    # Show new source
    $newSources = $finalContent.data.sources | Where-Object { $_.name -like "*DEBUG*" }
    Write-Host "New sources matching 'DEBUG':" -ForegroundColor White
    $newSources | ConvertTo-Json -Depth 3
} else {
    Write-Host "`n❌ FAIL: Source count did not increase ($initialCount -> $finalCount)" -ForegroundColor Red
    Write-Host "API returned success=$($result.success)" -ForegroundColor Red
}
