from .database import db
from datetime import datetime
import sqlite3

class Ingreso:
    """Modelo de ingresos técnicos"""

    ALLOWED_BANDEJA_SIM_COLORS = {
        'NEGRO',
        'BLANCO',
        'PLATEADO',
        'DORADO',
        'ROJO',
        'AZUL',
        'VERDE',
        'MORADO',
        'ROSADO',
        'NARANJA',
        'GRIS'
    }

    @staticmethod
    def normalize_bandeja_sim_color(color_bandeja_sim, bandeja_sim):
        """Normaliza color de bandeja SIM y retorna vacío si no aplica."""
        if not bandeja_sim:
            return ''

        color_normalizado = str(color_bandeja_sim or '').strip().upper()
        if color_normalizado in {'PÚRPURA', 'PURPURA'}:
            color_normalizado = 'MORADO'
        if color_normalizado == 'ROSA':
            color_normalizado = 'ROSADO'

        if color_normalizado not in Ingreso.ALLOWED_BANDEJA_SIM_COLORS:
            return ''
        return color_normalizado
    
    @staticmethod
    def generate_numero_ingreso():
        """Genera un número de ingreso secuencial (1, 2, 3, ...)"""
        # Usar el máximo actual para evitar colisiones si hubo eliminaciones
        query = "SELECT COALESCE(MAX(CAST(numero_ingreso AS INTEGER)), 0) as max_num FROM ingresos"
        result = db.execute_single(query)
        max_num = result['max_num'] if result and result['max_num'] is not None else 0
        next_num = max_num + 1
        
        # Retornar solo el número secuencial
        return str(next_num)
    
    @staticmethod
    def create(datos):
        """Crea un nuevo ingreso técnico"""
        # Convertir campos de texto a mayúsculas
        cliente_nombre = datos['cliente_nombre'].upper()
        cliente_apellido = datos['cliente_apellido'].upper()
        cliente_cedula = datos['cliente_cedula'].upper()
        cliente_telefono = datos.get('cliente_telefono', '').upper()
        cliente_direccion = datos.get('cliente_direccion', '').upper()
        color = datos.get('color', '').upper()
        imei = str(datos.get('imei', '') or '').strip()
        falla_general = datos.get('falla_general', '').upper()
        notas_adicionales = datos.get('notas_adicionales', '').upper()
        tipo_clave = (datos.get('tipo_clave', '') or '').upper()
        bandeja_sim = bool(datos.get('bandeja_sim', False))
        color_bandeja_sim = Ingreso.normalize_bandeja_sim_color(
            datos.get('color_bandeja_sim', ''),
            bandeja_sim
        )
        estado_botones_detalle = (datos.get('estado_botones_detalle', '') or '').upper()
        valor_total = datos.get('valor_reparacion', 0)
        fecha_ingreso = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        query = '''
        INSERT INTO ingresos (
            numero_ingreso, empleado_id, tecnico_id, tecnico_nombre, tecnico_telefono, tecnico_cedula, marca_id, modelo_id,
            cliente_nombre, cliente_apellido, cliente_cedula, cliente_telefono, cliente_direccion,
            color, imei, falla_general, notas_adicionales,
            estado_display, estado_tactil, estado_botones, estado_apagado,
            tiene_clave, tipo_clave, clave,
            garantia, estuche, bandeja_sim, color_bandeja_sim, visor_partido, estado_botones_detalle,
            valor_total, fecha_ingreso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        # Reintento simple por si hay concurrencia y se repite el número generado
        for _ in range(5):
            numero_ingreso = Ingreso.generate_numero_ingreso()
            params = (
                numero_ingreso,
                datos['empleado_id'],
                datos.get('tecnico_id'),
                (datos.get('tecnico_nombre') or '').upper(),
                (datos.get('tecnico_telefono') or '').upper(),
                (datos.get('tecnico_cedula') or '').upper(),
                datos['marca_id'],
                datos['modelo_id'],
                cliente_nombre,
                cliente_apellido,
                cliente_cedula,
                cliente_telefono,
                cliente_direccion,
                color,
                imei,
                falla_general,
                notas_adicionales,
                datos.get('estado_display', False),
                datos.get('estado_tactil', False),
                datos.get('estado_botones', False),
                datos.get('estado_apagado', False),
                datos.get('tiene_clave', False),
                tipo_clave,
                datos.get('clave', ''),
                datos.get('garantia', False),
                datos.get('estuche', False),
                bandeja_sim,
                color_bandeja_sim,
                datos.get('visor_partido', False),
                estado_botones_detalle,
                valor_total,
                fecha_ingreso
            )

            try:
                ingreso_id = db.execute_update(query, params)
                return {'id': ingreso_id, 'numero_ingreso': numero_ingreso}
            except sqlite3.IntegrityError as e:
                if 'ingresos.numero_ingreso' in str(e):
                    continue
                raise

        raise Exception('No se pudo generar un número de ingreso único, intenta nuevamente')

    @staticmethod
    def find_active_duplicate(cliente_cedula):
        """Busca un cliente existente por cédula (normalizada)"""
        cedula = str(cliente_cedula or '').strip().upper()
        cedula_normalizada = cedula.replace('.', '').replace('-', '').replace(' ', '')

        if not cedula_normalizada:
            return None

        query = '''
        SELECT
            id,
            numero_ingreso,
            estado_ingreso,
            fecha_ingreso,
            cliente_nombre,
            cliente_apellido,
            cliente_cedula,
                        cliente_telefono,
                        cliente_direccion,
                        imei
        FROM ingresos
                WHERE REPLACE(REPLACE(REPLACE(UPPER(TRIM(cliente_cedula)), '.', ''), '-', ''), ' ', '') = ?
        ORDER BY fecha_ingreso DESC
        LIMIT 1
        '''

        result = db.execute_single(query, (cedula_normalizada,))
        return dict(result) if result else None
    
    @staticmethod
    def get_by_id(ingreso_id):
        """Obtiene un ingreso por ID"""
        query = '''
        SELECT 
            i.*,
            m.nombre as marca,
            md.nombre as modelo,
            u1.nombre as empleado,
            COALESCE(NULLIF(TRIM(u2.nombre), ''), i.tecnico_nombre) as tecnico,
            COALESCE(NULLIF(TRIM(u2.telefono), ''), i.tecnico_telefono) as tecnico_telefono,
            COALESCE(NULLIF(TRIM(u2.cedula), ''), i.tecnico_cedula) as tecnico_cedula,
            CASE WHEN EXISTS (
                SELECT 1 FROM ingreso_fallas if2 
                WHERE if2.ingreso_id = i.id AND if2.estado_falla = 'reparada'
            ) THEN 1 ELSE 0 END as fue_reparado
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
            i.estado_pago,
            i.valor_total,
            u1.nombre as empleado,
            COALESCE(NULLIF(TRIM(u2.nombre), ''), i.tecnico_nombre) as tecnico,
            COALESCE(NULLIF(TRIM(u2.telefono), ''), i.tecnico_telefono) as tecnico_telefono,
            COALESCE(NULLIF(TRIM(u2.cedula), ''), i.tecnico_cedula) as tecnico_cedula,
            CASE WHEN EXISTS (
                SELECT 1 FROM ingreso_fallas if2 
                WHERE if2.ingreso_id = i.id AND if2.estado_falla = 'reparada'
            ) THEN 1 ELSE 0 END as fue_reparado
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

            if filtros.get('estado_pago'):
                query += " AND i.estado_pago = ?"
                params.append(filtros['estado_pago'])
            
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

            if filtros.get('estado_pago'):
                query += " AND estado_pago = ?"
                params.append(filtros['estado_pago'])
            
            if filtros.get('fecha_inicio'):
                query += " AND DATE(fecha_ingreso) >= ?"
                params.append(filtros['fecha_inicio'])
            
            if filtros.get('fecha_fin'):
                query += " AND DATE(fecha_ingreso) <= ?"
                params.append(filtros['fecha_fin'])
        
        result = db.execute_single(query, params)
        return result['total'] if result else 0
    
    @staticmethod
    def update_tecnico(ingreso_id, tecnico_id, tecnico_data=None):
        """Asigna un técnico a un ingreso"""
        tecnico_data = tecnico_data or {}
        query = "UPDATE ingresos SET tecnico_id = ?, tecnico_nombre = ?, tecnico_telefono = ?, tecnico_cedula = ? WHERE id = ?"
        db.execute_update(query, (
            tecnico_id,
            str(tecnico_data.get('nombre', '') or '').upper(),
            str(tecnico_data.get('telefono', '') or '').upper(),
            str(tecnico_data.get('cedula', '') or '').upper(),
            ingreso_id
        ))
        return True
    
    @staticmethod
    def update(ingreso_id, datos):
        """Actualiza un ingreso con múltiples campos"""
        if not datos:
            return True
        
        updates = []
        params = []
        
        for key, value in datos.items():
            if key in ['cliente_nombre', 'cliente_apellido', 'cliente_cedula', 'cliente_telefono', 'cliente_direccion', 'color', 'imei', 'falla_general', 'valor_total', 'estado_pago', 'tipo_clave', 'garantia', 'estuche', 'bandeja_sim', 'color_bandeja_sim', 'visor_partido', 'estado_botones_detalle', 'estado_apagado', 'tiene_clave', 'clave']:
                # Convertir a mayúsculas si es string (excepto valor_total)
                if isinstance(value, str) and key not in ['valor_total', 'estado_pago', 'imei', 'clave']:
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
        from datetime import datetime
        # Si el estado es 'entregado', guardar la fecha de entrega
        if estado == 'entregado':
            query = "UPDATE ingresos SET estado_ingreso = ?, fecha_entrega = ? WHERE id = ?"
            db.execute_update(query, (estado, datetime.now(), ingreso_id))
        else:
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
