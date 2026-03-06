# 🔧📱 CELUPRO - Sistema de Gestión de Reparación de Celulares

## 📋 Descripción

CELUPRO es una **aplicación web completa** para gestionar talleres de reparación de celulares. Permite administrar ingresos técnicos, rastrear fallas, asignar reparaciones, generar tickets térmicos y más.

Accesible desde **cualquier navegador en red local (LAN)** con soporte multi-usuario, múltiples roles y control de permisos.

## ✨ Características principales

### 🔐 Autenticación y Roles
- ✅ Login con usuario y contraseña
- ✅ 3 roles: Administrador, Empleado, Técnico
- ✅ Permisos específicos por rol
- ✅ Sesiones seguras con JWT

### 📝 Gestión de Ingresos
- ✅ Formulario completo de ingreso técnico
- ✅ Datos del cliente (nombre, apellido, cédula, teléfono, dirección)
- ✅ Datos del equipo (marca, modelo, color)
- ✅ Estado del equipo (display, táctil, botones, apagado, clave)
- ✅ Múltiples fallas iniciales por ingreso
- ✅ Notas y observaciones
- ✅ Número de ingreso automático

### 🛠️ Panel Técnico
- ✅ Ver ingresos pendientes
- ✅ Agregar nuevas fallas encontradas
- ✅ Modificar fallas existentes
- ✅ Cambiar valor de reparación
- ✅ Actualizar estado de falla
- ✅ Agregar notas internas
- ✅ Cambiar estado del ingreso

### 📊 Registros e Historial
- ✅ Tabla completa de ingresos
- ✅ Búsqueda por cliente, cédula, número
- ✅ Filtros por estado, marca, fecha
- ✅ Ordenamiento por columnas
- ✅ Paginación
- ✅ Vista detallada de cada ingreso

### ⚙️ Administración
- ✅ **Usuarios:** CRUD de usuarios, asignar roles
- ✅ **Marcas y Modelos:** Gestión dinámica
- ✅ **Fallas:** Catálogo configurable con precios
- ✅ **Configuración:** Nombre, teléfono, email, logo

### 🖨️ Impresión Térmica
- ✅ Generación de tickets ESC/POS (58mm)
- ✅ Logo PNG personalizado
- ✅ Datos del cliente y equipo
- ✅ Fallas diagnosticadas
- ✅ Valor total
- ✅ Contacto del negocio

### 🌐 Acceso en Red Local
- ✅ Acceso desde cualquier PC en la misma red
- ✅ Múltiples usuarios simultáneos
- ✅ Responsive (desktop, tablet, móvil)
- ✅ Interfaz intuitiva con Bootstrap

## 🛠️ Stack Tecnológico

### Backend
- **Framework:** Flask (Python 3.8+)
- **BD:** SQLite (local, portable)
- **API:** REST con JWT
- **Impresión:** ESC/POS

### Frontend
- **HTML5** + **Bootstrap 5** (responsive)
- **JavaScript** vanilla (sin dependencias pesadas)
- **CSS** personalizado
- **Fetch API** para comunicación

### Base de datos
- **SQLite** (incluida, sin instalación)
- Tablas: usuarios, marcas, modelos, ingresos, fallas, notas, configuración
- Soporta 400+ registros sin problemas

## 📦 Estructura del Proyecto

```
celupro-clone/
├── backend/                    # Flask unificado (API + Frontend)
│   ├── app.py                 # Aplicación principal (API + templates/static)
│   ├── models/                # Modelos de datos
│   │   ├── user.py
│   │   ├── marca.py
│   │   ├── falla.py
│   │   ├── ingreso.py
│   │   ├── nota.py
│   │   ├── config.py
│   │   └── database.py
│   ├── utils/                 # Utilidades (impresora térmica)
│   ├── requirements.txt       # Dependencias
│   └── .env.example           # Variables de entorno de ejemplo
├── frontend/                  # Recursos del frontend (servidos por backend/app.py)
│   ├── server.py              # Legacy/dev opcional (no requerido en producción)
│   ├── templates/
│   │   ├── login.html
│   │   └── dashboard.html
│   └── static/
│       ├── css/style.css
│       ├── js/auth.js
│       └── js/app.js
├── database/                  # Base de datos
│   ├── init_db.py
│   ├── celupro.db             # SQLite (se crea automático)
│   └── SCHEMA.sql
├── scripts/                   # Scripts auxiliares
│   ├── maintenance/           # Utilidades manuales de config/soporte
│   └── manual_tests/          # Pruebas manuales por API
├── .venv/                     # Entorno virtual Python
├── uv.lock                    # Lock de dependencias
├── render.yaml                # Configuracion de despliegue para Render
├── DEPLOY_RENDER.md           # Guia corta de publicacion en Render
└── README.md                  # Este archivo
```

