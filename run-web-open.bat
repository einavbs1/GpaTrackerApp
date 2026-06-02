@echo off
setlocal
cd /d "%~dp0"

echo Starting web dev server and opening browser...
call npm run dev:web -- --open
