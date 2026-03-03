@echo off
setlocal
cd /d "%~dp0\..\.."

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\maintenance\install_print_agent_windows.ps1" -ApiUrl "http://127.0.0.1:5001/api" -Usuario "admin" -Password "admin123" -Printer "HPRT PPTII-A(6)"

echo.
echo ==========================================
echo CELUPRO: instalacion automatica completada
echo ==========================================
echo Si no hubo errores, ya queda iniciando solo
pause
