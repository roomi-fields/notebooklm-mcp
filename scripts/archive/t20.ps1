# Test 20: Reject invalid source type
$body = @{ notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000107"; source_type = "invalid_type" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:3000/content/sources" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
if ($response.success -eq $false) { Write-Host "PASS" } else { Write-Host "FAIL" }
