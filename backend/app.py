from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta
from functools import wraps
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image, ImageOps

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
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=72)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB máximo
app.config['UPLOAD_FOLDER'] = Path(__file__).resolve().parent.parent / 'frontend' / 'static' / 'logos'

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
            current_user_id = int(get_jwt_identity())  # Convertir a int porque lo guardamos como string
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
    
    access_token = create_access_token(identity=str(user['id']))
    
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
    current_user_id = int(get_jwt_identity())
    user = User.get_by_id(current_user_id)
    
    return jsonify(user), 200

@app.route('/api/tecnicos', methods=['GET'])
@role_required('admin', 'empleado', 'tecnico')
def get_tecnicos():
    """Obtiene lista de técnicos activos para asignación"""
    tecnicos = User.get_tecnicos()
    return jsonify(tecnicos), 200

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
    
    if not data or not data.get('nombre'):
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

@app.route('/api/marcas/<int:marca_id>/orden', methods=['PUT'])
@role_required('admin')
def reorder_marca(marca_id):
    """Reordena una marca (up/down)"""
    data = request.get_json() or {}
    direction = (data.get('direction') or '').lower()

    if direction not in ('up', 'down'):
        return jsonify({'error': 'Dirección inválida. Usa up o down'}), 400

    try:
        moved = Marca.move(marca_id, direction)
        return jsonify({'success': moved}), 200
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

@app.route('/api/modelos/<int:modelo_id>/orden', methods=['PUT'])
@role_required('admin')
def reorder_modelo(modelo_id):
    """Reordena un modelo (up/down)"""
    data = request.get_json() or {}
    direction = (data.get('direction') or '').lower()

    if direction not in ('up', 'down'):
        return jsonify({'error': 'Dirección inválida. Usa up o down'}), 400

    try:
        moved = Modelo.move(modelo_id, direction)
        return jsonify({'success': moved}), 200
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
@role_required('admin', 'empleado', 'tecnico')
def create_ingreso():
    """Crea un nuevo ingreso técnico"""
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    
    # Validaciones básicas
    required_fields = ['marca_id', 'modelo_id', 'tecnico_id', 'cliente_nombre', 'cliente_apellido', 'cliente_cedula']
    if not all(data.get(field) for field in required_fields):
        return jsonify({'error': 'Campos requeridos incompletos'}), 400

    imei = str(data.get('imei', '') or '').strip()
    if imei and not imei.isdigit():
        return jsonify({'error': 'El IMEI solo puede contener números'}), 400

    # Nota: la cédula de cliente existente no debe bloquear la creación de nuevos ingresos.
    # El frontend puede advertir que el cliente ya existe, pero el backend permite registrar
    # múltiples ingresos para el mismo cliente.
    
    try:
        # Agregar empleado_id automáticamente
        data['empleado_id'] = current_user_id
        tecnico = User.get_by_id(int(data.get('tecnico_id')))
        if not tecnico or tecnico.get('rol') != 'tecnico':
            return jsonify({'error': 'Técnico inválido'}), 400

        data['tecnico_nombre'] = tecnico.get('nombre', '')
        data['tecnico_telefono'] = tecnico.get('telefono', '')
        data['tecnico_cedula'] = tecnico.get('cedula', '')
        
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

@app.route('/api/ingresos/<int:ingreso_id>', methods=['PUT'])
@role_required('admin', 'tecnico')
def update_ingreso(ingreso_id):
    """Actualiza un ingreso"""
    data = request.get_json()
    
    try:
        # Si se está actualizando el estado, usar el método específico
        if 'estado_ingreso' in data:
            Ingreso.update_estado(ingreso_id, data['estado_ingreso'])
        
        # Actualizar otros campos si es necesario
        updates = {}
        for key in ['cliente_nombre', 'cliente_apellido', 'cliente_cedula', 'cliente_telefono', 'cliente_direccion', 'color', 'imei', 'falla_general', 'valor_total', 'estado_pago', 'estado_apagado', 'tiene_clave', 'tipo_clave', 'clave', 'garantia', 'estuche', 'bandeja_sim', 'color_bandeja_sim', 'visor_partido', 'estado_botones_detalle']:
            if key in data:
                updates[key] = data[key]
        if updates:
            Ingreso.update(ingreso_id, updates)
        
        return jsonify({'success': True, 'message': 'Ingreso actualizado'}), 200
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
    if request.args.get('estado_pago'):
        filtros['estado_pago'] = request.args.get('estado_pago')
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
        tecnico = User.get_by_id(int(data['tecnico_id']))
        if not tecnico or tecnico.get('rol') != 'tecnico':
            return jsonify({'error': 'Técnico inválido'}), 400

        Ingreso.update_tecnico(ingreso_id, data['tecnico_id'], tecnico)
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
    current_user_id = int(get_jwt_identity())
    
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
    current_user_id = int(get_jwt_identity())
    
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

