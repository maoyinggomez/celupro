from .database import db


def normalize_model_name(name):
    return ' '.join((name or '').strip().split()).upper()

class Marca:
    """Modelo de marcas"""
    
    @staticmethod
    def get_all():
        """Obtiene todas las marcas"""
        query = "SELECT id, nombre, orden FROM marcas ORDER BY orden ASC, nombre ASC"
        results = db.execute_query(query)
        return [dict(row) for row in results]
    
    @staticmethod
    def get_by_id(marca_id):
        """Obtiene una marca por ID"""
        query = "SELECT id, nombre, orden FROM marcas WHERE id = ?"
        result = db.execute_single(query, (marca_id,))
        return dict(result) if result else None
    
    @staticmethod
    def create(nombre):
        """Crea una nueva marca"""
        next_order_query = "SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM marcas"
        next_order = db.execute_single(next_order_query)['next_order']
        query = "INSERT INTO marcas (nombre, orden) VALUES (?, ?)"
        marca_id = db.execute_update(query, (nombre, next_order))
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

    @staticmethod
    def move(marca_id, direction):
        """Mueve una marca arriba o abajo en el orden"""
        current = db.execute_single("SELECT id, orden FROM marcas WHERE id = ?", (marca_id,))
        if not current:
            return False

        if direction == 'up':
            neighbor = db.execute_single(
                "SELECT id, orden FROM marcas WHERE orden < ? ORDER BY orden DESC LIMIT 1",
                (current['orden'],)
            )
        else:
            neighbor = db.execute_single(
                "SELECT id, orden FROM marcas WHERE orden > ? ORDER BY orden ASC LIMIT 1",
                (current['orden'],)
            )

        if not neighbor:
            return False

        db.execute_update("UPDATE marcas SET orden = ? WHERE id = ?", (neighbor['orden'], current['id']))
        db.execute_update("UPDATE marcas SET orden = ? WHERE id = ?", (current['orden'], neighbor['id']))
        return True

class Modelo:
    """Modelo de modelos de celulares"""
    
    @staticmethod
    def get_by_marca(marca_id):
        """Obtiene modelos de una marca"""
        query = "SELECT id, nombre, marca_id, orden FROM modelos WHERE marca_id = ? ORDER BY orden ASC, nombre ASC"
        results = db.execute_query(query, (marca_id,))
        return [dict(row) for row in results]
    
    @staticmethod
    def get_by_id(modelo_id):
        """Obtiene un modelo por ID"""
        query = "SELECT id, nombre, marca_id, orden FROM modelos WHERE id = ?"
        result = db.execute_single(query, (modelo_id,))
        return dict(result) if result else None
    
    @staticmethod
    def create(marca_id, nombre):
        """Crea un nuevo modelo"""
        normalized_name = normalize_model_name(nombre)
        if not normalized_name:
            raise Exception('Nombre de modelo requerido')

        existing = db.execute_single(
            "SELECT id FROM modelos WHERE marca_id = ? AND UPPER(TRIM(nombre)) = UPPER(TRIM(?))",
            (marca_id, normalized_name)
        )
        if existing:
            raise Exception('El modelo ya existe para esta marca')

        next_order_query = "SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM modelos WHERE marca_id = ?"
        next_order = db.execute_single(next_order_query, (marca_id,))['next_order']
        query = "INSERT INTO modelos (marca_id, nombre, orden) VALUES (?, ?, ?)"
        modelo_id = db.execute_update(query, (marca_id, normalized_name, next_order))
        return modelo_id
    
    @staticmethod
    def update(modelo_id, nombre):
        """Actualiza un modelo"""
        normalized_name = normalize_model_name(nombre)
        if not normalized_name:
            raise Exception('Nombre de modelo requerido')

        current = db.execute_single("SELECT id, marca_id FROM modelos WHERE id = ?", (modelo_id,))
        if not current:
            raise Exception('Modelo no encontrado')

        existing = db.execute_single(
            """
            SELECT id
            FROM modelos
            WHERE marca_id = ?
              AND id <> ?
              AND UPPER(TRIM(nombre)) = UPPER(TRIM(?))
            """,
            (current['marca_id'], modelo_id, normalized_name)
        )
        if existing:
            raise Exception('Ya existe otro modelo con ese nombre en esta marca')

        query = "UPDATE modelos SET nombre = ? WHERE id = ?"
        db.execute_update(query, (normalized_name, modelo_id))
        return True
    
    @staticmethod
    def delete(modelo_id):
        """Elimina un modelo"""
        query = "DELETE FROM modelos WHERE id = ?"
        db.execute_update(query, (modelo_id,))
        return True

    @staticmethod
    def move(modelo_id, direction):
        """Mueve un modelo arriba o abajo dentro de su marca"""
        current = db.execute_single("SELECT id, marca_id, orden FROM modelos WHERE id = ?", (modelo_id,))
        if not current:
            return False

        if direction == 'up':
            neighbor = db.execute_single(
                "SELECT id, orden FROM modelos WHERE marca_id = ? AND orden < ? ORDER BY orden DESC LIMIT 1",
                (current['marca_id'], current['orden'])
            )
        else:
            neighbor = db.execute_single(
                "SELECT id, orden FROM modelos WHERE marca_id = ? AND orden > ? ORDER BY orden ASC LIMIT 1",
                (current['marca_id'], current['orden'])
            )

        if not neighbor:
            return False

        db.execute_update("UPDATE modelos SET orden = ? WHERE id = ?", (neighbor['orden'], current['id']))
        db.execute_update("UPDATE modelos SET orden = ? WHERE id = ?", (current['orden'], neighbor['id']))
        return True
