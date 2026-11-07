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
    if ([System.Management.Automation.PSTypeName]'ConsoleUtils') {
        [ConsoleUtils]::DisableQuickEdit()
    }
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
        try { Read-Host "Press Enter to exit..." } catch {}
        exit 1
    }
}

Write-Host "[INFO] Loading environment variables from .env ..." -ForegroundColor Yellow
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim().Trim([char]0xFEFF)
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

# 1.1 Profile: รันบนเครื่องใช้ dev (แสดง SQL log) ถ้าไม่ได้กำหนดไว้เอง
if (-not $env:SPRING_PROFILES_ACTIVE) {
    $env:SPRING_PROFILES_ACTIVE = "dev"
}

# 1.2 JWT_SECRET: backend ไม่มีค่า default แล้ว ถ้าว่างหรือยังเป็นค่าเก่าที่เคยอยู่ใน repo (สาธารณะ) หรือสั้นเกินไป
#     ให้สร้างค่าสุ่มใหม่และบันทึกลง .env (token เดิมจะใช้ไม่ได้ ต้อง login ใหม่)
$legacyJwtSecret = "bsru-student-portal-super-secure-and-ultra-secret-jwt-signing-key-2026-cs-bsru-thailand"
$needsNewSecret = (-not $env:JWT_SECRET) -or ($env:JWT_SECRET -eq $legacyJwtSecret) -or ([System.Text.Encoding]::UTF8.GetByteCount($env:JWT_SECRET) -lt 32)

if ($needsNewSecret) {
    $bytes = New-Object byte[] 64
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $newSecret = [Convert]::ToBase64String($bytes)

    $updatedLines = New-Object System.Collections.Generic.List[string]
    $replaced = $false
    foreach ($envLine in (Get-Content $envFile -Encoding UTF8)) {
        if ($envLine -match '^\s*JWT_SECRET\s*=') {
            $updatedLines.Add("JWT_SECRET=$newSecret")
            $replaced = $true
        } else {
            $updatedLines.Add($envLine)
        }
    }
    if (-not $replaced) { $updatedLines.Add("JWT_SECRET=$newSecret") }
    [System.IO.File]::WriteAllLines($envFile, $updatedLines, (New-Object System.Text.UTF8Encoding($false)))

    $env:JWT_SECRET = $newSecret
    Write-Host "[OK] Generated a new random JWT_SECRET and saved it to .env" -ForegroundColor Green
}

if (-not $env:SPRING_DATASOURCE_PASSWORD) {
    Write-Host "[WARN] SPRING_DATASOURCE_PASSWORD is not set in .env" -ForegroundColor Yellow
}

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

# 2.1 ตรวจสอบว่า Database พร้อมรับ Connection หรือยัง (Port 5432)
$dbPort = 5432
$dbReady = $false
for ($i = 0; $i -lt 5; $i++) {
    $tcp = Test-NetConnection -ComputerName localhost -Port $dbPort -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($tcp) {
        $dbReady = $true
        break
    }
    Start-Sleep -Seconds 1
}
if ($dbReady) {
    Write-Host "[OK] Database (PostgreSQL) is ready on port $dbPort." -ForegroundColor Green
} else {
    Write-Host "[WARN] ไม่พบ Database ตอบรับบน Port $dbPort (หากมี Docker กรุณาตรวจสอบว่า Docker Desktop เปิดอยู่)" -ForegroundColor Yellow
}

