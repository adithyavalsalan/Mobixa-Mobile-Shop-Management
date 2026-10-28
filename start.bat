@echo off
title MOBIXA Server
echo ========================================================
echo            MOBIXA Mobile Shop Management System
echo                       Launching...
echo ========================================================
echo.

if not exist .env (
    copy .env.example .env >nul
)

echo Configure JWT_SECRET, ADMIN_PASSWORD, and EMPLOYEE_PASSWORD in .env before first use.
echo.
echo Application will be available at: http://localhost:5000
echo.

REM Automatically open browser after short delay in background
start /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

echo Starting server on http://localhost:5000 ...
node backend/server.js
pause
