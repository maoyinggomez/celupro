from .database import db


class Repuesto:
    """Modelo de inventario de repuestos."""

    @staticmethod
    def get_all(include_inactive=False):
        query = '''
        SELECT id, nombre, costo_unitario, precio_sugerido, stock, activo, fecha_actualizacion
        FROM repuestos_inventario
        '''
        params = []
        if not include_inactive:
            query += ' WHERE activo = 1'
        query += ' ORDER BY nombre ASC'
        rows = db.execute_query(query, tuple(params))
        return [dict(row) for row in rows]

    @staticmethod
    def create(nombre, costo_unitario=0, precio_sugerido=0, stock=0):
        query = '''
        INSERT INTO repuestos_inventario (nombre, costo_unitario, precio_sugerido, stock, activo)
        VALUES (?, ?, ?, ?, 1)
        '''
        return db.execute_update(query, (str(nombre or '').strip().upper(), costo_unitario, precio_sugerido, stock))

    @staticmethod
    def update(repuesto_id, nombre, costo_unitario, precio_sugerido, stock, activo=True):
        query = '''
        UPDATE repuestos_inventario
        SET nombre = ?,
            costo_unitario = ?,
            precio_sugerido = ?,
            stock = ?,
            activo = ?,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = ?
        '''
        db.execute_update(
            query,
            (
                str(nombre or '').strip().upper(),
                costo_unitario,
                precio_sugerido,
                stock,
                1 if activo else 0,
                repuesto_id,
            ),
        )
        return True

    @staticmethod
    def delete(repuesto_id):
        db.execute_update('DELETE FROM repuestos_inventario WHERE id = ?', (repuesto_id,))
        return True
