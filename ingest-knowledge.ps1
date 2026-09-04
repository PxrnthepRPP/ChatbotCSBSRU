# ============================================================
# BSRU Student Portal - AI Knowledge Ingestion Script
# ============================================================
param(
    [string]$Source = "",
    [string]$Content = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$backendUrl = "http://127.0.0.1:8080"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  BSRU AI Chatbot - Knowledge Ingestion Tool (RAG Pipeline) " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Backend
try {
    $health = Invoke-RestMethod -Uri "$backendUrl/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "[OK] Spring Boot Backend is running on port 8080" -ForegroundColor Green
} catch {
    Write-Host "[ERR] Cannot connect to Spring Boot Backend at $backendUrl" -ForegroundColor Red
    Write-Host "      Please start backend first: .\start-backend.ps1" -ForegroundColor Yellow
    exit 1
}

# 2. Login to get Admin JWT Token
Write-Host "[INFO] Authenticating as Admin..." -ForegroundColor Gray
try {
    $loginBody = @{
        username = "admin"
        password = "password"
    } | ConvertTo-Json

    $loginRes = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json; charset=utf-8"
    $token = $loginRes.token
    Write-Host "[OK] Admin Token acquired." -ForegroundColor Green
} catch {
    Write-Host "[ERR] Authentication failed: $_" -ForegroundColor Red
    exit 1
}

# 3. Handle Inputs
if (-not $Source) {
    Write-Host ""
    $Source = Read-Host "Enter source name (e.g. curriculum_bsru_2567.pdf)"
    if (-not $Source) { $Source = "manual_entry.txt" }
}

if (-not $Content) {
    Write-Host ""
    Write-Host "Enter knowledge text for AI (type END on a new line when finished):" -ForegroundColor Yellow
    $lines = @()
    while ($true) {
        $l = Read-Host
        if ($l -eq "END") { break }
        $lines += $l
    }
    $Content = $lines -join "`n"
}

if (-not $Content -or $Content.Trim().Length -eq 0) {
    Write-Host "[WARN] Content is empty. Nothing to ingest." -ForegroundColor Yellow
    exit 0
}

# 4. Ingest into PGVector
Write-Host ""
Write-Host "[INFO] Ingesting and embedding document into PGVector..." -ForegroundColor Cyan

try {
    $bodyObj = @{
        content = $Content
        source = $Source
    }
    $jsonBody = $bodyObj | ConvertTo-Json
    $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)

    $headers = @{
        "Authorization" = "Bearer $token"
    }

    $response = Invoke-RestMethod -Uri "$backendUrl/api/admin/knowledge/ingest" -Method Post -Headers $headers -Body $utf8Bytes -ContentType "application/json; charset=utf-8"

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "[SUCCESS] Knowledge successfully ingested and vectorized!" -ForegroundColor Green
    Write-Host "  Source        : $($response.source)" -ForegroundColor White
    Write-Host "  Content Length: $($response.contentLength) characters" -ForegroundColor White
    Write-Host "  Destination   : Table 'bsru_embeddings' in PostgreSQL 16" -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "You can now ask the AI Chatbot questions related to this knowledge!" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "[ERR] Ingestion failed: $_" -ForegroundColor Red
}
