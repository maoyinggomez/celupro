@echo off
setlocal
cd /d "%~dp0\..\.."

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\maintenance\uninstall_print_agent_windows.ps1"

echo.
echo ==========================================
echo CELUPRO: desinstalacion completada
echo ==========================================
pause
