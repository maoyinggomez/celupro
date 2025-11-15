from .database import db

class Marca:
    """Modelo de marcas"""
    
    @staticmethod
    def get_all():
        """Obtiene todas las marcas"""
        query = "SELECT id, nombre FROM marcas ORDER BY nombre"
        results = db.execute_query(query)
        return [dict(row) for row in results]
    
    @staticmethod
    def get_by_id(marca_id):
        """Obtiene una marca por ID"""
        query = "SELECT id, nombre FROM marcas WHERE id = ?"
        result = db.execute_single(query, (marca_id,))
        return dict(result) if result else None
    
    @staticmethod
    def create(nombre):
        """Crea una nueva marca"""
        query = "INSERT INTO marcas (nombre) VALUES (?)"
        marca_id = db.execute_update(query, (nombre,))
        return marca_id
    
    @staticmethod
    def update(marca_id, nombre):
        """Actualiza una marca"""
        query = "UPDATE marcas SET nombre = ? WHERE id = ?"
        db.execute_update(query, (nombre, marca_id))
        return True
    
    @staticmethod
    def delete(marca_id):
        """Elimina una marca"""
        query = "DELETE FROM marcas WHERE id = ?"
        db.execute_update(query, (marca_id,))
        return True

class Modelo:
    """Modelo de modelos de celulares"""
    
    @staticmethod
    def get_by_marca(marca_id):
        """Obtiene modelos de una marca"""
        query = "SELECT id, nombre, marca_id FROM modelos WHERE marca_id = ? ORDER BY nombre"
        results = db.execute_query(query, (marca_id,))
        return [dict(row) for row in results]
    
    @staticmethod
    def get_by_id(modelo_id):
        """Obtiene un modelo por ID"""
        query = "SELECT id, nombre, marca_id FROM modelos WHERE id = ?"
        result = db.execute_single(query, (modelo_id,))
        return dict(result) if result else None
    
    @staticmethod
    def create(marca_id, nombre):
        """Crea un nuevo modelo"""
        query = "INSERT INTO modelos (marca_id, nombre) VALUES (?, ?)"
        modelo_id = db.execute_update(query, (marca_id, nombre))
        return modelo_id
    
    @staticmethod
    def update(modelo_id, nombre):
        """Actualiza un modelo"""
        query = "UPDATE modelos SET nombre = ? WHERE id = ?"
        db.execute_update(query, (nombre, modelo_id))
        return True
    
    @staticmethod
    def delete(modelo_id):
        """Elimina un modelo"""
        query = "DELETE FROM modelos WHERE id = ?"
        db.execute_update(query, (modelo_id,))
        return True
