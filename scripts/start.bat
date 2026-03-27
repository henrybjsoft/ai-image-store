@echo off
echo ========================================
echo   Image Asset Management - Production
echo ========================================
echo.

cd server

if not exist .env (
    echo ERROR: .env file not found
    echo Please copy .env.example to .env and configure it
    pause
    exit /b 1
)

findstr /C:"DASHSCOPE_API_KEY" .env >nul
if errorlevel 1 (
    echo WARNING: DASHSCOPE_API_KEY not configured
    echo Please configure API Key in .env file
)

echo Starting server...
echo URL: http://localhost:3000
echo.

set NODE_ENV=production
node src/app.js