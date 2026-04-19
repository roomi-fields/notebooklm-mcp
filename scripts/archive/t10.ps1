$body = @{ description = "Updated at $(Get-Date)" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/notebooks/e2e-rom1pey-test" -Method PUT -ContentType "application/json" -Body $body
