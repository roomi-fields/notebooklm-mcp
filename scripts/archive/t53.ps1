# Test 53: Missing question - should fail
$body = @{ notebook_id = "e2e-rom1pey-test" } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    Write-Host "FAIL: Should have returned error"
} catch {
    if ($_.Exception.Message -match "question" -or $_.Exception.Response.StatusCode -eq 400) {
        Write-Host "PASS: Correctly rejected missing question"
    } else {
        Write-Host "FAIL: Wrong error - $($_.Exception.Message)"
    }
}
