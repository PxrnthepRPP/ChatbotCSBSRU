@echo off
REM ==========================================
REM BSRU Student Portal - Backend Starter
REM ==========================================
REM Double-click launcher for Windows Explorer
REM Runs start-backend.ps1 via PowerShell
REM ==========================================

chcp 65001 >nul 2>&1
cd /d "%~dp0"
title BSRU Student Portal - Backend

where powershell.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] ไม่พบ powershell.exe ในระบบ กรุณาตรวจสอบ PATH หรือติดตั้ง PowerShell
    echo.
    pause
    exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1"
set PS_EXIT=%errorlevel%

REM Don't treat normal termination (0, 130 = SIGINT/Ctrl+C, -1073741510) as error
if %PS_EXIT% neq 0 if %PS_EXIT% neq 130 if %PS_EXIT% neq -1073741510 (
    echo.
    echo [ERROR] Backend exited with error code %PS_EXIT%.
    echo.
    pause
)
