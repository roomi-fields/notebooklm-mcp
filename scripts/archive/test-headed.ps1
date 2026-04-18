$body = @{
    question = "Quel est le theme principal?"
    notebook_url = "https://notebooklm.google.com/notebook/3e79b7be-9a72-4ac7-aaf7-ac3f450fa96f"
    headless = $false
} | ConvertTo-Json

Write-Host "Testing HEADED with account-b..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
$response | ConvertTo-Json -Depth 10
