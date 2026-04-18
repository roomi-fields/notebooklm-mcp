$body = @{
    question = "Bonjour, quel est le sujet principal de ce notebook?"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
} | ConvertTo-Json

Write-Host "Testing account rotation with rate-limited mathieudumont31..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
$response | ConvertTo-Json -Depth 10
