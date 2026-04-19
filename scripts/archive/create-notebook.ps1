$body = @{
    name = "e2e-agent-primary-test"
    description = "Test notebook for agent-primary English E2E tests"
    topics = @("test", "e2e", "english")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/create" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 10
