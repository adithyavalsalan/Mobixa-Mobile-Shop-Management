@echo off
title MOBIXA - Initial Setup
echo ========================================================
echo            MOBIXA Mobile Shop Management System
echo                       Initial Setup
echo ========================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH!
    echo Please install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
)

echo [1/3] Checking environment configuration...
if not exist .env (
    copy .env.example .env
    echo .env created from .env.example.
    echo Configure JWT_SECRET, ADMIN_PASSWORD, and EMPLOYEE_PASSWORD in .env before seeding.
) else (
    echo .env already exists.
)

echo.
echo Configure JWT_SECRET, ADMIN_PASSWORD, and EMPLOYEE_PASSWORD in .env now.
echo JWT_SECRET must be at least 32 characters; account passwords must be at least 12.
echo Press any key after saving .env to continue setup.
pause

echo.
echo [2/3] Installing project dependencies...
call npm.cmd install
if %errorlevel% neq 0 (
    echo Trying npm fallback...
    call npm install
)

echo.
echo [3/3] Seeding initial database records...
call npm.cmd run seed
if %errorlevel% neq 0 (
    echo [NOTICE] Configure the required secrets and ensure MongoDB is available, then run npm.cmd run seed.
)

echo.
echo ========================================================
echo               Setup Completed Successfully!
echo ========================================================
echo Set your login passwords in .env before using the application.
echo.
echo You can now double-click 'start.bat' to launch the app!
echo.
pause
