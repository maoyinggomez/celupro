# CELUPRO - Manual de Ejecución

## Inicio rápido (Cada día)

### 1. Activar el entorno

```powershell
# En PowerShell
cd "c:\Users\maoyi\OneDrive\Desktop\proyecto celupro"
.\venv\Scripts\Activate.ps1
```

### 2. Iniciar los servidores

**Opción A: Dos terminales separadas**

Terminal 1 (Backend - Puerto 5000):
```powershell
cd backend
python app.py
```

Terminal 2 (Frontend - Puerto 3000):
```powershell
cd frontend
python server.py
```

**Opción B: Una sola terminal**

```powershell
# Backend en background
cd backend
Start-Process python "app.py"

# Frontend en nueva ventana
cd ..\frontend
python server.py
```

### 3. Acceder a la aplicación

- **URL Local:** http://localhost:3000
- **Desde otra PC:** http://[TU_IP]:3000
- **API:** http://localhost:5000/api

## Pantallas principales

### Login
- Ingresa usuario y contraseña
- Usuario por defecto: **admin** / **admin123**

### Dashboard (Admin)
- Vista general de estadísticas
- Ingresos recientes
- Accesos rápidos a todas las funciones

### Nuevo Ingreso (Empleado)
1. Ingresa datos del cliente
2. Selecciona marca y modelo
3. Marca el estado del equipo
4. Selecciona fallas iniciales
5. Agrega notas
6. Crea el ingreso

### Panel Técnico (Técnico)
- Ver ingresos pendientes
- Agregar/modificar fallas
- Cambiar valores de reparación
- Actualizar estado del ingreso
- Generar ticket de impresión

### Registros
- Tabla completa de todos los ingresos
- Búsqueda por cliente/cédula/número
- Filtros por estado, marca, fecha
- Paginación
- Botón para ver detalles

### Administración (Admin)

#### Usuarios
- Crear nuevo usuario
- Asignar rol (admin, empleado, técnico)
- Editar datos
- Desactivar usuario

#### Marcas y Modelos
- Agregar nuevas marcas de celulares
- Gestionar modelos por marca
- Editar y eliminar

#### Fallas
- Ver catálogo completo de fallas
- Agregar nuevas fallas
- Definir precio sugerido

#### Configuración
- Nombre del negocio
- Teléfono
- Email
- **Subir logo PNG** para tickets

## Flujo de trabajo típico

### Escenario: Cliente trae celular para reparar

1. **Empleado:**
   - Click en "Nuevo Ingreso"
   - Llena datos del cliente
   - Selecciona marca, modelo, color
   - Marca estado del equipo
   - Selecciona fallas detectadas inicialmente
   - Anota observaciones
   - **Crea el ingreso** → Se genera número único

2. **Técnico:**
   - Entra a "Panel Técnico"
   - Ve ingreso pendiente
   - Click en "Ver Detalles"
   - Puede:
     - Agregar más fallas encontradas
     - Cambiar valor de cada falla
     - Cambiar estado de falla (reparada/no reparable)
     - Agregar notas internas
     - Cambiar estado del ingreso (en_reparacion → reparado)

3. **Cliente retira:**
   - Técnico cambia estado a "entregado"
   - Click en "Imprimir Ticket"
   - Sale ticket térmico con:
     - Datos del cliente
     - Equipo y fallas
     - Valor total
     - Datos del negocio

## Teclados y atajos

### En formularios
- `Tab` - Siguiente campo
- `Shift+Tab` - Campo anterior
- `Enter` - Enviar formulario

### En tablas
- Click en encabezado - Ordena por columna
- Búsqueda - Filtra en tiempo real
- "Ver" - Abre detalles

## Datos importantes

### Estados del ingreso
- **Pendiente** - Recién creado
- **En reparación** - Asignado a técnico
- **Reparado** - Listo para entregar
- **Entregado** - Cliente ya retiró
- **Cancelado** - Sin reparar

### Estados de falla
- **Pendiente** - Sin diagnosticar
- **Reparada** - Se reparó exitosamente
- **No reparable** - Imposible reparar

### Roles y permisos

| Acción | Admin | Empleado | Técnico |
|--------|-------|----------|---------|
| Ver dashboard | ✓ | | ✓ |
| Crear ingreso | ✓ | ✓ | |
| Ver registros | ✓ | ✓ | ✓ |
| Panel técnico | ✓ | | ✓ |
| Modificar fallas | ✓ | | ✓ |
| Administración | ✓ | | |
| Crear usuarios | ✓ | | |
| Editar configuración | ✓ | | |

## Búsqueda y filtros

### Buscar ingresos
- Por nombre cliente
- Por apellido
- Por número de cédula
- Por número de ingreso
- Por estado
- Por rango de fechas
- Por marca

### Tabla de registros
- Clickea encabezado para ordenar
- Filtro de estado (dropdown)
- Buscador en tiempo real
- Paginación: 20 ingresos por página

## Impresión de ticket

1. En detalles del ingreso
2. Click "Imprimir Ticket"
3. Impresora térmica recibe comando ESC/POS
4. Ticket de 58mm imprime automáticamente

**Requiere:** Impresora USB o red compatible con ESC/POS

## Backup de datos

### Manual
```powershell
# Copiar base de datos
Copy-Item "database\celupro.db" "database\celupro_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').db"
```

### Automatizado
Usa una tarea programada de Windows para backup diario.

## Detenerse

```powershell
# Ctrl+C en cada terminal para detener

# O cerrar ventanas directamente
```

## Reiniciar

Si algo falla:
```powershell
# 1. Detener ambos servidores
# 2. Activar entorno virtual nuevamente
.\venv\Scripts\Activate.ps1

# 3. Iniciar servidores
cd backend && python app.py
# En otra terminal
cd frontend && python server.py
```

## Cambiar contraseña de admin

1. Entra como admin
2. Ve a Administración → Usuarios
3. Busca "admin"
4. Click Editar
5. Ingresa nueva contraseña
6. Guarda

## Crear nuevos usuarios

1. Admin → Administración → Usuarios
2. Click "Nuevo Usuario"
3. Completa:
   - Usuario
   - Contraseña
   - Nombre
   - Rol (admin/empleado/técnico)
4. Crear

## Agregar marcas

1. Admin → Administración → Marcas
2. Click "Nueva Marca"
3. Ingresa nombre
4. Crear

### Agregar modelos a marca

1. En lista de marcas
2. Click "Modelos" en la marca
3. Click "Nuevo Modelo"
4. Ingresa nombre
5. Crear

## Subir logo del negocio

1. Admin → Administración → Configuración
2. Selecciona archivo PNG o JPG
3. Guarda
4. Logo aparecerá en tickets impresos

## Monitoreo

### Ver si servidores están corriendo
```powershell
# Backend
curl http://localhost:5000/api/auth/login -Method POST

# Frontend
curl http://localhost:3000
```

### Logs
- Backend: Se muestra en la terminal donde ejecuta
- Frontend: Se muestra en la terminal donde ejecuta

## Contacto y soporte

Para problemas específicos, revisa `INSTALACION.md` en sección "Solución de problemas".

---

**Versión:** 1.0  
**Última actualización:** 2024
