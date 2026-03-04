from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta, datetime
from functools import wraps
import re
import os
import sys
import io
import json
import csv
import sqlite3
import zipfile
import threading
import time
import socket
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
from models.cliente import Cliente
from models.nota import Nota
from models.config import Configuracion
from models.database import DB_PATH
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
    try:
        Cliente.sync_from_ingresos()
    except Exception:
        pass
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


def _is_garantia_content(text):
    return bool(re.search(r'\[GARANTIA\]|GARANT[ÍI]A', str(text or ''), re.IGNORECASE))


def _get_ingreso_id_by_ingreso_falla(ingreso_falla_id):
    from models.database import db as database
    row = database.execute_single("SELECT ingreso_id FROM ingreso_fallas WHERE id = ?", (ingreso_falla_id,))
    return int(row['ingreso_id']) if row else None


def _is_ingreso_entregado(ingreso_id):
    ingreso = Ingreso.get_by_id(ingreso_id)
    if not ingreso:
        return None
    return str(ingreso.get('estado_ingreso') or '').lower() == 'entregado'


def _normalize_cedula(value):
    return ''.join(ch for ch in str(value or '').upper().strip() if ch.isalnum())


def _to_bool(value):
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'si', 'sí', 'yes', 'on')
    return bool(value)


def _normalize_imei_value(value):
    raw = str(value or '').strip()
    digits_only = re.sub(r'\D', '', raw)
    has_separator = bool(re.search(r'[\s,;/|-]+', raw))

    if not raw:
        return None, 'Debes ingresar al menos un IMEI válido'

    if not has_separator and len(digits_only) == 30:
        imeis = [digits_only[:15], digits_only[15:30]]
    else:
        imeis = [part.strip() for part in re.split(r'[^0-9]+', raw) if part.strip()]

    if not imeis:
        return None, 'Debes ingresar al menos un IMEI válido'

    if len(imeis) > 2:
        return None, 'Solo se permiten máximo 2 IMEIs por equipo'

    if any((not imei.isdigit()) or len(imei) != 15 for imei in imeis):
        return None, 'Cada IMEI debe tener exactamente 15 números'

    if len(set(imeis)) != len(imeis):
        return None, 'No repitas el mismo IMEI dos veces'

    return ' / '.join(imeis), None


def _safe_backup_path(filename):
    backup_dir = Path(__file__).resolve().parent.parent / 'backups'
    backup_dir.mkdir(parents=True, exist_ok=True)
    candidate = (backup_dir / filename).resolve()
    if backup_dir.resolve() not in candidate.parents:
        return None
    return candidate


def _create_backup_file():
    backup_dir = Path(__file__).resolve().parent.parent / 'backups'
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f'celupro_{timestamp}.db'
    backup_path = backup_dir / backup_name

    source_conn = sqlite3.connect(DB_PATH)
    backup_conn = sqlite3.connect(str(backup_path))
    try:
        source_conn.backup(backup_conn)
    finally:
        backup_conn.close()
        source_conn.close()

    return backup_name, backup_path


def _backup_scheduler_loop():
    """Genera backups automáticos según backup_interval_hours."""
    while True:
        try:
            interval_hours = int(Configuracion.get('backup_interval_hours') or 24)
            interval_hours = max(1, min(24 * 30, interval_hours))

            backup_dir = Path(__file__).resolve().parent.parent / 'backups'
            backup_dir.mkdir(parents=True, exist_ok=True)
            latest_mtime = None

            for path in backup_dir.glob('celupro_*.db'):
                if not path.is_file():
                    continue
                mtime = path.stat().st_mtime
                if latest_mtime is None or mtime > latest_mtime:
                    latest_mtime = mtime

            should_create = latest_mtime is None or (time.time() - latest_mtime) >= (interval_hours * 3600)
            if should_create:
                _create_backup_file()
        except Exception:
            pass

        time.sleep(300)


def _start_backup_scheduler():
    thread = threading.Thread(target=_backup_scheduler_loop, daemon=True, name='backup-scheduler')
    thread.start()


_start_backup_scheduler()


