@echo off
REM Script para iniciar CELUPRO en Windows

echo.
echo ============================================
echo       CELUPRO - Iniciando...
echo ============================================
echo.

REM Configurar rutas
set VENV_PYTHON=C:\Users\maoyi\OneDrive\Desktop\proyecto celupro\venv\Scripts\python.exe
set BACKEND=C:\Users\maoyi\OneDrive\Desktop\proyecto celupro\backend
set FRONTEND=C:\Users\maoyi\OneDrive\Desktop\proyecto celupro\frontend

REM Iniciar Backend
echo Iniciando Backend (Puerto 5000)...
start "Backend CELUPRO" "%VENV_PYTHON%" "%BACKEND%\app.py"

REM Esperar
timeout /t 3 /nobreak

REM Iniciar Frontend
echo Iniciando Frontend (Puerto 3000)...
start "Frontend CELUPRO" "%VENV_PYTHON%" "%FRONTEND%\server.py"

echo.
echo ============================================
echo      CELUPRO INICIADO
echo ============================================
echo.
echo Acceso: http://localhost:3000
echo Usuario: admin
echo Contraseña: admin123
echo.
echo Las ventanas de terminal se abrirán automáticamente.
echo Cierra esta ventana cuando termines.
echo.
pause
