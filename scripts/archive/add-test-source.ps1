# Add source to test notebook with proper cleanup
$testNotebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"

Write-Host "Adding text source to test notebook..." -ForegroundColor Cyan

$sourceBody = @{
    source_type = "text"
    title = "E2E Test Document"
    text = @"
# E2E Test Document

This is a test document for End-to-End testing of the NotebookLM MCP HTTP Server.

## Section 1: Introduction
The NotebookLM MCP HTTP Server provides a REST API for interacting with Google NotebookLM.

## Section 2: Features
- Asking questions about notebook content
- Adding and managing sources
- Generating audio overviews, presentations, and reports
- Creating and managing notes

## Section 3: Technical Details
The architecture consists of:
1. HTTP wrapper (Express.js)
2. Session manager (Playwright browser sessions)
3. Content manager (source and content operations)

This document should provide enough content for testing.
"@
    notebook_url = $testNotebookUrl
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $sourceBody -TimeoutSec 90
    Write-Host "Result:" -ForegroundColor Yellow
    $result | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Close all sessions after operation
Write-Host ""
Write-Host "Cleaning up sessions..." -ForegroundColor Cyan
$sessions = Invoke-RestMethod -Uri "http://localhost:3000/sessions" -Method GET
foreach ($session in $sessions.data.sessions) {
    Write-Host "  Closing session $($session.id)..."
    Invoke-RestMethod -Uri "http://localhost:3000/sessions/$($session.id)" -Method DELETE -ErrorAction SilentlyContinue | Out-Null
}
Write-Host "Done." -ForegroundColor Green
