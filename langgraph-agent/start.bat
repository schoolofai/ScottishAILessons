@echo off
REM LangGraph Chat Application Startup Script for Windows
REM This script starts both the backend and frontend servers and opens the browser

echo ========================================
echo Starting LangGraph Chat Application...
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed. Please install Python 3.11+ first.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Get the script directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo Working directory: %SCRIPT_DIR%
echo.

REM Check if virtual environment exists
if not exist "..\venv" (
    echo Creating Python virtual environment...
    cd ..
    python -m venv venv
    cd "%SCRIPT_DIR%"
)

REM Activate virtual environment
echo Setting up backend...
call ..\venv\Scripts\activate

REM Check if langgraph is installed
pip show langgraph-cli >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing backend dependencies...
    pip install -e . "langgraph-cli[inmem]" >nul 2>&1
    echo Backend dependencies installed
)

REM Check if .env file exists
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env file from .env.example...
        copy .env.example .env >nul
        echo Please add your API keys to .env file if needed
    )
)

REM Start backend server
echo Starting LangGraph backend server...
echo. > backend.log
start /b cmd /c "langgraph dev > backend.log 2>&1"

REM Wait for backend to be ready
echo Waiting for backend to start...
:WAIT_BACKEND
timeout /t 2 /nobreak >nul
curl -s http://localhost:2024/docs >nul 2>&1
if %errorlevel% equ 0 (
    echo Backend is ready!
) else (
    goto WAIT_BACKEND
)

REM Setup frontend
echo Setting up frontend...
cd assistant-ui-frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install --legacy-peer-deps > ..\frontend-install.log 2>&1
    echo Frontend dependencies installed
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo Creating .env.local for frontend...
    (
        echo # Frontend environment variables
        echo NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
        echo NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=agent
    ) > .env.local
    echo Frontend configuration created
)

REM Start frontend server
echo Starting Assistant-UI frontend...
echo. > ..\frontend.log
start /b cmd /c "npm run dev > ..\frontend.log 2>&1"

REM Wait for frontend to be ready
echo Waiting for frontend to start...
:WAIT_FRONTEND
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo Frontend is ready!
) else (
    goto WAIT_FRONTEND
)

echo.
echo ========================================
echo Application is running!
echo ========================================
echo.
echo Frontend (Chat UI): http://localhost:3000
echo Backend API: http://localhost:2024
echo API Documentation: http://localhost:2024/docs
echo LangGraph Studio: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
echo.

REM Open browser
echo Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo Browser opened
echo.
echo Press Ctrl+C in each command window to stop the servers
echo Logs: backend.log, frontend.log
echo.
echo.
echo To view logs in real-time, open new command windows and run:
echo   type backend.log (for backend logs)
echo   type frontend.log (for frontend logs)
echo.
echo Press any key to exit (this will stop the servers)...
pause >nul

echo.
echo Stopping servers...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im python.exe >nul 2>&1
echo Servers stopped.