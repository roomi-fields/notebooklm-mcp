# Debug script to capture NotebookLM UI and identify correct selectors
# Runs with show_browser=true so we can see what's happening

$baseUrl = "http://localhost:3000"
$testNotebook = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"

Write-Host "=== Debug NotebookLM Selectors ===" -ForegroundColor Cyan

# First ask a question to open the notebook
Write-Host "`n[1] Opening notebook with a simple question..." -ForegroundColor Yellow

$askBody = @{
    question = "Hello, what is this notebook about?"
    notebook_url = $testNotebook
    show_browser = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/ask" -Method POST -ContentType "application/json" -Body $askBody -TimeoutSec 120
    if ($response.success) {
        Write-Host "  OK - Notebook opened" -ForegroundColor Green
        Write-Host "  Session ID: $($response.data.session_id)"
    }
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host "`n[2] Browser should now be visible with the notebook open." -ForegroundColor Yellow
Write-Host "    Check the left panel to see the Sources tab and Add button." -ForegroundColor Yellow
Write-Host "`n    Press Enter when ready to try adding a source..."
Read-Host

# Try adding source
Write-Host "`n[3] Trying to add text source..." -ForegroundColor Yellow

$sourceBody = @{
    source_type = "text"
    text = "Debug test content"
    title = "Debug Test"
    notebook_url = $testNotebook
    show_browser = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/content/sources" -Method POST -ContentType "application/json" -Body $sourceBody -TimeoutSec 120
    if ($response.success) {
        Write-Host "  SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Debug Complete ===" -ForegroundColor Cyan
