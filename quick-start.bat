@echo off
title Food App - Quick Start
echo.
echo ==========================================
echo  QUICK START - FOOD APP
echo ==========================================
echo.

echo Starting local MongoDB replica set...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\scripts\start-local-mongo.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Local MongoDB replica set could not be started.
    echo Run this from the project root: npm --prefix server run mongo:start
    echo.
    pause
    exit /b 1
)
echo MongoDB is running! OK
echo.

echo.
echo Starting Backend (Port 8001)...
cd server
call npm run kill
start "Backend Server" cmd /k "npm run dev"
cd ..

echo.
echo Starting Frontend (Port 5173)...
cd client
start "Frontend Server" cmd /k "npm run dev"
cd ..

echo.
echo ==========================================
echo SERVERS STARTING IN SEPARATE WINDOWS
echo ==========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8001
echo Health:   http://localhost:8001/health
echo.
echo Opening browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173
start http://localhost:8001/health
echo.
pause