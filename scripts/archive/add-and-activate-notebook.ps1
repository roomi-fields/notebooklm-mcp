# Add the newly created notebook to library and activate it
Write-Host "=== Adding and activating new notebook ===" -ForegroundColor Cyan

# Add the notebook
$addBody = @{
    name = "e2e-account-c-test"
    url = "https://notebooklm.google.com/notebook/725d28e1-4284-4f36-99a2-b6693c2ebf13"
    description = "E2E test notebook owned by account-c"
} | ConvertTo-Json

Write-Host "Adding notebook to library..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $addBody -TimeoutSec 60
    Write-Host "Added: $($response.success)" -ForegroundColor Green
} catch {
    Write-Host "Already exists or error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Activate it
Write-Host "`nActivating notebook..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/e2e-account-c-test/activate" -Method PUT -TimeoutSec 30
    Write-Host "Activated: $($response.success)" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Verify
Write-Host "`nVerifying active notebook..."
$notebooks = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method GET
Write-Host "Active: $($notebooks.data.active_notebook_id)" -ForegroundColor Cyan
