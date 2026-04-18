# Test 1: Add a text source
Write-Host "=== STEP 1: Adding test source ===" -ForegroundColor Cyan
$addBody = @{
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    source_type = "text"
    text = "This is a test source for deletion testing. Created at $(Get-Date)"
    title = "DELETE-ME-TEST-SOURCE"
} | ConvertTo-Json

$addResult = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $addBody
Write-Host "Add result:" -ForegroundColor Yellow
$addResult | ConvertTo-Json -Depth 5

# Wait for indexing
Write-Host "`n=== STEP 2: Waiting 10 seconds for indexing ===" -ForegroundColor Cyan
Start-Sleep -Seconds 10

# List sources to verify it was added
Write-Host "`n=== STEP 3: Listing sources to verify ===" -ForegroundColor Cyan
$listResult = Invoke-RestMethod -Uri "http://localhost:3000/content?notebook_url=https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" -Method GET
$testSource = $listResult.data.sources | Where-Object { $_.name -like "*DELETE-ME*" }
Write-Host "Found test source:" -ForegroundColor Yellow
$testSource | ConvertTo-Json -Depth 3

# Delete the source
Write-Host "`n=== STEP 4: Deleting source by name ===" -ForegroundColor Cyan
$deleteResult = Invoke-RestMethod -Uri "http://localhost:3000/content/sources?source_name=DELETE-ME-TEST-SOURCE&notebook_url=https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" -Method DELETE
Write-Host "Delete result:" -ForegroundColor Yellow
$deleteResult | ConvertTo-Json -Depth 5

# Verify deletion
Write-Host "`n=== STEP 5: Verifying deletion ===" -ForegroundColor Cyan
Start-Sleep -Seconds 3
$verifyResult = Invoke-RestMethod -Uri "http://localhost:3000/content?notebook_url=https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109" -Method GET
$stillExists = $verifyResult.data.sources | Where-Object { $_.name -like "*DELETE-ME*" }
if ($stillExists) {
    Write-Host "FAIL: Source still exists!" -ForegroundColor Red
    $stillExists | ConvertTo-Json
} else {
    Write-Host "SUCCESS: Source was deleted!" -ForegroundColor Green
}
