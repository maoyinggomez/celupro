#!/usr/bin/env python
"""
Script de diagnóstico para encontrar problemas
"""
import sys
import os
from pathlib import Path

os.chdir(Path(__file__).parent)
sys.path.insert(0, str(Path(__file__).parent))

print("\n=== DIAGNÓSTICO CELUPRO ===\n")

# 1. Verificar Python
print(f"✓ Python: {sys.version}")

# 2. Verificar dependencias
print("\nVerificando dependencias...")
try:
    import flask
    print(f"✓ Flask: {flask.__version__}")
except ImportError as e:
    print(f"✗ Flask: {e}")

try:
    import flask_cors
    print(f"✓ Flask-CORS")
except ImportError as e:
    print(f"✗ Flask-CORS: {e}")

try:
    import flask_jwt_extended
    print(f"✓ Flask-JWT-Extended")
except ImportError as e:
    print(f"✗ Flask-JWT-Extended: {e}")

try:
    import requests
    print(f"✓ Requests")
except ImportError as e:
    print(f"✗ Requests: {e}")

# 3. Verificar estructura
print("\nVerificando estructura...")
dirs = ['backend', 'frontend', 'database', 'models']
for d in dirs:
    if os.path.isdir(d):
        print(f"✓ {d}/")
    else:
        print(f"✗ {d}/ NO ENCONTRADO")

# 4. Intentar importar modelos
print("\nVerificando modelos...")
try:
    from models.user import User
    print("✓ models/user.py")
except Exception as e:
    print(f"✗ models/user.py: {e}")

try:
    from database.init_db import init_db
    print("✓ database/init_db.py")
except Exception as e:
    print(f"✗ database/init_db.py: {e}")

# 5. Intentar iniciar backend
print("\nIntentando iniciar Backend...")
try:
    from backend.app import app
    print("✓ Backend importado correctamente")
    print(f"  Routes: {len(app.url_map._rules)}")
except Exception as e:
    print(f"✗ Error al importar Backend: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*40 + "\n")
