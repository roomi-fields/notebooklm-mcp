# Test with the newly created notebook (owned by account-c)
$body = @{
    notebook_id = "english-test"
    source_type = "url"
    url = "https://en.wikipedia.org/wiki/Hello"
    show_browser = $true
} | ConvertTo-Json

# First add the notebook
$addBody = @{
    name = "english-test"
    url = "https://notebooklm.google.com/notebook/258f62a1-8658-4f96-8333-a9e16224f602"
} | ConvertTo-Json

Write-Host "Adding notebook owned by account-c..."
Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $addBody -TimeoutSec 60

Write-Host "`nTesting URL source on account-c's notebook..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
$response | ConvertTo-Json -Depth 5
