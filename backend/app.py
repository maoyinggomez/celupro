from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta
from functools import wraps
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Agregar la ruta padre al path para importar database
sys.path.insert(0, str(Path(__file__).parent.parent))

# Importar modelos
from models.user import User
from models.marca import Marca, Modelo
from models.falla import Falla, IngresoFalla
from models.ingreso import Ingreso
from models.nota import Nota
from models.config import Configuracion
from utils.thermal_printer import generate_ticket_data

load_dotenv()

app = Flask(__name__)

# Configuración
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'celupro-secret-key-2024')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

# Inicializar extensiones
CORS(app)
jwt = JWTManager(app)

# Inicializar base de datos
try:
    from database.init_db import init_db
    init_db()
except Exception as e:
    print(f"Advertencia: {e}")

# ===== DECORADORES DE AUTORIZACIÓN =====
def role_required(*roles):
    """Decorador para verificar roles específicos"""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.get_by_id(current_user_id)
            
            if not user or user['rol'] not in roles:
                return jsonify({'error': 'Acceso denegado'}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator

# ===== RUTAS DE AUTENTICACIÓN =====
@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login de usuario"""
    data = request.get_json()
    
    if not data.get('usuario') or not data.get('contraseña'):
        return jsonify({'error': 'Usuario y contraseña requeridos'}), 400
    
    user = User.authenticate(data['usuario'], data['contraseña'])
    
    if not user:
        return jsonify({'error': 'Credenciales inválidas'}), 401
    
    access_token = create_access_token(identity=user['id'])
    
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user['id'],
            'usuario': user['usuario'],
            'nombre': user['nombre'],
            'rol': user['rol']
        }
    }), 200

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Obtiene datos del usuario actual"""
    current_user_id = get_jwt_identity()
    user = User.get_by_id(current_user_id)
    
    return jsonify(user), 200

# ===== RUTAS DE MARCAS Y MODELOS =====
@app.route('/api/marcas', methods=['GET'])
@jwt_required()
def get_marcas():
    """Obtiene todas las marcas"""
    marcas = Marca.get_all()
    return jsonify(marcas), 200

@app.route('/api/marcas/<int:marca_id>/modelos', methods=['GET'])
@jwt_required()
def get_modelos_by_marca(marca_id):
    """Obtiene modelos de una marca"""
    modelos = Modelo.get_by_marca(marca_id)
    return jsonify(modelos), 200

@app.route('/api/marcas', methods=['POST'])
@role_required('admin')
def create_marca():
    """Crea una nueva marca"""
    data = request.get_json()
    
    if not data.get('nombre'):
        return jsonify({'error': 'Nombre requerido'}), 400
    
    try:
        marca_id = Marca.create(data['nombre'])
        return jsonify({'id': marca_id, 'nombre': data['nombre']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/marcas/<int:marca_id>', methods=['PUT'])
@role_required('admin')
def update_marca(marca_id):
    """Actualiza una marca"""
    data = request.get_json()
    
    if not data.get('nombre'):
        return jsonify({'error': 'Nombre requerido'}), 400
    
    try:
        Marca.update(marca_id, data['nombre'])
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/marcas/<int:marca_id>', methods=['DELETE'])
@role_required('admin')
def delete_marca(marca_id):
    """Elimina una marca"""
    try:
        Marca.delete(marca_id)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/modelos', methods=['POST'])
@role_required('admin')
def create_modelo():
    """Crea un nuevo modelo"""
    data = request.get_json()
    
    if not data.get('marca_id') or not data.get('nombre'):
        return jsonify({'error': 'Marca y nombre requeridos'}), 400
    
    try:
        modelo_id = Modelo.create(data['marca_id'], data['nombre'])
        return jsonify({'id': modelo_id, 'nombre': data['nombre']}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/modelos/<int:modelo_id>', methods=['PUT'])
@role_required('admin')
def update_modelo(modelo_id):
    """Actualiza un modelo"""
    data = request.get_json()
    
    if not data.get('nombre'):
        return jsonify({'error': 'Nombre requerido'}), 400
    
    try:
        Modelo.update(modelo_id, data['nombre'])
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/modelos/<int:modelo_id>', methods=['DELETE'])
@role_required('admin')
def delete_modelo(modelo_id):
    """Elimina un modelo"""
    try:
        Modelo.delete(modelo_id)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===== RUTAS DE FALLAS =====
@app.route('/api/fallas', methods=['GET'])
@jwt_required()
def get_fallas():
    """Obtiene todas las fallas del catálogo"""
    fallas = Falla.get_all()
    return jsonify(fallas), 200

@app.route('/api/fallas', methods=['POST'])
@role_required('admin', 'tecnico')
def create_falla():
    """Crea una nueva falla"""
    data = request.get_json()
    
    if not data.get('nombre'):
        return jsonify({'error': 'Nombre requerido'}), 400
    
    try:
        falla_id = Falla.create(
            data['nombre'],
            data.get('descripcion', ''),
            data.get('precio_sugerido', 0)
        )
        return jsonify({'id': falla_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/fallas/<int:falla_id>', methods=['PUT'])
@role_required('admin', 'tecnico')
def update_falla(falla_id):
    """Actualiza una falla"""
    data = request.get_json()
    
    try:
        Falla.update(
            falla_id,
            data.get('nombre', ''),
            data.get('descripcion', ''),
            data.get('precio_sugerido', 0)
        )
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/fallas/<int:falla_id>', methods=['DELETE'])
@role_required('admin')
def delete_falla(falla_id):
    """Elimina una falla"""
    try:
        Falla.delete(falla_id)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===== RUTAS DE INGRESOS TÉCNICOS =====
@app.route('/api/ingresos', methods=['POST'])
@role_required('admin', 'empleado')
def create_ingreso():
    """Crea un nuevo ingreso técnico"""
    data = request.get_json()
    current_user_id = get_jwt_identity()
    
    # Validaciones básicas
    required_fields = ['marca_id', 'modelo_id', 'cliente_nombre', 'cliente_apellido', 'cliente_cedula']
    if not all(data.get(field) for field in required_fields):
        return jsonify({'error': 'Campos requeridos incompletos'}), 400
    
    try:
        # Agregar empleado_id automáticamente
        data['empleado_id'] = current_user_id
        
        resultado = Ingreso.create(data)
        
        # Agregar fallas iniciales si vienen en la solicitud
        if data.get('fallas_iniciales'):
            for falla_id in data['fallas_iniciales']:
                IngresoFalla.add_to_ingreso(
                    resultado['id'],
                    falla_id,
                    Falla.get_by_id(falla_id)['precio_sugerido'] if Falla.get_by_id(falla_id) else 0,
                    current_user_id
                )
        
        # Agregar nota inicial si existe
        if data.get('notas_adicionales'):
            Nota.create(resultado['id'], current_user_id, data['notas_adicionales'], 'general')
        
        return jsonify(resultado), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingresos/<int:ingreso_id>', methods=['GET'])
@jwt_required()
def get_ingreso(ingreso_id):
    """Obtiene un ingreso específico"""
    ingreso = Ingreso.get_by_id(ingreso_id)
    
    if not ingreso:
        return jsonify({'error': 'Ingreso no encontrado'}), 404
    
    # Obtener fallas del ingreso
    fallas = IngresoFalla.get_by_ingreso(ingreso_id)
    
    # Obtener notas del ingreso
    notas = Nota.get_by_ingreso(ingreso_id)
    
    ingreso_dict = dict(ingreso)
    ingreso_dict['fallas'] = fallas
    ingreso_dict['notas'] = notas
    
    return jsonify(ingreso_dict), 200

@app.route('/api/ingresos/<int:ingreso_id>', methods=['DELETE'])
@role_required('admin')
def delete_ingreso(ingreso_id):
    """Elimina un ingreso (solo admin)"""
    try:
        Ingreso.delete(ingreso_id)
        return jsonify({'success': True, 'message': 'Ingreso eliminado'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingresos', methods=['GET'])
@jwt_required()
def get_ingresos():
    """Obtiene lista de ingresos con filtros"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    skip = (page - 1) * limit
    
    # Filtros
    filtros = {}
    if request.args.get('cliente'):
        filtros['cliente'] = request.args.get('cliente')
    if request.args.get('marca_id'):
        filtros['marca_id'] = request.args.get('marca_id', type=int)
    if request.args.get('estado'):
        filtros['estado'] = request.args.get('estado')
    if request.args.get('fecha_inicio'):
        filtros['fecha_inicio'] = request.args.get('fecha_inicio')
    if request.args.get('fecha_fin'):
        filtros['fecha_fin'] = request.args.get('fecha_fin')
    
    ingresos = Ingreso.get_all_with_filters(skip, limit, filtros if filtros else None)
    total = Ingreso.get_count(filtros if filtros else None)
    
    return jsonify({
        'data': ingresos,
        'total': total,
        'page': page,
        'limit': limit,
        'pages': (total + limit - 1) // limit
    }), 200

@app.route('/api/ingresos/pendientes', methods=['GET'])
@role_required('admin', 'tecnico')
def get_ingresos_pendientes():
    """Obtiene ingresos pendientes"""
    ingresos = Ingreso.get_pendientes()
    return jsonify(ingresos), 200

@app.route('/api/ingresos/<int:ingreso_id>/tecnico', methods=['PUT'])
@role_required('admin', 'tecnico')
def assign_tecnico(ingreso_id):
    """Asigna un técnico a un ingreso"""
    data = request.get_json()
    
    if not data.get('tecnico_id'):
        return jsonify({'error': 'tecnico_id requerido'}), 400
    
    try:
        Ingreso.update_tecnico(ingreso_id, data['tecnico_id'])
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingresos/<int:ingreso_id>/estado', methods=['PUT'])
@role_required('admin', 'tecnico')
def update_ingreso_estado(ingreso_id):
    """Actualiza el estado de un ingreso"""
    data = request.get_json()
    
    if not data.get('estado'):
        return jsonify({'error': 'estado requerido'}), 400
    
    try:
        Ingreso.update_estado(ingreso_id, data['estado'])
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===== RUTAS DE FALLAS POR INGRESO =====
@app.route('/api/ingresos/<int:ingreso_id>/fallas', methods=['POST'])
@role_required('admin', 'tecnico')
def add_falla_to_ingreso(ingreso_id):
    """Agrega una falla a un ingreso"""
    data = request.get_json()
    current_user_id = get_jwt_identity()
    
    if not data.get('falla_id'):
        return jsonify({'error': 'falla_id requerido'}), 400
    
    try:
        falla_ingreso_id = IngresoFalla.add_to_ingreso(
            ingreso_id,
            data['falla_id'],
            data.get('valor_reparacion', 0),
            current_user_id
        )
        return jsonify({'id': falla_ingreso_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingreso-fallas/<int:ingreso_falla_id>/valor', methods=['PUT'])
@role_required('admin', 'tecnico')
def update_falla_valor(ingreso_falla_id):
    """Actualiza el valor de reparación de una falla"""
    data = request.get_json()
    
    if 'valor_reparacion' not in data:
        return jsonify({'error': 'valor_reparacion requerido'}), 400
    
    try:
        IngresoFalla.update_valor(ingreso_falla_id, data['valor_reparacion'])
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingreso-fallas/<int:ingreso_falla_id>/estado', methods=['PUT'])
@role_required('admin', 'tecnico')
def update_falla_estado(ingreso_falla_id):
    """Actualiza el estado de una falla"""
    data = request.get_json()
    
    if not data.get('estado_falla'):
        return jsonify({'error': 'estado_falla requerido'}), 400
    
    try:
        IngresoFalla.update_estado(ingreso_falla_id, data['estado_falla'])
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingreso-fallas/<int:ingreso_falla_id>/notas', methods=['PUT'])
@role_required('admin', 'tecnico')
def update_falla_notas(ingreso_falla_id):
    """Agrega notas a una falla"""
    data = request.get_json()
    
    try:
        IngresoFalla.add_nota(ingreso_falla_id, data.get('notas_falla', ''))
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingreso-fallas/<int:ingreso_falla_id>', methods=['DELETE'])
@role_required('admin', 'tecnico')
def delete_ingreso_falla(ingreso_falla_id):
    """Elimina una falla de un ingreso"""
    try:
        IngresoFalla.delete_from_ingreso(ingreso_falla_id)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===== RUTAS DE NOTAS =====
@app.route('/api/ingresos/<int:ingreso_id>/notas', methods=['POST'])
@jwt_required()
def add_nota(ingreso_id):
    """Agrega una nota a un ingreso"""
    data = request.get_json()
    current_user_id = get_jwt_identity()
    
    if not data.get('contenido'):
        return jsonify({'error': 'contenido requerido'}), 400
    
    try:
        nota_id = Nota.create(
            ingreso_id,
            current_user_id,
            data['contenido'],
            data.get('tipo', 'general')
        )
        return jsonify({'id': nota_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===== RUTAS DE ADMINISTRACIÓN =====
@app.route('/api/admin/usuarios', methods=['GET'])
@role_required('admin')
def get_usuarios():
    """Obtiene todos los usuarios"""
    usuarios = User.get_all()
    return jsonify(usuarios), 200

@app.route('/api/admin/usuarios', methods=['POST'])
@role_required('admin')
def create_usuario():
    """Crea un nuevo usuario"""
    data = request.get_json()
    
    required_fields = ['usuario', 'contraseña', 'nombre', 'rol']
    if not all(data.get(field) for field in required_fields):
        return jsonify({'error': 'Campos requeridos incompletos'}), 400
    
    if User.check_exists(data['usuario']):
        return jsonify({'error': 'Usuario ya existe'}), 400
    
    try:
        user_id = User.create(data['usuario'], data['contraseña'], data['nombre'], data['rol'])
        return jsonify({'id': user_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/usuarios/<int:user_id>', methods=['PUT'])
@role_required('admin')
def update_usuario(user_id):
    """Actualiza un usuario"""
    data = request.get_json()
    
    try:
        User.update(user_id, data.get('nombre'), data.get('rol'), data.get('contraseña'))
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/usuarios/<int:user_id>', methods=['DELETE'])
@role_required('admin')
def delete_usuario(user_id):
    """Elimina un usuario (marca como inactivo)"""
    try:
        User.delete(user_id)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/configuracion', methods=['GET'])
@role_required('admin')
def get_configuracion():
    """Obtiene la configuración del negocio"""
    config = Configuracion.get_all()
    return jsonify(config), 200

@app.route('/api/admin/configuracion', methods=['PUT'])
@role_required('admin')
def update_configuracion():
    """Actualiza la configuración del negocio"""
    data = request.get_json()
    
    try:
        for clave, valor in data.items():
            Configuracion.set(clave, valor)
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/config/logo', methods=['POST'])
@role_required('admin')
def upload_logo():
    """Sube un logo para el negocio"""
    if 'logo' not in request.files:
        return jsonify({'error': 'Archivo no proporcionado'}), 400
    
    file = request.files['logo']
    
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo inválido'}), 400
    
    if not file.filename.endswith(('.png', '.jpg', '.jpeg')):
        return jsonify({'error': 'Solo se permiten PNG y JPG'}), 400
    
    try:
        filename = 'logo.' + file.filename.split('.')[-1].lower()
        filepath = os.path.join('frontend/static/logos', filename)
        file.save(filepath)
        
        Configuracion.set('logo_url', f'/static/logos/{filename}')
        
        return jsonify({'success': True, 'url': f'/static/logos/{filename}'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===== RUTA DE TICKET TÉRMICO =====
@app.route('/api/ingresos/<int:ingreso_id>/ticket', methods=['GET'])
@jwt_required()
def get_ticket_data(ingreso_id):
    """Obtiene datos y genera comando ESC/POS para ticket"""
    ingreso = Ingreso.get_by_id(ingreso_id)
    
    if not ingreso:
        return jsonify({'error': 'Ingreso no encontrado'}), 404
    
    try:
        # Obtener fallas del ingreso
        fallas = IngresoFalla.get_by_ingreso(ingreso_id)
        ingreso_dict = dict(ingreso)
        ingreso_dict['fallas'] = fallas
        
        # Obtener ruta del logo
        logo_path = None
        logo_config = Configuracion.get('logo_url')
        if logo_config:
            logo_path = os.path.join('frontend/static/logos', logo_config.split('/')[-1])
        
        # Generar datos del ticket
        ticket_bytes = generate_ticket_data(ingreso_dict, logo_path)
        
        # Retornar en base64 para que el frontend lo envíe a la impresora
        import base64
        ticket_b64 = base64.b64encode(ticket_bytes).decode('utf-8')
        
        return jsonify({
            'ticket_data': ticket_b64,
            'numero_ingreso': ingreso['numero_ingreso'],
            'cliente': f"{ingreso['cliente_nombre']} {ingreso['cliente_apellido']}"
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=8000)
