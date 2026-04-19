# Step 1: Add notebook owned by agent-tertiary to library
Write-Host "Step 1: Adding agent-tertiary notebook to library..."
$addBody = @{
    name = "agent-tertiary-english-test"
    url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000110"
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
Write-Host "`nStep 2: Activating agent-tertiary notebook..."
try {
    Invoke-RestMethod -Uri "http://localhost:3000/notebooks/agent-tertiary-english-test/activate" -Method PUT -TimeoutSec 10
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
