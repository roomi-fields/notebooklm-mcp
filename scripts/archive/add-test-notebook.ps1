# Add test notebook to library (no browser needed)
$testNotebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"

$addBody = @{
    url = $testNotebookUrl
    name = "E2E-Test-Notebook"
    description = "Notebook for E2E testing - can be modified/deleted"
    topics = @("test", "e2e", "automation")
} | ConvertTo-Json

Write-Host "Adding test notebook to library..."
$result = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $addBody -TimeoutSec 10
$result | ConvertTo-Json -Depth 3
