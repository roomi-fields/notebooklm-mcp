# Test /ask endpoint with HEADED browser to see what happens
# Set HEADLESS=false to see the browser

$env:HEADLESS = "false"

Write-Host "Starting server with visible browser..."
Write-Host "The browser will open and you can watch what happens"
Write-Host ""

# First, restart the server with headless=false
Write-Host "Restarting server in headed mode..."
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# Start server in background with headed mode
$env:HEADLESS = "false"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\path\to\notebooklm-mcp && set HEADLESS=false && node dist/http-wrapper.js" -WindowStyle Normal

Write-Host "Waiting for server to start..."
Start-Sleep -Seconds 5

# Test health
Write-Host "Testing health..."
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET
    Write-Host "Health: authenticated=$($health.data.authenticated)"
} catch {
    Write-Host "Health check failed: $_"
    exit 1
}

# Now ask a simple question
Write-Host ""
Write-Host "Asking question (watch the browser!)..."
$body = @{
    notebook_id = "notebook-1"
    question = "Hello, what is CNV?"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
    Write-Host ""
    Write-Host "Response received:"
    Write-Host "Success: $($response.success)"
    Write-Host "Answer: $($response.data.answer)"
} catch {
    Write-Host "Error: $_"
}

Write-Host ""
Write-Host "Test complete. The browser should still be open for inspection."
