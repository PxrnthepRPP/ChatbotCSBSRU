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

# ปิด QuickEdit Mode เพื่อป้องกัน Windows Console ค้าง (Freeze) เมื่อคลิกเมาส์ในหน้าต่าง
try {
    $consoleUtils = @'
    using System;
    using System.Runtime.InteropServices;
    public class ConsoleUtils {
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr GetStdHandle(int nStdHandle);
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
        public static void DisableQuickEdit() {
            IntPtr handle = GetStdHandle(-10);
            uint mode;
            if (GetConsoleMode(handle, out mode)) {
                mode &= ~0x0040u; // DISABLE QuickEdit
                mode |= 0x0080u;  // ENABLE Extended Flags
                SetConsoleMode(handle, mode);
            }
        }
    }
'@
    Add-Type -TypeDefinition $consoleUtils -ErrorAction SilentlyContinue
    [ConsoleUtils]::DisableQuickEdit()
} catch {}

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
                docker compose up -d database 2>$null
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
# 4.1 ตรวจสอบว่า Port กำลังทำงานอยู่แล้วหรือไม่
$portToCheck = if ($env:SERVER_PORT) { [int]$env:SERVER_PORT } else { 8080 }
$existingConn = Get-NetTCPConnection -LocalPort $portToCheck -State Listen -ErrorAction SilentlyContinue
if ($existingConn) {
    Write-Host "[OK] Backend กำลังทำงานอยู่แล้วบน Port $portToCheck (PID: $($existingConn.OwningProcess[0]))" -ForegroundColor Green
    Write-Host "[INFO] สามารถเปิดใช้งานเว็บได้ทันทีที่: http://localhost/ChatbotCSBSRU/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "กดปุ่มใดก็ได้เพื่อปิดหน้าต่างนี้..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}

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
