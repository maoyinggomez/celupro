#!/usr/bin/env python3
"""Diagnóstico del proyecto CELUPRO"""

import sys
import os
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

print("\n" + "="*60)
print("DIAGNÓSTICO CELUPRO")
print("="*60 + "\n")

# 1. Verificar archivos
print("1️⃣  Verificando archivos...")
files_to_check = [
    "database/celupro.db",
    "backend/app.py",
    "frontend/server.py",
    "venv/Scripts/python.exe"
]

for file in files_to_check:
    path = project_root / file
    if path.exists():
        print(f"  ✓ {file}")
    else:
        print(f"  ✗ FALTA: {file}")

# 2. Verificar BD
print("\n2️⃣  Verificando base de datos...")
try:
    import sqlite3
    conn = sqlite3.connect(str(project_root / "database/celupro.db"))
    cursor = conn.cursor()
    
    # Tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"  ✓ {len(tables)} tablas encontradas")
    
    # Usuario admin
    cursor.execute("SELECT * FROM usuarios WHERE usuario = ?", ("admin",))
    admin = cursor.fetchone()
    if admin:
        print(f"  ✓ Usuario admin existe (ID: {admin[0]})")
    else:
        print(f"  ✗ Usuario admin NO existe")
    
    conn.close()
except Exception as e:
    print(f"  ✗ Error BD: {e}")

# 3. Verificar dependencias
print("\n3️⃣  Verificando dependencias...")
try:
    import flask
    print(f"  ✓ Flask {flask.__version__}")
    import flask_cors
    print(f"  ✓ Flask-CORS")
    import flask_jwt_extended
    print(f"  ✓ Flask-JWT-Extended")
    import werkzeug
    print(f"  ✓ Werkzeug")
except ImportError as e:
    print(f"  ✗ Falta dependencia: {e}")

# 4. Intentar importar app
print("\n4️⃣  Intentando importar app...")
try:
    backend_path = str(project_root / "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    os.chdir(backend_path)
    from app import app
    print(f"  ✓ App importada correctamente")
    print(f"  ✓ App escuchando en http://0.0.0.0:5000")
except Exception as e:
    print(f"  ✗ Error al importar app: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
print("✓ Diagnóstico completado")
print("="*60 + "\n")
