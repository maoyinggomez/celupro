import sqlite3
import os
import re
from datetime import datetime
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'celupro.db')

def init_db():
    """Inicializa la base de datos con el esquema completo"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabla de usuarios
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        contraseña TEXT NOT NULL,
        nombre TEXT NOT NULL,
        telefono TEXT,
        cedula TEXT,
        rol TEXT CHECK(rol IN ('admin', 'empleado', 'tecnico')) NOT NULL,
        activo INTEGER DEFAULT 1,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Tabla de marcas
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS marcas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL,
        orden INTEGER DEFAULT 0,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Tabla de modelos
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS modelos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marca_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        orden INTEGER DEFAULT 0,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (marca_id) REFERENCES marcas(id) ON DELETE CASCADE,
        UNIQUE(marca_id, nombre)
    )
    ''')
    
    # Tabla de catálogo de fallas
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS fallas_catalogo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL,
        descripcion TEXT,
        precio_sugerido REAL DEFAULT 0,
        orden INTEGER DEFAULT 0,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Tabla de ingresos técnicos
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ingresos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_ingreso TEXT UNIQUE NOT NULL,
        empleado_id INTEGER NOT NULL,
        tecnico_id INTEGER,
        tecnico_nombre TEXT,
        tecnico_telefono TEXT,
        tecnico_cedula TEXT,
        cliente_nombre TEXT NOT NULL,
        cliente_apellido TEXT NOT NULL,
        cliente_cedula TEXT NOT NULL,
        cliente_telefono TEXT,
        cliente_direccion TEXT,
        marca_id INTEGER NOT NULL,
        modelo_id INTEGER NOT NULL,
        equipo_no_lista BOOLEAN DEFAULT 0,
        color TEXT,
        imei TEXT,
        falla_general TEXT,
        notas_adicionales TEXT,
        estado_display BOOLEAN,
        estado_tactil BOOLEAN,
        estado_botones BOOLEAN,
        estado_apagado BOOLEAN,
        tiene_clave BOOLEAN,
        tipo_clave TEXT,
        clave TEXT,
        garantia BOOLEAN DEFAULT 0,
        estuche BOOLEAN DEFAULT 0,
        bandeja_sim BOOLEAN DEFAULT 0,
        color_bandeja_sim TEXT,
        visor_partido BOOLEAN DEFAULT 0,
        estado_botones_detalle TEXT,
        valor_total REAL DEFAULT 0,
        estado_pago TEXT DEFAULT 'pendiente',
        estado_ingreso TEXT DEFAULT 'pendiente' CHECK(estado_ingreso IN ('pendiente', 'en_reparacion', 'reparado', 'no_reparable', 'entregado', 'cancelado')),
        fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_entrega TIMESTAMP,
        FOREIGN KEY (empleado_id) REFERENCES usuarios(id),
        FOREIGN KEY (tecnico_id) REFERENCES usuarios(id),
        FOREIGN KEY (marca_id) REFERENCES marcas(id),
        FOREIGN KEY (modelo_id) REFERENCES modelos(id)
    )
    ''')
    
    # Tabla de fallas por ingreso (relación N:M)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ingreso_fallas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingreso_id INTEGER NOT NULL,
        falla_id INTEGER NOT NULL,
        valor_reparacion REAL DEFAULT 0,
        estado_falla TEXT DEFAULT 'pendiente' CHECK(estado_falla IN ('pendiente', 'reparada', 'no_reparable')),
        notas_falla TEXT,
        agregada_por INTEGER,
        fecha_adicion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingreso_id) REFERENCES ingresos(id) ON DELETE CASCADE,
        FOREIGN KEY (falla_id) REFERENCES fallas_catalogo(id),
        FOREIGN KEY (agregada_por) REFERENCES usuarios(id),
        UNIQUE(ingreso_id, falla_id)
    )
    ''')
    
    # Tabla de notas por ingreso (historial)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS notas_ingreso (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingreso_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        contenido TEXT NOT NULL,
        tipo TEXT DEFAULT 'general' CHECK(tipo IN ('general', 'tecnica', 'administrativa')),
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingreso_id) REFERENCES ingresos(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
    ''')
    
    # Tabla de configuración del negocio
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT UNIQUE NOT NULL,
        valor TEXT,
        tipo TEXT DEFAULT 'text' CHECK(tipo IN ('text', 'number', 'file')),
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    conn.commit()

    # Migraciones para bases existentes
    ensure_schema_updates(cursor, conn)
    
    # Insertar datos por defecto
    insert_default_data(cursor, conn)

    # Asegurar configuraciones mínimas aunque la BD ya tuviera usuarios
    ensure_default_config(cursor, conn)

    # Asegurar catálogo de marcas/modelos de celulares (retroalimentación)
    ensure_phone_catalog(cursor, conn)
    
    conn.close()
    print(f"✓ Base de datos inicializada en: {DB_PATH}")

def insert_default_data(cursor, conn):
    """Inserta datos por defecto en la base de datos"""
    
    # Verificar si ya existen datos
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    if cursor.fetchone()[0] > 0:
        return
    
    # Usuario administrador por defecto
    hashed_password = generate_password_hash('admin123')
    cursor.execute('''
    INSERT INTO usuarios (usuario, contraseña, nombre, rol)
    VALUES (?, ?, ?, ?)
    ''', ('admin', hashed_password, 'Administrador', 'admin'))
    
    # Usuario empleado por defecto
    hashed_password_empleado = generate_password_hash('empleado123')
    cursor.execute('''
    INSERT INTO usuarios (usuario, contraseña, nombre, rol)
    VALUES (?, ?, ?, ?)
    ''', ('empleado', hashed_password_empleado, 'Empleado', 'empleado'))
    
    # Usuario técnico por defecto
    hashed_password_tecnico = generate_password_hash('tecnico123')
    cursor.execute('''
    INSERT INTO usuarios (usuario, contraseña, nombre, rol)
    VALUES (?, ?, ?, ?)
    ''', ('tecnico', hashed_password_tecnico, 'Técnico', 'tecnico'))
    
    # Marcas por defecto
    marcas_por_defecto = [
        'Apple',
        'Samsung',
        'Xiaomi',
        'Motorola',
        'LG',
        'Nokia',
        'Huawei',
        'Poco',
        'Realme',
        'Oppo',
        'Vivo',
        'OnePlus',
        'Lenovo',
        'TCL',
        'Otro'
    ]
    
    for marca in marcas_por_defecto:
        cursor.execute('INSERT INTO marcas (nombre) VALUES (?)', (marca,))
    
    conn.commit()
    
    # Modelos por defecto para algunas marcas
    cursor.execute("SELECT id FROM marcas WHERE nombre = 'Apple'")
    apple_id = cursor.fetchone()[0]
    
    modelos_apple = [
        'iPhone 15 Pro Max',
        'iPhone 15 Pro',
        'iPhone 15',
        'iPhone 14 Pro Max',
        'iPhone 14 Pro',
        'iPhone 14',
        'iPhone 13',
        'iPhone 12',
        'iPhone SE'
    ]
    
    for modelo in modelos_apple:
        cursor.execute('INSERT INTO modelos (marca_id, nombre) VALUES (?, ?)',
                      (apple_id, modelo))
    
    cursor.execute("SELECT id FROM marcas WHERE nombre = 'Samsung'")
    samsung_id = cursor.fetchone()[0]
    
    modelos_samsung = [
        'Galaxy S24 Ultra',
        'Galaxy S24',
        'Galaxy A55',
        'Galaxy A35',
        'Galaxy Z Fold 6',
        'Galaxy Z Flip 6',
        'Galaxy S23',
        'Galaxy A14'
    ]
    
    for modelo in modelos_samsung:
        cursor.execute('INSERT INTO modelos (marca_id, nombre) VALUES (?, ?)',
                      (samsung_id, modelo))
    
    # Fallas por defecto del catálogo
    fallas_por_defecto = [
        ('Revisión general', 'Diagnóstico general del equipo', 10000),
        ('Pantalla general', 'Problemas generales con la pantalla', 45000),
        ('Pantalla táctil no funciona', 'Pantalla táctil no responde', 50000),
        ('Pantalla original dañada', 'Pantalla original con daño físico', 55000),
        ('Puerto USB tipo C', 'Puerto de carga o datos dañado', 35000),
        ('Puerto USB tipo Micro', 'Puerto de carga o datos dañado', 30000),
        ('Batería general', 'Cambio de batería', 40000),
        ('Batería original', 'Cambio de batería original', 60000),
        ('Tapa general', 'Tapa trasera genérica', 25000),
        ('Tapa original', 'Tapa trasera original', 45000),
        ('Backover (vidrio trasero)', 'Reemplazo de vidrio trasero', 50000),
        ('Cámara dañada', 'Reparación o reemplazo de cámara', 40000),
        ('Antena dañada', 'Reparación o reemplazo de antena', 20000),
        ('IC de carga', 'Reparación componente de carga', 80000),
        ('IC de señal', 'Reparación componente de señal', 90000),
        ('Reballing', 'Reballing de componentes BGA', 120000)
    ]
    
    for nombre, descripcion, precio in fallas_por_defecto:
        cursor.execute('''
        INSERT INTO fallas_catalogo (nombre, descripcion, precio_sugerido)
        VALUES (?, ?, ?)
        ''', (nombre, descripcion, precio))
    
    # Configuración por defecto
    configuraciones = [
        ('nombre_negocio', 'CELUPRO', 'text'),
        ('telefono_negocio', '+57 300 000 0000', 'text'),
        ('direccion_negocio', '', 'text'),
        ('email_negocio', 'info@celupro.com', 'text'),
        ('tecnico_default_id', '', 'number'),
        ('logo_url', '', 'file'),
        ('ancho_papel_mm', '58', 'number')
    ]
    
    for clave, valor, tipo in configuraciones:
        cursor.execute('''
        INSERT INTO configuracion (clave, valor, tipo)
        VALUES (?, ?, ?)
        ''', (clave, valor, tipo))
    
    conn.commit()

def ensure_schema_updates(cursor, conn):
    """Aplica migraciones necesarias en bases existentes"""
    cursor.execute("PRAGMA table_info(ingresos)")
    columnas_ingresos = {row[1] for row in cursor.fetchall()}

    cursor.execute("PRAGMA table_info(usuarios)")
    columnas_usuarios = {row[1] for row in cursor.fetchall()}

    cursor.execute("PRAGMA table_info(marcas)")
    columnas_marcas = {row[1] for row in cursor.fetchall()}

    cursor.execute("PRAGMA table_info(modelos)")
    columnas_modelos = {row[1] for row in cursor.fetchall()}

    cursor.execute("PRAGMA table_info(fallas_catalogo)")
    columnas_fallas = {row[1] for row in cursor.fetchall()}

    if 'telefono' not in columnas_usuarios:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN telefono TEXT")

    if 'cedula' not in columnas_usuarios:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN cedula TEXT")

    if 'estado_pago' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN estado_pago TEXT DEFAULT 'pendiente'")

    if 'equipo_no_lista' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN equipo_no_lista BOOLEAN DEFAULT 0")

    if 'imei' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN imei TEXT")

    if 'tipo_clave' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN tipo_clave TEXT")

    if 'garantia' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN garantia BOOLEAN DEFAULT 0")

    if 'estuche' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN estuche BOOLEAN DEFAULT 0")

    if 'bandeja_sim' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN bandeja_sim BOOLEAN DEFAULT 0")

    if 'color_bandeja_sim' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN color_bandeja_sim TEXT")

    if 'visor_partido' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN visor_partido BOOLEAN DEFAULT 0")

    if 'estado_botones_detalle' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN estado_botones_detalle TEXT")

    if 'tecnico_nombre' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN tecnico_nombre TEXT")

    if 'tecnico_telefono' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN tecnico_telefono TEXT")

    if 'tecnico_cedula' not in columnas_ingresos:
        cursor.execute("ALTER TABLE ingresos ADD COLUMN tecnico_cedula TEXT")

    if 'orden' not in columnas_marcas:
        cursor.execute("ALTER TABLE marcas ADD COLUMN orden INTEGER DEFAULT 0")

    if 'orden' not in columnas_modelos:
        cursor.execute("ALTER TABLE modelos ADD COLUMN orden INTEGER DEFAULT 0")

    if 'orden' not in columnas_fallas:
        cursor.execute("ALTER TABLE fallas_catalogo ADD COLUMN orden INTEGER DEFAULT 0")

    # Asegurar falla base de diagnóstico para bases existentes
    falla_revision = cursor.execute(
        "SELECT id FROM fallas_catalogo WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?))",
        ('Revisión general',)
    ).fetchone()
    if not falla_revision:
        cursor.execute("SELECT COALESCE(MAX(orden), 0) + 1 FROM fallas_catalogo")
        siguiente_orden_falla = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO fallas_catalogo (nombre, descripcion, precio_sugerido, orden) VALUES (?, ?, ?, ?)",
            ('Revisión general', 'Diagnóstico general del equipo', 10000, siguiente_orden_falla)
        )

    cursor.execute("UPDATE marcas SET orden = id WHERE orden IS NULL OR orden = 0")
    cursor.execute("UPDATE modelos SET orden = id WHERE orden IS NULL OR orden = 0")
    cursor.execute("UPDATE fallas_catalogo SET orden = id WHERE orden IS NULL OR orden = 0")

    conn.commit()

def ensure_default_config(cursor, conn):
    """Asegura claves de configuración mínimas"""
    configuraciones = [
        ('nombre_negocio', 'CELUPRO', 'text'),
        ('telefono_negocio', '+57 300 000 0000', 'text'),
        ('direccion_negocio', '', 'text'),
        ('email_negocio', 'info@celupro.com', 'text'),
        ('tecnico_default_id', '', 'number'),
        ('logo_url', '', 'file'),
        ('ancho_papel_mm', '58', 'number')
    ]

    for clave, valor, tipo in configuraciones:
        cursor.execute("SELECT id FROM configuracion WHERE clave = ?", (clave,))
        existe = cursor.fetchone()
        if not existe:
            cursor.execute(
                "INSERT INTO configuracion (clave, valor, tipo) VALUES (?, ?, ?)",
                (clave, valor, tipo)
            )

    conn.commit()

def ensure_phone_catalog(cursor, conn):
    """Asegura marcas y modelos de celulares solicitados sin duplicar datos"""
    # Si existe Apple y no existe iPhone, migrar nombre para unificar catálogo
    cursor.execute("SELECT id FROM marcas WHERE LOWER(nombre) = 'apple'")
    apple = cursor.fetchone()
    cursor.execute("SELECT id FROM marcas WHERE LOWER(nombre) = 'iphone'")
    iphone = cursor.fetchone()

    if apple and not iphone:
        cursor.execute("UPDATE marcas SET nombre = ? WHERE id = ?", ('iPhone', apple[0]))

    catalogo = {
        'Samsung': [
            'Galaxy S10', 'Galaxy S10e', 'Galaxy S10+',
            'Galaxy S20', 'Galaxy S20+', 'Galaxy S20 Ultra',
            'Galaxy S21', 'Galaxy S21+', 'Galaxy S21 Ultra',
            'Galaxy S22', 'Galaxy S22+', 'Galaxy S22 Ultra',
            'Galaxy S23', 'Galaxy S23+', 'Galaxy S23 Ultra',
            'Galaxy S24', 'Galaxy S24+', 'Galaxy S24 Ultra',
            'Galaxy S25', 'Galaxy S25+', 'Galaxy S25 Ultra',
            'Galaxy A10', 'Galaxy A10s', 'Galaxy A20', 'Galaxy A20s', 'Galaxy A30', 'Galaxy A30s', 'Galaxy A50', 'Galaxy A50s', 'Galaxy A70',
            'Galaxy A11', 'Galaxy A21', 'Galaxy A31', 'Galaxy A51', 'Galaxy A71',
            'Galaxy A12', 'Galaxy A22', 'Galaxy A32', 'Galaxy A52', 'Galaxy A72',
            'Galaxy A13', 'Galaxy A23', 'Galaxy A33', 'Galaxy A53', 'Galaxy A73',
            'Galaxy A14', 'Galaxy A24', 'Galaxy A34', 'Galaxy A54',
            'Galaxy A15', 'Galaxy A25', 'Galaxy A35', 'Galaxy A55'
        ],
        'iPhone': [
            'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus',
            'iPhone 7', 'iPhone 7 Plus',
            'iPhone 8', 'iPhone 8 Plus',
            'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
            'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
            'iPhone SE (2020)',
            'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
            'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
            'iPhone SE (2022)',
            'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
            'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
            'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
            'iPhone 17', 'iPhone 17 Plus', 'iPhone 17 Pro', 'iPhone 17 Pro Max'
        ],
        'Xiaomi': [
            'Mi 9', 'Mi 9T', 'Mi 9T Pro',
            'Mi 10', 'Mi 10 Pro', 'Mi 10T', 'Mi 10T Pro',
            'Mi 11', 'Mi 11 Lite', 'Mi 11T', 'Mi 11T Pro',
            'Xiaomi 12', 'Xiaomi 12 Lite', 'Xiaomi 12T', 'Xiaomi 12T Pro',
            'Xiaomi 13', 'Xiaomi 13 Lite', 'Xiaomi 13T', 'Xiaomi 13T Pro',
            'Xiaomi 14', 'Xiaomi 14T', 'Xiaomi 14T Pro',
            'Redmi Note 8', 'Redmi Note 8 Pro',
            'Redmi Note 9', 'Redmi Note 9S', 'Redmi Note 9 Pro',
            'Redmi Note 10', 'Redmi Note 10S', 'Redmi Note 10 Pro',
            'Redmi Note 11', 'Redmi Note 11S', 'Redmi Note 11 Pro',
            'Redmi Note 12', 'Redmi Note 12S', 'Redmi Note 12 Pro',
            'Redmi Note 13', 'Redmi Note 13 Pro',
            'Redmi Note 14', 'Redmi Note 14 Pro'
        ],
        'Huawei': [
            'P30', 'P30 Pro',
            'P40', 'P40 Pro',
            'P50', 'P50 Pro',
            'P60', 'P60 Pro',
            'Mate 30', 'Mate 30 Pro',
            'Mate 40', 'Mate 40 Pro',
            'Mate 50', 'Mate 50 Pro',
            'Nova 5T',
            'Nova 7i', 'Nova 8i', 'Nova 9', 'Nova 10', 'Nova 11', 'Nova 12'
        ],
        'Honor': [
            'Honor 20', 'Honor 20 Pro',
            'Honor 30', 'Honor 30 Pro',
            'Honor 50', 'Honor 50 Lite',
            'Honor 70',
            'Honor 90',
            'Honor 200', 'Honor 200 Pro',
            'Honor X6', 'Honor X7', 'Honor X8', 'Honor X9', 'Honor X9b'
        ],
        'Vivo': [
            'Vivo Y11', 'Vivo Y12', 'Vivo Y15', 'Vivo Y17',
            'Vivo Y20', 'Vivo Y21', 'Vivo Y22', 'Vivo Y27', 'Vivo Y36',
            'Vivo V20', 'Vivo V21', 'Vivo V23', 'Vivo V25', 'Vivo V27', 'Vivo V29', 'Vivo V30',
            'Vivo X60', 'Vivo X70', 'Vivo X80', 'Vivo X90', 'Vivo X100'
        ]
    }

    for marca, modelos in catalogo.items():
        cursor.execute("SELECT id FROM marcas WHERE LOWER(nombre) = LOWER(?)", (marca,))
        marca_row = cursor.fetchone()

        if marca_row:
            marca_id = marca_row[0]
        else:
            cursor.execute("SELECT COALESCE(MAX(orden), 0) + 1 FROM marcas")
            siguiente_orden_marca = cursor.fetchone()[0]
            cursor.execute("INSERT INTO marcas (nombre, orden) VALUES (?, ?)", (marca, siguiente_orden_marca))
            marca_id = cursor.lastrowid

        for modelo in modelos:
            cursor.execute(
                "SELECT id FROM modelos WHERE marca_id = ? AND LOWER(nombre) = LOWER(?)",
                (marca_id, modelo)
            )
            if not cursor.fetchone():
                cursor.execute("SELECT COALESCE(MAX(orden), 0) + 1 FROM modelos WHERE marca_id = ?", (marca_id,))
                siguiente_orden_modelo = cursor.fetchone()[0]
                cursor.execute(
                    "INSERT INTO modelos (marca_id, nombre, orden) VALUES (?, ?, ?)",
                    (marca_id, modelo, siguiente_orden_modelo)
                )

    # Normalizar nombres (MAYÚSCULA) y eliminar duplicados por case
    normalize_and_dedupe_models(cursor)

    # Normalizar orden de modelos por año de lanzamiento
    normalize_models_order_by_launch_year(cursor)

    # Evitar duplicados futuros por mayúsculas/minúsculas
    cursor.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_modelos_marca_nombre_upper
        ON modelos(marca_id, UPPER(TRIM(nombre)))
        """
    )

    conn.commit()