@app.route('/api/garantias', methods=['GET'])
@role_required('admin', 'tecnico')
def get_garantias():
    """Obtiene trazabilidad de garantías post-entrega"""
    limit = request.args.get('limit', 200, type=int)
    try:
        garantias = Nota.get_garantias(limit)
        return jsonify(garantias), 200
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
        user_id = User.create(
            data['usuario'],
            data['contraseña'],
            data['nombre'],
            data['rol'],
            data.get('telefono'),
            data.get('cedula')
        )
        return jsonify({'id': user_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/usuarios/<int:user_id>', methods=['PUT'])
@role_required('admin')
def update_usuario(user_id):
    """Actualiza un usuario"""
    data = request.get_json()
    
    try:
        User.update(
            user_id,
            data.get('nombre'),
            data.get('rol'),
            data.get('contraseña'),
            data.get('telefono'),
            data.get('cedula')
        )
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

@app.route('/api/configuracion/publica', methods=['GET'])
@jwt_required()
def get_configuracion_publica():
    """Obtiene datos públicos del negocio para branding en UI"""
    try:
        datos = Configuracion.get_datos_negocio()
        logo_navbar = datos.get('logo_navbar_url') or datos.get('logo_url')
        logo_ticket = datos.get('logo_ticket_url') or datos.get('logo_url')
        return jsonify({
            'nombre_negocio': datos.get('nombre_negocio', 'CELUPRO'),
            'logo_url': datos.get('logo_url'),
            'logo_navbar_url': logo_navbar,
            'logo_ticket_url': logo_ticket,
            'tecnico_default_id': Configuracion.get('tecnico_default_id')
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def process_logo_upload(file, filename, config_key):
    """Procesa y guarda un logo PNG en static/logos y actualiza configuración"""
    logos_dir = Path(app.config['UPLOAD_FOLDER'])
    logos_dir.mkdir(parents=True, exist_ok=True)

    filepath = logos_dir / filename

    image = Image.open(file.stream)
    if image.mode != 'RGBA':
        image = image.convert('RGBA')

    max_size = (1400, 400)
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    image.save(str(filepath), format='PNG', optimize=True)

    logo_url = f'/static/logos/{filename}'
    Configuracion.set(config_key, logo_url)

    return logo_url

@app.route('/api/admin/config/logo/<string:target>', methods=['POST'])
@role_required('admin')
def upload_logo_by_target(target):
    """Sube un logo para navbar o ticket de forma independiente"""
    try:
        target_map = {
            'navbar': ('logo_navbar.png', 'logo_navbar_url'),
            'ticket': ('logo_ticket.png', 'logo_ticket_url')
        }

        if target not in target_map:
            return jsonify({'error': 'Tipo de logo inválido. Use navbar o ticket'}), 400

        if 'logo' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400
        
        file = request.files['logo']
        
        # Verificar que tiene nombre
        if not file or file.filename == '':
            return jsonify({'error': 'Archivo sin nombre'}), 400
        
        # Verificar extensión
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({'error': 'Solo se permiten archivos PNG o JPG'}), 400

        filename, config_key = target_map[target]
        logo_url = process_logo_upload(file, filename, config_key)

        if not Configuracion.get('logo_url'):
            Configuracion.set('logo_url', logo_url)
        
        return jsonify({
            'success': True, 
            'url': logo_url,
            'target': target,
            'message': f'Logo de {target} subido exitosamente'
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error al procesar archivo: {str(e)}'}), 500

@app.route('/api/admin/config/logo', methods=['POST'])
@role_required('admin')
def upload_logo_legacy():
    """Ruta legacy: sube el mismo logo para navbar y ticket"""
    try:
        if 'logo' not in request.files:
            return jsonify({'error': 'No se envió ningún archivo'}), 400

        file = request.files['logo']
        if not file or file.filename == '':
            return jsonify({'error': 'Archivo sin nombre'}), 400

        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            return jsonify({'error': 'Solo se permiten archivos PNG o JPG'}), 400

        logo_navbar_url = process_logo_upload(file, 'logo_navbar.png', 'logo_navbar_url')
        file.stream.seek(0)
        logo_ticket_url = process_logo_upload(file, 'logo_ticket.png', 'logo_ticket_url')
        Configuracion.set('logo_url', logo_navbar_url)

        return jsonify({
            'success': True,
            'url': logo_navbar_url,
            'logo_navbar_url': logo_navbar_url,
            'logo_ticket_url': logo_ticket_url,
            'message': 'Logo subido para navbar y ticket'
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error al procesar archivo: {str(e)}'}), 500

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

        # Datos del negocio para vista previa
        datos_negocio = Configuracion.get_datos_negocio()
        ingreso_dict['nombre_negocio'] = datos_negocio.get('nombre_negocio', 'CELUPRO')
        ingreso_dict['telefono_negocio'] = datos_negocio.get('telefono_negocio', '')
        ingreso_dict['direccion_negocio'] = datos_negocio.get('direccion_negocio', '')
        ingreso_dict['email_negocio'] = datos_negocio.get('email_negocio', '')
        
        # Obtener ruta del logo (absoluta desde la raíz del proyecto)
        logo_path = None
        logo_config = (
            Configuracion.get('logo_ticket_url')
            or Configuracion.get('logo_url')
            or '/static/logos/logo_ticket.png'
        )
        if logo_config:
            # Construir ruta absoluta al logo
            project_root = Path(__file__).parent.parent
            logo_filename = logo_config.split('/')[-1]
            logo_path = str(project_root / 'frontend' / 'static' / 'logos' / logo_filename)
        
        # Generar datos del ticket
        ticket_bytes = generate_ticket_data(ingreso_dict, logo_path)
        
        # Retornar en base64 para que el frontend lo envíe a la impresora
        import base64
        ticket_b64 = base64.b64encode(ticket_bytes).decode('utf-8')
        
        return jsonify({
            'ticket_data': ticket_b64,
            'numero_ingreso': ingreso['numero_ingreso'],
            'cliente': f"{ingreso['cliente_nombre']} {ingreso['cliente_apellido']}",
            'ingreso': ingreso_dict,
            'negocio': datos_negocio,
            'paper_width_mm': int(Configuracion.get('ancho_papel_mm') or 58)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===== RUTAS DE BÚSQUEDA DE CLIENTES =====
@app.route('/api/clientes/buscar', methods=['GET'])
def buscar_clientes():
    """Busca clientes por nombre, cédula o teléfono"""
    try:
        query_param = request.args.get('q', '').upper().strip()
        
        if not query_param or len(query_param) < 2:
            return jsonify({'data': []}), 200
        
        query = '''
        SELECT
            cliente_cedula,
            MIN(cliente_nombre) as cliente_nombre,
            MIN(cliente_apellido) as cliente_apellido,
            MIN(cliente_telefono) as cliente_telefono,
            MIN(cliente_direccion) as cliente_direccion
        FROM ingresos
        WHERE 
            UPPER(cliente_nombre) LIKE ? OR
            UPPER(cliente_apellido) LIKE ? OR
            UPPER(cliente_cedula) LIKE ? OR
            UPPER(cliente_telefono) LIKE ?
        GROUP BY cliente_cedula
        ORDER BY cliente_nombre, cliente_apellido
        LIMIT 10
        '''
        
        search_term = f"%{query_param}%"
        
        from models.database import db as database
        results = database.execute_query(query, (search_term, search_term, search_term, search_term))
        
        clientes = []
        for row in results:
            clientes.append({
                'nombre': row['cliente_nombre'],
                'apellido': row['cliente_apellido'],
                'cedula': row['cliente_cedula'],
                'telefono': row['cliente_telefono'],
                'direccion': row['cliente_direccion']
            })
        
        return jsonify({'data': clientes}), 200
    except Exception as e:
        import traceback
        error_msg = str(e)
        trace = traceback.format_exc()
        return jsonify({'error': error_msg, 'trace': trace}), 500

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5001)

