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

# GET configuración
config_response = requests.get(f'{BASE_URL}/admin/configuracion', headers=headers)
print("Status:", config_response.status_code)
print("\nConfiguracion completa:")
print(json.dumps(config_response.json(), indent=2, ensure_ascii=False))

print("\n\nValores específicos:")
config = config_response.json()
for key in ['nombre_negocio', 'telefono_negocio', 'direccion_negocio', 'email_negocio', 'logo_url']:
    if key in config:
        print(f"{key}:")
        print(f"  tipo: {config[key].get('tipo')}")
        print(f"  valor: {config[key].get('valor')}")
