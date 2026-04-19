# Verify NotebookLM Language
# Opens browser to check if UI is in English

$body = @{
    notebook_url = "https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000107"
    question = "What is this notebook about?"
    show_browser = $true
} | ConvertTo-Json

Write-Host "Opening NotebookLM to verify language..."
Write-Host "Check if the UI is in ENGLISH (buttons, menus, etc.)"
Write-Host ""

$response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 10
