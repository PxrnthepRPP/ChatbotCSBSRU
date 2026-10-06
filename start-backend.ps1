# ==========================================
# BSRU Student Portal — Quick Start Script (PowerShell)
# ==========================================
# ใช้สำหรับรัน Spring Boot Backend อย่างรวดเร็ว
# โดยจะโหลดค่าจากไฟล์ .env ให้อัตโนมัติ
#
# วิธีใช้: .\start-backend.ps1 หรือ ดับเบิลคลิก start-backend.bat
# ==========================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "   BSRU Student Portal - Backend Starter" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# 1. โหลดค่าจาก .env
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    $exampleFile = Join-Path $PSScriptRoot ".env.example"
    if (Test-Path $exampleFile) {
        Write-Host "[WARN] .env not found. Creating from .env.example ..." -ForegroundColor Yellow
        Copy-Item $exampleFile $envFile
        Write-Host "[OK] Created .env file." -ForegroundColor Green
    } else {
        Write-Host "[ERR] .env file not found! Please create .env first." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

Write-Host "[INFO] Loading environment variables from .env ..." -ForegroundColor Yellow
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $val = $parts[1].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
            Set-Item -Path "env:$key" -Value $val
        }
    }
}
Write-Host "[OK] Environment variables loaded." -ForegroundColor Green

# 2. ตรวจสอบ Docker Database
if (Get-Command docker -ErrorAction SilentlyContinue) {
    try {
        $dbStatus = docker ps --filter "name=bsru_vector_db" --filter "status=running" -q 2>$null
        if (-not $dbStatus) {
            Write-Host "[INFO] Starting database container (bsru_vector_db)..." -ForegroundColor Yellow
            docker start bsru_vector_db 2>$null
            if ($LASTEXITCODE -ne 0) {
                docker compose up -d bsru_vector_db 2>$null
            }
        }
    } catch {}
}

# 3. ตรวจสอบ JAVA_HOME
if (-not $env:JAVA_HOME) {
    $jdkPaths = @(
        "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot",
        "C:\Program Files\Java\jdk-21",
        "C:\Program Files\Eclipse Adoptium\jdk-21"
    )
    foreach ($p in $jdkPaths) {
        if (Test-Path $p) {
            $env:JAVA_HOME = $p
            [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $p, "Process")
            $env:PATH = "$p\bin;" + $env:PATH
            break
        }
    }
}

# 4. แสดงข้อมูลสรุป
Write-Host ""
$keyPreview = if ($env:GEMINI_API_KEY -and $env:GEMINI_API_KEY.Length -gt 10) { $env:GEMINI_API_KEY.Substring(0, 10) + "..." } else { "(not set)" }
Write-Host "[INFO] Gemini API Key: $keyPreview" -ForegroundColor Gray
Write-Host "[INFO] Database:       $env:SPRING_DATASOURCE_URL" -ForegroundColor Gray
Write-Host "[INFO] Server Port:    $env:SERVER_PORT" -ForegroundColor Gray
Write-Host ""
Write-Host "[INFO] Starting Spring Boot Backend ..." -ForegroundColor Green
Write-Host ""

# 5. หา Maven Executable
$mvnwCmd = Join-Path $PSScriptRoot "mvnw.cmd"
if (Test-Path $mvnwCmd) {
    & $mvnwCmd spring-boot:run
} elseif (Get-Command mvn -ErrorAction SilentlyContinue) {
    mvn spring-boot:run
} else {
    Write-Host "[ERR] Maven not found. Please install Maven or check mvnw.cmd." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERR] Backend stopped with exit code $LASTEXITCODE." -ForegroundColor Red
    Read-Host "Press Enter to close..."
}
