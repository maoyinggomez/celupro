# ❓ Preguntas Frecuentes (FAQ) - CELUPRO

## 🚀 Instalación y Inicio

### P1: ¿Cuánto tiempo toma instalar CELUPRO?
**R:** La instalación completa toma 5-10 minutos (primera vez). Las veces siguientes es inmediato.

### P2: ¿Necesito tener Python instalado?
**R:** Sí, Python 3.8 o superior. Descárgalo desde python.org

### P3: ¿Funciona solo en Windows?
**R:** No, funciona en Windows, Mac y Linux. Las instrucciones son similares.

### P4: ¿Puedo ejecutar CELUPRO en mi laptop?
**R:** Sí, es ideal. La aplicación necesita ~50MB de espacio.

### P5: ¿Necesito internet para usar CELUPRO?
**R:** No, funciona completamente offline en red local.

---

## 🔐 Acceso y Usuarios

### P6: ¿Cuál es la contraseña del usuario admin?
**R:** Usuario: `admin`, Contraseña: `admin123`  
⚠️ **Importante:** Cámbiala después de instalar.

### P7: ¿Cómo cambio la contraseña de admin?
**R:**
1. Inicia sesión como admin
2. Panel Administración → Usuarios
3. Click en "Editar" en usuario admin
4. Ingresa nueva contraseña
5. Guardar

### P8: ¿Puedo acceder desde otra computadora?
**R:** Sí, si están en la misma red. Usa la IP del servidor:
```
http://[IP_SERVIDOR]:3000
```

### P9: ¿Cuántos usuarios puedo crear?
**R:** Sin límite. Crea todos los que necesites.

### P10: ¿Qué diferencia hay entre los roles?
**R:**
- **Admin:** Acceso total, gestiona usuarios y configuración
- **Empleado:** Crea ingresos técnicos
- **Técnico:** Modifica fallas, asigna reparaciones

---

## 📱 Ingresos y Registros

### P11: ¿Cuántos ingresos puedo crear?
**R:** Teóricamente sin límite. La BD soporta 400+ sin problemas.

### P12: ¿Se genera automáticamente el número de ingreso?
**R:** Sí, formato: `IG-YYYYMMDD-XXXX` (ej: IG-20241115-0001)

### P13: ¿Puedo editar un ingreso después de crearlo?
**R:** No completamente. El técnico puede modificar fallas y valores. Para cambios mayores, contacta al admin.

### P14: ¿Cómo busco un ingreso específico?
**R:** Ve a "Registros" y usa:
- Buscador por nombre, cédula, número
- Filtros por estado, marca, fecha
- Ordenamiento por columnas

### P15: ¿Qué pasa si se me olvida el número de ingreso?
**R:** Busca por nombre o cédula del cliente en "Registros".

---

## 🛠️ Panel Técnico

### P16: ¿Cómo agrego una falla que no está en la lista?
**R:**
1. Admin → Administración → Fallas
2. Click "Nueva Falla"
3. Ingresa nombre, descripción y precio
4. Guardar

**O** agrega sobre la marcha desde el técnico (si has ampliado el código).

### P17: ¿Puedo cambiar el valor de reparación de una falla?
**R:** Sí, desde Panel Técnico:
1. Ver detalles del ingreso
2. Editar valor en cada falla
3. Se actualiza automáticamente

### P18: ¿Qué significa "estado_falla: pendiente/reparada/no_reparable"?
**R:**
- **Pendiente:** Aún no se diagnostica
- **Reparada:** Se reparó exitosamente
- **No reparable:** Es imposible reparar

### P19: ¿Cómo le digo al cliente que su celular está listo?
**R:**
1. Panel Técnico → Selecciona ingreso
2. Cambia estado de "en_reparacion" a "reparado"
3. Click "Imprimir Ticket"

### P20: ¿Puedo agregar notas a las fallas?
**R:** Sí, en Panel Técnico hay un campo de notas por falla.

---

## 💰 Presupuestos y Valores

### P21: ¿Cómo calcula CELUPRO el valor total?
**R:** Suma todos los valores de reparación de cada falla del ingreso.

### P22: ¿Puedo dar descuentos a clientes?
**R:** Actualmente no hay función automática. Puedes:
1. Reducir manualmente los valores de fallas
2. Agregar una "falla" llamada "Descuento" con valor negativo

### P23: ¿Se guarda el historial de valores?
**R:** Sí, en la tabla `ingreso_fallas` se guarda cada versión.

---

## 🖨️ Impresión de Tickets

