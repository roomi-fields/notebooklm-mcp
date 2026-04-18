$body = @{
    question = "Hello"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000107"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
$response | ConvertTo-Json -Depth 10
