@echo off
REM ==========================================
REM BSRU Student Portal - Backend Starter
REM ==========================================
REM Double-click launcher for Windows Explorer
REM Runs start-backend.ps1 via PowerShell
REM ==========================================

cd /d "%~dp0"
title BSRU Student Portal - Backend

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Backend exited with error code %errorlevel%.
    echo.
    pause
)
