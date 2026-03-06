from .database import db


def normalize_brand_name(name):
    return ' '.join((name or '').strip().split()).upper()


def normalize_model_name(name):
    return ' '.join((name or '').strip().split()).upper()


# Prioridad de marcas en el selector de ingreso.
BRAND_PRIORITY = [
    'SAMSUNG',
    'IPHONE',
    'XIAOMI',
    'MOTOROLA',
    'GOOGLE',
    'HUAWEI',
    'HONOR',
    'VIVO',
    'OPPO',
    'REALME',
    'POCO',
    'ONEPLUS',
    'NOKIA',
    'TCL',
    'LENOVO',
    'LG',
    'OTRO',
]


# Catálogo operativo (solo modelos permitidos en selector).
MODEL_POLICY_BY_BRAND = {
    'SAMSUNG': [
        'GALAXY A10', 'GALAXY A10S', 'GALAXY A20', 'GALAXY A20S', 'GALAXY A30', 'GALAXY A30S', 'GALAXY A50', 'GALAXY A50S', 'GALAXY A70',
        'GALAXY S10', 'GALAXY S10E', 'GALAXY S10+',
        'GALAXY A11', 'GALAXY A21', 'GALAXY A31', 'GALAXY A51', 'GALAXY A71',
        'GALAXY S20', 'GALAXY S20+', 'GALAXY S20 ULTRA',
        'GALAXY Z FLIP', 'GALAXY Z FOLD 2',
        'GALAXY A12', 'GALAXY A22', 'GALAXY A32', 'GALAXY A52', 'GALAXY A72',
        'GALAXY S21', 'GALAXY S21+', 'GALAXY S21 ULTRA',
        'GALAXY Z FLIP 3', 'GALAXY Z FOLD 3',
        'GALAXY A13', 'GALAXY A23', 'GALAXY A33', 'GALAXY A53', 'GALAXY A73',
        'GALAXY S22', 'GALAXY S22+', 'GALAXY S22 ULTRA',
        'GALAXY Z FLIP 4', 'GALAXY Z FOLD 4',
        'GALAXY A14', 'GALAXY A24', 'GALAXY A34', 'GALAXY A54',
        'GALAXY S23', 'GALAXY S23+', 'GALAXY S23 ULTRA',
        'GALAXY Z FLIP 5', 'GALAXY Z FOLD 5',
        'GALAXY A15', 'GALAXY A25', 'GALAXY A35', 'GALAXY A55',
        'GALAXY S24', 'GALAXY S24+', 'GALAXY S24 ULTRA',
        'GALAXY Z FLIP 6', 'GALAXY Z FOLD 6',
        'GALAXY A16', 'GALAXY A26', 'GALAXY A36', 'GALAXY A56',
        'GALAXY S25', 'GALAXY S25+', 'GALAXY S25 ULTRA',
        'GALAXY Z FLIP 7', 'GALAXY Z FOLD 7',
        'GALAXY S26', 'GALAXY S26+', 'GALAXY S26 ULTRA',
    ],
    'IPHONE': [
        'IPHONE 11', 'IPHONE 11 PRO', 'IPHONE 11 PRO MAX',
        'IPHONE SE (2020)',
        'IPHONE 12 MINI', 'IPHONE 12', 'IPHONE 12 PRO', 'IPHONE 12 PRO MAX',
        'IPHONE 13 MINI', 'IPHONE 13', 'IPHONE 13 PRO', 'IPHONE 13 PRO MAX',
        'IPHONE SE (2022)',
        'IPHONE 14', 'IPHONE 14 PLUS', 'IPHONE 14 PRO', 'IPHONE 14 PRO MAX',
        'IPHONE 15', 'IPHONE 15 PLUS', 'IPHONE 15 PRO', 'IPHONE 15 PRO MAX',
        'IPHONE 16', 'IPHONE 16 PLUS', 'IPHONE 16 PRO', 'IPHONE 16 PRO MAX',
        'IPHONE 17', 'IPHONE 17 PLUS', 'IPHONE 17 PRO', 'IPHONE 17 PRO MAX',
    ],
    'XIAOMI': [
        'MI 9', 'MI 9T', 'MI 9T PRO',
        'MI 10', 'MI 10 PRO', 'MI 10T', 'MI 10T PRO',
        'MI 11', 'MI 11 LITE', 'MI 11T', 'MI 11T PRO',
        'XIAOMI 12', 'XIAOMI 12 LITE', 'XIAOMI 12T', 'XIAOMI 12T PRO',
        'XIAOMI 13', 'XIAOMI 13 LITE', 'XIAOMI 13T', 'XIAOMI 13T PRO',
        'XIAOMI 14', 'XIAOMI 14T', 'XIAOMI 14T PRO',
        'XIAOMI 15', 'XIAOMI 15 PRO',
        'REDMI NOTE 8', 'REDMI NOTE 8 PRO',
        'REDMI NOTE 9', 'REDMI NOTE 9S', 'REDMI NOTE 9 PRO',
        'REDMI NOTE 10', 'REDMI NOTE 10S', 'REDMI NOTE 10 PRO',
        'REDMI NOTE 11', 'REDMI NOTE 11S', 'REDMI NOTE 11 PRO',
        'REDMI NOTE 12', 'REDMI NOTE 12S', 'REDMI NOTE 12 PRO',
        'REDMI NOTE 13', 'REDMI NOTE 13 PRO',
        'REDMI NOTE 14', 'REDMI NOTE 14 PRO',
    ],
    'MOTOROLA': [
        'MOTO G8', 'MOTO G8 POWER',
        'MOTO G9', 'MOTO G9 PLUS',
        'MOTO G10', 'MOTO G20', 'MOTO G30',
        'MOTO G31', 'MOTO G41', 'MOTO G51', 'MOTO G60',
        'MOTO G52', 'MOTO G62', 'MOTO G72', 'MOTO G82',
        'MOTO G53', 'MOTO G73', 'MOTO G84',
        'MOTO G54', 'MOTO G85',
        'MOTOROLA EDGE 20', 'MOTOROLA EDGE 30', 'MOTOROLA EDGE 40', 'MOTOROLA EDGE 50',
    ],
    'GOOGLE': [
        'PIXEL 4', 'PIXEL 4 XL',
        'PIXEL 5', 'PIXEL 5A',
        'PIXEL 6', 'PIXEL 6 PRO', 'PIXEL 6A',
        'PIXEL 7', 'PIXEL 7 PRO', 'PIXEL 7A',
        'PIXEL 8', 'PIXEL 8 PRO', 'PIXEL 8A',
        'PIXEL 9', 'PIXEL 9 PRO',
    ],
    'HUAWEI': [
        'P30', 'P30 PRO',
        'P40', 'P40 PRO',
        'P50', 'P50 PRO',
        'P60', 'P60 PRO',
        'MATE 30', 'MATE 30 PRO',
        'MATE 40', 'MATE 40 PRO',
        'MATE 50', 'MATE 50 PRO',
        'NOVA 5T', 'NOVA 7I', 'NOVA 8I', 'NOVA 9', 'NOVA 10', 'NOVA 11', 'NOVA 12',
    ],
    'HONOR': [
        'HONOR 20', 'HONOR 20 PRO',
        'HONOR 30', 'HONOR 30 PRO',
        'HONOR 50', 'HONOR 50 LITE',
        'HONOR 70', 'HONOR 90',
        'HONOR 200', 'HONOR 200 PRO',
        'HONOR X6', 'HONOR X7', 'HONOR X8', 'HONOR X9', 'HONOR X9B',
    ],
    'VIVO': [
        'VIVO Y11', 'VIVO Y12', 'VIVO Y15', 'VIVO Y17',
        'VIVO Y20', 'VIVO Y21', 'VIVO Y22', 'VIVO Y27', 'VIVO Y36',
        'VIVO V20', 'VIVO V21', 'VIVO V23', 'VIVO V25', 'VIVO V27', 'VIVO V29', 'VIVO V30',
        'VIVO X60', 'VIVO X70', 'VIVO X80', 'VIVO X90', 'VIVO X100',
    ],
    'OPPO': [
        'OPPO A54', 'OPPO A57', 'OPPO A58', 'OPPO A78', 'OPPO A79',
        'OPPO RENO 5', 'OPPO RENO 6', 'OPPO RENO 7', 'OPPO RENO 8', 'OPPO RENO 10', 'OPPO RENO 11',
    ],
    'REALME': [
        'REALME 7', 'REALME 8', 'REALME 9', 'REALME 10', 'REALME 11', 'REALME 12',
        'REALME C25', 'REALME C35', 'REALME C55',
    ],
    'POCO': [
        'POCO X3', 'POCO X3 PRO',
        'POCO X4 PRO', 'POCO X5', 'POCO X5 PRO', 'POCO X6', 'POCO X6 PRO',
        'POCO F3', 'POCO F4', 'POCO F5', 'POCO F6',
    ],
    'ONEPLUS': [
        'ONEPLUS 7', 'ONEPLUS 7 PRO',
        'ONEPLUS 8', 'ONEPLUS 8 PRO',
        'ONEPLUS 9', 'ONEPLUS 9 PRO',
        'ONEPLUS 10 PRO',
        'ONEPLUS 11', 'ONEPLUS 12',
        'ONEPLUS NORD', 'ONEPLUS NORD 2', 'ONEPLUS NORD 3',
    ],
}


