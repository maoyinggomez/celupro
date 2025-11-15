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

## 📦 Entregables

```
proyecto celupro/
├── backend/                    # API Flask
│   ├── app.py                 # Aplicación principal
│   ├── models/                # Modelos de datos
│   ├── utils/                 # Utilidades (impresora térmica)
│   ├── requirements.txt       # Dependencias
│   └── database/
│       ├── init_db.py         # Inicializador BD
│       └── celupro.db         # SQLite (se crea automático)
├── frontend/                  # Interfaz web
│   ├── server.py              # Servidor Flask
│   ├── templates/
│   │   ├── login.html
│   │   └── dashboard.html
│   └── static/
│       ├── css/style.css
│       ├── js/auth.js
│       ├── js/app.js
│       └── logos/             # Carpeta para logo
├── database/                  # Compartido
├── start.py                   # Script para iniciar todo
├── INSTALACION.md             # Manual de instalación
├── MANUAL_EJECUCION.md        # Manual de uso diario
└── README.md                  # Este archivo
```

## 🚀 Inicio Rápido

### Requisitos
- Python 3.8+
- Windows, macOS o Linux
- Conexión de red local

### Instalación (Primera vez)

```bash
# 1. Accede a la carpeta del proyecto
cd "c:\Users\maoyi\OneDrive\Desktop\proyecto celupro"

# 2. Crea entorno virtual
python -m venv venv

# 3. Activa el entorno (Windows)
.\venv\Scripts\Activate.ps1

# 4. Instala dependencias del backend
cd backend
pip install -r requirements.txt
cd ..

# 5. Inicializa base de datos
cd backend
python -c "from database.init_db import init_db; init_db()"
```

### Ejecución (Cada día)

**Opción A: Automático (Recomendado)**
```bash
python start.py
```

**Opción B: Manual**
```bash
# Terminal 1
cd backend
python app.py

# Terminal 2
cd frontend
python server.py
```

### Acceso
- **Local:** http://localhost:3000
- **Red Local:** http://[TU_IP]:3000
- **Usuario:** admin
- **Contraseña:** admin123

## 📖 Documentación

- **[INSTALACION.md](INSTALACION.md)** - Instalación detallada
- **[MANUAL_EJECUCION.md](MANUAL_EJECUCION.md)** - Uso diario y funcionalidades

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

### Puerto en uso
```powershell
netstat -ano | findstr :5000
taskkill /PID [PID] /F
```

### Base de datos corrupta
```powershell
cd backend
Remove-Item ..\..\database\celupro.db
python -c "from database.init_db import init_db; init_db()"
```

### Permisos de firewall
```powershell
# PowerShell como admin
netsh advfirewall firewall add rule name="CELUPRO" dir=in action=allow protocol=tcp localport=5000
```

Ver **[INSTALACION.md](INSTALACION.md)** para más detalles.

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

**Versión:** 1.0  
**Última actualización:** Noviembre 2024  
**Estado:** ✅ Listo para uso

**¿Necesitas ayuda?** Consulta los manuales incluidos o contacta al administrador del sistema.
