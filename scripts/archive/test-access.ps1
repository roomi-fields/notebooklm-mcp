# Test access to e2e-test-notebook (which should have been created by tests)
Write-Host "=== Testing notebook access with rom1pey ===" -ForegroundColor Cyan

# First activate e2e-test-notebook
Write-Host "`nActivating e2e-test-notebook..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/e2e-test-notebook/activate" -Method PUT -TimeoutSec 30
    Write-Host "Activated: $($response.success)" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Now try to ask a question with visible browser
Write-Host "`nAsking question with visible browser..."
$body = @{
    question = "Hello"
    show_browser = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    Write-Host "Response: $($response.success)" -ForegroundColor Green
    if ($response.data.answer) {
        Write-Host "Answer: $($response.data.answer.Substring(0, [Math]::Min(100, $response.data.answer.Length)))..."
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
