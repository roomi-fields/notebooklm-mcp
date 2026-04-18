$body = @{
    name = "e2e-account-b-test"
    description = "Test notebook for account-b English E2E tests"
    topics = @("test", "e2e", "english")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/create" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 10
