$body = @{
    question = "Quel est le theme principal?"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    headless = $false
} | ConvertTo-Json

Write-Host "Testing HEADED with agent-primary..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
$response | ConvertTo-Json -Depth 10
