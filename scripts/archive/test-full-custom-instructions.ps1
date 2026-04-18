# Test FULL: Custom Instructions (4 tests)
$notebookUrl = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
$passed = 0
$failed = 0

# Note: report does not support custom_instructions (uses report_format/language only)
$testCases = @(
    @{ type = "audio_overview"; instruction = "Use conversational tone" },
    @{ type = "data_table"; instruction = "Include source citations" },
    @{ type = "presentation"; instruction = "Keep it concise" }
)

foreach ($test in $testCases) {
    Write-Host "`n=== Testing custom_instructions with $($test.type) ===" -ForegroundColor Cyan

    $body = @{
        notebook_url = $notebookUrl
        content_type = $test.type
        custom_instructions = $test.instruction
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/content/generate" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
        if ($response.success) {
            Write-Host "  PASSED" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "  FAILED: $($response.error)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $failed++
    }
    Start-Sleep -Seconds 3
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Yellow
Write-Host "Passed: $passed / $($testCases.Count)"
Write-Host "Failed: $failed"
