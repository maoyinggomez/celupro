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

# 2. Actualizar configuración con valores nuevos
config_update = {
    'nombre_negocio': '🔧 REPARACIONES XYZ',
    'telefono_negocio': '+57 300 111 2222',
    'direccion_negocio': 'Calle 50 #23-45, Bogotá',
    'email_negocio': 'contacto@reparacionesxyz.com'
}
print(f"\n2. Actualizando configuración:")
for k, v in config_update.items():
    print(f"   {k}: {v}")

config_response = requests.put(f'{BASE_URL}/admin/configuracion', json=config_update, headers=headers)
print(f"   Status: {config_response.status_code}")

# 3. Crear un nuevo ingreso
print(f"\n3. Creando ingreso de prueba...")
ingreso_data = {
    'cliente_cedula': '1234567890',
    'cliente_nombre': 'Juan',
    'cliente_apellido': 'Pérez',
    'cliente_telefono': '3001234567',
    'cliente_direccion': 'Calle 10 # 20-30',
    'marca': 'Samsung',
    'modelo': 'Galaxy S21',
    'color': 'Negro',
    'falla_general': 'Pantalla rota',
    'fallas': []
}

ingreso_response = requests.post(f'{BASE_URL}/ingresos', json=ingreso_data, headers=headers)
print(f"   Status: {ingreso_response.status_code}")

if ingreso_response.status_code == 201:
    ingreso_id = ingreso_response.json().get('id')
    print(f"   Ingreso creado con ID: {ingreso_id}")
    
    # 4. Generar ticket para el nuevo ingreso
    print(f"\n4. Generando ticket para ingreso {ingreso_id}...")
    ticket_response = requests.get(f'{BASE_URL}/ingresos/{ingreso_id}/ticket', headers=headers)
    print(f"   Status: {ticket_response.status_code}")
    
    if ticket_response.status_code == 200:
        ticket_data = ticket_response.json()
        negocio = ticket_data.get('negocio', {})
        
        print(f"\n5. Datos del negocio en el ticket:")
        print(f"   nombre_negocio: {negocio.get('nombre_negocio')}")
        print(f"   telefono_negocio: {negocio.get('telefono_negocio')}")
        print(f"   direccion_negocio: {negocio.get('direccion_negocio')}")
        print(f"   email_negocio: {negocio.get('email_negocio')}")
        
        # Verificar si coinciden con lo actualizado
        print(f"\n6. ✓ Verificación:")
        all_match = True
        for k in config_update.keys():
            expected = config_update[k]
            actual = negocio.get(k)
            match = "✓" if expected == actual else "✗"
            if expected != actual:
                all_match = False
            print(f"   {match} {k}")
            print(f"      esperado: '{expected}'")
            print(f"      actual:   '{actual}'")
        
        if all_match:
            print(f"\n🎉 ¡ÉXITO! El ticket muestra la configuración actualizada")
        else:
            print(f"\n❌ FALLO: El ticket NO muestra la configuración actualizada")
    else:
        print(f"   Error: {ticket_response.text}")
else:
    print(f"   Error al crear ingreso: {ingreso_response.text}")