def _ensure_print_jobs_table():
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS print_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ingreso_id INTEGER NOT NULL,
                requested_by INTEGER,
                payload_json TEXT,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'done', 'error')),
                attempts INTEGER DEFAULT 0,
                printer_name TEXT,
                last_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                claimed_at TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (ingreso_id) REFERENCES ingresos(id) ON DELETE CASCADE,
                FOREIGN KEY (requested_by) REFERENCES usuarios(id)
            )
            '''
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created ON print_jobs(status, created_at)")
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(print_jobs)").fetchall()}
        if 'target_printer' not in columns:
            cursor.execute("ALTER TABLE print_jobs ADD COLUMN target_printer TEXT")

        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS print_workers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_name TEXT UNIQUE NOT NULL,
                worker_type TEXT DEFAULT 'agent' CHECK(worker_type IN ('agent', 'browser', 'backend')),
                printer_name TEXT,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_print_workers_last_seen ON print_workers(last_seen)")
        conn.commit()
    finally:
        conn.close()


_ensure_print_jobs_table()


def _config_bool(key, default=False):
    raw_value = Configuracion.get(key)
    if raw_value is None:
        return default
    return str(raw_value).strip().lower() in ('1', 'true', 'yes', 'si', 'sí', 'on')


def _build_ticket_context(ingreso_id):
    ingreso = Ingreso.get_by_id(ingreso_id)
    if not ingreso:
        raise ValueError('Ingreso no encontrado')

    fallas = IngresoFalla.get_by_ingreso(ingreso_id)
    ingreso_dict = dict(ingreso)
    ingreso_dict['fallas'] = fallas

    datos_negocio = Configuracion.get_datos_negocio()
    ingreso_dict['nombre_negocio'] = datos_negocio.get('nombre_negocio', 'CELUPRO')
    ingreso_dict['telefono_negocio'] = datos_negocio.get('telefono_negocio', '')
    ingreso_dict['direccion_negocio'] = datos_negocio.get('direccion_negocio', '')
    ingreso_dict['email_negocio'] = datos_negocio.get('email_negocio', '')

    logo_path = None
    logo_config = (
        Configuracion.get('logo_ticket_url')
        or Configuracion.get('logo_url')
        or '/static/logos/logo_ticket.png'
    )
    if logo_config:
        project_root = Path(__file__).parent.parent
        logo_filename = logo_config.split('/')[-1]
        logo_path = str(project_root / 'frontend' / 'static' / 'logos' / logo_filename)

    return ingreso, ingreso_dict, datos_negocio, logo_path


def _generate_ticket_bytes_for_ingreso(ingreso_id):
    _, ingreso_dict, _, logo_path = _build_ticket_context(ingreso_id)
    return generate_ticket_data(ingreso_dict, logo_path)


def _claim_next_print_job_internal(printer_name='BACKEND_TCP_RAW'):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute('BEGIN IMMEDIATE')
        job = cursor.execute(
            '''
                        SELECT id, ingreso_id, attempts
            FROM print_jobs
                        WHERE status = 'pending'
                            AND (COALESCE(TRIM(target_printer), '') = '' OR target_printer = ?)
                        ORDER BY CASE WHEN target_printer = ? THEN 0 ELSE 1 END, id ASC
            LIMIT 1
            '''
                        , (printer_name, printer_name)
        ).fetchone()

        if not job:
            conn.rollback()
            return None

        cursor.execute(
            '''
            UPDATE print_jobs
            SET status = 'processing',
                attempts = attempts + 1,
                claimed_at = CURRENT_TIMESTAMP,
                printer_name = COALESCE(NULLIF(?, ''), printer_name)
            WHERE id = ?
            ''',
            (printer_name, job['id'])
        )
        conn.commit()
        return {
            'id': int(job['id']),
            'ingreso_id': int(job['ingreso_id']),
            'attempts': int(job['attempts'] or 0) + 1
        }
    finally:
        conn.close()


def _complete_print_job_internal(job_id):
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute(
            '''
            UPDATE print_jobs
            SET status = 'done',
                completed_at = CURRENT_TIMESTAMP,
                last_error = NULL
            WHERE id = ? AND status = 'processing'
            ''',
            (job_id,)
        )
        conn.commit()
    finally:
        conn.close()


def _fail_print_job_internal(job_id, error_message):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        row = cursor.execute("SELECT attempts FROM print_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return

        attempts = int(row['attempts'] or 0)
        next_status = 'error' if attempts >= 5 else 'pending'
        cursor.execute(
            '''
            UPDATE print_jobs
            SET status = ?,
                last_error = ?,
                completed_at = CASE WHEN ? = 'error' THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id = ?
            ''',
            (next_status, str(error_message or 'Error de impresión')[:500], next_status, job_id)
        )
        conn.commit()
    finally:
        conn.close()


def _print_ticket_to_network_printer(host, port, ticket_bytes):
    with socket.create_connection((host, port), timeout=10) as sock:
        sock.sendall(ticket_bytes)


def _upsert_print_worker(worker_name, worker_type='agent', printer_name=''):
    safe_name = str(worker_name or '').strip()
    if not safe_name:
        return

    safe_type = str(worker_type or 'agent').strip().lower()
    if safe_type not in ('agent', 'browser', 'backend'):
        safe_type = 'agent'

    safe_printer = str(printer_name or '').strip()

    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute(
            '''
            INSERT INTO print_workers (worker_name, worker_type, printer_name, last_seen)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(worker_name) DO UPDATE SET
                worker_type = excluded.worker_type,
                printer_name = excluded.printer_name,
                last_seen = CURRENT_TIMESTAMP
            ''',
            (safe_name, safe_type, safe_printer)
        )
        conn.commit()
    finally:
        conn.close()


def _backend_print_worker_loop():
    while True:
        job = None
        try:
            enabled = _config_bool('print_backend_auto_enabled', False)
            if not enabled:
                time.sleep(2)
                continue

            _upsert_print_worker('BACKEND_TCP_RAW', 'backend', 'BACKEND_TCP_RAW')

            host = str(Configuracion.get('print_backend_host') or '').strip()
            if not host:
                time.sleep(2)
                continue

            port_value = Configuracion.get('print_backend_port') or '9100'
            try:
                port = int(port_value)
            except (TypeError, ValueError):
                port = 9100

            if port < 1 or port > 65535:
                port = 9100

            job = _claim_next_print_job_internal('BACKEND_TCP_RAW')
            if not job:
                time.sleep(1.5)
                continue

            ticket_bytes = _generate_ticket_bytes_for_ingreso(job['ingreso_id'])
            _print_ticket_to_network_printer(host, port, ticket_bytes)
            _complete_print_job_internal(job['id'])
        except Exception as exc:
            if job and job.get('id'):
                try:
                    _fail_print_job_internal(job['id'], str(exc))
                except Exception:
                    pass
            time.sleep(2)


def _start_backend_print_worker():
    thread = threading.Thread(target=_backend_print_worker_loop, daemon=True, name='backend-print-worker')
    thread.start()


_start_backend_print_worker()

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

@app.route('/api/fallas/<int:falla_id>/orden', methods=['PUT'])
@role_required('admin')
def reorder_falla(falla_id):
    """Reordena una falla (up/down)"""
    data = request.get_json() or {}
    direction = (data.get('direction') or '').lower()

    if direction not in ('up', 'down'):
        return jsonify({'error': 'Dirección inválida. Usa up o down'}), 400

    try:
        moved = Falla.move(falla_id, direction)
        return jsonify({'success': moved}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ===== RUTAS DE INGRESOS TÉCNICOS =====
@app.route('/api/ingresos', methods=['POST'])
@role_required('admin', 'empleado', 'tecnico')
def create_ingreso():
    """Crea un nuevo ingreso técnico"""
    data = request.get_json() or {}
    current_user_id = int(get_jwt_identity())
    equipo_no_lista_raw = data.get('equipo_no_lista', False)
    if isinstance(equipo_no_lista_raw, str):
        equipo_no_lista = equipo_no_lista_raw.strip().lower() in ('1', 'true', 'si', 'sí', 'yes', 'on')
    else:
        equipo_no_lista = bool(equipo_no_lista_raw)

    # Compatibilidad defensiva: si marca/modelo vienen ambos vacíos, tratar como no_lista
    marca_vacia = data.get('marca_id') in (None, '', 'null')
    modelo_vacio = data.get('modelo_id') in (None, '', 'null')
    if not equipo_no_lista and marca_vacia and modelo_vacio:
        equipo_no_lista = True

    def _is_text_only(value):
        return bool(value) and all(ch.isalpha() or ch.isspace() for ch in value)

    # Validaciones explícitas para evitar falsos positivos
    cliente_nombre = str(data.get('cliente_nombre') or '').strip()
    cliente_apellido = str(data.get('cliente_apellido') or '').strip()
    cliente_cedula = str(data.get('cliente_cedula') or '').strip()
    cliente_telefono = str(data.get('cliente_telefono') or '').strip()

    missing_fields = []
    if not cliente_nombre:
        missing_fields.append('cliente_nombre')
    if not cliente_apellido:
        missing_fields.append('cliente_apellido')
    if not cliente_cedula:
        missing_fields.append('cliente_cedula')

    try:
        tecnico_id = int(data.get('tecnico_id'))
    except (TypeError, ValueError):
        tecnico_id = None
        missing_fields.append('tecnico_id')

    if not equipo_no_lista:
        try:
            int(data.get('marca_id'))
        except (TypeError, ValueError):
            missing_fields.append('marca_id')

        try:
            int(data.get('modelo_id'))
        except (TypeError, ValueError):
            missing_fields.append('modelo_id')

    if missing_fields:
        return jsonify({
            'error': f'Campos requeridos incompletos (ingresos): {", ".join(sorted(set(missing_fields)))}',
            'missing_fields': sorted(set(missing_fields))
        }), 400

    if not _is_text_only(cliente_nombre):
        return jsonify({'error': 'El nombre del cliente solo debe contener texto'}), 400

    if not _is_text_only(cliente_apellido):
        return jsonify({'error': 'El apellido del cliente solo debe contener texto'}), 400

    if not cliente_cedula.isdigit():
        return jsonify({'error': 'La cédula del cliente solo debe contener números'}), 400

    if cliente_telefono and not cliente_telefono.isdigit():
        return jsonify({'error': 'El teléfono del cliente solo debe contener números'}), 400

    imei_no_visible = _to_bool(data.get('imei_no_visible', False))
    if imei_no_visible:
        imei = ''
    else:
        imei, imei_error = _normalize_imei_value(data.get('imei', ''))
        if imei_error:
            return jsonify({'error': imei_error}), 400

    data['cliente_nombre'] = cliente_nombre
    data['cliente_apellido'] = cliente_apellido
    data['cliente_cedula'] = cliente_cedula
    data['cliente_telefono'] = cliente_telefono
    data['imei'] = imei
    data['imei_no_visible'] = imei_no_visible

    tiene_clave_raw = data.get('tiene_clave', False)
    if isinstance(tiene_clave_raw, str):
        tiene_clave = tiene_clave_raw.strip().lower() in ('1', 'true', 'si', 'sí', 'yes', 'on')
    else:
        tiene_clave = bool(tiene_clave_raw)

    tipo_clave = str(data.get('tipo_clave', '') or '').strip().upper()
    clave = str(data.get('clave', '') or '').strip()
    if tiene_clave and tipo_clave == 'NUMERICA' and clave and not clave.isdigit():
        return jsonify({'error': 'La clave NUMÉRICA solo permite números'}), 400

    # Nota: la cédula de cliente existente no debe bloquear la creación de nuevos ingresos.
    # El frontend puede advertir que el cliente ya existe, pero el backend permite registrar
    # múltiples ingresos para el mismo cliente.
    
    try:
        if equipo_no_lista:
            no_lista_defaults = Modelo.get_or_create_no_lista_defaults()
            data['marca_id'] = no_lista_defaults['marca_id']
            data['modelo_id'] = no_lista_defaults['modelo_id']
            data['equipo_no_lista'] = True
        else:
            try:
                data['marca_id'] = int(data.get('marca_id'))
                data['modelo_id'] = int(data.get('modelo_id'))
            except (TypeError, ValueError):
                return jsonify({'error': 'Marca o modelo inválidos'}), 400

            marca = Marca.get_by_id(data['marca_id'])
            modelo = Modelo.get_by_id(data['modelo_id'])
            if not marca or not modelo:
                return jsonify({'error': 'Marca o modelo no encontrados'}), 400
            if not Modelo.belongs_to_marca(data['modelo_id'], data['marca_id']):
                return jsonify({'error': 'El modelo no pertenece a la marca seleccionada'}), 400
            data['equipo_no_lista'] = False

        # Agregar empleado_id automáticamente
        data['empleado_id'] = current_user_id
        tecnico = User.get_by_id(tecnico_id)
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

        Cliente.upsert({
            'cliente_cedula': data.get('cliente_cedula'),
            'cliente_nombre': data.get('cliente_nombre'),
            'cliente_apellido': data.get('cliente_apellido'),
            'cliente_telefono': data.get('cliente_telefono'),
            'cliente_direccion': data.get('cliente_direccion')
        })
        
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
        ingreso_actual = Ingreso.get_by_id(ingreso_id)
        if not ingreso_actual:
            return jsonify({'error': 'Ingreso no encontrado'}), 404

        if str(ingreso_actual.get('estado_ingreso') or '').lower() == 'entregado':
            return jsonify({'error': 'No se puede eliminar un ingreso entregado desde Registros'}), 409

        Cliente.upsert({
            'cliente_cedula': ingreso_actual.get('cliente_cedula'),
            'cliente_nombre': ingreso_actual.get('cliente_nombre'),
            'cliente_apellido': ingreso_actual.get('cliente_apellido'),
            'cliente_telefono': ingreso_actual.get('cliente_telefono'),
            'cliente_direccion': ingreso_actual.get('cliente_direccion')
        })
        Ingreso.delete(ingreso_id)
        return jsonify({'success': True, 'message': 'Ingreso eliminado'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingresos/<int:ingreso_id>', methods=['PUT'])
@role_required('admin', 'tecnico', 'empleado')
def update_ingreso(ingreso_id):
    """Actualiza un ingreso"""
    data = request.get_json() or {}
    current_user_id = int(get_jwt_identity())
    current_user = User.get_by_id(current_user_id)
    
    try:
        def _is_text_only(value):
            return bool(value) and all(ch.isalpha() or ch.isspace() for ch in value)

        ingreso_actual = Ingreso.get_by_id(ingreso_id)
        if not ingreso_actual:
            return jsonify({'error': 'Ingreso no encontrado'}), 404

        if str(ingreso_actual.get('estado_ingreso') or '').lower() == 'entregado':
            return jsonify({'error': 'Ingreso entregado bloqueado para edición. Usa Ingresar por Garantía.'}), 409

        # Si se está actualizando el estado, usar el método específico
        if 'estado_ingreso' in data:
            Ingreso.update_estado(ingreso_id, data['estado_ingreso'])
        
        # Actualizar otros campos si es necesario
        updates = {}
        for key in ['cliente_nombre', 'cliente_apellido', 'cliente_cedula', 'cliente_telefono', 'cliente_direccion', 'color', 'imei', 'imei_no_visible', 'falla_general', 'valor_total', 'estado_pago', 'estado_apagado', 'tiene_clave', 'tipo_clave', 'clave', 'garantia', 'estuche', 'bandeja_sim', 'color_bandeja_sim', 'visor_partido', 'estado_botones_detalle']:
            if key in data:
                updates[key] = data[key]

        tiene_clave_raw = updates.get('tiene_clave', ingreso_actual.get('tiene_clave', False))
        if isinstance(tiene_clave_raw, str):
            tiene_clave = tiene_clave_raw.strip().lower() in ('1', 'true', 'si', 'sí', 'yes', 'on')
        else:
            tiene_clave = bool(tiene_clave_raw)

        tipo_clave = str(updates.get('tipo_clave', ingreso_actual.get('tipo_clave', '')) or '').strip().upper()
        clave = str(updates.get('clave', ingreso_actual.get('clave', '')) or '').strip()
        if tiene_clave and tipo_clave == 'NUMERICA' and clave and not clave.isdigit():
            return jsonify({'error': 'La clave NUMÉRICA solo permite números'}), 400

        if 'cliente_nombre' in updates:
            nombre = str(updates.get('cliente_nombre') or '').strip()
            if not _is_text_only(nombre):
                return jsonify({'error': 'El nombre del cliente solo debe contener texto'}), 400
            updates['cliente_nombre'] = nombre

        if 'cliente_apellido' in updates:
            apellido = str(updates.get('cliente_apellido') or '').strip()
            if not _is_text_only(apellido):
                return jsonify({'error': 'El apellido del cliente solo debe contener texto'}), 400
            updates['cliente_apellido'] = apellido

        if 'cliente_cedula' in updates:
            cedula = str(updates.get('cliente_cedula') or '').strip()
            if not cedula.isdigit():
                return jsonify({'error': 'La cédula del cliente solo debe contener números'}), 400
            updates['cliente_cedula'] = cedula

        if 'cliente_telefono' in updates:
            telefono = str(updates.get('cliente_telefono') or '').strip()
            if telefono and not telefono.isdigit():
                return jsonify({'error': 'El teléfono del cliente solo debe contener números'}), 400
            updates['cliente_telefono'] = telefono

        imei_no_visible = _to_bool(updates.get('imei_no_visible', ingreso_actual.get('imei_no_visible', False)))
        if imei_no_visible:
            updates['imei_no_visible'] = True
            updates['imei'] = ''
        elif 'imei' in updates or 'imei_no_visible' in updates:
            imei_update, imei_error = _normalize_imei_value(updates.get('imei', ingreso_actual.get('imei', '')))
            if imei_error:
                return jsonify({'error': imei_error}), 400
            updates['imei'] = imei_update
            updates['imei_no_visible'] = False

        is_admin = current_user and current_user.get('rol') == 'admin'
        catalog_fields = {'marca_id', 'modelo_id', 'equipo_no_lista'}
        requested_catalog_update = any(field in data for field in catalog_fields)

        if requested_catalog_update and not is_admin:
            return jsonify({'error': 'Solo admin puede actualizar marca/modelo del ingreso'}), 403

        if requested_catalog_update:

            marca_id = data.get('marca_id', ingreso_actual.get('marca_id'))
            modelo_id = data.get('modelo_id', ingreso_actual.get('modelo_id'))

            if marca_id is not None:
                try:
                    marca_id = int(marca_id)
                except (TypeError, ValueError):
                    return jsonify({'error': 'marca_id inválido'}), 400

            if modelo_id is not None:
                try:
                    modelo_id = int(modelo_id)
                except (TypeError, ValueError):
                    return jsonify({'error': 'modelo_id inválido'}), 400

            if not marca_id or not modelo_id:
                return jsonify({'error': 'Marca y modelo son requeridos para catalogar'}), 400

            marca = Marca.get_by_id(marca_id)
            modelo = Modelo.get_by_id(modelo_id)
            if not marca or not modelo:
                return jsonify({'error': 'Marca o modelo no encontrados'}), 400
            if not Modelo.belongs_to_marca(modelo_id, marca_id):
                return jsonify({'error': 'El modelo no pertenece a la marca seleccionada'}), 400

            updates['marca_id'] = marca_id
            updates['modelo_id'] = modelo_id
            updates['equipo_no_lista'] = bool(data.get('equipo_no_lista', False))

        if updates:
            Ingreso.update(ingreso_id, updates)

        merged_cliente = {
            'cliente_nombre': updates.get('cliente_nombre', ingreso_actual.get('cliente_nombre')),
            'cliente_apellido': updates.get('cliente_apellido', ingreso_actual.get('cliente_apellido')),
            'cliente_cedula': updates.get('cliente_cedula', ingreso_actual.get('cliente_cedula')),
            'cliente_telefono': updates.get('cliente_telefono', ingreso_actual.get('cliente_telefono')),
            'cliente_direccion': updates.get('cliente_direccion', ingreso_actual.get('cliente_direccion'))
        }
        Cliente.upsert(merged_cliente)
        
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
        ingreso = Ingreso.get_by_id(ingreso_id)
        if not ingreso:
            return jsonify({'error': 'Ingreso no encontrado'}), 404

        if str(ingreso.get('estado_ingreso') or '').lower() == 'entregado':
            return jsonify({'error': 'Ingreso entregado bloqueado para edición. Usa Ingresar por Garantía.'}), 409

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
        if _is_ingreso_entregado(ingreso_id):
            return jsonify({'error': 'No se pueden modificar fallas en ingresos entregados. Usa Ingresar por Garantía.'}), 409

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
        ingreso_id = _get_ingreso_id_by_ingreso_falla(ingreso_falla_id)
        if not ingreso_id:
            return jsonify({'error': 'Falla de ingreso no encontrada'}), 404

        if _is_ingreso_entregado(ingreso_id):
            return jsonify({'error': 'No se puede actualizar valor en ingresos entregados. Usa Ingresar por Garantía.'}), 409

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
        ingreso_id = _get_ingreso_id_by_ingreso_falla(ingreso_falla_id)
        if not ingreso_id:
            return jsonify({'error': 'Falla de ingreso no encontrada'}), 404

        if _is_ingreso_entregado(ingreso_id):
            return jsonify({'error': 'No se puede actualizar estado de fallas en ingresos entregados. Usa Ingresar por Garantía.'}), 409

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
        ingreso_id = _get_ingreso_id_by_ingreso_falla(ingreso_falla_id)
        if not ingreso_id:
            return jsonify({'error': 'Falla de ingreso no encontrada'}), 404

        if _is_ingreso_entregado(ingreso_id):
            return jsonify({'error': 'No se pueden agregar notas a fallas en ingresos entregados. Usa Ingresar por Garantía.'}), 409

        IngresoFalla.add_nota(ingreso_falla_id, data.get('notas_falla', ''))
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ingreso-fallas/<int:ingreso_falla_id>', methods=['DELETE'])
@role_required('admin', 'tecnico')
def delete_ingreso_falla(ingreso_falla_id):
    """Elimina una falla de un ingreso"""
    try:
        ingreso_id = _get_ingreso_id_by_ingreso_falla(ingreso_falla_id)
        if not ingreso_id:
            return jsonify({'error': 'Falla de ingreso no encontrada'}), 404

        if _is_ingreso_entregado(ingreso_id):
            return jsonify({'error': 'No se pueden eliminar fallas en ingresos entregados. Usa Ingresar por Garantía.'}), 409

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
        ingreso = Ingreso.get_by_id(ingreso_id)
        if not ingreso:
            return jsonify({'error': 'Ingreso no encontrado'}), 404

        if str(ingreso.get('estado_ingreso') or '').lower() == 'entregado' and not _is_garantia_content(data.get('contenido')):
            return jsonify({'error': 'Ingreso entregado bloqueado para notas generales. Solo se permite garantía.'}), 409

        nota_id = Nota.create(
            ingreso_id,
            current_user_id,
            data['contenido'],
            data.get('tipo', 'general')
        )
        return jsonify({'id': nota_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/ingresos/<int:ingreso_id>/garantia', methods=['POST'])
@role_required('admin', 'tecnico')
def ingresar_garantia(ingreso_id):
    """Reingresa un equipo entregado por garantía y reabre el caso."""
    data = request.get_json() or {}
    current_user_id = int(get_jwt_identity())
    comentario = str(data.get('comentario') or '').strip()

    if not comentario:
        return jsonify({'error': 'comentario requerido'}), 400

    ingreso = Ingreso.get_by_id(ingreso_id)
    if not ingreso:
        return jsonify({'error': 'Ingreso no encontrado'}), 404

    if str(ingreso.get('estado_ingreso') or '').lower() != 'entregado':
        return jsonify({'error': 'Solo ingresos entregados pueden ingresar por garantía'}), 409

    try:
        Nota.create(ingreso_id, current_user_id, f"[GARANTIA][ABIERTA]: {comentario}", 'tecnica')
        Ingreso.update_estado(ingreso_id, 'en_reparacion')
        Ingreso.update(ingreso_id, {'garantia': True})
        return jsonify({'success': True, 'message': 'Ingreso reabierto por garantía'}), 200
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


@app.route('/api/admin/backups/list', methods=['GET'])
@role_required('admin')
def list_backups():
    """Lista copias de seguridad disponibles"""
    try:
        backup_dir = Path(__file__).resolve().parent.parent / 'backups'
        backup_dir.mkdir(parents=True, exist_ok=True)

        files = []
        for path in backup_dir.glob('*'):
            if not path.is_file():
                continue
            files.append({
                'filename': path.name,
                'size_bytes': path.stat().st_size,
                'updated_at': datetime.fromtimestamp(path.stat().st_mtime).isoformat()
            })

        files.sort(key=lambda item: item['updated_at'], reverse=True)
        return jsonify({'data': files}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/backups/create', methods=['POST'])
@role_required('admin')
def create_backup():
    """Genera copia de seguridad SQLite en carpeta backups"""
    try:
        backup_name, _ = _create_backup_file()

        return jsonify({
            'success': True,
            'filename': backup_name,
            'path': f'/api/admin/backups/download/{backup_name}'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/backups/download/<path:filename>', methods=['GET'])
@role_required('admin')
def download_backup(filename):
    """Descarga una copia de seguridad"""
    backup_file = _safe_backup_path(filename)
    if not backup_file or not backup_file.exists() or not backup_file.is_file():
        return jsonify({'error': 'Archivo de backup no encontrado'}), 404

    return send_file(str(backup_file), as_attachment=True, download_name=backup_file.name)


@app.route('/api/admin/db/export', methods=['GET'])
@role_required('admin')
def export_full_database():
    """Exporta la base de datos completa en CSV (ZIP)"""
    try:
        tables = [
            'usuarios',
            'marcas',
            'modelos',
            'fallas_catalogo',
            'clientes',
            'configuracion',
            'ingresos',
            'ingreso_fallas',
            'notas_ingreso',
            'print_jobs'
        ]

        zip_buffer = io.BytesIO()
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        try:
            with zipfile.ZipFile(zip_buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zip_file:
                for table in tables:
                    columns = [row['name'] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
                    if not columns:
                        continue

                    rows = conn.execute(f"SELECT * FROM {table}").fetchall()
                    output = io.StringIO()
                    writer = csv.writer(output)
                    writer.writerow(columns)
                    for row in rows:
                        writer.writerow([row[col] for col in columns])

                    zip_file.writestr(f"{table}.csv", output.getvalue().encode('utf-8-sig'))
                    output.close()
        finally:
            conn.close()

        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            as_attachment=True,
            mimetype='application/zip',
            download_name=f'celupro_full_csv_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/db/import', methods=['POST'])
@role_required('admin')
def import_full_database():
    """Importa base completa desde ZIP de CSVs"""
    if 'file' not in request.files:
        return jsonify({'error': 'No se envió archivo de importación'}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Archivo inválido'}), 400

    if not file.filename.lower().endswith('.zip'):
        return jsonify({'error': 'Formato inválido. Debe ser un .zip con archivos CSV'}), 400

    try:
        expected_tables = [
            'usuarios',
            'marcas',
            'modelos',
            'fallas_catalogo',
            'clientes',
            'configuracion',
            'ingresos',
            'ingreso_fallas',
            'notas_ingreso',
            'print_jobs'
        ]
        required_tables = {'usuarios', 'marcas', 'modelos', 'ingresos', 'configuracion'}

        zip_bytes = io.BytesIO(file.read())
        with zipfile.ZipFile(zip_bytes, 'r') as zf:
            available_csv = {Path(name).name for name in zf.namelist() if name.lower().endswith('.csv')}
            required_csv = {f'{table}.csv' for table in required_tables}
            missing = sorted(required_csv - available_csv)

            if missing:
                return jsonify({'error': f'Plantilla incompleta. Faltan: {", ".join(missing)}'}), 400

            table_rows = {}
            for table in expected_tables:
                filename = f'{table}.csv'
                if filename not in available_csv:
                    table_rows[table] = []
                    continue

                raw = zf.read(filename).decode('utf-8-sig')
                reader = csv.DictReader(io.StringIO(raw))
                table_rows[table] = list(reader)

        # Respaldo de seguridad antes de importar
        _create_backup_file()

        conn = sqlite3.connect(DB_PATH)
        try:
            cursor = conn.cursor()
            cursor.execute('PRAGMA foreign_keys = OFF')
            cursor.execute('BEGIN')

            delete_order = [
                'print_jobs',
                'notas_ingreso',
                'ingreso_fallas',
                'ingresos',
                'modelos',
                'marcas',
                'fallas_catalogo',
                'clientes',
                'configuracion',
                'usuarios'
            ]

            for table in delete_order:
                cursor.execute(f'DELETE FROM {table}')

            insert_order = [
                'usuarios',
                'marcas',
                'modelos',
                'fallas_catalogo',
                'clientes',
                'configuracion',
                'ingresos',
                'ingreso_fallas',
                'notas_ingreso',
                'print_jobs'
            ]

            for table in insert_order:
                rows = table_rows.get(table, [])
                if not rows:
                    continue

                db_columns = [row[1] for row in cursor.execute(f'PRAGMA table_info({table})').fetchall()]
                csv_columns = [col for col in rows[0].keys() if col in db_columns]
                if not csv_columns:
                    continue

                placeholders = ','.join(['?'] * len(csv_columns))
                insert_sql = f"INSERT INTO {table} ({', '.join(csv_columns)}) VALUES ({placeholders})"

                for row in rows:
                    values = [None if row.get(col, '') == '' else row.get(col) for col in csv_columns]
                    cursor.execute(insert_sql, values)

            conn.commit()
            cursor.execute('PRAGMA foreign_keys = ON')
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

        from database.init_db import init_db as reinit_db
        reinit_db()
        Cliente.sync_from_ingresos()

        return jsonify({'success': True, 'message': 'Base de datos importada desde CSV correctamente'}), 200
    except zipfile.BadZipFile:
        return jsonify({'error': 'Archivo ZIP inválido'}), 400
    except UnicodeDecodeError:
        return jsonify({'error': 'Uno o más CSV no están en UTF-8'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/ingresos/clear', methods=['POST'])
@role_required('admin')
def clear_all_ingresos_keep_clientes():
    """Elimina todos los ingresos (incluyendo fallas y notas), preservando la base de clientes."""
    try:
        _create_backup_file()

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row

        try:
            cursor = conn.cursor()
            cursor.execute('PRAGMA foreign_keys = OFF')
            cursor.execute('BEGIN')

            notas_count = cursor.execute('SELECT COUNT(*) AS c FROM notas_ingreso').fetchone()['c']
            fallas_count = cursor.execute('SELECT COUNT(*) AS c FROM ingreso_fallas').fetchone()['c']
            ingresos_count = cursor.execute('SELECT COUNT(*) AS c FROM ingresos').fetchone()['c']
            jobs_count = cursor.execute('SELECT COUNT(*) AS c FROM print_jobs').fetchone()['c']

            cursor.execute('DELETE FROM print_jobs')
            cursor.execute('DELETE FROM notas_ingreso')
            cursor.execute('DELETE FROM ingreso_fallas')
            cursor.execute('DELETE FROM ingresos')

            try:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('ingresos','ingreso_fallas','notas_ingreso','print_jobs')")
            except Exception:
                pass

            clientes_count = cursor.execute('SELECT COUNT(*) AS c FROM clientes').fetchone()['c']

            conn.commit()
            cursor.execute('PRAGMA foreign_keys = ON')
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

        return jsonify({
            'success': True,
            'message': 'Se eliminaron todos los ingresos sin borrar clientes',
            'deleted': {
                'ingresos': int(ingresos_count or 0),
                'ingreso_fallas': int(fallas_count or 0),
                'notas_ingreso': int(notas_count or 0),
                'print_jobs': int(jobs_count or 0)
            },
            'clientes_preservados': int(clientes_count or 0)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/csv/clientes/export', methods=['GET'])
@role_required('admin')
def export_clientes_csv():
    """Exporta clientes únicos (por cédula) a CSV"""
    try:
        from models.database import db as database
        query = '''
        SELECT
            c.cedula as cliente_cedula,
            c.nombre as cliente_nombre,
            c.apellido as cliente_apellido,
            c.telefono as cliente_telefono,
            c.direccion as cliente_direccion,
            (
                SELECT COUNT(*)
                FROM ingresos i
                WHERE REPLACE(REPLACE(REPLACE(UPPER(TRIM(i.cliente_cedula)), '.', ''), '-', ''), ' ', '') = c.cedula
            ) AS total_ingresos
        FROM clientes c
        ORDER BY c.fecha_actualizacion DESC, c.id DESC
        '''

        rows = database.execute_query(query)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'cliente_cedula',
            'cliente_nombre',
            'cliente_apellido',
            'cliente_telefono',
            'cliente_direccion',
            'total_ingresos'
        ])

        for row in rows:
            writer.writerow([
                row['cliente_cedula'] or '',
                row['cliente_nombre'] or '',
                row['cliente_apellido'] or '',
                row['cliente_telefono'] or '',
                row['cliente_direccion'] or '',
                row['total_ingresos'] or 0
            ])

        csv_bytes = io.BytesIO(output.getvalue().encode('utf-8-sig'))
        output.close()

        filename = f'clientes_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        return send_file(csv_bytes, mimetype='text/csv', as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/csv/clientes/import', methods=['POST'])
@role_required('admin')
def import_clientes_csv():
    """Importa clientes desde CSV y actualiza ingresos existentes por cédula"""
    if 'file' not in request.files:
        return jsonify({'error': 'No se envió archivo CSV'}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Archivo inválido'}), 400

    if not file.filename.lower().endswith('.csv'):
        return jsonify({'error': 'Solo se permite formato CSV'}), 400

    try:
        content = file.stream.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(content))

        if not reader.fieldnames:
            return jsonify({'error': 'CSV sin cabeceras'}), 400

        field_map = {name.strip().lower(): name for name in reader.fieldnames}
        cedula_field = field_map.get('cliente_cedula') or field_map.get('cedula')
        nombre_field = field_map.get('cliente_nombre') or field_map.get('nombre')
        apellido_field = field_map.get('cliente_apellido') or field_map.get('apellido')
        telefono_field = field_map.get('cliente_telefono') or field_map.get('telefono')
        direccion_field = field_map.get('cliente_direccion') or field_map.get('direccion')

        required = [cedula_field, nombre_field, apellido_field]
        if not all(required):
            return jsonify({'error': 'El CSV debe incluir: cliente_cedula, cliente_nombre, cliente_apellido'}), 400

        from models.database import db as database
        updated_rows = 0
        skipped_rows = 0
        no_match_rows = 0
        clientes_upserted = 0

        for row in reader:
            cedula_norm = _normalize_cedula(row.get(cedula_field, ''))
            nombre = str(row.get(nombre_field, '') or '').strip().upper()
            apellido = str(row.get(apellido_field, '') or '').strip().upper()
            telefono = str(row.get(telefono_field, '') or '').strip().upper() if telefono_field else ''
            direccion = str(row.get(direccion_field, '') or '').strip().upper() if direccion_field else ''

            if not cedula_norm or not nombre or not apellido:
                skipped_rows += 1
                continue

            Cliente.upsert({
                'cliente_cedula': cedula_norm,
                'cliente_nombre': nombre,
                'cliente_apellido': apellido,
                'cliente_telefono': telefono,
                'cliente_direccion': direccion
            })
            clientes_upserted += 1

            query = '''
            UPDATE ingresos
            SET cliente_nombre = ?,
                cliente_apellido = ?,
                cliente_telefono = ?,
                cliente_direccion = ?
            WHERE REPLACE(REPLACE(REPLACE(UPPER(TRIM(cliente_cedula)), '.', ''), '-', ''), ' ', '') = ?
            '''

            with database.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, (nombre, apellido, telefono, direccion, cedula_norm))
                conn.commit()
                affected = cursor.rowcount or 0

            if affected > 0:
                updated_rows += affected
            else:
                no_match_rows += 1

        return jsonify({
            'success': True,
            'clientes_upserted': clientes_upserted,
            'updated_rows': updated_rows,
            'skipped_rows': skipped_rows,
            'no_match_rows': no_match_rows
        }), 200
    except UnicodeDecodeError:
        return jsonify({'error': 'No se pudo leer el CSV. Usa codificación UTF-8.'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
            'tecnico_default_id': Configuracion.get('tecnico_default_id'),
            'print_dispatch_mode': 'queue_auto',
            'print_target_printer': Configuracion.get('print_target_printer') or ''
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
    try:
        ingreso, ingreso_dict, datos_negocio, logo_path = _build_ticket_context(ingreso_id)
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
            'paper_width_mm': int(Configuracion.get('ancho_papel_mm') or 58),
            'paper_height_mm': int(Configuracion.get('largo_papel_mm') or 300),
            'paper_margin_mm': int(Configuracion.get('margen_papel_mm') or 0)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/print-jobs', methods=['POST'])
@role_required('admin', 'empleado', 'tecnico')
def enqueue_print_job():
    """Encola un trabajo de impresión para ser procesado por el agente del local."""
    data = request.get_json() or {}
    ingreso_id = data.get('ingreso_id')

    try:
        ingreso_id = int(ingreso_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'ingreso_id inválido'}), 400

    ingreso = Ingreso.get_by_id(ingreso_id)
    if not ingreso:
        return jsonify({'error': 'Ingreso no encontrado'}), 404

    payload = data.get('payload') if isinstance(data.get('payload'), dict) else {}
    target_printer = str(data.get('target_printer') or payload.get('target_printer') or Configuracion.get('print_target_printer') or '').strip()
    payload = dict(payload)
    if target_printer:
        payload['target_printer'] = target_printer
    requested_by = int(get_jwt_identity())

    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute(
            '''
            INSERT INTO print_jobs (ingreso_id, requested_by, payload_json, target_printer, status)
            VALUES (?, ?, ?, ?, 'pending')
            ''',
            (ingreso_id, requested_by, json.dumps(payload, ensure_ascii=False), target_printer)
        )
        job_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()

    return jsonify({
        'success': True,
        'job_id': job_id,
        'ingreso_id': ingreso_id,
        'target_printer': target_printer,
        'status': 'pending'
    }), 201


@app.route('/api/print-workers/heartbeat', methods=['POST'])
@role_required('admin')
def print_worker_heartbeat():
    data = request.get_json() or {}
    worker_name = str(data.get('worker_name') or '').strip()
    worker_type = str(data.get('worker_type') or 'agent').strip().lower()
    printer_name = str(data.get('printer_name') or worker_name).strip()

    if not worker_name:
        return jsonify({'error': 'worker_name requerido'}), 400

    _upsert_print_worker(worker_name, worker_type, printer_name)
    return jsonify({'success': True}), 200


@app.route('/api/print-workers', methods=['GET'])
@role_required('admin')
def list_print_workers():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            '''
            SELECT worker_name, worker_type, printer_name, last_seen,
                   CASE WHEN datetime(last_seen) >= datetime('now', '-120 seconds') THEN 1 ELSE 0 END AS online
            FROM print_workers
            ORDER BY online DESC, datetime(last_seen) DESC, worker_name ASC
            '''
        ).fetchall()

        workers = []
        for row in rows:
            worker_name = row['worker_name']
            printer_name = row['printer_name']
            worker_type = row['worker_type']

            normalized_name = str(worker_name or '').upper()
            normalized_printer = str(printer_name or '').upper()
            if normalized_name.startswith('BROWSER_') or normalized_printer.startswith('BROWSER_'):
                worker_type = 'browser'

            workers.append({
                'worker_name': worker_name,
                'worker_type': worker_type,
                'printer_name': printer_name,
                'last_seen': row['last_seen'],
                'online': bool(row['online'])
            })

        if not workers:
            legacy_rows = conn.execute(
                '''
                SELECT DISTINCT printer_name
                FROM print_jobs
                WHERE COALESCE(TRIM(printer_name), '') <> ''
                ORDER BY printer_name ASC
                LIMIT 20
                '''
            ).fetchall()
            workers = [
                {
                    'worker_name': row['printer_name'],
                    'worker_type': 'agent',
                    'printer_name': row['printer_name'],
                    'last_seen': None,
                    'online': False
                }
                for row in legacy_rows
            ]
        return jsonify({'success': True, 'workers': workers}), 200
    finally:
        conn.close()


@app.route('/api/print-jobs/claim', methods=['POST'])
@role_required('admin')
def claim_print_job():
    """Reserva atómicamente el siguiente trabajo pendiente para un agente de impresión."""
    data = request.get_json() or {}
    printer_name = str(data.get('printer_name') or '').strip()
    worker_type = str(data.get('worker_type') or 'agent').strip().lower()
    if worker_type not in ('agent', 'browser', 'backend'):
        worker_type = 'agent'

    try:
        _upsert_print_worker(printer_name or 'UNNAMED_WORKER', worker_type, printer_name)
    except Exception:
        pass

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute('BEGIN IMMEDIATE')

        job = cursor.execute(
            '''
            SELECT id, ingreso_id, payload_json, attempts, created_at, target_printer
            FROM print_jobs
            WHERE status = 'pending'
              AND (COALESCE(TRIM(target_printer), '') = '' OR target_printer = ?)
            ORDER BY CASE WHEN target_printer = ? THEN 0 ELSE 1 END, id ASC
            LIMIT 1
            ''',
            (printer_name, printer_name)
        ).fetchone()

        if not job:
            conn.rollback()
            return jsonify({'success': True, 'job': None}), 200

        cursor.execute(
            '''
            UPDATE print_jobs
            SET status = 'processing',
                attempts = attempts + 1,
                claimed_at = CURRENT_TIMESTAMP,
                printer_name = COALESCE(NULLIF(?, ''), printer_name)
            WHERE id = ?
            ''',
            (printer_name, job['id'])
        )
        conn.commit()

        payload = {}
        if job['payload_json']:
            try:
                payload = json.loads(job['payload_json'])
            except Exception:
                payload = {}

        return jsonify({
            'success': True,
            'job': {
                'id': job['id'],
                'ingreso_id': job['ingreso_id'],
                'attempts': int(job['attempts'] or 0) + 1,
                'created_at': job['created_at'],
                'target_printer': job['target_printer'],
                'payload': payload
            }
        }), 200
    finally:
        conn.close()


@app.route('/api/print-jobs/<int:job_id>/complete', methods=['POST'])
@role_required('admin')
def complete_print_job(job_id):
    """Marca un trabajo de impresión como completado."""
    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        cursor.execute(
            '''
            UPDATE print_jobs
            SET status = 'done',
                completed_at = CURRENT_TIMESTAMP,
                last_error = NULL
            WHERE id = ? AND status = 'processing'
            ''',
            (job_id,)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'Trabajo no encontrado o no está en processing'}), 404
        return jsonify({'success': True}), 200
    finally:
        conn.close()


@app.route('/api/print-jobs/<int:job_id>/fail', methods=['POST'])
@role_required('admin')
def fail_print_job(job_id):
    """Reporta fallo del trabajo; reintenta automáticamente hasta 5 veces."""
    data = request.get_json() or {}
    error_message = str(data.get('error') or 'Error de impresión').strip()[:500]

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        row = cursor.execute("SELECT attempts FROM print_jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return jsonify({'error': 'Trabajo no encontrado'}), 404

        attempts = int(row['attempts'] or 0)
        next_status = 'error' if attempts >= 5 else 'pending'

        cursor.execute(
            '''
            UPDATE print_jobs
            SET status = ?,
                last_error = ?,
                completed_at = CASE WHEN ? = 'error' THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id = ?
            ''',
            (next_status, error_message, next_status, job_id)
        )
        conn.commit()

        return jsonify({'success': True, 'status': next_status, 'attempts': attempts}), 200
    finally:
        conn.close()

# ===== RUTAS DE BÚSQUEDA DE CLIENTES =====
@app.route('/api/clientes/buscar', methods=['GET'])
def buscar_clientes():
    """Busca clientes por nombre, cédula o teléfono"""
    try:
        query_param = request.args.get('q', '').upper().strip()
        
        if not query_param or len(query_param) < 2:
            return jsonify({'data': []}), 200
        results = Cliente.search(query_param, limit=10)
        
        clientes = []
        for row in results:
            clientes.append({
                'nombre': row['nombre'],
                'apellido': row['apellido'],
                'cedula': row['cedula'],
                'telefono': row['telefono'],
                'direccion': row['direccion']
            })
        
        return jsonify({'data': clientes}), 200
    except Exception as e:
        import traceback
        error_msg = str(e)
        trace = traceback.format_exc()
        return jsonify({'error': error_msg, 'trace': trace}), 500


@app.route('/api/clientes/<cedula>/actualizar', methods=['PUT'])
@role_required('admin')
def actualizar_cliente_por_cedula(cedula):
    """Actualiza datos del cliente en todos sus ingresos por cédula normalizada"""
    data = request.get_json() or {}

    nombre = str(data.get('cliente_nombre') or '').strip()
    apellido = str(data.get('cliente_apellido') or '').strip()
    cedula_nueva = str(data.get('cliente_cedula') or '').strip()
    telefono = str(data.get('cliente_telefono') or '').strip()
    direccion = str(data.get('cliente_direccion') or '').strip()

    missing_fields = []
    if not nombre:
        missing_fields.append('cliente_nombre')
    if not apellido:
        missing_fields.append('cliente_apellido')
    if not cedula_nueva:
        missing_fields.append('cliente_cedula')
    if not telefono:
        missing_fields.append('cliente_telefono')

    if missing_fields:
        return jsonify({'error': 'Campos requeridos incompletos', 'missing_fields': missing_fields}), 400

    cedula_original_norm = ''.join(ch for ch in str(cedula or '').upper().strip() if ch.isalnum())
    if not cedula_original_norm:
        return jsonify({'error': 'Cédula original inválida'}), 400

    from models.database import db as database
    ingresos = database.execute_query(
        '''
        SELECT id
        FROM ingresos
        WHERE REPLACE(REPLACE(REPLACE(UPPER(TRIM(cliente_cedula)), '.', ''), '-', ''), ' ', '') = ?
        ''',
        (cedula_original_norm,)
    )

    Cliente.update_by_cedula(cedula, nombre, apellido, cedula_nueva, telefono, direccion)

    if not ingresos:
        return jsonify({'success': True, 'updated': 0, 'message': 'Cliente actualizado en catálogo'}), 200

    for row in ingresos:
        Ingreso.update(row['id'], {
            'cliente_nombre': nombre,
            'cliente_apellido': apellido,
            'cliente_cedula': cedula_nueva,
            'cliente_telefono': telefono,
            'cliente_direccion': direccion
        })

    return jsonify({'success': True, 'updated': len(ingresos)}), 200

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5001)

