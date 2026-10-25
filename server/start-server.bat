@echo off
cd /d "%~dp0"
node scripts\ensure-port-free.mjs || exit /b 1
node scripts\ensure-local-mongo.mjs || exit /b 1
node --import tsx index.ts 2>&1
