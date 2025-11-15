from .database import db
from werkzeug.security import generate_password_hash, check_password_hash

class User:
    """Modelo de usuario"""
    
    @staticmethod
    def authenticate(usuario, contraseña):
        """Autentica un usuario"""
        query = "SELECT * FROM usuarios WHERE usuario = ? AND activo = 1"
        result = db.execute_single(query, (usuario,))
        
        if result and check_password_hash(result['contraseña'], contraseña):
            return dict(result)
        return None
    
    @staticmethod
    def get_by_id(user_id):
        """Obtiene un usuario por ID"""
        query = "SELECT id, usuario, nombre, rol FROM usuarios WHERE id = ? AND activo = 1"
        result = db.execute_single(query, (user_id,))
        return dict(result) if result else None
    
    @staticmethod
    def get_all():
        """Obtiene todos los usuarios activos"""
        query = "SELECT id, usuario, nombre, rol, fecha_creacion FROM usuarios WHERE activo = 1 ORDER BY nombre"
        results = db.execute_query(query)
        return [dict(row) for row in results]
    
    @staticmethod
    def create(usuario, contraseña, nombre, rol):
        """Crea un nuevo usuario"""
        hashed_password = generate_password_hash(contraseña)
        query = '''
        INSERT INTO usuarios (usuario, contraseña, nombre, rol)
        VALUES (?, ?, ?, ?)
        '''
        user_id = db.execute_update(query, (usuario, hashed_password, nombre, rol))
        return user_id
    
    @staticmethod
    def update(user_id, nombre=None, rol=None, contraseña=None):
        """Actualiza datos de un usuario"""
        updates = []
        params = []
        
        if nombre:
            updates.append("nombre = ?")
            params.append(nombre)
        
        if rol:
            updates.append("rol = ?")
            params.append(rol)
        
        if contraseña:
            hashed = generate_password_hash(contraseña)
            updates.append("contraseña = ?")
            params.append(hashed)
        
        if not updates:
            return False
        
        params.append(user_id)
        query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id = ?"
        db.execute_update(query, params)
        return True
    
    @staticmethod
    def delete(user_id):
        """Marca un usuario como inactivo"""
        query = "UPDATE usuarios SET activo = 0 WHERE id = ?"
        db.execute_update(query, (user_id,))
        return True
    
    @staticmethod
    def check_exists(usuario):
        """Verifica si un usuario ya existe"""
        query = "SELECT id FROM usuarios WHERE usuario = ?"
        return db.execute_single(query, (usuario,)) is not None