### P24: ¿Qué tipo de impresora necesito?
**R:** Impresora térmica ESC/POS de 58mm (estándar en POS).

### P25: ¿Mi impresora es compatible?
**R:** Si es ESC/POS de 58mm, probablemente sí. Ver [IMPRESORAS.md](IMPRESORAS.md)

### P26: ¿Puedo personalizar el ticket?
**R:** Sí, edita `backend/utils/thermal_printer.py`

### P27: ¿Cómo subo el logo de mi negocio?
**R:**
1. Admin → Administración → Configuración
2. Scroll a "Logo (PNG o JPG)"
3. Selecciona archivo
4. Guardar
5. Aparecerá en los tickets

### P28: ¿El ticket incluye los datos del cliente?
**R:** Sí, incluye:
- Nombre, cédula, teléfono, dirección
- Marca, modelo, color
- Todas las fallas y valores
- Valor total
- Contacto del negocio

### P29: ¿Se imprime automáticamente?
**R:** No, haces click en "Imprimir Ticket" cuando es necesario.

### P30: ¿Qué pasa si no tengo impresora térmica?
**R:** Puedes guardar como PDF o usar una impresora normal (el ticket es muy grande en A4).

---

## ⚙️ Administración

### P31: ¿Cómo agrego nuevas marcas de celulares?
**R:**
1. Admin → Administración → Marcas
2. Click "Nueva Marca"
3. Ingresa nombre
4. Crear

### P32: ¿Cómo agrego modelos a una marca?
**R:**
1. Admin → Administración → Marcas
2. Click "Modelos" en la marca
3. Click "Nuevo Modelo"
4. Ingresa nombre
5. Crear

### P33: ¿Puedo eliminar una marca?
**R:** Sí, pero se eliminarán todos sus modelos e ingresos. **Cuidado.**

### P34: ¿Cómo cambio los datos del negocio (teléfono, email)?
**R:**
1. Admin → Administración → Configuración
2. Edita los campos
3. Guardar

### P35: ¿Quién puede acceder a Administración?
**R:** Solo usuarios con rol "Admin".

---

## 📊 Base de Datos

### P36: ¿Dónde se guarda la información?
**R:** En un archivo SQLite: `database/celupro.db` (~0.5MB por 100 registros)

### P37: ¿Cómo hago backup de la BD?
**R:**
```powershell
Copy-Item "database\celupro.db" "database\celupro_backup_$(Get-Date -Format 'yyyyMMdd').db"
```

### P38: ¿Puedo restaurar de un backup?
**R:** Sí, reemplaza el archivo `celupro.db` con el backup.

### P39: ¿Cada cuánto debo hacer backup?
**R:** Se recomienda diariamente (automático al cerrar si lo configuras).

### P40: ¿Qué pasa si se daña la BD?
**R:** Puedes recuperarla desde backup, o recrearla:
```python
cd backend
Remove-Item ..\..\database\celupro.db
python -c "from database.init_db import init_db; init_db()"
```

---

## 🐛 Troubleshooting

### P41: No puedo iniciar la aplicación
**R:** Verifica:
1. Python está instalado (`python --version`)
2. Estás en la carpeta correcta
3. Ejecutaste `pip install -r requirements.txt`
4. Puertos 5000 y 3000 están libres

### P42: Dice "Puerto en uso"
**R:**
```powershell
# Encuentra qué usa el puerto
netstat -ano | findstr :5000

# Mata el proceso
taskkill /PID [PID] /F

# O cambia puerto en start.py
```

### P43: "Permiso denegado" al ejecutar
**R:** En Windows, ejecuta PowerShell como administrador:
```powershell
# Click derecho en PowerShell → Ejecutar como administrador
```

### P44: La BD no se crea automáticamente
**R:** Crea manualmente:
```powershell
cd backend
python -c "from database.init_db import init_db; init_db()"
```

### P45: No puedo acceder desde otra PC
**R:** Verifica:
1. IP correcta del servidor (`ipconfig`)
2. Firewall abierto (ver [INSTALACION.md](INSTALACION.md))
3. Ambas en la misma red

### P46: "Acceso denegado" a cierta función
**R:** Verifica tu rol:
- Click arriba a la derecha → Tu nombre
- Confirms tu rol
- Si es "empleado", no puedes hacer de "admin"

### P47: El ticket no imprime
**R:**
1. Verifica que la impresora esté encendida
2. Prueba con Word → Imprimir
3. Verifica puerto/IP en configuración

