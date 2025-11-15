#!/usr/bin/env python3
"""Test de login"""

import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from backend.models.user import User

print("\n" + "="*50)
print("TEST DE LOGIN")
print("="*50 + "\n")

usuario = 'admin'
contraseña = 'admin123'

print(f"Probando: {usuario} / {contraseña}")
result = User.authenticate(usuario, contraseña)

if result:
    print("\n✅ LOGIN CORRECTO\n")
    print(f"  Usuario: {result['usuario']}")
    print(f"  ID: {result['id']}")
    print(f"  Rol: {result['rol']}")
    print("\nEl backend debería funcionar correctamente.")
else:
    print("\n❌ LOGIN FALLÓ\n")
    print("Hay un problema con la autenticación.")

print("\n" + "="*50 + "\n")
