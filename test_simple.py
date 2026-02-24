import requests

BASE_URL = 'http://localhost:5001/api'

# 1. Login
login_response = requests.post(f'{BASE_URL}/auth/login', json={
    'usuario': 'admin',
    'contraseña': 'admin123'
})
print(f"1. Login: {login_response.status_code}")
token = login_response.json().get('access_token')
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# 2. Verificar configuración ANTES de actualizar
print(f"\n2. Configuración ANTES:")
import sqlite3
conn = sqlite3.connect('database/celupro.db')
cur = conn.cursor()
cur.execute("SELECT clave, valor FROM configuracion WHERE clave IN ('nombre_negocio', 'telefono_negocio', 'direccion_negocio', 'email_negocio')")
config_antes = {}
for row in cur.fetchall():
    config_antes[row[0]] = row[1]
    print(f"   {row[0]}: {row[1]}")
conn.close()

# 3. Actualizar configuración con valores COMPLETAMENTE NUEVOS
config_update = {
    'nombre_negocio': '⚡ SERVITEC 2026',
    'telefono_negocio': '+57 321 888 9999',
    'direccion_negocio': 'Carrera 100 #50-25',
    'email_negocio': 'info@servitec2026.co'
}
print(f"\n3. Actualizando configuración:")
for k, v in config_update.items():
    print(f"   {k}: {v}")

config_response = requests.put(f'{BASE_URL}/admin/configuracion', json=config_update, headers=headers)
print(f"   Status: {config_response.status_code}")

# 4. Verificar configuración DESPUÉS de actualizar (directo en DB)
print(f"\n4. Configuración DESPUÉS (desde DB):")
conn = sqlite3.connect('database/celupro.db')
cur = conn.cursor()
cur.execute("SELECT clave, valor FROM configuracion WHERE clave IN ('nombre_negocio', 'telefono_negocio', 'direccion_negocio', 'email_negocio')")
for row in cur.fetchall():
    print(f"   {row[0]}: {row[1]}")
conn.close()

# 5. Obtener lista de ingresos
ingresos_response = requests.get(f'{BASE_URL}/ingresos', headers=headers)
ingresos = ingresos_response.json()

if ingresos:
    ingreso_id = ingresos[0]['id']
    print(f"\n5. Generando ticket para ingreso existente ID: {ingreso_id}")
    
    # 6. Generar ticket
    ticket_response = requests.get(f'{BASE_URL}/ingresos/{ingreso_id}/ticket', headers=headers)
    print(f"   Status: {ticket_response.status_code}")
    
    if ticket_response.status_code == 200:
        ticket_data = ticket_response.json()
        negocio = ticket_data.get('negocio', {})
        
        print(f"\n6. Datos del negocio en el ticket:")
        for k, v in negocio.items():
            print(f"   {k}: {v}")
        
        # Verificar si coinciden con lo actualizado
        print(f"\n7. ✓ Verificación:")
        all_match = True
        for k in config_update.keys():
            expected = config_update[k]
            actual = negocio.get(k)
            match = "✓" if expected == actual else "✗"
            if expected != actual:
                all_match = False
            print(f"   {match} {k}")
            if expected != actual:
                print(f"      ESPERADO: '{expected}'")
                print(f"      ACTUAL:   '{actual}'")
        
        if all_match:
            print(f"\n🎉 ¡ÉXITO! El ticket muestra la configuración actualizada")
        else:
            print(f"\n❌ PROBLEMA: El ticket NO refleja los cambios")
            print(f"\n   Posible causa: El backend puede estar cacheando la configuración")
            print(f"   o el método get_datos_negocio() tiene algún problema.")
    else:
        print(f"   Error: {ticket_response.text}")
else:
    print(f"\n5. No hay ingresos en el sistema. Crea uno manualmente desde el frontend.")
