import sqlite3

# Verificar configuración en base de datos
conn = sqlite3.connect('database/celupro.db')
cur = conn.cursor()

print("=== Configuración en DB ===")
cur.execute('''
    SELECT clave, valor 
    FROM configuracion 
    WHERE clave IN ("nombre_negocio", "telefono_negocio", "direccion_negocio", "email_negocio")
''')

for clave, valor in cur.fetchall():
    print(f"{clave}: {valor}")

conn.close()