def normalize_and_dedupe_models(cursor):
    """Convierte nombres de modelos a MAYÚSCULA y elimina duplicados por case"""
    cursor.execute("SELECT DISTINCT marca_id FROM modelos")
    marcas = [row[0] for row in cursor.fetchall()]

    for marca_id in marcas:
        cursor.execute(
            "SELECT id, nombre, orden FROM modelos WHERE marca_id = ? ORDER BY orden ASC, id ASC",
            (marca_id,)
        )
        rows = cursor.fetchall()

        seen = {}
        for modelo_id, nombre, orden in rows:
            normalized = re.sub(r'\s+', ' ', (nombre or '').strip()).upper()
            if not normalized:
                normalized = 'SIN MODELO'

            existing = seen.get(normalized)
            if not existing:
                seen[normalized] = (modelo_id, orden)
                cursor.execute("UPDATE modelos SET nombre = ? WHERE id = ?", (normalized, modelo_id))
                continue

            keep_id, keep_order = existing

            # Si hay ingresos referenciando el duplicado, migrar al registro principal
            cursor.execute("UPDATE ingresos SET modelo_id = ? WHERE modelo_id = ?", (keep_id, modelo_id))

            # Mantener el orden más bajo para el registro que se conserva
            if orden is not None and keep_order is not None and orden < keep_order:
                cursor.execute("UPDATE modelos SET orden = ? WHERE id = ?", (orden, keep_id))
                seen[normalized] = (keep_id, orden)

            cursor.execute("DELETE FROM modelos WHERE id = ?", (modelo_id,))

