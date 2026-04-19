$body = @{
    question = "Bonjour, test quota"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Testing with mathieudumont (should hit rate limit)..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
$response | ConvertTo-Json -Depth 10
