from .database import db

class Nota:
    """Modelo de notas por ingreso"""
    
    @staticmethod
    def create(ingreso_id, usuario_id, contenido, tipo='general'):
        """Agrega una nota a un ingreso"""
        query = '''
        INSERT INTO notas_ingreso (ingreso_id, usuario_id, contenido, tipo)
        VALUES (?, ?, ?, ?)
        '''
        nota_id = db.execute_update(query, (ingreso_id, usuario_id, contenido, tipo))
        return nota_id
    
    @staticmethod
    def get_by_ingreso(ingreso_id):
        """Obtiene todas las notas de un ingreso"""
        query = '''
        SELECT 
            n.id, n.contenido, n.tipo, n.fecha_creacion,
            u.nombre as usuario
        FROM notas_ingreso n
        JOIN usuarios u ON n.usuario_id = u.id
        WHERE n.ingreso_id = ?
        ORDER BY n.fecha_creacion DESC
        '''
        results = db.execute_query(query, (ingreso_id,))
        return [dict(row) for row in results]
    
    @staticmethod
    def update(nota_id, contenido):
        """Actualiza una nota"""
        query = "UPDATE notas_ingreso SET contenido = ? WHERE id = ?"
        db.execute_update(query, (contenido, nota_id))
        return True
    
    @staticmethod
    def delete(nota_id):
        """Elimina una nota"""
        query = "DELETE FROM notas_ingreso WHERE id = ?"
        db.execute_update(query, (nota_id,))
        return True

    @staticmethod
    def get_garantias(limit=200):
        """Obtiene trazabilidad de garantías (apertura y gestión)"""
        query = '''
        SELECT
            n.id,
            n.ingreso_id,
            n.contenido,
            n.fecha_creacion,
            u.nombre as usuario,
            i.numero_ingreso,
            i.estado_ingreso,
            i.cliente_nombre,
            i.cliente_apellido,
            i.cliente_cedula,
            i.cliente_telefono,
            m.nombre as marca,
            md.nombre as modelo,
            i.color
        FROM notas_ingreso n
        JOIN ingresos i ON i.id = n.ingreso_id
        LEFT JOIN usuarios u ON u.id = n.usuario_id
        LEFT JOIN marcas m ON m.id = i.marca_id
        LEFT JOIN modelos md ON md.id = i.modelo_id
          WHERE UPPER(TRIM(n.contenido)) LIKE '[GARANTIA]%'
              OR UPPER(TRIM(n.contenido)) LIKE 'GARANTÍA %'
        ORDER BY n.fecha_creacion DESC
        LIMIT ?
        '''
        results = db.execute_query(query, (limit,))
        return [dict(row) for row in results]
