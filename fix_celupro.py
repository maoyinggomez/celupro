#!/usr/bin/env python3
"""Diagnóstico completo y corrección de CELUPRO"""

import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from pathlib import Path

project_root = Path(__file__).parent
db_path = project_root / "database" / "celupro.db"

print("\n" + "="*60)
print("DIAGNÓSTICO Y CORRECCIÓN CELUPRO")
print("="*60 + "\n")

# 1. Verificar BD
print("1️⃣  Verificando BD...")
if not db_path.exists():
    print(f"❌ BD no existe: {db_path}")
    exit(1)
print(f"✓ BD existe")

# 2. Conectar y verificar
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# Verificar tabla usuarios
try:
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    count = cursor.fetchone()[0]
    print(f"✓ Tabla usuarios: {count} registros")
except Exception as e:
    print(f"❌ Error en tabla usuarios: {e}")
    conn.close()
    exit(1)

# 3. Verificar usuario admin
print("\n2️⃣  Verificando usuario admin...")
cursor.execute("SELECT id, usuario, contraseña, rol FROM usuarios WHERE usuario = ?", ("admin",))
admin = cursor.fetchone()

if not admin:
    print("❌ Usuario admin NO existe")
    print("→ Creando admin...")
    
    hashed = generate_password_hash("admin123")
    try:
        cursor.execute('''
            INSERT INTO usuarios (usuario, contraseña, nombre, rol, activo)
            VALUES (?, ?, ?, ?, ?)
        ''', ("admin", hashed, "Administrador", "admin", 1))
        conn.commit()
        print("✓ Usuario admin creado")
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.close()
        exit(1)
else:
    admin_id, usuario, pwd_hash, rol = admin
    print(f"✓ Usuario admin existe (ID: {admin_id}, Rol: {rol})")
    
    # Verificar contraseña
    test_pwd = "admin123"
    is_valid = check_password_hash(pwd_hash, test_pwd)
    
    if is_valid:
        print("✓ Contraseña es correcta")
    else:
        print("❌ Contraseña INCORRECTA en BD")
        print("→ Regenerando...")
        
        new_hash = generate_password_hash(test_pwd)
        cursor.execute("UPDATE usuarios SET contraseña = ? WHERE id = ?", (new_hash, admin_id))
        conn.commit()
        print("✓ Contraseña actualizada")

# 4. Listar todos los usuarios
print("\n3️⃣  Usuarios en BD:")
cursor.execute("SELECT id, usuario, nombre, rol FROM usuarios")
users = cursor.fetchall()
if users:
    for user in users:
        print(f"  - {user[1]} ({user[2]}) - Rol: {user[3]}")
else:
    print("  ⚠️  No hay usuarios")

conn.close()

print("\n" + "="*60)
print("✅ DIAGNÓSTICO COMPLETADO")
print("="*60)
print("\nAhora:")
print("1. Cierra todas las terminales")
print("2. Abre terminal 1 y ejecuta:")
print('   cd "C:\\Users\\maoyi\\OneDrive\\Desktop\\proyecto celupro\\backend" ; & "C:\\Users\\maoyi\\OneDrive\\Desktop\\proyecto celupro\\venv\\Scripts\\python.exe" app.py')
print("3. Abre terminal 2 y ejecuta:")
print('   cd "C:\\Users\\maoyi\\OneDrive\\Desktop\\proyecto celupro\\frontend" ; & "C:\\Users\\maoyi\\OneDrive\\Desktop\\proyecto celupro\\venv\\Scripts\\python.exe" server.py')
print("4. Abre http://localhost:3000")
print("5. Login: admin / admin123")
print("\n" + "="*60 + "\n")