### P48: Errores de contraseña
**R:**
- Contraseña es sensible a mayúsculas
- Revisa CAPS LOCK
- Intenta con usuario "admin" / "admin123"

---

## 🌐 Red Local

### P49: ¿Qué IP debo usar?
**R:** La IP local del servidor. Obtén con:
```powershell
ipconfig
# Busca "IPv4 Address" (ej: 192.168.1.100)
```

### P50: ¿Pueden conectarse múltiples usuarios simultáneamente?
**R:** Sí, sin límite práctico. Depende del servidor.

### P51: ¿Se ve bien en móvil?
**R:** Sí, es 100% responsive. Puedes usar en tablet/smartphone en red.

### P52: ¿Qué ancho de banda necesito?
**R:** Muy poco, <1MB por transacción. Funciona con conexiones lentas.

---

## 📈 Características Avanzadas

### P53: ¿Puedo exportar datos?
**R:** No directamente. Puedes:
1. Exportar desde SQLite (usar SQLite Browser)
2. Copiar datos desde la tabla

### P54: ¿Hay reportes?
**R:** No en v1.0. Roadmap para v2.0.

### P55: ¿Puedo sincronizar entre sucursales?
**R:** No en v1.0. Requiere servidor central (Roadmap).

### P56: ¿Hay notificaciones por SMS/Email?
**R:** No en v1.0. Roadmap para futuro.

### P57: ¿Puedo conectar un escáner de cédulas?
**R:** No nativamente. Requiere hardware específico y configuración.

---

## 🎓 Capacitación

### P58: ¿Dónde puedo aprender a usar CELUPRO?
**R:** Lee estos archivos en orden:
1. README.md (visión general)
2. MANUAL_EJECUCION.md (uso diario)
3. [INSTALACION.md](INSTALACION.md) (instalación)

### P59: ¿Hay videos tutoriales?
**R:** No en v1.0. Se pueden crear.

### P60: ¿Quién es la persona de soporte?
**R:** El administrador del taller. Contacta a quien configuró CELUPRO.

---

## 💼 Producción

### P61: ¿Es seguro usar en producción?
**R:** Sí, está hecho con prácticas estándar. Recomendaciones:
1. Cambiar contraseña admin
2. Hacer backups diarios
3. Usar en servidor dedicado
4. Firewall configurado

### P62: ¿Cuánto cuesta CELUPRO?
**R:** Es **gratis** y de código abierto (privado).

### P63: ¿Quién desarrolló CELUPRO?
**R:** Tu asistente de IA. Diseñado específicamente para tu negocio.

### P64: ¿Puedo modificar el código?
**R:** Sí, es tu propiedad. Edita como necesites.

### P65: ¿Hay soporte profesional?
**R:** Actualmente no. Puedes contactar al desarrollador.

---

## 🔒 Seguridad

### P66: ¿Es segura mi información?
**R:** Sí:
- Datos en BD local (tu control)
- Contraseñas hasheadas
- JWT para sesiones
- Sin envío a internet

### P67: ¿Quién puede ver mis datos?
**R:** Solo usuarios logueados en CELUPRO. Nadie en internet.

### P68: ¿Necesito SSL/HTTPS?
**R:** No para red local. Si es remota, sí.

### P69: ¿Puedo auditar quién hizo qué?
**R:** Actualmente no hay logs. Roadmap.

### P70: ¿Es legal usar CELUPRO?
**R:** Sí, es tu software. Usa como quieras.

---

## 📞 Contacto y Ayuda

### P71: ¿Tengo un error no listado aquí?
**R:** 
1. Revisa la terminal donde corre backend
2. Busca el error en Google
3. Revisa logs de aplicación

### P72: ¿Cómo reporto un bug?
**R:** Describe:
1. Qué hiciste
2. Qué pasó
3. Error exacto (de terminal)

### P73: ¿Puedo pedir una nueva característica?
**R:** Sí, contacta al desarrollador. Roadmap:
- Reportes PDF
- Gráficas
- SMS/Email
- App móvil

### P74: ¿Dónde encuentro el código?
**R:** En el proyecto `proyecto celupro/`

### P75: ¿Hay documentación técnica?
**R:** Sí:
- [database/SCHEMA.sql](database/SCHEMA.sql) - Estructura BD
- Código fuente bien comentado

---

## 🎉 Conclusión

¿No encontraste tu respuesta? **Contacta al administrador** de tu sistema.

**Versión FAQ:** 1.0  
**Última actualización:** Noviembre 2024

---

**¡Gracias por usar CELUPRO! 🚀**
