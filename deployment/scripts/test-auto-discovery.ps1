#!/usr/bin/env pwsh
#Requires -Version 5.1

<#
.SYNOPSIS
    Test the auto-discovery endpoint safely.

.DESCRIPTION
    Validates the POST /notebooks/auto-discover endpoint with:
    - missing URL input
    - invalid URL format
    - one or more real notebook URLs that you provide

.PARAMETER ServerUrl
    Base URL of the NotebookLM MCP HTTP server.

.PARAMETER NotebookUrl
    Optional single NotebookLM notebook URL to test.

.PARAMETER TestAll
    Test all notebook URLs supplied through AUTO_DISCOVERY_NOTEBOOKS.

.EXAMPLE
    .\test-auto-discovery.ps1 -NotebookUrl "https://notebooklm.google.com/notebook/<your-notebook-id>"

.EXAMPLE
    $env:AUTO_DISCOVERY_NOTEBOOKS = "https://notebooklm.google.com/notebook/<id-1>,https://notebooklm.google.com/notebook/<id-2>"
    .\test-auto-discovery.ps1 -TestAll
#>

param(
    [string]$ServerUrl = "http://127.0.0.1:3000",
    [string]$NotebookUrl = "",
    [switch]$TestAll = $false
)

function Write-Success { param([string]$Message) Write-Host "[PASS] $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Warning-Custom { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Error-Custom { param([string]$Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }

function Get-BatchNotebookUrls {
    if (-not $env:AUTO_DISCOVERY_NOTEBOOKS) {
        return @()
    }

    return $env:AUTO_DISCOVERY_NOTEBOOKS.Split(',') `
        | ForEach-Object { $_.Trim() } `
        | Where-Object { $_ }
}

function Test-ExpectedError {
    param(
        [string]$Name,
        [hashtable]$Body,
        [int]$ExpectedStatus
    )

    Write-Info $Name

    try {
        $null = Invoke-RestMethod `
            -Uri "$ServerUrl/notebooks/auto-discover" `
            -Method POST `
            -Body ($Body | ConvertTo-Json) `
            -ContentType "application/json" `
            -ErrorAction Stop

        Write-Error-Custom "$Name should have failed with HTTP $ExpectedStatus"
        return $false
    } catch {
        if ($_.Exception.Response.StatusCode -eq $ExpectedStatus) {
            Write-Success "$Name returned HTTP $ExpectedStatus"
            return $true
        }

        Write-Error-Custom "$Name returned HTTP $($_.Exception.Response.StatusCode), expected $ExpectedStatus"
        return $false
    }
}

Write-Info "Testing server: $ServerUrl"

try {
    $health = Invoke-RestMethod -Uri "$ServerUrl/health" -Method GET -ErrorAction Stop
    if (-not $health.success) {
        throw "Health check returned success=false"
    }
    Write-Success "Server is reachable"
} catch {
    Write-Error-Custom "Server is not reachable at $ServerUrl"
    Write-Info "Start it with: npm run start:http"
    exit 1
}

$total = 0
$passed = 0

$total++
if (Test-ExpectedError -Name "Missing URL field" -Body @{} -ExpectedStatus 400) { $passed++ }

$total++
if (Test-ExpectedError -Name "Invalid URL format" -Body @{ url = "https://example.com/not-a-notebooklm-url" } -ExpectedStatus 400) { $passed++ }

$notebooksToTest = @()

if ($NotebookUrl) {
    $notebooksToTest = @($NotebookUrl)
} elseif ($TestAll) {
    $notebooksToTest = Get-BatchNotebookUrls
    if ($notebooksToTest.Count -eq 0) {
        Write-Warning-Custom "AUTO_DISCOVERY_NOTEBOOKS is empty. Nothing to batch test."
    }
} else {
    Write-Info "Provide -NotebookUrl for one notebook, or set AUTO_DISCOVERY_NOTEBOOKS and use -TestAll."
}

foreach ($testUrl in $notebooksToTest) {
    $total++
    Write-Info "Testing auto-discovery with $testUrl"

    try {
        $response = Invoke-RestMethod `
            -Uri "$ServerUrl/notebooks/auto-discover" `
            -Method POST `
            -Body (@{ url = $testUrl } | ConvertTo-Json) `
            -ContentType "application/json" `
            -ErrorAction Stop

        if (-not $response.success) {
            Write-Error-Custom "Auto-discovery returned success=false for $testUrl"
            continue
        }

        $notebook = $response.notebook
        if (-not $notebook) {
            $notebook = $response.data.notebook
        }

        if (-not $notebook) {
            Write-Error-Custom "Auto-discovery did not return notebook metadata"
            continue
        }

        Write-Success "Auto-discovery succeeded"
        Write-Host "  name: $($notebook.name)"
        Write-Host "  description: $($notebook.description)"

        if ($notebook.tags) {
            Write-Host "  tags: $($notebook.tags -join ', ')"
        } elseif ($notebook.topics) {
            Write-Host "  tags: $($notebook.topics -join ', ')"
        }

        $passed++
    } catch {
        Write-Error-Custom "Auto-discovery failed for $testUrl"
        Write-Host $_.Exception.Message
    }
}

Write-Host ""
Write-Host "Summary: $passed / $total checks passed."

if ($passed -ne $total) {
    exit 1
}
