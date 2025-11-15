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
