#!/usr/bin/env python
"""
Script para crear usuario de prueba
"""
import sys
import os
from pathlib import Path

os.chdir(Path(__file__).parent)
sys.path.insert(0, str(Path(__file__).parent))

from backend.models.user import User

print("\n=== CREAR USUARIO DE PRUEBA ===\n")

# Crear usuario admin
usuario_admin = User.create(
    usuario='admin',
    contraseña='admin123',
    nombre='Administrador',
    rol='admin'
)

if usuario_admin:
    print("✓ Usuario admin creado exitosamente")
    print(f"  Usuario: admin")
    print(f"  Contraseña: admin123")
    print(f"  Rol: admin")
else:
    print("⚠ El usuario admin ya existe")

# Crear usuario técnico
usuario_tecnico = User.create(
    usuario='tecnico',
    contraseña='tech123',
    nombre='Técnico',
    rol='tecnico'
)

if usuario_tecnico:
    print("\n✓ Usuario técnico creado exitosamente")
    print(f"  Usuario: tecnico")
    print(f"  Contraseña: tech123")
    print(f"  Rol: tecnico")
else:
    print("\n⚠ El usuario técnico ya existe")

# Listar usuarios
print("\n=== USUARIOS EN LA BASE DE DATOS ===\n")
usuarios = User.get_all()
if usuarios:
    for u in usuarios:
        print(f"  • {u['usuario']} ({u['nombre']}) - {u['rol']}")
else:
    print("  No hay usuarios")

print("\n")
