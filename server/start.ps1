# Suman Food Server - Auto Port Fix
# Run this script to automatically fix port conflicts

$PORT = 8001
$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "    Suman Food Server - Auto Fix" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if port is in use
$connection = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue
if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            Write-Host "[INFO] Port $PORT is in use by: $($process.ProcessName) (PID: $($connection.OwningProcess))" -ForegroundColor Yellow

            Write-Host "[INFO] Killing process..." -ForegroundColor Yellow
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue

            if ($?) {
                        Write-Host "[OK] Process killed successfully." -ForegroundColor Green
            }
            else {
                        Write-Host "[WARN] Trying to kill all node processes..." -ForegroundColor Yellow
                        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
            }

            Start-Sleep -Seconds 2
}
else {
            Write-Host "[OK] Port $PORT is free." -ForegroundColor Green
}

Write-Host ""
Write-Host "[INFO] Starting server with tsx..." -ForegroundColor Cyan
Write-Host ""

# Start the server using tsx
npx tsx index.ts