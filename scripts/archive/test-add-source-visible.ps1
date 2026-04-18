# Test add source with visible browser
Write-Host "=== Testing add source with VISIBLE browser ===" -ForegroundColor Cyan
$body = @{
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    source_type = "text"
    text = "Test content for debugging the text upload issue."
    title = "DEBUG-TEST-SOURCE"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Request body:" -ForegroundColor Yellow
$body

$result = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body
Write-Host "`nResult:" -ForegroundColor Yellow
$result | ConvertTo-Json -Depth 5