## 🚀 Inicio Rápido

### Requisitos
- Python 3.9+
- Windows, macOS o Linux
- Conexión de red local

### Instalación (Primera vez)

```bash
# 1. Instala dependencias del backend
cd backend
pip install -r requirements.txt
cd ..

# 2. Inicia un solo servidor
cd backend
python3 app.py
```

### Acceso
- **Local:** http://127.0.0.1:5001
- **Red Local:** http://[TU_IP]:5001

> ℹ️ La base de datos se crea automáticamente en el primer inicio.

## ☁️ Publicar en Render

Para desplegar en hosting usa la guia:

- `DEPLOY_RENDER.md`

Incluye un `render.yaml` listo para crear servicio web + disco persistente.

## 🔐 Variables recomendadas para producción

Antes de desplegar, crea `backend/.env` basado en `backend/.env.example` y ajusta como mínimo:

- `JWT_SECRET_KEY`: usa una clave única y aleatoria de **32+ caracteres**.
- `JWT_ACCESS_TOKEN_HOURS`: reduce duración del token según tu operación (por ejemplo, `8` o `12`).
- `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `LOGIN_ATTEMPT_WINDOW_MINUTES`: define tu política de bloqueo.
- `AUDIT_LOG_RETENTION_DAYS`: define cuántos días conservar auditoría (ej. `180`).
- `AUDIT_RETENTION_CLEANUP_INTERVAL_MINUTES`: frecuencia de limpieza automática (ej. `60`).

Checklist rápido:

1. Nunca subir `backend/.env` al repositorio.
2. Rotar `JWT_SECRET_KEY` cuando haya sospecha de exposición.
3. Verificar periódicamente lockouts activos y eventos críticos en Admin.
4. Ejecutar `bash scripts/maintenance/quality_check.sh` antes de liberar cambios.

Para generar un `JWT_SECRET_KEY` robusto:

```bash
python3 scripts/maintenance/generate_jwt_secret.py
```

Para actualizar automáticamente `backend/.env` (crea backup del archivo si existe):

```bash
python3 scripts/maintenance/generate_jwt_secret.py --update-env backend/.env
```

En modo no interactivo (por ejemplo CI), confirma con:

```bash
python3 scripts/maintenance/generate_jwt_secret.py --update-env backend/.env --yes
```

## 📖 Documentación

- **Este README** - Guía completa del proyecto
- **backend/requirements.txt** - Dependencias instaladas
- **database/SCHEMA.sql** - Estructura de la base de datos

## 🧰 Scripts auxiliares

Desde la raíz del proyecto (`celupro-clone/`):

```bash
# Mantenimiento
python3 scripts/maintenance/check_config.py
python3 scripts/maintenance/debug_config.py
python3 scripts/maintenance/reset_config.py
python3 scripts/maintenance/generate_jwt_secret.py
bash scripts/maintenance/post_deploy_check.sh

# Calidad (smoke tests automáticos backend)
bash scripts/maintenance/quality_check.sh

# Pruebas manuales por API
python3 scripts/manual_tests/test_simple.py
python3 scripts/manual_tests/test_config_get.py
python3 scripts/manual_tests/test_full_flow.py
python3 scripts/manual_tests/test_ticket_config.py
```

Chequeo rápido post-despliegue (backend arriba y credenciales válidas):

```bash
bash scripts/maintenance/post_deploy_check.sh \
    --base-url http://127.0.0.1:5001/api \
    --user admin \
    --password admin123
```

### 🚨 Runbook rápido de incidentes (warning / critical)

Si el semáforo operativo pasa a `warning` o `critical`:

1. Ejecuta primero el chequeo automático:

```bash
bash scripts/maintenance/post_deploy_check.sh
```

2. Revisa en Admin → Auditoría:
- eventos `denied` y `error` de las últimas 24h,
- IP/rol y acción afectada.

3. Revisa en Admin → Impresión:
- cola `pending_old` y `stale_processing`,
- workers online/offline.

4. Si hay degradación sostenida:
- genera backup antes de cambios,
- reinicia backend y vuelve a ejecutar post-deploy check,
- si persiste, conserva evidencia (hora, endpoint, error) y escala.

### ✅ Control de calidad recomendado antes de `git push`

Este comando ejecuta pruebas automáticas de humo del backend sobre una base SQLite temporal aislada (no toca la BD real):

```bash
bash scripts/maintenance/quality_check.sh
```

Actualmente valida, entre otros:
- login/autorización básica,
- creación de ingreso con `IMEI no visible`,
- rechazo de IMEI inválido (más de 2),
- permisos de `empleado` para actualizar estado de ingreso.

### 🔐 Retención automática de auditoría

La tabla `audit_logs` ahora tiene limpieza automática para no crecer indefinidamente.

Variables opcionales de entorno:

- `AUDIT_LOG_RETENTION_DAYS` (por defecto: `180`): días a conservar en auditoría.
- `AUDIT_RETENTION_CLEANUP_INTERVAL_MINUTES` (por defecto: `60`): frecuencia mínima de limpieza automática.

Si defines `AUDIT_LOG_RETENTION_DAYS=0`, se desactiva la limpieza automática.

### 🖨️ Impresión remota automática (gratis)

Para imprimir en la impresora del local desde cualquier dispositivo:

1. Deja la app unificada corriendo (`backend/app.py`).
2. En el **PC del local** (con la impresora conectada), ejecuta el agente:

```bash
cd /ruta/celupro-clone
python3 scripts/maintenance/print_agent.py \
    --base-url http://127.0.0.1:5001/api \
    --usuario admin \
    --password admin123 \
    --printer "NOMBRE_IMPRESORA"
