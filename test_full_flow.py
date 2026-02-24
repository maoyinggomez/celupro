import requests
import json

BASE_URL = 'http://localhost:5001/api'

# 1. Login
login_response = requests.post(f'{BASE_URL}/auth/login', json={
    'usuario': 'admin',
    'contraseña': 'admin123'
})
print(f"1. Login: {login_response.status_code}")
if login_response.status_code != 200:
    print(f"   Error: {login_response.text}")
    exit(1)
token = login_response.json().get('access_token')

headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# 2. Actualizar configuración
config_update = {
    'nombre_negocio': 'MI NEGOCIO NUEVO',
    'telefono_negocio': '+57 321 999 8888',
    'direccion_negocio': 'Calle 123 #45-67',
    'email_negocio': 'nuevo@email.com'
}
print(f"\n2. Actualizando configuración:")
for k, v in config_update.items():
    print(f"   {k}: {v}")

config_response = requests.put(f'{BASE_URL}/admin/configuracion', json=config_update, headers=headers)
print(f"   Status: {config_response.status_code}")

# 3. Leer configuración para verificar
get_config_response = requests.get(f'{BASE_URL}/admin/configuracion', headers=headers)
print(f"\n3. Configuración guardada:")
config_data = get_config_response.json()
for k in config_update.keys():
    print(f"   {k}: {config_data.get(k, 'NO ENCONTRADO')}")

# 4. Obtener primer ingreso
ingresos_response = requests.get(f'{BASE_URL}/ingresos', headers=headers)
ingresos = ingresos_response.json()
if ingresos:
    ingreso_id = ingresos[0]['id']
    print(f"\n4. Generando ticket para ingreso ID: {ingreso_id}")
    
    # 5. Generar ticket
    ticket_response = requests.get(f'{BASE_URL}/ingresos/{ingreso_id}/ticket', headers=headers)
    print(f"   Status: {ticket_response.status_code}")
    
    ticket_data = ticket_response.json()
    negocio = ticket_data.get('negocio', {})
    
    print(f"\n5. Datos del negocio en el ticket:")
    print(f"   nombre_negocio: {negocio.get('nombre_negocio')}")
    print(f"   telefono_negocio: {negocio.get('telefono_negocio')}")
    print(f"   direccion_negocio: {negocio.get('direccion_negocio')}")
    print(f"   email_negocio: {negocio.get('email_negocio')}")
    
    # Verificar si coinciden
    print(f"\n6. Verificación:")
    for k in config_update.keys():
        expected = config_update[k]
        actual = negocio.get(k)
        match = "✓" if expected == actual else "✗"
        print(f"   {match} {k}: esperado='{expected}', actual='{actual}'")
else:
    print("\n4. No hay ingresos para probar")
