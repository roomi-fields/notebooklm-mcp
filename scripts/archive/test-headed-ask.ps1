# Test /ask avec navigateur visible
$body = @{
    question = "What is IFS therapy?"
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000109"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Envoi requete /ask avec navigateur visible..."
Write-Host "Regardez le navigateur qui va s'ouvrir!"
Write-Host ""

$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 180
Write-Host "Reponse: $($response.data.answer)"