def _brand_priority_index(brand_name):
    normalized = normalize_brand_name(brand_name)
    try:
        return BRAND_PRIORITY.index(normalized)
    except ValueError:
        return len(BRAND_PRIORITY) + 100


def _model_policy_for_brand(brand_name):
    return MODEL_POLICY_BY_BRAND.get(normalize_brand_name(brand_name))

class Marca:
    """Modelo de marcas"""
    
    @staticmethod
    def get_all():
        """Obtiene todas las marcas"""
        query = "SELECT id, nombre, orden FROM marcas ORDER BY orden ASC, nombre ASC"
        results = db.execute_query(query)
        rows = [dict(row) for row in results]

        # Si existe iPhone, ocultar Apple para evitar duplicidad visual.
        has_iphone = any(normalize_brand_name(item.get('nombre')) == 'IPHONE' for item in rows)
        if has_iphone:
            rows = [item for item in rows if normalize_brand_name(item.get('nombre')) != 'APPLE']

        rows.sort(key=lambda item: (
            _brand_priority_index(item.get('nombre')),
            int(item.get('orden') or 9999),
            normalize_brand_name(item.get('nombre'))
        ))
        return rows
    
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

    @staticmethod
    def get_or_create_by_name(nombre):
        """Obtiene una marca por nombre normalizado o la crea si no existe"""
        normalized_name = normalize_brand_name(nombre)
        if not normalized_name:
            raise Exception('Nombre de marca requerido')

        existing = db.execute_single(
            "SELECT id, nombre, orden FROM marcas WHERE UPPER(TRIM(nombre)) = ?",
            (normalized_name,)
        )
        if existing:
            return dict(existing)

        next_order_query = "SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM marcas"
        next_order = db.execute_single(next_order_query)['next_order']
        marca_id = db.execute_update(
            "INSERT INTO marcas (nombre, orden) VALUES (?, ?)",
            (normalized_name, next_order)
        )
        return {
            'id': marca_id,
            'nombre': normalized_name,
            'orden': next_order
        }

