# Test if authentication actually works by making a real /ask request
# First add a notebook, then ask a question

Write-Host "=== Testing if port 3000 is REALLY authenticated ==="
Write-Host ""

# Add a test notebook
$notebook = @{
    url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    name = "Test E2E"
    description = "Notebook pour tests E2E"
    topics = @("test", "e2e")
} | ConvertTo-Json

Write-Host "1. Adding notebook..."
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $notebook
    Write-Host "   Notebook added: $($resp.data.notebook.id)"
} catch {
    Write-Host "   Failed to add notebook: $_"
}

# Activate it
Write-Host "2. Activating notebook..."
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/test-e2e/activate" -Method PUT
    Write-Host "   Activated: $($resp.success)"
} catch {
    Write-Host "   Failed to activate: $_"
}

# Ask a question - THIS will tell us if auth really works
Write-Host "3. Asking question (this tests real auth)..."
$question = @{
    question = "What is this notebook about?"
} | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $question -TimeoutSec 120
    Write-Host ""
    Write-Host "=== RESULT ==="
    if ($resp.success) {
        Write-Host "SUCCESS! Authentication WORKS!"
        Write-Host "Answer: $($resp.data.answer.Substring(0, [Math]::Min(200, $resp.data.answer.Length)))..."
    } else {
        Write-Host "Failed: $($resp.error)"
    }
} catch {
    Write-Host "Request failed: $_"
}
