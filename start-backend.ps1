# ==========================================
# BSRU Student Portal — Quick Start Script (PowerShell)
# ==========================================
# ใช้สำหรับรัน Spring Boot Backend อย่างรวดเร็ว
# โดยจะโหลดค่าจากไฟล์ .env ให้อัตโนมัติ
#
# วิธีใช้: .\start-backend.ps1
# ==========================================

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "   BSRU Student Portal - Backend Starter" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# โหลดค่าจาก .env
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Write-Host "[INFO] Loading environment variables from .env ..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Length -eq 2) {
                [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
                Set-Item -Path "env:$($parts[0].Trim())" -Value $parts[1].Trim()
            }
        }
    }
    Write-Host "[OK] Environment variables loaded." -ForegroundColor Green
} else {
    Write-Host "[WARN] .env file not found! Copy .env.example to .env first." -ForegroundColor Red
    Write-Host "       copy .env.example .env" -ForegroundColor Gray
    exit 1
}

Write-Host ""
$keyPreview = if ($env:GEMINI_API_KEY.Length -gt 10) { $env:GEMINI_API_KEY.Substring(0, 10) + "..." } else { "(not set)" }
Write-Host "[INFO] Gemini API Key: $keyPreview" -ForegroundColor Gray
Write-Host "[INFO] Database: $env:SPRING_DATASOURCE_URL" -ForegroundColor Gray
Write-Host "[INFO] Server Port: $env:SERVER_PORT" -ForegroundColor Gray
Write-Host ""
Write-Host "[INFO] Starting Spring Boot ..." -ForegroundColor Yellow
Write-Host ""

# รัน Spring Boot
mvn spring-boot:run