class Modelo:
    """Modelo de modelos de celulares"""
    
    @staticmethod
    def get_by_marca(marca_id):
        """Obtiene modelos de una marca"""
        brand_row = db.execute_single("SELECT nombre FROM marcas WHERE id = ?", (marca_id,))
        brand_name = brand_row['nombre'] if brand_row else ''
        allowed_models = _model_policy_for_brand(brand_name)

        query = "SELECT id, nombre, marca_id, orden FROM modelos WHERE marca_id = ? ORDER BY orden ASC, nombre ASC"
        results = db.execute_query(query, (marca_id,))
        rows = [dict(row) for row in results]

        if not allowed_models:
            return rows

        allowed_set = {normalize_model_name(model) for model in allowed_models}
        filtered = [row for row in rows if normalize_model_name(row.get('nombre')) in allowed_set]

        order_map = {normalize_model_name(model): idx for idx, model in enumerate(allowed_models)}
        filtered.sort(key=lambda row: (
            order_map.get(normalize_model_name(row.get('nombre')), 9999),
            normalize_model_name(row.get('nombre'))
        ))
        return filtered
    
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

    @staticmethod
    def belongs_to_marca(modelo_id, marca_id):
        """Valida si un modelo pertenece a una marca"""
        query = "SELECT 1 FROM modelos WHERE id = ? AND marca_id = ?"
        row = db.execute_single(query, (modelo_id, marca_id))
        return bool(row)

    @staticmethod
    def get_or_create_no_lista_defaults():
        """Asegura IDs por defecto para ingresos sin catálogo definido"""
        marca = Marca.get_or_create_by_name('OTRO')
        marca_id = marca['id']

        model_name = 'POR CATALOGAR'
        existing_model = db.execute_single(
            "SELECT id, nombre, marca_id, orden FROM modelos WHERE marca_id = ? AND UPPER(TRIM(nombre)) = ?",
            (marca_id, model_name)
        )

        if existing_model:
            modelo = dict(existing_model)
        else:
            modelo_id = Modelo.create(marca_id, model_name)
            modelo = Modelo.get_by_id(modelo_id)

        return {
            'marca_id': marca_id,
            'modelo_id': modelo['id'],
            'marca_nombre': marca['nombre'],
            'modelo_nombre': modelo['nombre']
        }
