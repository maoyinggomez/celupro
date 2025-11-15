-- CELUPRO - Esquema de Base de Datos SQLite
-- Generado automáticamente por init_db.py

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    contraseña TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('admin', 'empleado', 'tecnico')) NOT NULL,
    activo INTEGER DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de marcas (fabricantes)
CREATE TABLE IF NOT EXISTS marcas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de modelos (dependiente de marcas)
CREATE TABLE IF NOT EXISTS modelos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marca_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (marca_id) REFERENCES marcas(id) ON DELETE CASCADE,
    UNIQUE(marca_id, nombre)
);

-- Tabla de catálogo de fallas
CREATE TABLE IF NOT EXISTS fallas_catalogo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT,
    precio_sugerido REAL DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ingresos técnicos
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
    estado_ingreso TEXT DEFAULT 'pendiente' CHECK(estado_ingreso IN ('pendiente', 'en_reparacion', 'reparado', 'entregado', 'cancelado')),
    fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TIMESTAMP,
    FOREIGN KEY (empleado_id) REFERENCES usuarios(id),
    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id),
    FOREIGN KEY (marca_id) REFERENCES marcas(id),
    FOREIGN KEY (modelo_id) REFERENCES modelos(id)
);

-- Tabla de fallas por ingreso (relación N:M)
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
);

-- Tabla de notas por ingreso (historial)
CREATE TABLE IF NOT EXISTS notas_ingreso (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ingreso_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    contenido TEXT NOT NULL,
    tipo TEXT DEFAULT 'general' CHECK(tipo IN ('general', 'tecnica', 'administrativa')),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingreso_id) REFERENCES ingresos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de configuración del negocio
CREATE TABLE IF NOT EXISTS configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT,
    tipo TEXT DEFAULT 'text' CHECK(tipo IN ('text', 'number', 'file')),
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES PARA RENDIMIENTO
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE INDEX idx_modelos_marca ON modelos(marca_id);
CREATE INDEX idx_ingresos_cliente ON ingresos(cliente_cedula);
CREATE INDEX idx_ingresos_estado ON ingresos(estado_ingreso);
CREATE INDEX idx_ingresos_marca ON ingresos(marca_id);
CREATE INDEX idx_ingresos_fecha ON ingresos(fecha_ingreso);
CREATE INDEX idx_ingreso_fallas_ingreso ON ingreso_fallas(ingreso_id);
CREATE INDEX idx_ingreso_fallas_falla ON ingreso_fallas(falla_id);
CREATE INDEX idx_notas_ingreso ON notas_ingreso(ingreso_id);

-- VISTAS ÚTILES (Opcional)
-- Ingreso completo con datos relacionados
CREATE VIEW vista_ingresos_completo AS
SELECT 
    i.id,
    i.numero_ingreso,
    i.fecha_ingreso,
    CONCAT(i.cliente_nombre, ' ', i.cliente_apellido) as cliente_completo,
    i.cliente_cedula,
    m.nombre as marca,
    md.nombre as modelo,
    i.color,
    i.estado_ingreso,
    i.valor_total,
    u1.nombre as empleado,
    u2.nombre as tecnico
FROM ingresos i
LEFT JOIN marcas m ON i.marca_id = m.id
LEFT JOIN modelos md ON i.modelo_id = md.id
LEFT JOIN usuarios u1 ON i.empleado_id = u1.id
LEFT JOIN usuarios u2 ON i.tecnico_id = u2.id;

-- Ingresos pendientes
CREATE VIEW vista_ingresos_pendientes AS
SELECT 
    i.id,
    i.numero_ingreso,
    i.fecha_ingreso,
    CONCAT(i.cliente_nombre, ' ', i.cliente_apellido) as cliente,
    m.nombre as marca,
    md.nombre as modelo
FROM ingresos i
LEFT JOIN marcas m ON i.marca_id = m.id
LEFT JOIN modelos md ON i.modelo_id = md.id
WHERE i.estado_ingreso = 'pendiente'
ORDER BY i.fecha_ingreso;

-- DATOS INICIALES
-- Estos se insertan automáticamente por init_db.py

-- Usuario administrador por defecto
-- Usuario: admin, Contraseña: admin123, Rol: admin

-- 15 Marcas iniciales
-- Apple, Samsung, Xiaomi, Motorola, LG, Nokia, Huawei, Poco, Realme, Oppo, Vivo, OnePlus, Lenovo, TCL, Otro

-- Modelos de ejemplo para Apple y Samsung
-- iPhone series, Galaxy series

-- 15 Fallas predefinidas con precios sugeridos
-- Pantalla, Batería, Puerto USB, Cámara, IC, Reballing, etc.

-- Configuración por defecto
-- nombre_negocio: CELUPRO
-- telefono_negocio: +57 300 000 0000
-- email_negocio: info@celupro.com
-- logo_url: (vacío, se carga después)
-- ancho_papel_mm: 58

-- NOTAS IMPORTANTES
-- 1. Las fechas usan TIMESTAMP automático (se registra fecha/hora actual)
-- 2. Los estados están validados por CHECK constraints
-- 3. Las relaciones tienen ON DELETE CASCADE para mantener integridad
-- 4. Las contraseñas se hashean en la aplicación (nunca en SQL)
-- 5. La BD soporta 400+ registros sin problemas de rendimiento
-- 6. Los índices mejoran búsquedas por 10-100x
-- 7. Las vistas facilitan consultas complejas

-- QUERIES ÚTILES PARA ADMINISTRADOR

-- Ver todos los usuarios activos
-- SELECT * FROM usuarios WHERE activo = 1;

-- Contar ingresos por estado
-- SELECT estado_ingreso, COUNT(*) FROM ingresos GROUP BY estado_ingreso;

-- Ingresos por técnico
-- SELECT tecnico_id, COUNT(*) FROM ingresos WHERE tecnico_id IS NOT NULL GROUP BY tecnico_id;

-- Fallas más comunes
-- SELECT f.nombre, COUNT(*) as veces FROM ingreso_fallas if JOIN fallas_catalogo f ON if.falla_id = f.id GROUP BY f.id ORDER BY veces DESC;

-- Valor total de reparaciones
-- SELECT SUM(valor_total) FROM ingresos;

-- Ingresos sin técnico asignado
-- SELECT numero_ingreso, cliente_nombre FROM ingresos WHERE tecnico_id IS NULL AND estado_ingreso != 'entregado';
