from .database import db

class Configuracion:
    """Modelo de configuración del negocio"""
    
    @staticmethod
    def get_all():
        """Obtiene todas las configuraciones"""
        query = "SELECT clave, valor, tipo FROM configuracion"
        results = db.execute_query(query)
        config_dict = {}
        for row in results:
            config_dict[row['clave']] = {
                'valor': row['valor'],
                'tipo': row['tipo']
            }
        return config_dict
    
    @staticmethod
    def get(clave):
        """Obtiene una configuración específica"""
        query = "SELECT valor FROM configuracion WHERE clave = ?"
        result = db.execute_single(query, (clave,))
        return result['valor'] if result else None
    
    @staticmethod
    def set(clave, valor, tipo='text'):
        """Establece o actualiza una configuración"""
        # Verificar si existe
        query_check = "SELECT id FROM configuracion WHERE clave = ?"
        exists = db.execute_single(query_check, (clave,))
        
        if exists:
            query = "UPDATE configuracion SET valor = ?, tipo = ? WHERE clave = ?"
            db.execute_update(query, (valor, tipo, clave))
        else:
            query = "INSERT INTO configuracion (clave, valor, tipo) VALUES (?, ?, ?)"
            db.execute_update(query, (clave, valor, tipo))
        
        return True
    
    @staticmethod
    def get_datos_negocio():
        """Obtiene datos principales del negocio"""
        query = "SELECT clave, valor FROM configuracion WHERE clave IN ('nombre_negocio', 'telefono_negocio', 'email_negocio', 'logo_url')"
        results = db.execute_query(query)
        datos = {}
        for row in results:
            datos[row['clave']] = row['valor']
        return datos
