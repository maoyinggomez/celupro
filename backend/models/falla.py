from .database import db

class Falla:
    """Modelo de fallas del catálogo"""
    
    @staticmethod
    def get_all():
        """Obtiene todas las fallas del catálogo"""
        query = "SELECT id, nombre, descripcion, precio_sugerido FROM fallas_catalogo ORDER BY nombre"
        results = db.execute_query(query)
        return [dict(row) for row in results]
    
    @staticmethod
    def get_by_id(falla_id):
        """Obtiene una falla por ID"""
        query = "SELECT id, nombre, descripcion, precio_sugerido FROM fallas_catalogo WHERE id = ?"
        result = db.execute_single(query, (falla_id,))
        return dict(result) if result else None
    
    @staticmethod
    def create(nombre, descripcion, precio_sugerido):
        """Crea una nueva falla"""
        query = "INSERT INTO fallas_catalogo (nombre, descripcion, precio_sugerido) VALUES (?, ?, ?)"
        falla_id = db.execute_update(query, (nombre, descripcion, precio_sugerido))
        return falla_id
    
    @staticmethod
    def update(falla_id, nombre, descripcion, precio_sugerido):
        """Actualiza una falla"""
        query = "UPDATE fallas_catalogo SET nombre = ?, descripcion = ?, precio_sugerido = ? WHERE id = ?"
        db.execute_update(query, (nombre, descripcion, precio_sugerido, falla_id))
        return True
    
    @staticmethod
    def delete(falla_id):
        """Elimina una falla del catálogo"""
        query = "DELETE FROM fallas_catalogo WHERE id = ?"
        db.execute_update(query, (falla_id,))
        return True

class IngresoFalla:
    """Modelo de fallas por ingreso técnico"""
    
    @staticmethod
    def add_to_ingreso(ingreso_id, falla_id, valor_reparacion, usuario_id):
        """Agrega una falla a un ingreso"""
        query = '''
        INSERT INTO ingreso_fallas (ingreso_id, falla_id, valor_reparacion, agregada_por)
        VALUES (?, ?, ?, ?)
        '''
        falla_ingreso_id = db.execute_update(query, (ingreso_id, falla_id, valor_reparacion, usuario_id))
        return falla_ingreso_id
    
    @staticmethod
    def get_by_ingreso(ingreso_id):
        """Obtiene todas las fallas de un ingreso"""
        query = '''
        SELECT 
            inf.id,
            inf.falla_id,
            fc.nombre,
            fc.descripcion,
            inf.valor_reparacion,
            inf.estado_falla,
            inf.notas_falla,
            u.nombre as agregada_por
        FROM ingreso_fallas inf
        JOIN fallas_catalogo fc ON inf.falla_id = fc.id
        LEFT JOIN usuarios u ON inf.agregada_por = u.id
        WHERE inf.ingreso_id = ?
        ORDER BY inf.fecha_adicion
        '''
        results = db.execute_query(query, (ingreso_id,))
        return [dict(row) for row in results]
    
    @staticmethod
    def update_valor(ingreso_falla_id, valor_reparacion):
        """Actualiza el valor de reparación de una falla"""
        query = "UPDATE ingreso_fallas SET valor_reparacion = ? WHERE id = ?"
        db.execute_update(query, (valor_reparacion, ingreso_falla_id))
        return True
    
    @staticmethod
    def update_estado(ingreso_falla_id, estado_falla):
        """Actualiza el estado de una falla"""
        query = "UPDATE ingreso_fallas SET estado_falla = ? WHERE id = ?"
        db.execute_update(query, (estado_falla, ingreso_falla_id))
        return True
    
    @staticmethod
    def add_nota(ingreso_falla_id, notas_falla):
        """Agrega notas a una falla"""
        query = "UPDATE ingreso_fallas SET notas_falla = ? WHERE id = ?"
        db.execute_update(query, (notas_falla, ingreso_falla_id))
        return True
    
    @staticmethod
    def delete_from_ingreso(ingreso_falla_id):
        """Elimina una falla de un ingreso"""
        query = "DELETE FROM ingreso_fallas WHERE id = ?"
        db.execute_update(query, (ingreso_falla_id,))
        return True
