$body = @{
    description = "Updated by E2E test at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/notebooks/e2e-rom1pey-test" -Method PUT -ContentType "application/json" -Body $body
