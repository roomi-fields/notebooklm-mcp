# Navigate to NotebookLM home and create a fresh notebook
Write-Host "=== Creating a fresh test notebook ===" -ForegroundColor Cyan

# Use the notebooks endpoint with a URL to the home page to trigger discovery
# We'll use POST /notebooks with just a name to create a new one

$body = @{
    name = "e2e-rom1pey-test"
    url = "https://notebooklm.google.com"
    description = "E2E test notebook for rom1pey account"
} | ConvertTo-Json

Write-Host "`nAdding notebook entry..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    Write-Host "Response:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Now list all notebooks
Write-Host "`n=== Current notebooks ===" -ForegroundColor Cyan
$notebooks = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method GET
Write-Host "Active notebook: $($notebooks.data.active_notebook_id)"
Write-Host "Total notebooks: $($notebooks.data.notebooks.Count)"
