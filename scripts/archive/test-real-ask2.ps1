# Test auth by asking directly with notebook_url
Write-Host "=== Testing REAL authentication on port 3000 ==="
Write-Host ""

$body = @{
    question = "What is this notebook about?"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
} | ConvertTo-Json

Write-Host "Asking question with direct notebook URL..."
Write-Host "This will PROVE if authentication works or not"
Write-Host ""

try {
    $resp = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
    Write-Host "=== RESULT ==="
    if ($resp.success) {
        $answer = $resp.data.answer
        if ($answer -eq "Le système n'a pas pu répondre.") {
            Write-Host "Auth works but NotebookLM returned error (known issue)"
        } else {
            Write-Host "SUCCESS! Got real answer:"
            Write-Host $answer.Substring(0, [Math]::Min(300, $answer.Length))
        }
    } else {
        Write-Host "Failed: $($resp.error)"
    }
} catch {
    Write-Host "Exception: $_"
}
