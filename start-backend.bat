@echo off
REM ==========================================
REM BSRU Student Portal — Quick Start Script
REM ==========================================
REM ใช้สำหรับรัน Spring Boot Backend อย่างรวดเร็ว
REM โดยจะโหลดค่าจากไฟล์ .env ให้อัตโนมัติ
REM ==========================================

echo.
echo  ========================================
echo   BSRU Student Portal - Backend Starter
echo  ========================================
echo.

REM โหลดค่าจาก .env
if exist ".env" (
    echo [INFO] Loading environment variables from .env ...
    for /F "usebackq tokens=1,* delims==" %%A in (".env") do (
        REM ข้ามบรรทัด comment (#) และบรรทัดว่าง
        echo %%A | findstr /r "^#" >nul 2>&1 || (
            if not "%%A"=="" (
                set "%%A=%%B"
            )
        )
    )
    echo [OK] Environment variables loaded.
) else (
    echo [WARN] .env file not found! Copy .env.example to .env first.
    echo        copy .env.example .env
    echo.
    pause
    exit /b 1
)

echo.
echo [INFO] Starting Spring Boot on port %SERVER_PORT% ...
echo [INFO] Gemini API Key: %GEMINI_API_KEY:~0,10%...
echo [INFO] Database: %SPRING_DATASOURCE_URL%
echo.

REM รัน Spring Boot
mvn spring-boot:run

pause
