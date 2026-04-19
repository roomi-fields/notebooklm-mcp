# Test FULL: Source Selection (1 test)
Add-Type -AssemblyName System.Web
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
$encodedUrl = [System.Uri]::EscapeDataString($notebookUrl)

Write-Host "`n=== Testing source selection ===" -ForegroundColor Cyan

# First, get the list of sources
Write-Host "  Getting sources list..." -ForegroundColor Gray
try {
    $sourcesUrl = "http://localhost:3000/content?notebook_url=$encodedUrl"
    $sourcesResponse = Invoke-RestMethod -Uri $sourcesUrl -Method GET -TimeoutSec 120

    if ($sourcesResponse.success -and $sourcesResponse.data.sources -and $sourcesResponse.data.sources.Count -gt 0) {
        $sources = @($sourcesResponse.data.sources[0].name)
        Write-Host "  Found $($sourcesResponse.data.sources.Count) sources, using first: $sources" -ForegroundColor Gray

        $body = @{
            notebook_url = $notebookUrl
            content_type = "report"
            sources = $sources
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
        if ($response.success) {
            Write-Host "PASSED" -ForegroundColor Green
        } else {
            Write-Host "FAILED: $($response.error)" -ForegroundColor Red
        }
    } else {
        Write-Host "SKIPPED: No sources found in notebook" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}
