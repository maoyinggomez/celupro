#!/usr/bin/env python3
"""Script para resetear la base de datos e insertar usuario admin"""

import sqlite3
import os
from pathlib import Path
from werkzeug.security import generate_password_hash

# Rutas
project_root = Path(__file__).parent
db_path = project_root / "database" / "celupro.db"

print("=" * 50)
print("RESETEAR BASE DE DATOS")
print("=" * 50)

# Conectar
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# Verificar tabla usuarios
try:
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    count = cursor.fetchone()[0]
    print(f"\n✓ Tabla usuarios existe con {count} registros")
except:
    print("\n✗ Error: Tabla usuarios no existe")
    conn.close()
    exit(1)

# Verificar si existe admin
cursor.execute("SELECT * FROM usuarios WHERE usuario = ?", ("admin",))
user = cursor.fetchone()

if user:
    print("✓ Usuario 'admin' ya existe")
    print(f"  ID: {user[0]}, Nombre: {user[2]}, Rol: {user[3]}")
else:
    print("\n→ Creando usuario admin...")
    hashed_pwd = generate_password_hash("admin123")
    try:
        cursor.execute('''
            INSERT INTO usuarios (usuario, contraseña, nombre, rol, activo)
            VALUES (?, ?, ?, ?, ?)
        ''', ("admin", hashed_pwd, "Administrador", "admin", 1))
        conn.commit()
        print("✓ Usuario admin creado exitosamente")
        print("\n  Credenciales:")
        print("  Usuario: admin")
        print("  Contraseña: admin123")
    except Exception as e:
        print(f"✗ Error al crear usuario: {e}")

conn.close()
print("\n" + "=" * 50)
print("✓ Completado")
print("=" * 50)
