import requests

BASE_URL = 'http://localhost:5001/api'

# Login
login_response = requests.post(f'{BASE_URL}/auth/login', json={
    'usuario': 'admin',
    'contraseña': 'admin123'
})
token = login_response.json().get('access_token')
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Restaurar configuración por defecto
config_default = {
    'nombre_negocio': 'CELUPRO',
    'telefono_negocio': '+57 300 000 0000',
    'direccion_negocio': '',
    'email_negocio': 'info@celupro.com'
}

print("Restaurando configuración por defecto...")
for k, v in config_default.items():
    print(f"  {k}: {v if v else '(vacío)'}")

config_response = requests.put(f'{BASE_URL}/admin/configuracion', json=config_default, headers=headers)
print(f"\nStatus: {config_response.status_code}")

if config_response.status_code == 200:
    print("✓ Configuración restaurada correctamente")
    print("\nAhora puedes:")
    print("1. Ir a http://localhost:3000")
    print("2. Login con admin / admin123")
    print("3. Ir al panel de Administración")
    print("4. Modificar la configuración")
    print("5. Guardar y verificar que se actualiza")
else:
    print(f"✗ Error: {config_response.text}")
