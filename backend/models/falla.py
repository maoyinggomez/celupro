from .database import db

class Falla:
    """Modelo de fallas del catálogo"""
    
    @staticmethod
    def get_all():
        """Obtiene todas las fallas del catálogo"""
        query = "SELECT id, nombre, descripcion, precio_sugerido, orden FROM fallas_catalogo ORDER BY orden ASC, nombre ASC"
        results = db.execute_query(query)
        return [dict(row) for row in results]
    
    @staticmethod
    def get_by_id(falla_id):
        """Obtiene una falla por ID"""
        query = "SELECT id, nombre, descripcion, precio_sugerido, orden FROM fallas_catalogo WHERE id = ?"
        result = db.execute_single(query, (falla_id,))
        return dict(result) if result else None
    
    @staticmethod
    def create(nombre, descripcion, precio_sugerido):
        """Crea una nueva falla"""
        next_order_query = "SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM fallas_catalogo"
        next_order = db.execute_single(next_order_query)['next_order']
        query = "INSERT INTO fallas_catalogo (nombre, descripcion, precio_sugerido, orden) VALUES (?, ?, ?, ?)"
        falla_id = db.execute_update(query, (nombre, descripcion, precio_sugerido, next_order))
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

    @staticmethod
    def move(falla_id, direction):
        """Mueve una falla arriba o abajo en el orden"""
        current = db.execute_single("SELECT id, orden FROM fallas_catalogo WHERE id = ?", (falla_id,))
        if not current:
            return False

        if direction == 'up':
            neighbor = db.execute_single(
                "SELECT id, orden FROM fallas_catalogo WHERE orden < ? ORDER BY orden DESC LIMIT 1",
                (current['orden'],)
            )
        else:
            neighbor = db.execute_single(
                "SELECT id, orden FROM fallas_catalogo WHERE orden > ? ORDER BY orden ASC LIMIT 1",
                (current['orden'],)
            )

        if not neighbor:
            return False

        db.execute_update("UPDATE fallas_catalogo SET orden = ? WHERE id = ?", (neighbor['orden'], current['id']))
        db.execute_update("UPDATE fallas_catalogo SET orden = ? WHERE id = ?", (current['orden'], neighbor['id']))
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
