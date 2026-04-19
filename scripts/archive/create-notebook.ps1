$body = @{
    name = "e2e-mathieu-test"
    description = "Test notebook for mathieudumont31 English E2E tests"
    topics = @("test", "e2e", "english")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/create" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 10
