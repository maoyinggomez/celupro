import requests
import json

BASE_URL = 'http://localhost:5001/api'

# Login
login_response = requests.post(f'{BASE_URL}/auth/login', json={
    'usuario': 'admin',
    'contraseña': 'admin123'
})
token = login_response.json().get('access_token')
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

print("=== PRUEBA 1: Leer configuración actual ===")
config_response = requests.get(f'{BASE_URL}/admin/configuracion', headers=headers)
config = config_response.json()
print(f"nombre_negocio: {config.get('nombre_negocio', {}).get('valor')}")
print(f"telefono_negocio: {config.get('telefono_negocio', {}).get('valor')}")

print("\n=== PRUEBA 2: Actualizar configuración ===")
new_config = {
    'nombre_negocio': 'MI NEGOCIO NUEVO TEST',
    'telefono_negocio': '+57 999 888 7777',
    'direccion_negocio': 'Calle Test 123',
    'email_negocio': 'test@test.com'
}
print("Enviando:", json.dumps(new_config, indent=2, ensure_ascii=False))

update_response = requests.put(f'{BASE_URL}/admin/configuracion', json=new_config, headers=headers)
print(f"Status: {update_response.status_code}")
print(f"Response: {update_response.json()}")

print("\n=== PRUEBA 3: Verificar en base de datos ===")
import sqlite3
conn = sqlite3.connect('database/celupro.db')
cur = conn.cursor()
cur.execute("SELECT clave, valor FROM configuracion WHERE clave = 'nombre_negocio'")
db_result = cur.fetchone()
conn.close()
print(f"En DB: nombre_negocio = '{db_result[1] if db_result else 'NO ENCONTRADO'}'")

print("\n=== PRUEBA 4: Leer configuración de nuevo ===")
config_response2 = requests.get(f'{BASE_URL}/admin/configuracion', headers=headers)
config2 = config_response2.json()
print(f"nombre_negocio: {config2.get('nombre_negocio', {}).get('valor')}")
print(f"telefono_negocio: {config2.get('telefono_negocio', {}).get('valor')}")

print("\n=== RESULTADO ===")
if config2.get('nombre_negocio', {}).get('valor') == new_config['nombre_negocio']:
    print("✓ La configuración se guarda y lee correctamente")
else:
    print("✗ PROBLEMA: El valor no coincide")
    print(f"   Esperado: {new_config['nombre_negocio']}")
    print(f"   Obtenido: {config2.get('nombre_negocio', {}).get('valor')}")
