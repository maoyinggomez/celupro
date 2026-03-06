# Despliegue en Render (CELUPRO)

## 1) Antes de crear el servicio
- Sube el repo a GitHub.
- Verifica que estos cambios esten en `main`.

## 2) Crear servicio en Render
- Entra a Render -> New -> Blueprint.
- Selecciona este repositorio.
- Render detectara `render.yaml` y creara:
  - 1 Web Service (`celupro`)
  - 1 disco persistente (`/var/data`)

Nota:
- El repo fija Python `3.11.11` mediante `.python-version` para compatibilidad de dependencias.

## 3) Variables importantes
- `JWT_SECRET_KEY`: obligatoria, usa una clave larga (32+ chars).
- `CELUPRO_DB_PATH`: ya queda en `/var/data/celupro.db` (persistente).

## 4) Primer inicio
- El backend crea la DB automaticamente si no existe.
- URL final sera algo como: `https://celupro.onrender.com`.

## 5) Verificacion rapida
1. Abrir `/` (login)
2. Iniciar sesion
3. Probar crear un ingreso
4. Ver panel tecnico

## 6) Notas de impresion
- El print agent local debe apuntar al backend online:
  - `--base-url https://TU-SERVICIO.onrender.com/api`

## 7) Actualizaciones
- Cada `git push` a la rama conectada dispara deploy automatico.
