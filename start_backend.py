#!/usr/bin/env python3
"""Script para iniciar backend y frontend sin reinicio automático"""

import sys
import os
from pathlib import Path

# Configurar encoding UTF-8 para Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

project_root = Path(__file__).parent
backend_path = str(project_root / "backend")
sys.path.insert(0, str(project_root))
sys.path.insert(0, backend_path)

# Cambiar al directorio backend
os.chdir(backend_path)

from app import app

print("\n" + "="*60)
print("INICIANDO SERVIDOR CELUPRO")
print("="*60)
print(f"Backend: http://0.0.0.0:5000")
print("="*60 + "\n")

# Iniciar sin debug para evitar reinicio automático
app.run(debug=False, host='0.0.0.0', port=5000, use_reloader=False)
