# CELUPRO - Manual de Instalación

## Requisitos

- **Python 3.8+** instalado
- **Windows, macOS o Linux**
- Conexión a red local

## Instalación Paso a Paso

### 1. Preparar el entorno Python

```powershell
# En PowerShell (Windows)
cd "c:\Users\maoyi\OneDrive\Desktop\proyecto celupro"

# Crear un entorno virtual
python -m venv venv

# Activar el entorno virtual
.\venv\Scripts\Activate.ps1

# O si usas cmd.exe:
venv\Scripts\activate.bat
```

### 2. Instalar dependencias

```powershell
# Instalar Flask y librerías del backend
cd backend
pip install -r requirements.txt

# Volver al directorio raíz
cd ..
```

### 3. Inicializar la base de datos

```powershell
# Desde el directorio raíz del proyecto
cd backend
python -c "from database.init_db import init_db; init_db()"
```

**Usuarios por defecto después de la inicialización:**
- Usuario: `admin`
- Contraseña: `admin123`
- Rol: Administrador

### 4. Crear archivo .env (opcional)

En `backend/.env`:
```
FLASK_ENV=development
JWT_SECRET_KEY=tu-clave-secreta-aqui
```

## Ejecutar la aplicación

### Opción 1: En tu computadora local (desarrollo)

```powershell
# Terminal 1 - Backend (Puerto 5000)
cd backend
python app.py

# Terminal 2 - Frontend (Puerto 3000)
cd frontend
python server.py
```

Luego accede en tu navegador:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:5000/api

### Opción 2: Acceder desde otra computadora en la red (Recomendado)

El backend se ejecuta automáticamente en `0.0.0.0:5000` (escucha en todas las interfaces de red).

1. Obtén tu IP local:
   ```powershell
   ipconfig
   # Busca el IPv4 en tu conexión de red (ej: 192.168.1.100)
   ```

2. Desde otra computadora, accede a:
   - **Frontend:** http://192.168.1.100:3000
   - **API:** http://192.168.1.100:5000/api

> **Nota:** Reemplaza `192.168.1.100` con tu IP real

## Solución de problemas

### Puerto ya en uso
```powershell
# Ver qué proceso usa el puerto 5000
netstat -ano | findstr :5000

# Matar el proceso (reemplaza PID con el número)
taskkill /PID [PID] /F
```

### Base de datos corrupta
```powershell
# Eliminar la BD y recrearla
cd backend
Remove-Item ..\..\database\celupro.db
python -c "from database.init_db import init_db; init_db()"
```

### Errores de importación
```powershell
# Asegurar que estás en el directorio correcto
cd c:\Users\maoyi\OneDrive\Desktop\proyecto celupro\backend

# Verificar que las librerías estén instaladas
pip list
```

## Estructura de carpetas

```
proyecto celupro/
├── backend/                 # API Flask
│   ├── app.py              # Aplicación principal
│   ├── models/             # Modelos de datos
│   ├── routes/             # Rutas adicionales
│   ├── utils/              # Funciones útiles
│   ├── requirements.txt    # Dependencias
│   └── database/           # Base de datos
│       ├── init_db.py      # Inicializador
│       └── celupro.db      # SQLite
├── frontend/               # Interfaz web
│   ├── server.py           # Servidor Flask para frontend
│   ├── templates/          # HTML
│   │   ├── login.html
│   │   └── dashboard.html
│   └── static/
│       ├── css/            # Estilos
│       ├── js/             # JavaScript
│       └── logos/          # Archivos de logo
└── database/               # Datos compartidos
```

## Acceso inicial

1. Abre tu navegador y ve a `http://localhost:3000` (o tu IP)
2. Inicia sesión con:
   - **Usuario:** admin
   - **Contraseña:** admin123
3. Desde el panel de administración puedes:
   - Crear nuevos usuarios
   - Agregar marcas y modelos
   - Configurar el negocio
   - Subir tu logo

## Configuración de firewall

Si está bloqueado desde otra computadora, abre los puertos:

**Windows Defender:**
```powershell
# PowerShell como administrador
netsh advfirewall firewall add rule name="CELUPRO Backend" dir=in action=allow protocol=tcp localport=5000
netsh advfirewall firewall add rule name="CELUPRO Frontend" dir=in action=allow protocol=tcp localport=3000
```

## Notas importantes

- **No compartir credenciales** en producción
- Cambiar contraseña de admin después de instalar
- Realizar copias de seguridad regular de `celupro.db`
- La BD soporta hasta 400+ registros sin problemas
- En producción, usar un servidor WSGI (Gunicorn, uWSGI)

## Siguiente

Ver `MANUAL_EJECUCION.md` para instrucciones de uso diario.
