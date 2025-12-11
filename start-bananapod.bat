@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PREFERRED_PORT=3000"
set "SCAN_LIMIT=50"

where node >nul 2>&1 || (
  echo [ERROR] node not found. Install Node.js LTS from https://nodejs.org
  pause
  exit /b 1
)
where npm >nul 2>&1 || (
  echo [ERROR] npm not found. Ensure Node.js is installed and added to PATH.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] installing dependencies...
  call npm install || (
    echo [ERROR] npm install failed. Try: npm config set registry https://registry.npmmirror.com
    pause
    exit /b 1
  )
)

set "USE_PORT="
if not "%~1"=="" set "USE_PORT=%~1"
if "%USE_PORT%"=="" set "USE_PORT=%PREFERRED_PORT%"

call :is_port_free %USE_PORT%
if errorlevel 1 (
  call :kill_port %USE_PORT%
  call :is_port_free %USE_PORT%
)

call :is_port_free %USE_PORT%
if errorlevel 1 (
  for /l %%i in (1,1,%SCAN_LIMIT%) do (
    set /a TRY_PORT=%PREFERRED_PORT%+%%i
    call :is_port_free !TRY_PORT!
    if errorlevel 0 (
      set "USE_PORT=!TRY_PORT!"
      goto start_server
    )
  )
)

:start_server
echo [INFO] starting dev server on port %USE_PORT%
start "BananaPod Dev" cmd /k "npm run dev -- --port %USE_PORT%"

set "RETRIES=30"
:wait_ready
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:%USE_PORT%/).StatusCode | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  timeout /t 1 >nul
  set /a RETRIES-=1
  if %RETRIES% gtr 0 goto wait_ready
  echo [WARN] dev server not ready. Check the log window.
  pause
  exit /b 1
)

echo [OK] dev server ready at http://localhost:%USE_PORT%/
start "" "http://localhost:%USE_PORT%/"
pause
exit /b 0

:is_port_free
set "CHK_PORT=%1"
netstat -ano | findstr ":%CHK_PORT%" | findstr /I "LISTENING" >nul 2>&1 && (exit /b 1) || (exit /b 0)

:kill_port
set "KILL_PORT=%1"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%KILL_PORT%" ^| findstr /I "LISTENING"') do taskkill /PID %%P /F >nul 2>&1
exit /b 0