def infer_launch_year(brand_name, model_name):
    """Intenta inferir el año de lanzamiento según marca/modelo"""
    brand = (brand_name or '').strip().lower()
    model = (model_name or '').strip()
    upper = model.upper()

    if brand == 'iphone':
        se_match = re.search(r'SE\s*\((\d{4})\)', upper)
        if se_match:
            return int(se_match.group(1))

        if upper.startswith('IPHONE X'):
            if 'XR' in upper or 'XS' in upper:
                return 2018
            return 2017

        num_match = re.search(r'IPHONE\s+(\d+)', upper)
        if num_match:
            num = int(num_match.group(1))
            iphone_year_map = {
                6: 2014, 7: 2016, 8: 2017, 11: 2019,
                12: 2020, 13: 2021, 14: 2022, 15: 2023, 16: 2024, 17: 2025
            }
            return iphone_year_map.get(num)

    if brand == 'samsung':
        s_match = re.search(r'\bS(\d{2})\b', upper)
        if s_match:
            s_num = int(s_match.group(1))
            if s_num == 10:
                return 2019
            if s_num >= 20:
                return 2000 + s_num

        a_match = re.search(r'\bA(\d{2})\b', upper)
        if a_match:
            a_num = int(a_match.group(1))
            year_map = {
                10: 2019, 20: 2019, 30: 2019, 50: 2019, 70: 2019,
                11: 2020, 21: 2020, 31: 2020, 51: 2020, 71: 2020,
                12: 2021, 22: 2021, 32: 2021, 52: 2021, 72: 2021,
                13: 2022, 23: 2022, 33: 2022, 53: 2022, 73: 2022,
                14: 2023, 24: 2023, 34: 2023, 54: 2023,
                15: 2024, 25: 2024, 35: 2024, 55: 2024
            }
            return year_map.get(a_num)

    if brand == 'xiaomi':
        mi_match = re.search(r'\bMI\s?(\d{1,2})\b', upper)
        if mi_match:
            mi_num = int(mi_match.group(1))
            if mi_num == 9:
                return 2019
            if mi_num >= 10:
                return 2010 + mi_num

        xiaomi_match = re.search(r'\bXIAOMI\s(\d{2})\b', upper)
        if xiaomi_match:
            x_num = int(xiaomi_match.group(1))
            return 2010 + x_num

        redmi_match = re.search(r'REDMI\s+NOTE\s+(\d{1,2})', upper)
        if redmi_match:
            r_num = int(redmi_match.group(1))
            return 2011 + r_num

    if brand == 'huawei':
        series_match = re.search(r'\b(P|MATE)\s?(\d{2})\b', upper)
        if series_match:
            line = series_match.group(1)
            num = int(series_match.group(2))
            if line == 'P':
                p_map = {30: 2019, 40: 2020, 50: 2021, 60: 2023}
                return p_map.get(num)
            if line == 'MATE':
                mate_map = {30: 2019, 40: 2020, 50: 2022}
                return mate_map.get(num)

        nova_map = {
            'NOVA 5T': 2019,
            'NOVA 7I': 2020,
            'NOVA 8I': 2021,
            'NOVA 9': 2021,
            'NOVA 10': 2022,
            'NOVA 11': 2023,
            'NOVA 12': 2024
        }
        for key, year in nova_map.items():
            if key in upper:
                return year

    if brand == 'honor':
        honor_map = {
            'HONOR 20': 2019, 'HONOR 20 PRO': 2019,
            'HONOR 30': 2020, 'HONOR 30 PRO': 2020,
            'HONOR 50': 2021, 'HONOR 50 LITE': 2021,
            'HONOR 70': 2022,
            'HONOR 90': 2023,
            'HONOR 200': 2024, 'HONOR 200 PRO': 2024,
            'HONOR X6': 2022, 'HONOR X7': 2022, 'HONOR X8': 2022, 'HONOR X9': 2022,
            'HONOR X9B': 2023
        }
        for key, year in honor_map.items():
            if key in upper:
                return year

    if brand == 'vivo':
        vivo_map = {
            'VIVO Y11': 2019, 'VIVO Y12': 2019, 'VIVO Y15': 2019, 'VIVO Y17': 2019,
            'VIVO Y20': 2020, 'VIVO Y21': 2021, 'VIVO Y22': 2022, 'VIVO Y27': 2023, 'VIVO Y36': 2023,
            'VIVO V20': 2020, 'VIVO V21': 2021, 'VIVO V23': 2022, 'VIVO V25': 2022, 'VIVO V27': 2023, 'VIVO V29': 2023, 'VIVO V30': 2024,
            'VIVO X60': 2021, 'VIVO X70': 2021, 'VIVO X80': 2022, 'VIVO X90': 2022, 'VIVO X100': 2023
        }
        for key, year in vivo_map.items():
            if key in upper:
                return year

    return None

def normalize_models_order_by_launch_year(cursor):
    """Reordena modelos por año de lanzamiento dentro de cada marca objetivo"""
    marcas_objetivo = ('samsung', 'iphone', 'xiaomi', 'huawei', 'honor', 'vivo')

    cursor.execute(
        "SELECT id, nombre FROM marcas WHERE LOWER(nombre) IN (?, ?, ?, ?, ?, ?)",
        marcas_objetivo
    )
    marcas = cursor.fetchall()

    for marca_id, marca_nombre in marcas:
        cursor.execute(
            "SELECT id, nombre FROM modelos WHERE marca_id = ?",
            (marca_id,)
        )
        modelos = cursor.fetchall()

        ordenados = sorted(
            modelos,
            key=lambda item: (
                infer_launch_year(marca_nombre, item[1]) if infer_launch_year(marca_nombre, item[1]) is not None else 9999,
                item[1].lower()
            )
        )

        for index, (modelo_id, _) in enumerate(ordenados, start=1):
            cursor.execute("UPDATE modelos SET orden = ? WHERE id = ?", (index, modelo_id))

if __name__ == '__main__':
    init_db()