```

Notas:
- Si omites `--printer`, usa la impresora predeterminada del sistema.
- En Windows para impresión RAW instala: `pip install pywin32`.
- El agente toma trabajos de la cola y los imprime al instante en el local.
- Desde la app, al presionar imprimir, se envía a cola remota automáticamente.

### Sin previsualización en navegador (modo silencioso)

Si usas el modo de impresión desde navegador (sin agente), **JavaScript no puede ocultar el cuadro de impresión por sí solo**.
Para impresión directa debes abrir el navegador del PC local con `--kiosk-printing`:

- macOS (Chrome):

```bash
open -a "Google Chrome" --args --kiosk-printing --app="http://127.0.0.1:5001"
```

- Windows (Chrome):

```bat
start chrome --kiosk-printing --app="http://127.0.0.1:5001"
```

Luego, en Admin → Impresión:
- activa `Imprimir de una vez (sin previsualización, requiere kiosk)`
- pulsa `Guardar configuración`
- deja `Modo impresora del local` en `Activar`

### Windows local (recomendado): impresión directa automática sin tocar el navegador

Si el PC del local es Windows, usa el agente como tarea programada de inicio de sesión (una sola vez):

1) En el PC Windows abre PowerShell dentro de la carpeta del proyecto.

2) Ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\maintenance\install_print_agent_windows.ps1 \
    -ApiUrl "http://127.0.0.1:5001/api" \
    -Usuario "admin" \
    -Password "admin123" \
    -Printer "NOMBRE_IMPRESORA"
```

O más simple (doble clic, sin comandos):

- Ejecuta `scripts/maintenance/install_print_agent_windows.bat`

3) En Admin → Impresión deja `Imprimir inmediatamente en impresora del local (cola)`.

Con esto ya no depende de la previsualización del navegador y no tendrás que configurarlo cada rato.

Para desinstalar:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\maintenance\uninstall_print_agent_windows.ps1
```

También disponible por doble clic:

- `scripts/maintenance/uninstall_print_agent_windows.bat`

### Sin instalar nada en el PC del local (impresora en red)

Si la impresora térmica tiene IP de red (Ethernet/WiFi), puedes imprimir automático sin instalar agente en Windows:

1) En Admin → Impresión:
- `Modo al imprimir ticket`: `Imprimir inmediatamente en impresora del local (cola)`
- `Impresión automática por red (sin PC local)`: `Sí`
- `IP impresora de red`: ejemplo `192.168.1.50`
- `Puerto`: `9100` (normalmente)
- Guardar configuración

2) Deja backend corriendo. El backend consume la cola y envía ESC/POS directo a la impresora.

Nota: este modo no depende del navegador ni muestra previsualización.

## 🗺️ Flujos principales

### Crear ingreso (Empleado)
1. Click "Nuevo Ingreso"
2. Completa datos del cliente
3. Selecciona marca y modelo
4. Marca estado del equipo
5. Selecciona fallas iniciales
6. Anota observaciones
7. Crea el ingreso ✓

### Procesar reparación (Técnico)
1. Ve "Panel Técnico"
2. Selecciona ingreso pendiente
3. Agrega/modifica fallas
4. Cambia valores de reparación
5. Marca fallas como reparadas
6. Actualiza estado a "reparado"
7. Imprime ticket

### Entregar (Cualquiera)
1. En registros, localiza ingreso
2. Ve detalles
3. Verifica estado "reparado"
4. Cambia a "entregado"
5. Cliente retira ✓

## 🔒 Seguridad

- ✅ Contraseñas hasheadas (Werkzeug)
- ✅ JWT para sesiones
- ✅ Validación de roles en backend
- ✅ CORS configurado
- ✅ Input sanitization en BD

## 📊 Estadísticas y Capacidad

| Métrica | Valor |
|---------|-------|
| Usuarios | Sin límite |
| Ingresos | 400+ sin problemas |
| Fallas por ingreso | Sin límite |
| Usuarios simultáneos | Depende del servidor |
| Almacenamiento | <10MB por 400 registros |

## 🎯 Casos de uso típicos

### Pequeño taller (1-3 técnicos)
- ✅ Perfecto - uso local
- ✅ Admin en laptop
- ✅ Técnicos en otras PCs

### Taller mediano (4-10 técnicos)
- ✅ Múltiples empleados ingresando
- ✅ Múltiples técnicos en panel
- ✅ Admin supervisando

### Franquicia (varias sucursales)
- ✅ Desplegar en servidor central
- ✅ Acceso desde múltiples oficinas
- ⚠️ Requiere ajustes en producción

## 🔄 Workflow típico de datos

```
Cliente arriba
    ↓