# 3. ตรวจสอบ JAVA_HOME และ JDK 21
$isJavaHomeValid = $env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))
if (-not $isJavaHomeValid) {
    $foundJdk = $null
    $candidateDirs = @(
        "C:\Program Files\Microsoft",
        "C:\Program Files\Java",
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Amazon Corretto",
        "C:\Program Files\Zulu",
        "C:\Program Files\BellSoft"
    )
    foreach ($dir in $candidateDirs) {
        if (Test-Path $dir) {
            $jdks = Get-ChildItem -Path $dir -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match "21" -and (Test-Path (Join-Path $_.FullName "bin\java.exe")) }
            if ($jdks) {
                $foundJdk = ($jdks | Select-Object -First 1).FullName
                break
            }
        }
    }
    if (-not $foundJdk) {
        $javaCmd = Get-Command java.exe -ErrorAction SilentlyContinue
        if ($javaCmd) {
            $javaBin = Split-Path $javaCmd.Source -Parent
            $javaRoot = Split-Path $javaBin -Parent
            if (Test-Path (Join-Path $javaRoot "bin\javac.exe")) {
                $foundJdk = $javaRoot
            }
        }
    }
    if ($foundJdk) {
        $env:JAVA_HOME = $foundJdk
        [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $foundJdk, "Process")
        $env:PATH = "$foundJdk\bin;" + $env:PATH
        Write-Host "[OK] Detected JDK 21 at: $foundJdk" -ForegroundColor Green
    }
}

# 4. แสดงข้อมูลสรุป
Write-Host ""
$keyPreview = if ($env:GEMINI_API_KEY -and $env:GEMINI_API_KEY.Length -gt 10) { $env:GEMINI_API_KEY.Substring(0, 10) + "..." } else { "(not set)" }
Write-Host "[INFO] Gemini API Key: $keyPreview" -ForegroundColor Gray
Write-Host "[INFO] Database:       $env:SPRING_DATASOURCE_URL" -ForegroundColor Gray
Write-Host "[INFO] Server Port:    $env:SERVER_PORT" -ForegroundColor Gray
Write-Host "[INFO] Profile:        $env:SPRING_PROFILES_ACTIVE" -ForegroundColor Gray
if ($env:JAVA_HOME) {
    Write-Host "[INFO] Java Home:      $env:JAVA_HOME" -ForegroundColor Gray
}

# 4.1 ตรวจสอบว่า Port กำลังทำงานอยู่แล้วหรือไม่
$portToCheck = if ($env:SERVER_PORT) { [int]$env:SERVER_PORT } else { 8080 }
$existingConn = Get-NetTCPConnection -LocalPort $portToCheck -State Listen -ErrorAction SilentlyContinue
if ($existingConn) {
    Write-Host ""
    Write-Host "[OK] Backend กำลังทำงานอยู่แล้วบน Port $portToCheck (PID: $($existingConn.OwningProcess[0]))" -ForegroundColor Green
    Write-Host "[INFO] สามารถเปิดใช้งานเว็บได้ทันทีที่: http://localhost/ChatbotCSBSRU/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "กดปุ่มใดก็ได้เพื่อปิดหน้าต่างนี้..." -ForegroundColor Gray
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        try { Read-Host "กด Enter เพื่อปิด..." } catch {}
    }
    exit 0
}

Write-Host ""
Write-Host "[INFO] Starting Spring Boot Backend ..." -ForegroundColor Green
Write-Host ""

# 5. หา Maven Executable และเริ่มรัน
$mvnwCmd = Join-Path $PSScriptRoot "mvnw.cmd"
if (Test-Path $mvnwCmd) {
    & $mvnwCmd spring-boot:run
} elseif (Get-Command mvn -ErrorAction SilentlyContinue) {
    mvn spring-boot:run
} else {
    Write-Host "[ERR] ไม่พบ Maven หรือ mvnw.cmd ในโปรเจกต์" -ForegroundColor Red
    try { Read-Host "กด Enter เพื่อออก..." } catch {}
    exit 1
}

# ตรวจสอบ Exit code (0, 130 = Ctrl+C/SIGINT, 3221225786 / -1073741510 = Ctrl+C NTSTATUS)
$exitCode = $LASTEXITCODE
if ($exitCode -eq 0 -or $exitCode -eq 130 -or $exitCode -eq 3221225786 -or $exitCode -eq -1073741510) {
    Write-Host ""
    Write-Host "[INFO] ปิดการทำงาน Backend เรียบร้อยแล้ว" -ForegroundColor Gray
    exit 0
} else {
    Write-Host ""
    Write-Host "[ERR] Backend หยุดทำงานด้วยข้อผิดพลาด (Exit Code: $exitCode)" -ForegroundColor Red
    try { Read-Host "กด Enter เพื่อปิดหน้าต่างนี้..." } catch {}
    exit $exitCode
}
