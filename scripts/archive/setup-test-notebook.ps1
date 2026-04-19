# Setup test notebook with source
$testNotebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"

Write-Host "=== Setting up Test Notebook ===" -ForegroundColor Cyan

# 1. Add notebook to library
Write-Host "1. Adding notebook to library..."
$addBody = @{
    url = $testNotebookUrl
    name = "E2E-Test-Notebook"
    description = "Notebook for E2E testing - can be modified/deleted"
    topics = @("test", "e2e", "automation")
} | ConvertTo-Json

try {
    $addResult = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $addBody -TimeoutSec 30
    Write-Host "   Added to library: $($addResult.success)" -ForegroundColor $(if ($addResult.success) { "Green" } else { "Red" })
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Add a text source for testing
Write-Host "2. Adding text source..."
$sourceBody = @{
    source_type = "text"
    title = "E2E Test Document"
    text = @"
# E2E Test Document

This is a test document for End-to-End testing of the NotebookLM MCP HTTP Server.

## Section 1: Introduction
The NotebookLM MCP HTTP Server provides a REST API for interacting with Google's NotebookLM.
It supports features like:
- Asking questions about notebook content
- Adding and managing sources
- Generating audio overviews, presentations, and reports
- Creating and managing notes

## Section 2: Test Data
Here are some test facts for verification:
- The project is written in TypeScript
- It uses Playwright for browser automation
- The server runs on port 3000 by default
- Multiple Google accounts can be used for rate limit rotation

## Section 3: Technical Details
The architecture consists of:
1. HTTP wrapper (Express.js)
2. Session manager (Playwright browser sessions)
3. Content manager (source and content operations)
4. Account manager (multi-account support)

This document should provide enough content for testing various NotebookLM features.
"@
    notebook_url = $testNotebookUrl
} | ConvertTo-Json

try {
    $sourceResult = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $sourceBody -TimeoutSec 60
    Write-Host "   Source added: $($sourceResult.success)" -ForegroundColor $(if ($sourceResult.success) { "Green" } else { "Red" })
    if (-not $sourceResult.success) {
        Write-Host "   Error: $($sourceResult.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test notebook setup complete!" -ForegroundColor Green
Write-Host "URL: $testNotebookUrl"
