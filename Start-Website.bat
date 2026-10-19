@echo off
setlocal
cd /d "%~dp0"
title White Elephant Creative Studio - local preview

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org , then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing the website's building blocks. This takes a minute or two...
  call npm install
  if errorlevel 1 (
    echo Installation failed. Please check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo ================================================================
echo  Starting the White Elephant Creative Studio website preview...
echo  Your browser will open at http://localhost:5173 in a few seconds.
echo.
echo  PREVIEW MODE: the contact form is connected to a FAKE inbox, so
echo  no real email is sent. Close this window to stop the preview.
echo ================================================================
echo.

start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:5173"
call npm run dev:mock -- --port 5173 --strictPort
echo.
echo The preview has stopped. If you saw "Port 5173 is already in use", close any other preview window and try again.
pause
