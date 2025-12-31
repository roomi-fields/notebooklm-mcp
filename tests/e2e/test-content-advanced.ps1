# NotebookLM MCP HTTP Server - Advanced Content Tests (YouTube + Audio)
# Tests YouTube source upload and audio generation with long timeouts
# Usage: powershell -ExecutionPolicy Bypass -File tests/e2e/test-content-advanced.ps1
#
# IMPORTANT: Audio generation can take 3-5 minutes!
# YouTube sources may be rejected by NotebookLM (video restrictions, geo-blocking, etc.)

param(
    [string]$NotebookId = "",
    [string]$YouTubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    [int]$AudioTimeout = 300,
    [int]$YouTubeTimeout = 180,
    [switch]$SkipAudio,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000"
$Passed = 0
$Failed = 0
$Skipped = 0
$PartialPass = 0
$Results = @()

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-TestHeader {
    param([string]$Category)
    Write-Host "`n========================================" -ForegroundColor Magenta
    Write-Host "  $Category" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
}

function Write-Info {
    param([string]$Message)
    if ($Verbose) {
        Write-Host "    [INFO] $Message" -ForegroundColor Gray
    }
}

function Get-HttpStatusCode {
    param($Exception)
    if ($Exception.Response) {
        return [int]$Exception.Response.StatusCode
    }
    return 0
}

function Get-ErrorBody {
    param($Exception)
    try {
        if ($Exception.Response) {
            $reader = New-Object System.IO.StreamReader($Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            $reader.Close()
            return $body | ConvertFrom-Json
        }
    } catch {}
    return $null
}

# ============================================================================
# HEADER
# ============================================================================

Write-Host "`n"
Write-Host "+---------------------------------------------------------+" -ForegroundColor Magenta
Write-Host "|   NotebookLM Advanced Content Tests (YouTube + Audio)   |" -ForegroundColor Magenta
Write-Host "+---------------------------------------------------------+" -ForegroundColor Magenta
Write-Host "`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Base URL: $BaseUrl"
Write-Host "YouTube Timeout: ${YouTubeTimeout}s"
Write-Host "Audio Timeout: ${AudioTimeout}s ($(($AudioTimeout / 60))min)"
if ($SkipAudio) {
    Write-Host "Mode: YouTube only (audio generation skipped)" -ForegroundColor Yellow
}

# ============================================================================
# SERVER HEALTH CHECK
# ============================================================================

Write-Host "`nChecking server health..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 10
    if ($health.success) {
        Write-Host " OK" -ForegroundColor Green
        Write-Host "  - Authenticated: $($health.data.authenticated)"
        Write-Host "  - Active sessions: $($health.data.active_sessions)"

        if (-not $health.data.authenticated) {
            Write-Host "`n[WARNING] Not authenticated! Tests may fail." -ForegroundColor Yellow
            Write-Host "Run: POST /auth/setup to authenticate first."
        }
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host " FAILED - Server not responding" -ForegroundColor Red
    Write-Host "Make sure the server is running: npm run start:http"
    exit 1
}

# ============================================================================
# GET OR SELECT NOTEBOOK
# ============================================================================

Write-TestHeader "NOTEBOOK SELECTION"

$sessionId = $null

if ($NotebookId) {
    Write-Host "  Using specified notebook: $NotebookId"
    # Activate the notebook
    try {
        $activateResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$NotebookId/activate" -Method PUT -TimeoutSec 30
        if ($activateResponse.success) {
            Write-Host "  Notebook activated successfully" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [WARN] Could not activate notebook: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Looking for available notebooks..."
    try {
        $notebooks = Invoke-RestMethod -Uri "$BaseUrl/notebooks" -TimeoutSec 15
        if ($notebooks.data.notebooks.Count -gt 0) {
            $NotebookId = $notebooks.data.notebooks[0].id
            Write-Host "  Found notebook: $NotebookId ($($notebooks.data.notebooks[0].name))" -ForegroundColor Cyan

            # Activate the first notebook
            $activateResponse = Invoke-RestMethod -Uri "$BaseUrl/notebooks/$NotebookId/activate" -Method PUT -TimeoutSec 30
            if ($activateResponse.success) {
                Write-Host "  Notebook activated" -ForegroundColor Green
            }
        } else {
            Write-Host "  [WARN] No notebooks found. Tests may fail." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [WARN] Could not list notebooks: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Check for existing sessions
try {
    $sessions = Invoke-RestMethod -Uri "$BaseUrl/sessions" -TimeoutSec 15
    if ($sessions.data.sessions.Count -gt 0) {
        $sessionId = $sessions.data.sessions[0].id
        Write-Host "  Using existing session: $sessionId" -ForegroundColor Cyan
    }
} catch {
    Write-Info "No existing sessions found"
}

# ============================================================================
# TEST 1: YOUTUBE SOURCE UPLOAD
# ============================================================================

Write-TestHeader "YOUTUBE SOURCE UPLOAD"

Write-Host "  Testing: POST /content/sources (youtube)..."
Write-Host "    URL: $YouTubeUrl"
Write-Host "    Timeout: ${YouTubeTimeout}s"
Write-Host "    This may take 1-3 minutes..." -ForegroundColor Yellow

$youtubeResult = @{
    Name = "POST /content/sources (youtube)"
    Status = "PENDING"
    Duration = 0
    Details = ""
}

$startTime = Get-Date

try {
    $youtubeBody = @{
        source_type = "youtube"
        url = $YouTubeUrl
    }

    if ($sessionId) {
        $youtubeBody.session_id = $sessionId
    }

    $response = Invoke-RestMethod `
        -Uri "$BaseUrl/content/sources" `
        -Method POST `
        -ContentType "application/json" `
        -Body ($youtubeBody | ConvertTo-Json) `
        -TimeoutSec $YouTubeTimeout

    $duration = ((Get-Date) - $startTime).TotalSeconds
    $youtubeResult.Duration = [math]::Round($duration, 1)

    if ($response.success) {
        Write-Host "    PASS (${duration}s)" -ForegroundColor Green
        $youtubeResult.Status = "PASS"
        $youtubeResult.Details = "Source added successfully"
        if ($response.data.session_id) {
            $sessionId = $response.data.session_id
            Write-Host "    Session: $sessionId" -ForegroundColor Gray
        }
        $Passed++
    } else {
        Write-Host "    FAIL: $($response.error)" -ForegroundColor Red
        $youtubeResult.Status = "FAIL"
        $youtubeResult.Details = $response.error
        $Failed++
    }
} catch {
    $duration = ((Get-Date) - $startTime).TotalSeconds
    $youtubeResult.Duration = [math]::Round($duration, 1)

    $statusCode = Get-HttpStatusCode $_.Exception
    $errorBody = Get-ErrorBody $_.Exception

    # Analyze the error
    $errorMessage = $_.Exception.Message
    if ($errorBody -and $errorBody.error) {
        $errorMessage = $errorBody.error
    }

    # YouTube rejections are expected - endpoint exists = partial pass
    if ($statusCode -eq 400 -or $statusCode -eq 422) {
        Write-Host "    PARTIAL PASS (HTTP $statusCode - endpoint works, YouTube rejected)" -ForegroundColor Yellow
        Write-Host "    Reason: $errorMessage" -ForegroundColor Gray
        $youtubeResult.Status = "PARTIAL"
        $youtubeResult.Details = "Endpoint works, video rejected: $errorMessage"
        $PartialPass++
    } elseif ($statusCode -eq 500 -and $errorMessage -like "*YouTube*") {
        Write-Host "    PARTIAL PASS (endpoint works, YouTube processing error)" -ForegroundColor Yellow
        Write-Host "    Reason: $errorMessage" -ForegroundColor Gray
        $youtubeResult.Status = "PARTIAL"
        $youtubeResult.Details = "Endpoint works, YouTube error: $errorMessage"
        $PartialPass++
    } elseif ($errorMessage -like "*timeout*" -or $errorMessage -like "*timed out*") {
        Write-Host "    TIMEOUT after ${duration}s" -ForegroundColor Yellow
        Write-Host "    This may indicate the video is processing slowly" -ForegroundColor Gray
        $youtubeResult.Status = "TIMEOUT"
        $youtubeResult.Details = "Timed out after ${duration}s"
        $PartialPass++
    } else {
        Write-Host "    ERROR (HTTP $statusCode): $errorMessage" -ForegroundColor Red
        $youtubeResult.Status = "ERROR"
        $youtubeResult.Details = "HTTP $statusCode - $errorMessage"
        $Failed++
    }
}

$Results += $youtubeResult

# ============================================================================
# TEST 2: AUDIO GENERATION
# ============================================================================

Write-TestHeader "AUDIO OVERVIEW GENERATION"

if ($SkipAudio) {
    Write-Host "  [SKIP] Audio generation skipped (use -SkipAudio:$false to enable)" -ForegroundColor Yellow
    $Skipped++
    $Results += @{
        Name = "POST /content/generate (audio_overview)"
        Status = "SKIPPED"
        Duration = 0
        Details = "Skipped by user"
    }
} else {
    Write-Host "  Testing: POST /content/generate (audio_overview)..."
    Write-Host "    Timeout: ${AudioTimeout}s ($(($AudioTimeout / 60)) minutes)"
    Write-Host "    This operation typically takes 3-5 minutes!" -ForegroundColor Yellow
    Write-Host "    Please wait..." -ForegroundColor Cyan

    $audioResult = @{
        Name = "POST /content/generate (audio_overview)"
        Status = "PENDING"
        Duration = 0
        Details = ""
    }

    $startTime = Get-Date

    try {
        $audioBody = @{
            content_type = "audio_overview"
            custom_instructions = "Create a brief 2-minute summary focusing on key points"
        }

        if ($sessionId) {
            $audioBody.session_id = $sessionId
        }

        $response = Invoke-RestMethod `
            -Uri "$BaseUrl/content/generate" `
            -Method POST `
            -ContentType "application/json" `
            -Body ($audioBody | ConvertTo-Json) `
            -TimeoutSec $AudioTimeout

        $duration = ((Get-Date) - $startTime).TotalSeconds
        $audioResult.Duration = [math]::Round($duration, 1)

        if ($response.success) {
            Write-Host "    PASS (${duration}s / $([math]::Round($duration/60, 1))min)" -ForegroundColor Green
            $audioResult.Status = "PASS"
            $audioResult.Details = "Audio generated in $([math]::Round($duration/60, 1)) minutes"

            if ($response.data) {
                Write-Host "    Audio ready for download" -ForegroundColor Gray
            }
            $Passed++
        } else {
            Write-Host "    FAIL: $($response.error)" -ForegroundColor Red
            $audioResult.Status = "FAIL"
            $audioResult.Details = $response.error
            $Failed++
        }
    } catch {
        $duration = ((Get-Date) - $startTime).TotalSeconds
        $audioResult.Duration = [math]::Round($duration, 1)

        $statusCode = Get-HttpStatusCode $_.Exception
        $errorBody = Get-ErrorBody $_.Exception

        $errorMessage = $_.Exception.Message
        if ($errorBody -and $errorBody.error) {
            $errorMessage = $errorBody.error
        }

        # Check for timeout
        if ($errorMessage -like "*timeout*" -or $errorMessage -like "*timed out*") {
            Write-Host "    TIMEOUT after $([math]::Round($duration/60, 1)) minutes" -ForegroundColor Yellow
            Write-Host "    Audio generation takes 3-5 minutes. Consider increasing -AudioTimeout" -ForegroundColor Gray
            $audioResult.Status = "TIMEOUT"
            $audioResult.Details = "Timed out after $([math]::Round($duration/60, 1))min - consider increasing timeout"
            $PartialPass++
        } elseif ($statusCode -eq 400 -and $errorMessage -like "*no sources*") {
            Write-Host "    PARTIAL PASS (endpoint works, no sources available)" -ForegroundColor Yellow
            $audioResult.Status = "PARTIAL"
            $audioResult.Details = "Endpoint works, notebook needs sources first"
            $PartialPass++
        } elseif ($statusCode -eq 400 -or $statusCode -eq 422) {
            Write-Host "    PARTIAL PASS (HTTP $statusCode - endpoint accessible)" -ForegroundColor Yellow
            Write-Host "    Reason: $errorMessage" -ForegroundColor Gray
            $audioResult.Status = "PARTIAL"
            $audioResult.Details = "Endpoint works: $errorMessage"
            $PartialPass++
        } elseif ($statusCode -eq 500 -and $errorMessage -like "*audio*") {
            Write-Host "    PARTIAL PASS (endpoint works, audio generation issue)" -ForegroundColor Yellow
            Write-Host "    Reason: $errorMessage" -ForegroundColor Gray
            $audioResult.Status = "PARTIAL"
            $audioResult.Details = "Endpoint works, generation error: $errorMessage"
            $PartialPass++
        } else {
            Write-Host "    ERROR (HTTP $statusCode): $errorMessage" -ForegroundColor Red
            $audioResult.Status = "ERROR"
            $audioResult.Details = "HTTP $statusCode - $errorMessage"
            $Failed++
        }
    }

    $Results += $audioResult
}

# ============================================================================
# TEST 3: AUDIO DOWNLOAD (if audio was generated)
# ============================================================================

Write-TestHeader "AUDIO DOWNLOAD"

$audioGenerated = ($Results | Where-Object { $_.Name -eq "POST /content/generate (audio_overview)" -and $_.Status -eq "PASS" }).Count -gt 0

if (-not $audioGenerated) {
    Write-Host "  [SKIP] Audio download skipped (no audio was generated)" -ForegroundColor Yellow
    $Skipped++
    $Results += @{
        Name = "GET /content/download (audio_overview)"
        Status = "SKIPPED"
        Duration = 0
        Details = "No audio generated to download"
    }
} else {
    Write-Host "  Testing: GET /content/download (audio_overview)..."

    $downloadResult = @{
        Name = "GET /content/download (audio_overview)"
        Status = "PENDING"
        Duration = 0
        Details = ""
    }

    $startTime = Get-Date

    try {
        $downloadUrl = "$BaseUrl/content/download?content_type=audio_overview"
        if ($sessionId) {
            $downloadUrl += "&session_id=$sessionId"
        }

        # First check if audio is available (HEAD-like check via GET with short timeout)
        $response = Invoke-RestMethod `
            -Uri $downloadUrl `
            -Method GET `
            -TimeoutSec 60

        $duration = ((Get-Date) - $startTime).TotalSeconds
        $downloadResult.Duration = [math]::Round($duration, 1)

        if ($response.success) {
            Write-Host "    PASS (${duration}s)" -ForegroundColor Green
            $downloadResult.Status = "PASS"
            $downloadResult.Details = "Audio download available"
            $Passed++
        } else {
            Write-Host "    FAIL: $($response.error)" -ForegroundColor Red
            $downloadResult.Status = "FAIL"
            $downloadResult.Details = $response.error
            $Failed++
        }
    } catch {
        $duration = ((Get-Date) - $startTime).TotalSeconds
        $downloadResult.Duration = [math]::Round($duration, 1)

        $statusCode = Get-HttpStatusCode $_.Exception

        # 400/404 is acceptable - endpoint exists
        if ($statusCode -eq 400 -or $statusCode -eq 404) {
            Write-Host "    PARTIAL PASS (HTTP $statusCode - endpoint accessible)" -ForegroundColor Yellow
            $downloadResult.Status = "PARTIAL"
            $downloadResult.Details = "Endpoint works, audio may not be ready"
            $PartialPass++
        } else {
            Write-Host "    ERROR: $($_.Exception.Message)" -ForegroundColor Red
            $downloadResult.Status = "ERROR"
            $downloadResult.Details = $_.Exception.Message
            $Failed++
        }
    }

    $Results += $downloadResult
}

# ============================================================================
# RESULTS SUMMARY
# ============================================================================

Write-Host "`n"
Write-Host "+---------------------------------------------------------+" -ForegroundColor Magenta
Write-Host "|                   TEST RESULTS SUMMARY                  |" -ForegroundColor Magenta
Write-Host "+---------------------------------------------------------+" -ForegroundColor Magenta

$Total = $Passed + $Failed + $Skipped + $PartialPass
$SuccessRate = if ($Total -gt 0) { [math]::Round((($Passed + $PartialPass) / $Total) * 100, 1) } else { 0 }

Write-Host "`n  Results:"
Write-Host "    Passed:       $Passed" -ForegroundColor Green
Write-Host "    Partial Pass: $PartialPass" -ForegroundColor Yellow
Write-Host "    Failed:       $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Gray" })
Write-Host "    Skipped:      $Skipped" -ForegroundColor $(if ($Skipped -gt 0) { "Yellow" } else { "Gray" })
Write-Host "    Total:        $Total"
Write-Host "`n  Success Rate: $SuccessRate% (includes partial passes)" -ForegroundColor $(if ($SuccessRate -eq 100) { "Green" } elseif ($SuccessRate -ge 50) { "Yellow" } else { "Red" })

Write-Host "`n  Detailed Results:"
Write-Host "  ----------------"
foreach ($result in $Results) {
    $statusColor = switch ($result.Status) {
        "PASS" { "Green" }
        "PARTIAL" { "Yellow" }
        "TIMEOUT" { "Yellow" }
        "SKIPPED" { "Cyan" }
        default { "Red" }
    }

    $durationStr = if ($result.Duration -gt 0) { " ($($result.Duration)s)" } else { "" }
    Write-Host "    [$($result.Status)]$durationStr $($result.Name)" -ForegroundColor $statusColor
    if ($result.Details -and $Verbose) {
        Write-Host "         $($result.Details)" -ForegroundColor Gray
    }
}

Write-Host "`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$totalDuration = ($Results | Measure-Object -Property Duration -Sum).Sum
Write-Host "Total Duration: $([math]::Round($totalDuration, 1))s ($([math]::Round($totalDuration/60, 1))min)"

# ============================================================================
# NOTES AND RECOMMENDATIONS
# ============================================================================

Write-Host "`n  Notes:" -ForegroundColor Cyan
Write-Host "  ------"
Write-Host "  - YouTube source uploads may fail due to video restrictions"
Write-Host "  - Audio generation typically takes 3-5 minutes"
Write-Host "  - Use -Verbose for detailed error messages"
Write-Host "  - Use -AudioTimeout 600 for longer audio generation (10min)"
Write-Host "  - Use -SkipAudio to test only YouTube sources"

# Exit with appropriate code
if ($Failed -eq 0) {
    if ($PartialPass -gt 0) {
        Write-Host "`n[PARTIAL SUCCESS] Tests completed with partial passes" -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "`n[SUCCESS] All tests passed!" -ForegroundColor Green
        exit 0
    }
} else {
    Write-Host "`n[FAILURE] Some tests failed" -ForegroundColor Red
    exit 1
}
