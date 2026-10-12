@echo off
rem Starts the local database and the dev server in two windows, then opens the app.
rem Double-click this file, or run it from a terminal in the project folder.
cd /d "%~dp0"
set CHECKPOINT_DISABLE=1

netstat -ano | findstr /r ":5433 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting the database...
  start "Booking System - database" cmd /k "node scripts\dev-db.mjs"
  timeout /t 8 /nobreak >nul
) else (
  echo Database already running.
)

netstat -ano | findstr /r ":3000 .*LISTENING" >nul
if errorlevel 1 (
  echo Starting the app...
  start "Booking System - app" cmd /k "npm run dev"
  timeout /t 12 /nobreak >nul
) else (
  echo App already running.
)

start "" http://localhost:3000
echo.
echo Leave the two windows open while you use the app. Close them to stop it.
timeout /t 5 >nul
