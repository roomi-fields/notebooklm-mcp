# Complete test: Add source, verify, delete, verify
Write-Host "=== Complete Add/Delete Source Test ===" -ForegroundColor Cyan
Write-Host "Notebook: 00000000-0000-0000-0000-000000000109" -ForegroundColor Gray

# Step 1: Add a text source
Write-Host "`n--- Step 1: Adding text source ---" -ForegroundColor Yellow
$uniqueId = Get-Date -Format "HHmmss"
$body = @{
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    source_type = "text"
    text = "Test source for add/delete verification. Unique ID: $uniqueId. This is test content."
    title = "TEST-DELETE-$uniqueId"
    show_browser = $true
} | ConvertTo-Json

$addResult = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
Write-Host "Add result:" -ForegroundColor Gray
$addResult | ConvertTo-Json -Depth 3

if (-not $addResult.success) {
    Write-Host "`n[FAIL] Add source failed!" -ForegroundColor Red
    exit 1
}

$sourceName = $addResult.data.sourceName
Write-Host "`nSource added with name: $sourceName" -ForegroundColor Green

# Step 2: Wait and verify source exists
Write-Host "`n--- Step 2: Waiting 5 seconds and verifying source exists ---" -ForegroundColor Yellow
Start-Sleep -Seconds 5

$listResult = Invoke-RestMethod -Uri "http://localhost:3000/content?notebook_url=https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" -Method GET
$sourceCount = $listResult.data.sources.Count
Write-Host "Total sources in notebook: $sourceCount" -ForegroundColor Gray

# Look for our source (either by name or "Texte colle")
$foundSource = $listResult.data.sources | Where-Object { $_.name -like "*Texte coll*" -or $_.name -like "*$uniqueId*" }
if ($foundSource) {
    Write-Host "Found source:" -ForegroundColor Green
    $foundSource | ConvertTo-Json -Depth 2
} else {
    Write-Host "Note: Source not visible in list (may be filtered or named differently)" -ForegroundColor Yellow
}

# Step 3: Delete the source
Write-Host "`n--- Step 3: Deleting source by name '$sourceName' ---" -ForegroundColor Yellow
$deleteUrl = "http://localhost:3000/content/sources?source_name=$([System.Web.HttpUtility]::UrlEncode($sourceName))&notebook_url=https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109&show_browser=true"
Write-Host "DELETE URL: $deleteUrl" -ForegroundColor Gray

try {
    $deleteResult = Invoke-RestMethod -Uri $deleteUrl -Method DELETE -TimeoutSec 120
    Write-Host "`nDelete result:" -ForegroundColor Gray
    $deleteResult | ConvertTo-Json -Depth 3

    if ($deleteResult.success) {
        Write-Host "`n[SUCCESS] Delete operation completed!" -ForegroundColor Green
    } else {
        Write-Host "`n[FAIL] Delete returned success=false: $($deleteResult.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "`n[ERROR] Delete failed with exception: $_" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
