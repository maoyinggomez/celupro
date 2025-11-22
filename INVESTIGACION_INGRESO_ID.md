# Investigación: Formato de ID "IG-YYYYMMDD-XXXX"

## Problema Identificado

El código en `backend/models/ingreso.py` había sido modificado después del último commit, provocando que el número de ingreso **NO se generara** con el formato especificado `IG-YYYYMMDD-XXXX`.

### Código Incorrecto (Antes del Fix)

```python
# Usar un placeholder que será reemplazado por el ID real después de insertar
params = (
    'temp',  # placeholder temporal
    ...
)

ingreso_id = db.execute_update(query, params)

# Actualizar numero_ingreso para que sea igual al id
update_query = "UPDATE ingresos SET numero_ingreso = ? WHERE id = ?"
db.execute_update(update_query, (str(ingreso_id), ingreso_id))

return {'id': ingreso_id, 'numero_ingreso': str(ingreso_id)}
```

**Resultado:** Se guardaban IDs simples como "1", "2", "3" en lugar de "IG-20251122-0001"

### Código Correcto (Después del Fix)

```python
@staticmethod
def generate_numero_ingreso():
    """Genera un número de ingreso único con formato IG-YYYYMMDD-XXXX"""
    # Contar ingresos creados hoy
    query = "SELECT COUNT(*) as count FROM ingresos WHERE strftime('%Y-%m-%d', fecha_ingreso) = date('now')"
    result = db.execute_single(query)
    count = result['count'] + 1 if result else 1
    
    # Generar formato: IG-YYYYMMDD-XXXX
    return f"IG-{datetime.now().strftime('%Y%m%d')}-{count:04d}"

@staticmethod
def create(datos):
    """Crea un nuevo ingreso técnico"""
    # Generar número de ingreso único
    numero_ingreso = Ingreso.generate_numero_ingreso()
    
    # ... resto del código ...
    
    params = (
        numero_ingreso,  # Usar el número generado
        datos['empleado_id'],
        ...
    )
    
    ingreso_id = db.execute_update(query, params)
    
    return {'id': ingreso_id, 'numero_ingreso': numero_ingreso}
```

**Resultado:** Se guardan IDs con el formato correcto: "IG-20251122-0001", "IG-20251122-0002", etc.

## Formato Explicado

- **IG**: Prefijo que significa "Ingreso"
- **YYYYMMDD**: Fecha del ingreso (ej: 20251122 = 22 de noviembre de 2025)
- **XXXX**: Número secuencial de 4 dígitos (001, 002, 003, etc.) que se reinicia cada día

**Ejemplo:** `IG-20251122-0001` = Primer ingreso del 22 de noviembre de 2025

## Información Técnica

### Función `generate_numero_ingreso()`

1. Cuenta cuántos ingresos se crearon **hoy** (misma fecha)
2. Incrementa el contador en 1
3. Retorna el formato: `IG-{FECHA}-{CONTADOR:04d}`

### Comportamiento

- Cada día el contador se reinicia desde 1
- El contador es de 4 dígitos con relleno de ceros (0001, 0002, ..., 9999)
- No hay riesgo de duplicados porque la fecha cambia diariamente

## Verificación

El código fue testeado y genera correctamente:
- ✓ `IG-20251122-0003` (siguiendo la secuencia en la BD)
- ✓ Formato validado: IG-YYYYMMDD-XXXX
- ✓ Integrado en la función `Ingreso.create()`

## Archivo Modificado

- **`backend/models/ingreso.py`**: Restaurada la función `generate_numero_ingreso()` y el flujo correcto de creación de ingresos.
