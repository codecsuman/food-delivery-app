@echo off
chcp 65001 >nul
title Suman Food Server
cls

echo ==========================================
echo    Suman Food Server - Auto Fix
echo ==========================================
echo.

:: Check if port 8001 is in use
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001') do (
    echo [INFO] Port 8001 is in use by PID: %%a
    echo [INFO] Killing process...
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Could not kill process. Trying alternative...
        taskkill /F /IM node.exe >nul 2>&1
    ) else (
        echo [OK] Process killed successfully.
    )
    timeout /t 2 /nobreak >nul
)

echo.
echo [INFO] Starting server with tsx...
echo.

:: Start the server using tsx (modern, no deprecated flags)
npx tsx index.ts

echo.
echo [INFO] Server stopped.
pause