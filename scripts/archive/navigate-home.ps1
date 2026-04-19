# Navigate to NotebookLM homepage
$body = @{
    question = "test"
    show_browser = $true
    notebook_url = "https://notebooklm.google.com/"
} | ConvertTo-Json

Write-Host "Opening NotebookLM homepage with rpmonster..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Expected error (no notebook selected) - browser should be open"
    Write-Host $_.Exception.Message
}
