import sqlite3
import os
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
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Tabla de modelos
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS modelos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marca_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
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
        cliente_nombre TEXT NOT NULL,
        cliente_apellido TEXT NOT NULL,
        cliente_cedula TEXT NOT NULL,
        cliente_telefono TEXT,
        cliente_direccion TEXT,
        marca_id INTEGER NOT NULL,
        modelo_id INTEGER NOT NULL,
        color TEXT,
        falla_general TEXT,
        notas_adicionales TEXT,
        estado_display BOOLEAN,
        estado_tactil BOOLEAN,
        estado_botones BOOLEAN,
        estado_apagado BOOLEAN,
        tiene_clave BOOLEAN,
        clave TEXT,
        valor_total REAL DEFAULT 0,
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
    
    # Insertar datos por defecto
    insert_default_data(cursor, conn)
    
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
        ('email_negocio', 'info@celupro.com', 'text'),
        ('logo_url', '', 'file'),
        ('ancho_papel_mm', '58', 'number')
    ]
    
    for clave, valor, tipo in configuraciones:
        cursor.execute('''
        INSERT INTO configuracion (clave, valor, tipo)
        VALUES (?, ?, ?)
        ''', (clave, valor, tipo))
    
    conn.commit()

if __name__ == '__main__':
    init_db()
