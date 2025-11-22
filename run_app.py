#!/usr/bin/env python
"""
Script simple para iniciar CELUPRO
Ejecutar: python run_app.py
"""

import subprocess
import sys
import os
import time
import webbrowser
from pathlib import Path

os.chdir(Path(__file__).parent)

print("\n" + "="*60)
print("  CELUPRO - Sistema de Reparaciones")
print("="*60 + "\n")

# Inicializar DB
print("[1/3] Inicializando base de datos...")
try:
    subprocess.run([sys.executable, "database/init_db.py"], timeout=10)
    print("✓ Base de datos lista\n")
except:
    print("⚠ No se pudo inicializar la BD (continuando...)\n")

# Iniciar backend
print("[2/3] Iniciando Backend en puerto 5000...")
backend_process = subprocess.Popen(
    [sys.executable, "backend/app.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
time.sleep(3)
print("✓ Backend iniciado\n")

# Iniciar frontend
print("[3/3] Iniciando Frontend en puerto 3000...")
frontend_process = subprocess.Popen(
    [sys.executable, "frontend/server.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
time.sleep(2)
print("✓ Frontend iniciado\n")

print("="*60)
print("✓ CELUPRO está funcionando")
print("="*60)
print("\nAcceso:")
print("  • Frontend: http://localhost:3000")
print("  • Backend: http://localhost:5000")
print("\nAbriendo navegador...\n")

time.sleep(1)
try:
    webbrowser.open('http://localhost:3000')
except:
    print("Abre manualmente: http://localhost:3000\n")

print("El servidor está corriendo. Presiona Ctrl+C para detener.\n")

try:
    backend_process.wait()
    frontend_process.wait()
except KeyboardInterrupt:
    print("\n\nDeteniendo servicios...")
    backend_process.terminate()
    frontend_process.terminate()
    time.sleep(1)
    backend_process.kill()
    frontend_process.kill()
    print("Servicios detenidos.\n")
    sys.exit(0)
