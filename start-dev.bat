@echo off
title Food App - Development Environment
echo.
echo ==========================================
echo  FOOD APP - DEVELOPMENT STARTER
echo ==========================================
echo.

echo Checking prerequisites...
echo.

echo [1/4] Starting local MongoDB replica set...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\scripts\start-local-mongo.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Local MongoDB replica set could not be started.
    echo Run this from the project root: npm --prefix server run mongo:start
    echo.
    pause
    exit /b 1
)
echo MongoDB OK!

echo.
echo [2/4] Installing/Updating dependencies...
echo.
echo    Backend dependencies...
cd server
npm install 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Backend npm install had issues
)

echo.
echo    Frontend dependencies...
cd ..\client
npm install 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Frontend npm install had issues
)

echo.
echo [3/4] Starting Backend Server (Port 8001)...
cd ..\server
call npm run kill
start "Food App - Backend" cmd /k "npm run dev"

echo.
echo [4/4] Starting Frontend (Port 5173)...
cd ..\client
start "Food App - Frontend" cmd /k "npm run dev"

echo.
echo ==========================================
echo  SERVERS STARTING...
echo ==========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8001
echo Health:   http://localhost:8001/health
echo API Base: http://localhost:8001/api/v1
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul

start http://localhost:5173
start http://localhost:8001/health

echo.
echo ==========================================
echo  BOTH SERVERS RUNNING IN SEPARATE WINDOWS
echo ==========================================
echo.
echo Backend logs:  Check "Food App - Backend" window
echo Frontend logs: Check "Food App - Frontend" window
echo.
echo Press Ctrl+C in those windows to stop servers.
echo.
pause