# Guía de Impresoras Térmicas ESC/POS

## Configuración de Impresoras Soportadas

CELUPRO genera comandos **ESC/POS** para impresoras térmicas de **58mm** (estándar en talleres).

### Impresoras Compatibles

| Marca | Modelo | Estado |
|-------|--------|--------|
| Epson | TM-T20, TM-T88 | ✅ Probada |
| Star Micronics | SM-S220i, SM-L200 | ✅ Compatible |
| Zebra | Stripe | ✅ Compatible |
| Xprinter | XP-365B | ✅ Popular |
| JEPSEN | SLM-TI80 | ✅ Compatible |
| Other | ESC/POS genérica | ✅ Soporte |

## Instalación en Windows

### 1. Conectar impresora

#### USB
1. Conecta cable USB a la PC
2. Windows detecta automáticamente
3. Espera a que instale drivers

#### Red
1. Obtén IP de la impresora (manual o DHCP)
2. Accede a `http://192.168.1.XX` (IP de impresora)
3. Configura conexión de red

### 2. Verificar conexión

```powershell
# Ver puertos COM (para USB)
wmic logicaldisk get name

# Ver dispositivos USB
Get-PnpDevice -Class Ports -PresentOnly

# Probar ping a impresora (para red)
ping 192.168.1.XX
```

### 3. Instalar drivers (si no se instalan automáticos)

**Epson TM:**
1. Descarga desde epson.com
2. Instala TM drivers
3. Reinicia

**Star Micronics:**
1. Descarga Star Print Server
2. Instala y reinicia

**Xprinter:**
1. Descarga desde xprinter.es
2. Instala drivers
3. Reinicia

## Configuración en CELUPRO

### Vía interfaz web (Futuro)
- Admin → Configuración → Impresoras
- Selecciona tipo de conexión (USB/Red)
- Selecciona puerto o IP
- Guarda

### Manual (Por ahora)
Edita `backend/utils/thermal_printer.py` y ajusta la conexión:

```python
# Para USB
printer = usb.core.find(idVendor=0x04b8, idProduct=0x0202)  # Epson

# Para Red
printer = Network('192.168.1.50', 9100)  # IP de impresora
```

## Prueba de Impresión

### Test desde PowerShell

```powershell
# 1. Abre Python
python

# 2. Ejecuta:
from utils.thermal_printer import ThermalTicket

ticket = ThermalTicket()
ticket.add_text("PRUEBA DE IMPRESIÓN", size='large', align='center', bold=True)
ticket.add_text("Si ves esto, ¡funciona!")
ticket.cut_paper()

# 3. Envía a impresora (depende de conexión)
datos = ticket.get_bytes()
# ... enviar datos según conexión
```

### Test desde navegador

1. Crea un ingreso de prueba
2. Ve a registros
3. Click "Imprimir Ticket"
4. Verifica que imprima

## Solución de Problemas

### No detecta impresora USB

```powershell
# Reinstalar drivers
Uninstall-PnpDevice -InstanceName [NOMBRE]

# O desde Dispositivos:
1. Conexiones > Impresoras
2. Busca la impresora
3. Click derecho > Desinstalar
4. Desconecta USB
5. Espera 30 segundos
6. Conecta de nuevo
```

### No imprime desde CELUPRO

1. Verifica que funcione desde otra app
   ```
   Notepad → Archivo → Imprimir → [Tu impresora]
   ```

2. Verifica puerto/IP en configuración

3. Revisa logs de backend
   ```
   Ctrl+C en terminal del backend
   Ver último error
   ```

### Problema de conectividad de red

```powershell
# Prueba conexión
ping -a 192.168.1.50

# Si no responde:
# 1. Reinicia impresora
# 2. Verifica que esté en la misma red
# 3. Verifica IP correcta
```

### Impresión cortada o mal formateada

1. Verifica ancho de papel (58mm)
2. Limpia cabezal de impresora
3. Prueba con rollo nuevo de papel
4. Ajusta márgenes en thermal_printer.py

## Librerias Python usadas

```python
# Para USB
pip install pyusb

# Para Red
pip install python-escpos

# Para imagenes (logo)
pip install Pillow

# Ya incluidas en requirements.txt
```

## Configuración de Márgenes

En `thermal_printer.py`, función `add_text()`:

```python
# Ancho de línea (caracteres)
# 58mm = ~32 caracteres
# Ajusta según tu papel
WIDTH = 32
```

## Recepción de Papel

### Ancho estándar: 58mm
- ~32 caracteres por línea (monoespaciado)
- Rollo de 30-50 metros típico
- Costo: $5-10 por rollo

### Dónde comprar
- AliExpress
- Amazon
- Proveedores locales de tiendas
- Distribuidoras de equipos POS

## Mantenimiento

### Limpieza regular
```
1. Apaga impresora
2. Abre compartimento de papel
3. Limpia cabezal con alcohol isopropílico
4. Espera 5 minutos
5. Cierra y enciende
```

### Cambio de papel
```
1. Abre compartimento
2. Retira rollo vacío
3. Inserta rollo nuevo
4. Cierra compartimento
5. Presiona botón feed para alinear
```

## Ejemplo de Script de Prueba

```python
#!/usr/bin/env python
# test_printer.py

from utils.thermal_printer import ThermalTicket, generate_ticket_data

# Crear ticket de prueba
data_ingreso = {
    'numero_ingreso': 'IG-20241115-0001',
    'cliente_nombre': 'Juan',
    'cliente_apellido': 'Pérez',
    'cliente_cedula': '1234567890',
    'cliente_telefono': '3001234567',
    'cliente_direccion': 'Cra 5 #10-20',
    'marca': 'Samsung',
    'modelo': 'Galaxy S24',
    'color': 'Negro',
    'falla_general': 'Pantalla rota, no enciende',
    'tiene_clave': False,
    'fallas': [
        {'nombre': 'Pantalla general', 'valor_reparacion': 50000},
        {'nombre': 'Batería general', 'valor_reparacion': 40000}
    ],
    'valor_total': 90000
}

# Generar comandos ESC/POS
ticket_bytes = generate_ticket_data(data_ingreso)

# Guardar a archivo para inspeccionar
with open('test_ticket.bin', 'wb') as f:
    f.write(ticket_bytes)

print("Ticket generado en test_ticket.bin")
print(f"Tamaño: {len(ticket_bytes)} bytes")

# Para enviar a impresora real:
# from usb.core import find, USBError
# printer = find(idVendor=0x04b8, idProduct=0x0202)
# if printer:
#     printer.write(0x01, ticket_bytes)
# else:
#     print("Impresora no encontrada")
```

## Especificaciones ESC/POS

**Códigos utilizados en CELUPRO:**
- `\x1b\x40` - Inicializar
- `\x1b\x61\x01` - Alinear centro
- `\x1b\x61\x00` - Alinear izquierda
- `\x1b\x61\x02` - Alinear derecha
- `\x1b\x45\x01` - Negrita ON
- `\x1b\x45\x00` - Negrita OFF
- `\x1d\x21\x11` - Tamaño doble
- `\x1d\x56\x01` - Corte de papel

Para documentación completa: [ESC/POS Reference](https://www.epson.com.tw/pos)

## Soporte Adicional

Si tienes problemas específicos con tu impresora:

1. Identifica marca y modelo exacto
2. Busca "ESC/POS" + marca en Google
3. Descarga manual en PDF
4. Verifica códigos específicos de tu modelo

Algunas impresoras tienen variaciones menores.

---

**Versión:** 1.0  
**Última actualización:** Noviembre 2024