Empleado crea ingreso (datos + fallas iniciales)
    ↓
Ingreso en estado "pendiente"
    ↓
Técnico asigna y modifica fallas
    ↓
Cambia estado a "en_reparacion"
    ↓
Completa reparación
    ↓
Estado "reparado"
    ↓
Imprime ticket
    ↓
Cliente retira
    ↓
Estado "entregado" ✓
```

## 🐛 Troubleshooting

### Puerto en uso (macOS/Linux)
```bash
# Ver qué está usando el puerto
lsof -i :5001

# Matar el proceso
kill -9 [PID]
```

### Base de datos corrupta
```bash
# Eliminar y recrear
rm database/celupro.db
cd backend && python3 app.py  # Se recrea automáticamente
```

### Módulos no encontrados
```bash
cd backend
pip install -r requirements.txt
```

## ✅ Go-Live y Operación (P6)

### Checklist de salida a producción (10 puntos)

1. `backend/.env` creado y fuera de Git.
2. `JWT_SECRET_KEY` rotado con `generate_jwt_secret.py` (32+ caracteres).
3. `JWT_ACCESS_TOKEN_HOURS` ajustado a operación real (`8-12` recomendado).
4. Política de lockout validada (`LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `LOGIN_ATTEMPT_WINDOW_MINUTES`).
5. Retención de auditoría definida (`AUDIT_LOG_RETENTION_DAYS`).
6. Impresión validada (agente local o impresora en red).
7. Respaldos verificados (crear y descargar backup en Admin).
8. `bash scripts/maintenance/quality_check.sh` en verde.
9. `bash scripts/maintenance/post_deploy_check.sh` en verde.
10. Revisión final de Admin → Auditoría y Dashboard semáforo sin alertas críticas persistentes.

### Rutina semanal recomendada (15-20 min)

- Revisar críticos 24h (`denied` / `error`) en Admin → Auditoría.
- Revisar cola de impresión (`pending_old`, `stale_processing`, `error`).
- Revisar lockouts activos y fallos de login recientes.
- Generar backup y validar descarga.

### Contingencia rápida

1. Si hay degradación (`warning/critical` sostenido), ejecutar `post_deploy_check.sh`.
2. Si falla impresión, validar workers online y cola antes de reiniciar servicios.
3. Antes de cambios correctivos, generar backup.
4. Aplicar corrección, reiniciar backend y repetir post-deploy check.
5. Registrar hora, síntoma y acción tomada en la bitácora interna.

## 📋 Próximas mejoras (Roadmap)

- [ ] Reportes en PDF
- [ ] Gráficas de estadísticas
- [ ] SMS/Email de notificaciones
- [ ] Backup automático
- [ ] Sincronización multi-sucursal
- [ ] App móvil nativa
- [ ] Pagos online integrados

## 👥 Roles y permisos

| Función | Admin | Empleado | Técnico |
|---------|:-----:|:--------:|:-------:|
| Dashboard | ✓ | | ✓ |
| Crear ingreso | ✓ | ✓ | |
| Ver registros | ✓ | ✓ | ✓ |
| Panel técnico | ✓ | | ✓ |
| Modificar fallas | ✓ | | ✓ |
| Gestión usuarios | ✓ | | |
| Gestión marcas | ✓ | | |
| Configuración | ✓ | | |

## 📞 Contacto y Soporte

Para issues o preguntas:
1. Revisa [INSTALACION.md](INSTALACION.md)
2. Revisa [MANUAL_EJECUCION.md](MANUAL_EJECUCION.md)
3. Verifica logs en terminal del servidor

## 📄 Licencia

Proyecto privado - Derechos reservados

## 🙏 Créditos

Desarrollado con:
- Flask
- Bootstrap 5
- SQLite
- Werkzeug

---
2.0  
**Última actualización:** Febrero 2026  
**Estado:** ✅ En desarrollo activo
**¿Necesitas ayuda?** Consulta los manuales incluidos o contacta al administrador del sistema.
