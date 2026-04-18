# Step 1: Add notebook owned by account-c to library
Write-Host "Step 1: Adding account-c notebook to library..."
$addBody = @{
    name = "account-c-english-test"
    url = "https://notebooklm.google.com/notebook/258f62a1-8658-4f96-8333-a9e16224f602"
    description = "Test notebook for English UI"
    topics = @("test", "english")
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/notebooks" -Method POST -ContentType "application/json" -Body $addBody -TimeoutSec 60
    Write-Host "Added: $($result | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Add failed (may already exist): $($_.Exception.Message)"
}

# Step 2: Activate this notebook
Write-Host "`nStep 2: Activating account-c notebook..."
try {
    Invoke-RestMethod -Uri "http://localhost:3000/notebooks/account-c-english-test/activate" -Method PUT -TimeoutSec 10
    Write-Host "Activated!"
} catch {
    Write-Host "Activate failed: $($_.Exception.Message)"
}

# Step 3: Test URL source with visible browser
Write-Host "`nStep 3: Testing URL source with VISIBLE browser..."
$testBody = @{
    source_type = "url"
    url = "https://en.wikipedia.org/wiki/Hello_World"
    show_browser = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $testBody -TimeoutSec 120
Write-Host "Result:"
$response | ConvertTo-Json -Depth 5
