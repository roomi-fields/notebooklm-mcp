<#
.SYNOPSIS
    Start NotebookLM MCP HTTP Server on Windows with auto-restart

.DESCRIPTION
    This script starts the HTTP server and automatically restarts it if it crashes.
    It must be run from Windows (PowerShell), NOT from WSL.

.EXAMPLE
    .\scripts\start-server.ps1

.EXAMPLE
    # Run in background (hidden window)
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File D:\path\to\notebooklm-mcp\scripts\start-server.ps1" -WindowStyle Hidden
#>

param(
    [int]$Port = 3000,
    [int]$MaxRestarts = 10,
    [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NotebookLM MCP HTTP Server (Windows)     " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $ProjectDir"
Write-Host "Port: $Port"
Write-Host "Max restarts: $MaxRestarts"
Write-Host ""

# Check we're on Windows (not WSL)
if ($env:WSL_DISTRO_NAME) {
    Write-Host "ERROR: This script must be run from Windows, not WSL!" -ForegroundColor Red
    Write-Host "Open PowerShell on Windows and run:" -ForegroundColor Yellow
    Write-Host "  cd $ProjectDir" -ForegroundColor Yellow
    Write-Host "  .\scripts\start-server.ps1" -ForegroundColor Yellow
    exit 1
}

# Kill any existing server on the port
$existingProcesses = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

foreach ($pid in $existingProcesses) {
    Write-Host "Killing existing process on port $Port (PID: $pid)..." -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

# Change to project directory
Set-Location $ProjectDir

$restartCount = 0
$lastRestartTime = Get-Date

while ($restartCount -lt $MaxRestarts) {
    Write-Host ""
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting server (attempt $($restartCount + 1)/$MaxRestarts)..." -ForegroundColor Green

    try {
        # Start the server
        $process = Start-Process -FilePath "node.exe" -ArgumentList "dist/http-wrapper.js" -NoNewWindow -PassThru -Wait

        $exitCode = $process.ExitCode
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Server exited with code: $exitCode" -ForegroundColor Yellow

        # Reset restart count if server ran for more than 1 minute
        $timeSinceLastRestart = (Get-Date) - $lastRestartTime
        if ($timeSinceLastRestart.TotalMinutes -gt 1) {
            $restartCount = 0
        }

        $restartCount++
        $lastRestartTime = Get-Date

        if ($restartCount -lt $MaxRestarts) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Restarting in $RestartDelaySeconds seconds..." -ForegroundColor Cyan
            Start-Sleep -Seconds $RestartDelaySeconds
        }
    }
    catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Error: $_" -ForegroundColor Red
        $restartCount++
        Start-Sleep -Seconds $RestartDelaySeconds
    }
}

Write-Host ""
Write-Host "Max restarts ($MaxRestarts) reached. Server stopped." -ForegroundColor Red
Write-Host "Check logs for errors." -ForegroundColor Yellow
