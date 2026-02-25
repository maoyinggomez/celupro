"""
Utilidad para generar comandos ESC/POS para impresoras térmicas de 58mm
"""

import base64
import io
import re
from PIL import Image
from datetime import datetime

class ThermalTicket:
    """Generador de tickets térmi cos ESC/POS para impresoras de 58mm"""
    
    # Códigos ESC/POS
    INIT = b'\x1b\x40'  # Inicializar impresora
    SET_ALIGN_CENTER = b'\x1b\x61\x01'  # Alinear al centro
    SET_ALIGN_LEFT = b'\x1b\x61\x00'  # Alinear a la izquierda
    SET_ALIGN_RIGHT = b'\x1b\x61\x02'  # Alinear a la derecha
    BOLD_ON = b'\x1b\x45\x01'  # Negrita activada
    BOLD_OFF = b'\x1b\x45\x00'  # Negrita desactivada
    DOUBLE_HEIGHT = b'\x1d\x21\x11'  # Alto doble
    DOUBLE_WIDTH = b'\x1d\x21\x10'  # Ancho doble
    RESET_SIZE = b'\x1d\x21\x00'  # Tamaño normal
    FEED_LINE = b'\x0a'  # Salto de línea
    PAPER_CUT = b'\x1d\x56\x01'  # Corte parcial de papel
    
    def __init__(self, paper_width=58):
        """
        Inicializa el generador de tickets
        paper_width: ancho del papel en mm (default 58)
        """
        self.paper_width = paper_width
        self.content = bytearray()
        self.content.extend(self.INIT)
    
    def add_text(self, text, size='normal', align='left', bold=False):
        """
        Agrega texto al ticket
        size: 'normal', 'double', 'large'
        align: 'left', 'center', 'right'
        bold: activar negrita
        """
        # Alineación
        if align == 'center':
            self.content.extend(self.SET_ALIGN_CENTER)
        elif align == 'right':
            self.content.extend(self.SET_ALIGN_RIGHT)
        else:
            self.content.extend(self.SET_ALIGN_LEFT)
        
        # Tamaño
        if size == 'double':
            self.content.extend(self.DOUBLE_HEIGHT)
            self.content.extend(self.DOUBLE_WIDTH)
        elif size == 'large':
            # Tamaño grande (combinación)
            self.content.extend(b'\x1d\x21\x22')
        
        # Negrita
        if bold:
            self.content.extend(self.BOLD_ON)
        
        # Texto
        self.content.extend(text.encode('utf-8'))
        self.content.extend(self.FEED_LINE)
        
        # Reset de formato
        if bold:
            self.content.extend(self.BOLD_OFF)
        if size in ['double', 'large']:
            self.content.extend(self.RESET_SIZE)
        
        self.content.extend(self.SET_ALIGN_LEFT)
    
    def add_line(self, char='-', length=32):
        """Agrega una línea decorativa"""
        self.content.extend(self.SET_ALIGN_CENTER)
        self.content.extend((char * length).encode('utf-8'))
        self.content.extend(self.FEED_LINE)
        self.content.extend(self.SET_ALIGN_LEFT)
    
    def add_table_row(self, left, right, separator=' ', width=32):
        """Agrega una fila de tabla (dos columnas)"""
        # Calcular espacios
        total_len = len(left) + len(right)
        spaces_needed = width - total_len
        if spaces_needed < 1:
            spaces_needed = 1
        
        row = left + (separator * spaces_needed) + right
        self.content.extend(row.encode('utf-8'))
        self.content.extend(self.FEED_LINE)
    
    def add_logo(self, image_path, width=200, height=100):
        """
        Agrega un logo (imagen) al ticket
        image_path: ruta del archivo PNG
        width, height: dimensiones en píxeles
        """
        try:
            img = Image.open(image_path)
            
            # Redimensionar
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
            
            # Convertir a blanco y negro
            img = img.convert('1')
            
            # Centrar
            self.content.extend(self.SET_ALIGN_CENTER)
            
            # Convertir imagen a ESC/POS bitmap
            bitmap_data = self._image_to_bitmap(img)
            self.content.extend(bitmap_data)
            
            self.content.extend(self.FEED_LINE)
            self.content.extend(self.SET_ALIGN_LEFT)
        except Exception as e:
            print(f"Error al agregar logo: {e}")
    
    def _image_to_bitmap(self, image):
        """Convierte una imagen PIL a comando ESC/POS bitmap"""
        width, height = image.size
        width_bytes = (width + 7) // 8

        raster_data = bytearray()

        for y in range(height):
            for x_byte in range(width_bytes):
                byte = 0
                for bit in range(8):
                    x = (x_byte * 8) + bit
                    if x < width:
                        pixel = image.getpixel((x, y))
                        if pixel == 0:
                            byte |= 1 << (7 - bit)
                raster_data.append(byte)

        x_l = width_bytes & 0xFF
        x_h = (width_bytes >> 8) & 0xFF
        y_l = height & 0xFF
        y_h = (height >> 8) & 0xFF

        command = bytearray()
        command.extend(b'\x1d\x76\x30\x00')
        command.extend(bytes([x_l, x_h, y_l, y_h]))
        command.extend(raster_data)

        return command
    
    def add_newlines(self, count=1):
        """Agrega saltos de línea"""
        for _ in range(count):
            self.content.extend(self.FEED_LINE)
    
    def add_qrcode(self, data, size=3):
        """
        Agrega un código QR
        size: 1-8, tamaño del QR
        """
        # Comando para código QR en ESC/POS
        # Esto es simplificado - en producción se usaría una librería QR
        self.content.extend(self.SET_ALIGN_CENTER)
        self.content.extend(f"QR: {data}".encode('utf-8'))
        self.content.extend(self.FEED_LINE)
        self.content.extend(self.SET_ALIGN_LEFT)
    
    def cut_paper(self):
        """Corta el papel"""
        self.add_newlines(3)
        self.content.extend(self.PAPER_CUT)
    
    def get_bytes(self):
        """Retorna los bytes del ticket"""
        return bytes(self.content)
    
    def get_base64(self):
        """Retorna el contenido en base64 para envío"""
        return base64.b64encode(self.get_bytes()).decode('utf-8')


