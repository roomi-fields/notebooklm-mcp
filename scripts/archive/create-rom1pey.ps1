$body = @{
    name = "e2e-rom1pey-english"
    description = "Test notebook for rom1pey English E2E tests"
    topics = @("test", "e2e", "english")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/create" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
$response | ConvertTo-Json -Depth 10
