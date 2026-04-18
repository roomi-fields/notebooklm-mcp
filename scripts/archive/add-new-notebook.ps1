# Add the newly created notebook to library with all required fields
Write-Host "=== Adding notebook to library ===" -ForegroundColor Cyan

$body = @{
    name = "e2e-account-c-test"
    url = "https://notebooklm.google.com/notebook/725d28e1-4284-4f36-99a2-b6693c2ebf13"
    description = "E2E test notebook owned by account-c"
    topics = @("test", "e2e", "account-c")
} | ConvertTo-Json

Write-Host "Body: $body"
Write-Host "`nSending request..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
    Write-Host "Success: $($response.success)" -ForegroundColor Green
    Write-Host "Notebook ID: $($response.data.notebook.id)"
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

    # Get response body
    $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $responseBody = $streamReader.ReadToEnd()
    Write-Host "Response: $responseBody" -ForegroundColor Yellow
}
