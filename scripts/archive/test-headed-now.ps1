$body = @{
    question = "Quel est le theme principal?"
    notebook_url = "https://notebooklm.google.com/notebook/3e79b7be-9a72-4ac7-aaf7-ac3f450fa96f"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Lancement test HEADED avec account-b..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
$response | ConvertTo-Json -Depth 3
