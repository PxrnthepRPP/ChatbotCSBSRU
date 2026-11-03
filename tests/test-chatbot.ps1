# ============================================================
# BSRU AI Chatbot - Question Test Runner
# ============================================================
# Sends every question in chatbot-test-questions.json to /api/chat
# and writes the answers to chatbot-test-report.md for review.
#
# Usage:  .\tests\test-chatbot.ps1
#         .\tests\test-chatbot.ps1 -Only A3,C1
# ============================================================
param(
    [string[]]$Only = @(),
    # Pause between questions so the Gemini free tier per-minute quota is not exceeded (HTTP 429)
    [int]$DelaySeconds = 8
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$backendUrl = "http://127.0.0.1:8080"
$questionsFile = Join-Path $PSScriptRoot "chatbot-test-questions.json"
$reportFile = Join-Path $PSScriptRoot "chatbot-test-report.md"

function Invoke-Chat([string]$message, [string]$token) {
    $json = @{ message = $message } | ConvertTo-Json -Compress
    $headers = @{}
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    # Send and read as UTF-8 explicitly; Windows PowerShell 5.1 would otherwise garble Thai text
    $res = Invoke-WebRequest -Uri "$backendUrl/api/chat" -Method Post -UseBasicParsing -TimeoutSec 180 `
        -Headers $headers -ContentType "application/json; charset=utf-8" `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($json))
    $text = [System.Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
    return ($text | ConvertFrom-Json).reply
}

function Test-GeminiFailed([string]$since) {
    # ChatController silently falls back to canned answers when Gemini fails, so check the backend log
    $log = docker logs --since $since bsru_backend 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    $hit = $log | Select-String -Pattern "Gemini API call encountered an issue: (.*)" | Select-Object -Last 1
    if ($hit) { return ($hit.Matches[0].Groups[1].Value -replace '\.* Using intelligent assistant fallback\.*', '').Trim() }
    return ""
}

Write-Host ""
Write-Host "=== BSRU AI Chatbot - Question Test ===" -ForegroundColor Cyan

$questions = Get-Content $questionsFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Only.Count -gt 0) { $questions = $questions | Where-Object { $Only -contains $_.id } }

try {
    $login = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" -Method Post `
        -ContentType "application/json" -Body '{"username":"6621100042","password":"password"}'
    $studentToken = $login.token
    Write-Host "[OK] Logged in as student 6621100042" -ForegroundColor Green
} catch {
    Write-Host "[ERR] Cannot log in at $backendUrl - is the backend running? ($_)" -ForegroundColor Red
    exit 1
}

$report = New-Object System.Collections.Generic.List[string]
$report.Add("# Chatbot Test Report")
$report.Add("")
$report.Add("Run at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$report.Add("")
$summary = New-Object System.Collections.Generic.List[string]
$geminiDown = 0

$first = $true
foreach ($q in $questions) {
    if (-not $first) { Start-Sleep -Seconds $DelaySeconds }
    $first = $false
    Write-Host ""
    Write-Host "[$($q.id)] $($q.question)" -ForegroundColor Yellow
    $token = if ($q.role -eq "guest") { $null } else { $studentToken }
    $since = (Get-Date).ToUniversalTime().AddSeconds(-1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $reply = Invoke-Chat $q.question $token
    } catch {
        $reply = "(request failed: $_)"
    }
    $seconds = [math]::Round($watch.Elapsed.TotalSeconds, 1)
    $geminiError = Test-GeminiFailed $since

    if ($geminiError) {
        $status = "GEMINI ERROR"
        $geminiDown++
    } else {
        $missing = @($q.mustMatch | Where-Object { $reply -notmatch $_ })
        $status = if ($q.mustMatch.Count -eq 0) { "CHECK MANUALLY" } elseif ($missing.Count -eq 0) { "PASS" } else { "CHECK: missing $($missing -join ', ')" }
    }

    $color = switch -Wildcard ($status) { "PASS" { "Green" } "GEMINI*" { "Red" } default { "DarkYellow" } }
    Write-Host $reply
    Write-Host "  -> $status (${seconds}s)" -ForegroundColor $color

    $summary.Add("| $($q.id) | $($q.category) | $status | ${seconds}s |")
    $report.Add("## $($q.id) - $($q.category)")
    $report.Add("")
    $report.Add("**Question ($($q.role)):** $($q.question)")
    $report.Add("")
    $report.Add("**Expected:** $($q.expect)")
    $report.Add("")
    $report.Add("**Result:** $status (${seconds}s)")
    if ($geminiError) { $report.Add(""); $report.Add("**Gemini error:** $geminiError") }
    $report.Add("")
    $report.Add("**Answer:**")
    $report.Add("")
    $report.Add($reply)
    $report.Add("")
    $report.Add("---")
    $report.Add("")
}

$table = @("| ID | Category | Result | Time |", "|---|---|---|---|") + $summary
$final = @($report[0..3]) + $table + @("") + @($report[4..($report.Count - 1)])
[System.IO.File]::WriteAllLines($reportFile, [string[]]$final, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Report written to $reportFile" -ForegroundColor Cyan
if ($geminiDown -gt 0) {
    Write-Host "[WARN] $geminiDown answer(s) came from the offline fallback, not Gemini. Check GEMINI_API_KEY in .env" -ForegroundColor Red
}
