$body = @{
    question = "Test rotation automatique"
    show_browser = $true
} | ConvertTo-Json

Write-Host "=== TEST ROTATION COMPLETE ===" -ForegroundColor Cyan
Write-Host "1. Demarrage avec mathieudumont (quota 50/50)"
Write-Host "2. Attend erreur 'Le systeme n'a pas pu repondre'"
Write-Host "3. Detection rate limit -> switch compte"
Write-Host "4. Retry avec nouveau compte"
Write-Host ""

$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
$response | ConvertTo-Json -Depth 10
