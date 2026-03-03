from .database import db


class Cliente:
    """Modelo de clientes persistentes"""

    @staticmethod
    def normalize_cedula(value):
        return ''.join(ch for ch in str(value or '').upper().strip() if ch.isalnum())

    @staticmethod
    def upsert(cliente_data):
        cedula = Cliente.normalize_cedula(cliente_data.get('cliente_cedula'))
        if not cedula:
            return False

        nombre = str(cliente_data.get('cliente_nombre') or '').strip().upper()
        apellido = str(cliente_data.get('cliente_apellido') or '').strip().upper()
        telefono = str(cliente_data.get('cliente_telefono') or '').strip().upper()
        direccion = str(cliente_data.get('cliente_direccion') or '').strip().upper()

        if not nombre or not apellido:
            return False

        query = '''
        INSERT INTO clientes (cedula, nombre, apellido, telefono, direccion, fecha_actualizacion)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(cedula) DO UPDATE SET
            nombre = excluded.nombre,
            apellido = excluded.apellido,
            telefono = excluded.telefono,
            direccion = excluded.direccion,
            fecha_actualizacion = CURRENT_TIMESTAMP
        '''
        db.execute_update(query, (cedula, nombre, apellido, telefono, direccion))
        return True

    @staticmethod
    def search(query_param, limit=10):
        search_term = f"%{str(query_param or '').upper().strip()}%"
        query = '''
        SELECT cedula, nombre, apellido, telefono, direccion
        FROM clientes
        WHERE UPPER(nombre) LIKE ?
           OR UPPER(apellido) LIKE ?
           OR UPPER(cedula) LIKE ?
           OR UPPER(telefono) LIKE ?
        ORDER BY nombre, apellido
        LIMIT ?
        '''
        rows = db.execute_query(query, (search_term, search_term, search_term, search_term, int(limit)))
        return [dict(row) for row in rows]

    @staticmethod
    def update_by_cedula(cedula_original, nombre, apellido, cedula_nueva, telefono, direccion):
        cedula_original_norm = Cliente.normalize_cedula(cedula_original)
        cedula_nueva_norm = Cliente.normalize_cedula(cedula_nueva)
        if not cedula_original_norm or not cedula_nueva_norm:
            return False

        nombre = str(nombre or '').strip().upper()
        apellido = str(apellido or '').strip().upper()
        telefono = str(telefono or '').strip().upper()
        direccion = str(direccion or '').strip().upper()

        # Si cambia la cédula, consolidar en una sola fila
        if cedula_original_norm != cedula_nueva_norm:
            db.execute_update('DELETE FROM clientes WHERE cedula = ?', (cedula_nueva_norm,))

        query = '''
        UPDATE clientes
        SET cedula = ?, nombre = ?, apellido = ?, telefono = ?, direccion = ?, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE cedula = ?
        '''
        db.execute_update(query, (cedula_nueva_norm, nombre, apellido, telefono, direccion, cedula_original_norm))

        # Si no existía, crear registro
        db.execute_update(
            '''
            INSERT INTO clientes (cedula, nombre, apellido, telefono, direccion, fecha_actualizacion)
            SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE cedula = ?)
            ''',
            (cedula_nueva_norm, nombre, apellido, telefono, direccion, cedula_nueva_norm)
        )
        return True

    @staticmethod
    def sync_from_ingresos():
        """Sincroniza catálogo de clientes desde ingresos existentes"""
        query = '''
        INSERT INTO clientes (cedula, nombre, apellido, telefono, direccion, fecha_actualizacion)
        SELECT
            REPLACE(REPLACE(REPLACE(UPPER(TRIM(i.cliente_cedula)), '.', ''), '-', ''), ' ', '') AS cedula_norm,
            UPPER(TRIM(i.cliente_nombre)) AS nombre,
            UPPER(TRIM(i.cliente_apellido)) AS apellido,
            UPPER(TRIM(COALESCE(i.cliente_telefono, ''))) AS telefono,
            UPPER(TRIM(COALESCE(i.cliente_direccion, ''))) AS direccion,
            CURRENT_TIMESTAMP
        FROM ingresos i
        WHERE i.id = (
            SELECT i2.id
            FROM ingresos i2
            WHERE REPLACE(REPLACE(REPLACE(UPPER(TRIM(i2.cliente_cedula)), '.', ''), '-', ''), ' ', '')
                  = REPLACE(REPLACE(REPLACE(UPPER(TRIM(i.cliente_cedula)), '.', ''), '-', ''), ' ', '')
            ORDER BY datetime(i2.fecha_ingreso) DESC, i2.id DESC
            LIMIT 1
        )
        ON CONFLICT(cedula) DO UPDATE SET
            nombre = excluded.nombre,
            apellido = excluded.apellido,
            telefono = excluded.telefono,
            direccion = excluded.direccion,
            fecha_actualizacion = CURRENT_TIMESTAMP
        '''
        db.execute_update(query)
