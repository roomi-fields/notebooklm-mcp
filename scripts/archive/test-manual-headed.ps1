# Test in headed mode to see what happens
# Stop existing server
taskkill /F /IM node.exe 2>$null
Start-Sleep -Seconds 2

# Set headed mode and start server
$env:HEADLESS = "false"
Write-Host "Starting server in HEADED mode (you'll see the browser)..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d D:\path\to\notebooklm-mcp && set HEADLESS=false && node dist/http-wrapper.js" -NoNewWindow

Write-Host "Waiting for server..."
Start-Sleep -Seconds 6

# Ask question
Write-Host "Sending question - WATCH THE BROWSER!"
$body = @{
    notebook_id = "notebook-2"
    question = "What is IFS?"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
    Write-Host "Response: $($response.data.answer)"
} catch {
    Write-Host "Error: $_"
}
