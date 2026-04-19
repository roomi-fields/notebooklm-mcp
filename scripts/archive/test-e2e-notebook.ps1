# Test access to e2e-test-notebook with rom1pey
Write-Host "=== Testing e2e-test-notebook with visible browser ===" -ForegroundColor Cyan

# Activate it
Write-Host "Activating e2e-test-notebook..."
Invoke-RestMethod -Uri "http://localhost:3000/notebooks/e2e-test-notebook/activate" -Method PUT -TimeoutSec 30

# Try to access with visible browser
Write-Host "`nTesting access with visible browser..."
$body = @{
    question = "What is this notebook about?"
    show_browser = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    Write-Host "SUCCESS! Answer: $($response.data.answer.Substring(0, [Math]::Min(200, $response.data.answer.Length)))..." -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "This notebook is probably not accessible to rom1pey" -ForegroundColor Yellow
}
