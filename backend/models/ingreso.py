from .database import db
from datetime import datetime

class Ingreso:
    """Modelo de ingresos técnicos"""
    
    @staticmethod
    def generate_numero_ingreso():
        """Genera un número de ingreso único"""
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        query = "SELECT COUNT(*) as count FROM ingresos WHERE strftime('%Y-%m-%d', fecha_ingreso) = date('now')"
        result = db.execute_single(query)
        count = result['count'] + 1 if result else 1
        return f"IG-{datetime.now().strftime('%Y%m%d')}-{count:04d}"
    
    @staticmethod
    def create(datos):
        """Crea un nuevo ingreso técnico"""
        numero_ingreso = Ingreso.generate_numero_ingreso()
        
        # Convertir campos de texto a mayúsculas
        cliente_nombre = datos['cliente_nombre'].upper()
        cliente_apellido = datos['cliente_apellido'].upper()
        cliente_cedula = datos['cliente_cedula'].upper()
        cliente_telefono = datos.get('cliente_telefono', '').upper()
        cliente_direccion = datos.get('cliente_direccion', '').upper()
        color = datos.get('color', '').upper()
        falla_general = datos.get('falla_general', '').upper()
        notas_adicionales = datos.get('notas_adicionales', '').upper()
        
        query = '''
        INSERT INTO ingresos (
            numero_ingreso, empleado_id, marca_id, modelo_id,
            cliente_nombre, cliente_apellido, cliente_cedula, cliente_telefono, cliente_direccion,
            color, falla_general, notas_adicionales,
            estado_display, estado_tactil, estado_botones, estado_apagado,
            tiene_clave, clave
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        params = (
            numero_ingreso,
            datos['empleado_id'],
            datos['marca_id'],
            datos['modelo_id'],
            cliente_nombre,
            cliente_apellido,
            cliente_cedula,
            cliente_telefono,
            cliente_direccion,
            color,
            falla_general,
            notas_adicionales,
            datos.get('estado_display', False),
            datos.get('estado_tactil', False),
            datos.get('estado_botones', False),
            datos.get('estado_apagado', False),
            datos.get('tiene_clave', False),
            datos.get('clave', '')
        )
        
        ingreso_id = db.execute_update(query, params)
        return {'id': ingreso_id, 'numero_ingreso': numero_ingreso}
    
    @staticmethod
    def get_by_id(ingreso_id):
        """Obtiene un ingreso por ID"""
        query = '''
        SELECT 
            i.*,
            m.nombre as marca,
            md.nombre as modelo,
            u1.nombre as empleado,
            u2.nombre as tecnico
        FROM ingresos i
        LEFT JOIN marcas m ON i.marca_id = m.id
        LEFT JOIN modelos md ON i.modelo_id = md.id
        LEFT JOIN usuarios u1 ON i.empleado_id = u1.id
        LEFT JOIN usuarios u2 ON i.tecnico_id = u2.id
        WHERE i.id = ?
        '''
        result = db.execute_single(query, (ingreso_id,))
        return dict(result) if result else None
    
    @staticmethod
    def get_all_with_filters(skip=0, limit=50, filtros=None):
        """Obtiene ingresos con filtros opcionales"""
        query = '''
        SELECT 
            i.id, i.numero_ingreso, i.fecha_ingreso, i.fecha_entrega,
            i.cliente_nombre, i.cliente_apellido, i.cliente_cedula,
            i.cliente_telefono, i.cliente_direccion,
            m.nombre as marca,
            md.nombre as modelo,
            i.color,
            i.estado_ingreso,
            i.valor_total,
            u1.nombre as empleado,
            u2.nombre as tecnico
        FROM ingresos i
        LEFT JOIN marcas m ON i.marca_id = m.id
        LEFT JOIN modelos md ON i.modelo_id = md.id
        LEFT JOIN usuarios u1 ON i.empleado_id = u1.id
        LEFT JOIN usuarios u2 ON i.tecnico_id = u2.id
        WHERE 1=1
        '''
        
        params = []
        
        if filtros:
            if filtros.get('cliente'):
                query += " AND (i.cliente_nombre LIKE ? OR i.cliente_apellido LIKE ? OR i.cliente_cedula LIKE ?)"
                search = f"%{filtros['cliente']}%"
                params.extend([search, search, search])
            
            if filtros.get('marca_id'):
                query += " AND i.marca_id = ?"
                params.append(filtros['marca_id'])
            
            if filtros.get('estado'):
                query += " AND i.estado_ingreso = ?"
                params.append(filtros['estado'])
            
            if filtros.get('fecha_inicio'):
                query += " AND DATE(i.fecha_ingreso) >= ?"
                params.append(filtros['fecha_inicio'])
            
            if filtros.get('fecha_fin'):
                query += " AND DATE(i.fecha_ingreso) <= ?"
                params.append(filtros['fecha_fin'])
        
        query += " ORDER BY i.fecha_ingreso DESC LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        results = db.execute_query(query, params)
        return [dict(row) for row in results]
    
    @staticmethod
    def get_count(filtros=None):
        """Obtiene el total de ingresos"""
        query = "SELECT COUNT(*) as total FROM ingresos WHERE 1=1"
        params = []
        
        if filtros:
            if filtros.get('cliente'):
                query += " AND (cliente_nombre LIKE ? OR cliente_apellido LIKE ? OR cliente_cedula LIKE ?)"
                search = f"%{filtros['cliente']}%"
                params.extend([search, search, search])
            
            if filtros.get('marca_id'):
                query += " AND marca_id = ?"
                params.append(filtros['marca_id'])
            
            if filtros.get('estado'):
                query += " AND estado_ingreso = ?"
                params.append(filtros['estado'])
            
            if filtros.get('fecha_inicio'):
                query += " AND DATE(fecha_ingreso) >= ?"
                params.append(filtros['fecha_inicio'])
            
            if filtros.get('fecha_fin'):
                query += " AND DATE(fecha_ingreso) <= ?"
                params.append(filtros['fecha_fin'])
        
        result = db.execute_single(query, params)
        return result['total'] if result else 0
    
    @staticmethod
    def update_tecnico(ingreso_id, tecnico_id):
        """Asigna un técnico a un ingreso"""
        query = "UPDATE ingresos SET tecnico_id = ? WHERE id = ?"
        db.execute_update(query, (tecnico_id, ingreso_id))
        return True
    
    @staticmethod
    def update(ingreso_id, datos):
        """Actualiza un ingreso con múltiples campos"""
        if not datos:
            return True
        
        updates = []
        params = []
        
        for key, value in datos.items():
            if key in ['cliente_nombre', 'cliente_apellido', 'cliente_cedula', 'cliente_telefono', 'cliente_direccion', 'color', 'falla_general']:
                # Convertir a mayúsculas si es string
                if isinstance(value, str):
                    value = value.upper()
                updates.append(f"{key} = ?")
                params.append(value)
        
        if not updates:
            return True
        
        params.append(ingreso_id)
        query = f"UPDATE ingresos SET {', '.join(updates)} WHERE id = ?"
        db.execute_update(query, params)
        return True
    
    @staticmethod
    def update_estado(ingreso_id, estado):
        """Actualiza el estado del ingreso"""
        query = "UPDATE ingresos SET estado_ingreso = ? WHERE id = ?"
        db.execute_update(query, (estado, ingreso_id))
        return True
    
    @staticmethod
    def update_valor_total(ingreso_id, valor_total):
        """Actualiza el valor total"""
        query = "UPDATE ingresos SET valor_total = ? WHERE id = ?"
        db.execute_update(query, (valor_total, ingreso_id))
        return True
    
    @staticmethod
    def get_pendientes():
        """Obtiene ingresos pendientes"""
        query = '''
        SELECT 
            i.id, i.numero_ingreso, i.fecha_ingreso,
            i.cliente_nombre, i.cliente_apellido,
            m.nombre as marca, md.nombre as modelo
        FROM ingresos i
        LEFT JOIN marcas m ON i.marca_id = m.id
        LEFT JOIN modelos md ON i.modelo_id = md.id
        WHERE i.estado_ingreso = 'pendiente'
        ORDER BY i.fecha_ingreso
        '''
        results = db.execute_query(query)
        return [dict(row) for row in results]
    
    @staticmethod
    def delete(ingreso_id):
        """Elimina un ingreso y todas sus fallas y notas asociadas"""
        # Eliminar notas
        query_notas = "DELETE FROM notas_ingreso WHERE ingreso_id = ?"
        db.execute_update(query_notas, (ingreso_id,))
        
        # Eliminar fallas
        query_fallas = "DELETE FROM ingreso_fallas WHERE ingreso_id = ?"
        db.execute_update(query_fallas, (ingreso_id,))
        
        # Eliminar ingreso
        query = "DELETE FROM ingresos WHERE id = ?"
        db.execute_update(query, (ingreso_id,))
        
        return True
