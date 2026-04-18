# Test 31: Reject removed types (faq, study_guide, etc.)
$types = @("faq", "study_guide", "briefing_doc", "timeline", "table_of_contents")
$allPass = $true
foreach ($t in $types) {
    $body = @{ notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000107"; content_type = $t } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 5 | Out-Null
        $allPass = $false
    } catch { }
}
if ($allPass) { Write-Host "PASS" } else { Write-Host "FAIL" }
