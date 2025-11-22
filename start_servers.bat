@echo off
REM Script para iniciar CELUPRO - Backend y Frontend

echo.
echo ========================================
echo        INICIANDO CELUPRO
echo ========================================
echo.

REM Start backend in background
echo [1/2] Iniciando Backend en puerto 5000...
start "CELUPRO Backend" python backend/app.py

REM Wait 3 seconds
timeout /t 3 /nobreak

REM Start frontend in background
echo [2/2] Iniciando Frontend en puerto 3000...
start "CELUPRO Frontend" python frontend/server.py

echo.
echo ========================================
echo   Backend: http://localhost:5000
echo   Frontend: http://localhost:3000
echo ========================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause
