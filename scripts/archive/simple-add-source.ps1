$body = @{
    source_type = "text"
    title = "Test Source"
    text = "Test document for E2E testing. Contains info about the server."
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108"
} | ConvertTo-Json

Write-Host "Adding source..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
