# Test access to personal notebook on port 3001
$body = @{
    url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000113"
    name = "Mon Notebook Perso"
    description = "Test notebook personnel"
    topics = @("test")
} | ConvertTo-Json

Write-Host "Adding your personal notebook..."
$response = Invoke-RestMethod -Uri "http://localhost:3001/notebooks" -Method POST -ContentType "application/json" -Body $body
Write-Host "Result: $($response.success)"
if ($response.success) {
    Write-Host "Notebook added! ID: $($response.data.notebook.id)"
}
