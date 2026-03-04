import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime, date
from pathlib import Path

# Obtener ruta de BD de forma robusta
def get_db_path():
    """Obtiene la ruta correcta de la BD"""
    env_path = os.getenv('CELUPRO_DB_PATH', '').strip()
    if env_path:
        return env_path

    # Opciones de rutas posibles
    possible_paths = [
        Path(__file__).parent.parent.parent / "database" / "celupro.db",  # Desde models/
        Path(__file__).parent.parent.parent.parent / "database" / "celupro.db",  # Desde backend/
        Path.cwd() / "database" / "celupro.db",  # Desde directorio actual
    ]
    
    for path in possible_paths:
        if path.exists():
            return str(path)
    
    # Si no existe, retornar la primera opción (se creará si es necesario)
    return str(possible_paths[0])

DB_PATH = get_db_path()


def _normalize_sql_param(value):
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(value, date):
        return value.strftime('%Y-%m-%d')
    return value


def _normalize_sql_params(params):
    if isinstance(params, tuple):
        return tuple(_normalize_sql_param(value) for value in params)
    if isinstance(params, list):
        return [_normalize_sql_param(value) for value in params]
    if params is None:
        return ()
    return params

class Database:
    """Clase para gestionar conexiones a SQLite"""
    
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
    
    @contextmanager
    def get_connection(self):
        """Context manager para conexiones a la BD"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def execute_query(self, query, params=()):
        """Ejecuta una consulta SELECT"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, _normalize_sql_params(params))
            return cursor.fetchall()
    
    def execute_single(self, query, params=()):
        """Ejecuta una consulta SELECT que retorna un solo resultado"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, _normalize_sql_params(params))
            return cursor.fetchone()
    
    def execute_update(self, query, params=()):
        """Ejecuta INSERT, UPDATE o DELETE"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, _normalize_sql_params(params))
            conn.commit()
            return cursor.lastrowid
    
    def execute_many(self, query, params_list):
        """Ejecuta múltiples inserciones"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            normalized_params = [_normalize_sql_params(params) for params in params_list]
            cursor.executemany(query, normalized_params)
            conn.commit()

db = Database()
