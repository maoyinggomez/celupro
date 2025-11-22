@echo off
chcp 65001 >nul
color 0A
cls

echo.
echo ===================================================
echo   INICIANDO CELUPRO - Sistema de Reparaciones
echo ===================================================
echo.

REM Cambiar al directorio del proyecto
cd /d "%~dp0"

REM Activar entorno virtual
echo [1/4] Activando entorno virtual...
call venv\Scripts\activate.bat

if errorlevel 1 (
    echo Error: No se pudo activar el entorno virtual
    echo Asegúrate de que exists "venv" carpeta
    pause
    exit /b 1
)

echo [2/4] Inicializando base de datos...
python database/init_db.py >nul 2>&1

echo [3/4] Iniciando servidores...
echo.
echo IMPORTANTE: Se abrirán 2 ventanas. Déjalas abiertas para que funcione.
echo.
pause

REM Iniciar backend en una nueva ventana
start cmd /k "title CELUPRO - BACKEND & python backend/app.py"

REM Pequeña pausa para que el backend inicie
timeout /t 2 /nobreak

REM Iniciar frontend en otra ventana
start cmd /k "title CELUPRO - FRONTEND & python frontend/server.py"

timeout /t 2 /nobreak

echo [4/4] Abriendo navegador...
timeout /t 2 /nobreak

REM Abrir el navegador
start http://localhost:3000

echo.
echo ===================================================
echo   CELUPRO iniciado correctamente
echo ===================================================
echo.
echo Acceso en: http://localhost:3000
echo Backend API: http://localhost:5000
echo.
echo Para detener, cierra las ventanas de BACKEND y FRONTEND
echo.
pause
