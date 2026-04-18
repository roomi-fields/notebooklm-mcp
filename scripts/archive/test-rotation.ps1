$body = @{
    question = "Bonjour, quel est le sujet principal de ce notebook?"
    notebook_url = "https://notebooklm.google.com/notebook/3e79b7be-9a72-4ac7-aaf7-ac3f450fa96f"
} | ConvertTo-Json

Write-Host "Testing account rotation with rate-limited account-b..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
$response | ConvertTo-Json -Depth 10
