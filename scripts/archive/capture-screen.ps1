# Just activate notebook and get content to take screenshot
Write-Host "Activating notebook-1..."
$response = Invoke-RestMethod -Uri "http://localhost:3000/notebooks/notebook-1/activate" -Method PUT
Write-Host "Activated"

# The server should have taken debug screenshots - check the data folder
Write-Host "`nChecking for debug screenshots..."
$debugPath = "$env:LOCALAPPDATA\notebooklm-mcp\Data"
Get-ChildItem $debugPath -Filter "*.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object {
    Write-Host "  $($_.Name) - $($_.LastWriteTime)"
}
