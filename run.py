#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Script simple para iniciar CELUPRO"""

import subprocess
import sys
import time
from pathlib import Path

project_root = Path(__file__).parent
venv_python = project_root / "venv" / "Scripts" / "python.exe"

print("\n" + "="*50)
print("🚀 INICIANDO CELUPRO")
print("="*50 + "\n")

# Backend
print("1️⃣  Iniciando Backend (Puerto 5000)...")
backend_cmd = [str(venv_python), "app.py"]
backend_process = subprocess.Popen(
    backend_cmd,
    cwd=str(project_root / "backend"),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
time.sleep(2)

# Frontend
print("2️⃣  Iniciando Frontend (Puerto 3000)...\n")
frontend_cmd = [str(venv_python), "server.py"]
frontend_process = subprocess.Popen(
    frontend_cmd,
    cwd=str(project_root / "frontend"),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
time.sleep(1)

print("✅ APLICACIÓN LISTA\n")
print("Acceso: http://localhost:3000")
print("Usuario: admin")
print("Contraseña: admin123\n")
print("Presiona Ctrl+C para detener...\n")

try:
    backend_process.wait()
    frontend_process.wait()
except KeyboardInterrupt:
    print("\n\n⛔ Deteniendo...")
    backend_process.terminate()
    frontend_process.terminate()
    backend_process.wait()
    frontend_process.wait()
    print("✓ Detenido\n")
