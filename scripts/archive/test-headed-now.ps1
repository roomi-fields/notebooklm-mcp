$body = @{
    question = "Quel est le theme principal?"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Lancement test HEADED avec agent-primary..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
$response | ConvertTo-Json -Depth 3
