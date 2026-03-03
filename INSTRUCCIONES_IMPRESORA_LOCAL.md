# Configurar Impresora Local USB (Windows) - Guía Simplificada

## Resumen Rápido
Ya **no necesitas URLs complicadas ni software especial** en el Windows. Solo abre este sistema en el navegador del PC con la impresora USB, presiona un botón y **listo**.

---

## Paso a Paso

### 1. **En la PC con la impresora USB**
   - Abre un navegador web (Chrome, Edge, Firefox)
   - Escribe la dirección: `http://192.168.33.141:3000` 
     - (Cambia `192.168.33.141` por la IP de tu servidor si es diferente)
   - Presiona Enter
   - Si aparece login, ingresa con usuario **admin**

### 2. **Activa este navegador como impresora**
   - Una vez logged in como admin, ve a la sección **Admin → Impresión**
   - Verás un cuadro azul que dice: _"Convertir este navegador en impresora local"_
   - **Presiona el botón verde**: `✓ Usar este navegador como impresora`
   
   ```
   ┌─────────────────────────────────────────────────┐
   │ 🖥️  Convertir este navegador en impresora local  │
   │                                                     │
   │ Si abres esta página en el PC con la impresora  │
   │ USB conectada, presiona el botón de abajo para  │
   │ convertir ese navegador en impresora local.    │
   │                                                     │
   │ [✓ Usar este navegador como impresora]         │
   └─────────────────────────────────────────────────┘
   ```

### 3. **Verifica que está conectado**
   - Deberías ver en la sección _"Configuración de Impresión"_ un mensaje verde: 
     - 🟢 **CONECTADA**
   - En el dropdown _"Impresora local predeterminada"_ verás seleccionada algo como:
     - `BROWSER_WIN32_xxxx (navegador local)`

### 4. **Ahora los empleados pueden imprimir**
   - Desde el sistema de ingresos normal (en cualquier PC):
     - Presiona **Imprimir** en un ticket
     - El sistema automáticamente enviará el ticket a **la PC con la impresora**
     - Se abrirá el diálogo de impresora en ese navegador
     - Confirma y **¡listo, imprime!**

---

## ¿Qué Pasa Internamente?

```
1. Windows PC abre navegador → Admin Panel
2. Admin presiona botón "Usar este navegador"
   ↓
3. Sistema marca este navegador como "impresora local"
4. Navegador inicia a "escuchar" tickets cada 3 segundos
5. Empleado en otra PC presiona "Imprimir"
6. Ticket aparece en el navegador del Windows
7. Se abre el diálogo de impresora nativa de Windows
8. Admin/Usuario confirma impresora USB → ¡Imprime!
```

---

## Requisitos

- ✅ Windows PC con **impresora USB** conectada
- ✅ Navegador web (Chrome, Edge, Firefox, etc.)
- ✅ **Conexión a la misma red** que el servidor
- ✅ Usuario **admin** en el sistema
- ❌ **NO necesitas** archivos de proyecto ni software especial


---

## Solución de Problemas

### **"No puedo abrir la URL"**
- Verifica que escribiste la IP correcta (pregunta al técnico)
- Intenta hacer ping: `ping 192.168.33.141` en Cmd
- Comprueba que la PC está en la misma red WiFi/Ethernet

### **"Presioné el botón pero no aparece en verde"**
- Espera 5 segundos y recarga la página (Ctrl+R)
- El navegador debe estar activo y con esta pestaña abierta
- Verifica que escribiste **admin** en login, no otro usuario

### **"Imprimo pero no aparece nada"**
- Asegúrate de que la impresora USB está encendida y conectada
- En la PC Windows, ve a **Configurar → Dispositivos → Impresoras y escáneres**
- Verifica que tu impresora aparece en la lista
- Cuando imprimes desde el sistema, debe aparecer un diálogo de impresora en el navegador

### **"El diálogo de impresora no sale"**
- Revisa que **Pop-ups no estén bloqueados** en el navegador
- Haz clic en el icono de Pop-ups bloqueados y permite para este sitio
- Intenta de nuevo

---

## Configuración Avanzada (Opcional)

### **Cambiar tamaño del papel**
En **Admin → Impresión → Papel y Márgenes** puedes ajustar:
- Ancho (mm): 58 típicamente para térmicas
- Largo (mm): 150-200 típicamente
- Márgenes (mm): déjalo en 2-3

### **Cambiar tamaño de letra**
En la misma sección hay **Tamaño de Letra (zoom %)** para agrandar o achicar el ticket.

---

## Notas Importantes

- **El navegador debe estar abierto** en el Windows con impresora. Si lo cierras, deja de funcionar.
- **No necesitas admin activo** en el Windows, solo que el navegador esté abierto.
- **Cada PC con impresora** necesita su propio navegador activo (puedes tener múltiples).
- **Los tickets se imprimen automáticamente** cuando empleados presionan el botón, sin previsualización.

---

¿Necesitas ayuda? Contacta al técnico.
