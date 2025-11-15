import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

# Obtener ruta de BD de forma robusta
def get_db_path():
    """Obtiene la ruta correcta de la BD"""
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
            cursor.execute(query, params)
            return cursor.fetchall()
    
    def execute_single(self, query, params=()):
        """Ejecuta una consulta SELECT que retorna un solo resultado"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchone()
    
    def execute_update(self, query, params=()):
        """Ejecuta INSERT, UPDATE o DELETE"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.lastrowid
    
    def execute_many(self, query, params_list):
        """Ejecuta múltiples inserciones"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany(query, params_list)
            conn.commit()

db = Database()
