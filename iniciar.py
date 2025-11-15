#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script para iniciar CELUPRO - Versión simplificada"""

import subprocess
import sys
import os
from pathlib import Path

project_root = Path(__file__).parent

print("\n" + "="*60)
print("CELUPRO - Iniciando...")
print("="*60 + "\n")

# Rutas
venv_python = project_root / "venv" / "Scripts" / "python.exe"
backend_dir = project_root / "backend"
frontend_dir = project_root / "frontend"

print(f"Python: {venv_python}")
print(f"Backend: {backend_dir}")
print(f"Frontend: {frontend_dir}\n")

# Verificar que existan
if not venv_python.exists():
    print("❌ Error: No se encuentra Python en el venv")
    sys.exit(1)

if not backend_dir.exists():
    print("❌ Error: No se encuentra directorio backend")
    sys.exit(1)

if not frontend_dir.exists():
    print("❌ Error: No se encuentra directorio frontend")
    sys.exit(1)

print("✅ Archivos verificados\n")

# Iniciar backend
print("Iniciando Backend...")
try:
    backend_process = subprocess.Popen(
        [str(venv_python), "app.py"],
        cwd=str(backend_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    print("✅ Backend iniciado (PID: {})".format(backend_process.pid))
except Exception as e:
    print(f"❌ Error al iniciar backend: {e}")
    sys.exit(1)

import time
time.sleep(3)

# Iniciar frontend
print("Iniciando Frontend...")
try:
    frontend_process = subprocess.Popen(
        [str(venv_python), "server.py"],
        cwd=str(frontend_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    print("✅ Frontend iniciado (PID: {})\n".format(frontend_process.pid))
except Exception as e:
    print(f"❌ Error al iniciar frontend: {e}")
    backend_process.terminate()
    sys.exit(1)

print("="*60)
print("✅ CELUPRO INICIADO")
print("="*60)
print("\nAcceso:")
print("  🌐 http://localhost:3000")
print("  👤 Usuario: admin")
print("  🔑 Contraseña: admin123")
print("\nPresiona Ctrl+C para detener...\n")

try:
    while True:
        time.sleep(1)
        
        # Verificar si los procesos siguen corriendo
        if backend_process.poll() is not None:
            print("\n❌ Backend se detuvo")
            break
        
        if frontend_process.poll() is not None:
            print("\n❌ Frontend se detuvo")
            break
            
except KeyboardInterrupt:
    print("\n\n⛔ Deteniendo...")
    backend_process.terminate()
    frontend_process.terminate()
    
    try:
        backend_process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        backend_process.kill()
    
    try:
        frontend_process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        frontend_process.kill()
    
    print("✓ Detenido\n")
