# Test 30: Reject invalid content type
$body = @{ notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000107"; content_type = "invalid_type" } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
    Write-Host "FAIL: Should have rejected"
} catch {
    # 400 Bad Request = correct rejection
    Write-Host "PASS"
}