def _clean_falla_name(value):
    text = str(value or '').strip()
    text = re.sub(r'\s*\(\$\s*[\d\.,]+\)\s*$', '', text).strip()
    return text or 'N/A'

def generate_ticket_data(ingreso_dict, logo_path=None):
    """
    Genera los datos de un ticket completo para un ingreso
    
    Args:
        ingreso_dict: Diccionario con datos del ingreso
        logo_path: Ruta del logo (opcional)
    
    Returns:
        bytes: Comandos ESC/POS
    """
    ticket = ThermalTicket()
    
    # Encabezado con logo
    if logo_path:
        ticket.add_logo(logo_path)
    
    # Nombre del negocio y datos de contacto
    ticket.add_text(ingreso_dict.get('nombre_negocio', 'CELUPRO'), size='large', align='center', bold=True)
    ticket.add_text("Centro de Reparación", size='normal', align='center')
    if ingreso_dict.get('telefono_negocio'):
        ticket.add_text(f"Tel: {ingreso_dict.get('telefono_negocio')}", align='center')
    if ingreso_dict.get('direccion_negocio'):
        ticket.add_text(ingreso_dict.get('direccion_negocio'), align='center')
    elif ingreso_dict.get('email_negocio'):
        ticket.add_text(ingreso_dict.get('email_negocio'), align='center')
    ticket.add_line()
    
    # PARTE PARA EL CLIENTE
    ticket.add_text("RECIBO DE INGRESO", size='double', align='center', bold=True)
    ticket.add_newlines(1)
    
    # Número y fecha
    ticket.add_table_row("Ingreso:", ingreso_dict.get('numero_ingreso', 'N/A'))
    ticket.add_table_row("Fecha:", datetime.now().strftime("%d/%m/%Y %H:%M"))
    ticket.add_line()
    
    # Datos del cliente
    ticket.add_text("DATOS DEL CLIENTE", size='normal', align='left', bold=True)
    cliente_nombre = f"{ingreso_dict.get('cliente_nombre', '')} {ingreso_dict.get('cliente_apellido', '')}"
    ticket.add_table_row("Nombre:", cliente_nombre)
    ticket.add_table_row("Cédula:", ingreso_dict.get('cliente_cedula', ''))
    ticket.add_table_row("Teléfono:", ingreso_dict.get('cliente_telefono', ''))
    ticket.add_table_row("Dirección:", (ingreso_dict.get('cliente_direccion', '') or '')[:25])
    ticket.add_table_row("Fecha/Hora:", datetime.now().strftime("%d/%m/%Y %H:%M"))
    ticket.add_line()
    
    # Datos del equipo
    ticket.add_text("EQUIPO RECIBIDO", size='normal', align='left', bold=True)
    ticket.add_table_row("Marca:", ingreso_dict.get('marca', ''))
    ticket.add_table_row("Modelo:", ingreso_dict.get('modelo', ''))
    ticket.add_table_row("Color:", ingreso_dict.get('color', '') or '')
    ticket.add_table_row("IMEI:", ingreso_dict.get('imei', '') or '')
    ticket.add_table_row("Clave:", "SÍ" if ingreso_dict.get('tiene_clave') else "NO")
    if ingreso_dict.get('tiene_clave'):
        tipo_clave = ingreso_dict.get('tipo_clave', '') or ''
        clave = ingreso_dict.get('clave', '') or ''
        ticket.add_table_row("Tipo:", tipo_clave)
        ticket.add_table_row("Acceso:", clave)
    ticket.add_table_row("Garantía:", "SÍ" if ingreso_dict.get('garantia') else "NO")
    ticket.add_table_row("Apagado:", "SÍ" if ingreso_dict.get('estado_apagado') else "NO")
    ticket.add_table_row("Estuche:", "SÍ" if ingreso_dict.get('estuche') else "NO")
    ticket.add_table_row("Bandeja SIM:", "SÍ" if ingreso_dict.get('bandeja_sim') else "NO")
    if ingreso_dict.get('bandeja_sim'):
        ticket.add_table_row("Color SIM:", ingreso_dict.get('color_bandeja_sim', '') or '')
    ticket.add_table_row("Visor/Glass:", "SÍ" if ingreso_dict.get('visor_partido') else "NO")
    ticket.add_table_row("Botones:", ingreso_dict.get('estado_botones_detalle', '') or '')
    ticket.add_line()
    
    # Valor estimado
    total = ingreso_dict.get('valor_total', 0) or 0
    ticket.add_text(f"VALOR ESTIMADO: ${total:,.0f}", size='normal', align='center', bold=True)
    
    ticket.add_newlines(1)
    ticket.add_text("COMENTARIOS", size='normal', align='left', bold=True)
    ticket.add_text("PANTALLAS NO TIENEN GARANTIA", align='center', bold=True)
    ticket.add_text("YA QUE ES UN CRISTAL Y DEPENDE", align='center', bold=True)
    ticket.add_text("DEL CUIDADOS DEL CLIENTE.", align='center', bold=True)
    ticket.add_newlines(1)
    ticket.add_text("LA CONTRASEÑA SE SOLICITA PARA", align='center', bold=True)
    ticket.add_text("HACER REVISION DE SU TELEFONO", align='center', bold=True)
    ticket.add_text("Y GARANTIZAR FUNCIONAMIENTO.", align='center', bold=True)
    ticket.add_newlines(1)
    ticket.add_text("PASADOS 60 DIAS NO SE RESPONDE", align='center', bold=True)
    ticket.add_text("POR EQUIPOS ABANDONADOS.", align='center', bold=True)
    
    # LÍNEA DE CORTE
    ticket.add_newlines(2)
    ticket.add_line('=', 32)
    ticket.add_text("CORTE AQUÍ", align='center')
    ticket.add_line('=', 32)
    ticket.add_newlines(2)
    
    # PARTE PARA EL TÉCNICO
    ticket.add_text("INGRESO TÉCNICO", size='double', align='center', bold=True)
    ticket.add_newlines(1)
    
    # Número y fecha
    ticket.add_table_row("Ingreso:", ingreso_dict.get('numero_ingreso', 'N/A'))
    ticket.add_table_row("Fecha:", datetime.now().strftime("%d/%m/%Y %H:%M"))
    ticket.add_line()
    
    # Datos del cliente
    ticket.add_text("CLIENTE", size='normal', align='left', bold=True)
    ticket.add_table_row("Nombre:", cliente_nombre)
    ticket.add_table_row("Cédula:", ingreso_dict.get('cliente_cedula', ''))
    ticket.add_table_row("Teléfono:", ingreso_dict.get('cliente_telefono', ''))
    ticket.add_table_row("Dirección:", (ingreso_dict.get('cliente_direccion', '') or '')[:25])
    ticket.add_table_row("Fecha/Hora:", datetime.now().strftime("%d/%m/%Y %H:%M"))
    ticket.add_line()
    
    # Datos del equipo
    ticket.add_text("EQUIPO", size='normal', align='left', bold=True)
    ticket.add_table_row("Marca:", ingreso_dict.get('marca', ''))
    ticket.add_table_row("Modelo:", ingreso_dict.get('modelo', ''))
    ticket.add_table_row("Color:", ingreso_dict.get('color', '') or '')
    ticket.add_table_row("IMEI:", ingreso_dict.get('imei', '') or '')
    ticket.add_table_row("Clave:", "SÍ" if ingreso_dict.get('tiene_clave') else "NO")
    if ingreso_dict.get('tiene_clave'):
        tipo_clave = ingreso_dict.get('tipo_clave', '') or ''
        clave = ingreso_dict.get('clave', '') or ''
        ticket.add_table_row("Tipo:", tipo_clave)
        ticket.add_table_row("Acceso:", clave)
    ticket.add_table_row("Garantía:", "SÍ" if ingreso_dict.get('garantia') else "NO")
    ticket.add_table_row("Apagado:", "SÍ" if ingreso_dict.get('estado_apagado') else "NO")
    ticket.add_table_row("Estuche:", "SÍ" if ingreso_dict.get('estuche') else "NO")
    ticket.add_table_row("Bandeja SIM:", "SÍ" if ingreso_dict.get('bandeja_sim') else "NO")
    if ingreso_dict.get('bandeja_sim'):
        ticket.add_table_row("Color SIM:", ingreso_dict.get('color_bandeja_sim', '') or '')
    ticket.add_table_row("Visor/Glass:", "SÍ" if ingreso_dict.get('visor_partido') else "NO")
    ticket.add_table_row("Botones:", ingreso_dict.get('estado_botones_detalle', '') or '')
    ticket.add_line()
    
    # Estado del equipo
    ticket.add_text("ESTADO DEL EQUIPO", size='normal', align='left', bold=True)
    ticket.add_table_row("Display:", "OK" if ingreso_dict.get('estado_display') else "MAL")
    ticket.add_table_row("Táctil:", "OK" if ingreso_dict.get('estado_tactil') else "MAL")
    ticket.add_table_row("Botones:", "OK" if ingreso_dict.get('estado_botones') else "MAL")
    ticket.add_table_row("Apagado:", "OK" if ingreso_dict.get('estado_apagado') else "MAL")
    ticket.add_line()
    
    # Fallas
    if ingreso_dict.get('fallas'):
        ticket.add_text("FALLAS DIAGNOSTICADAS", size='normal', align='left', bold=True)
        for falla in ingreso_dict['fallas']:
            falla_text = _clean_falla_name((falla or {}).get('nombre'))
            ticket.add_text(f"• {falla_text}")
        ticket.add_line()
    
    # Notas
    if ingreso_dict.get('falla_general'):
        ticket.add_text("DETALLE", size='normal', align='left', bold=True)
        ticket.add_text(ingreso_dict['falla_general'][:50])
        ticket.add_line()
    
    # Total
    ticket.add_text(f"VALOR TOTAL: ${total:,.0f}", size='large', align='center', bold=True)
    
    ticket.add_newlines(2)
    ticket.add_text("Técnico: ____________________", align='left')
    ticket.add_text("Fecha: ____/____/____", align='left')
    
    ticket.cut_paper()
    
    return ticket.get_bytes()
