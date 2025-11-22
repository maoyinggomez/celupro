#!/usr/bin/env python
"""
Script para iniciar CELUPRO completo (Backend + Frontend)
Ejecutar: python start_all.py
"""

import subprocess
import os
import sys
import time
import webbrowser
from pathlib import Path

# Configurar encoding UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header():
    print(f"\n{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.GREEN}    CELUPRO - Sistema de Reparaciones{Colors.END}")
    print(f"{Colors.CYAN}{'='*60}{Colors.END}\n")

def print_step(step_num, total, message):
    print(f"{Colors.BLUE}[{step_num}/{total}]{Colors.END} {message}")

def check_venv():
    """Verifica que el entorno virtual exista"""
    venv_path = Path("venv")
    if not venv_path.exists():
        print(f"{Colors.RED}Error: No se encontró 'venv'{Colors.END}")
        print("Ejecuta primero: python -m venv venv")
        return False
    return True

def init_database():
    """Inicializa la base de datos"""
    try:
        print_step(1, 4, "Inicializando base de datos...")
        result = subprocess.run([sys.executable, "database/init_db.py"], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print(f"{Colors.GREEN}✓ Base de datos lista{Colors.END}")
            return True
        else:
            print(f"{Colors.YELLOW}Advertencia: {result.stderr}{Colors.END}")
            return True  # Continuar de todas formas
    except Exception as e:
        print(f"{Colors.YELLOW}Advertencia: {e}{Colors.END}")
        return True

def start_backend():
    """Inicia el backend Flask"""
    print_step(2, 4, "Iniciando Backend (Puerto 5000)...")
    
    if sys.platform == "win32":
        # Windows: abrir en nueva ventana
        subprocess.Popen(f'start cmd /k "python backend/app.py"', shell=True)
    else:
        # Linux/Mac: ejecutar en segundo plano
        subprocess.Popen([sys.executable, "backend/app.py"])
    
    # Esperar a que el backend esté listo
    time.sleep(3)
    print(f"{Colors.GREEN}✓ Backend iniciado{Colors.END}")

def start_frontend():
    """Inicia el frontend Flask"""
    print_step(3, 4, "Iniciando Frontend (Puerto 5001)...")
    
    if sys.platform == "win32":
        # Windows: abrir en nueva ventana
        subprocess.Popen(f'start cmd /k "python frontend/server.py"', shell=True)
    else:
        # Linux/Mac: ejecutar en segundo plano
        subprocess.Popen([sys.executable, "frontend/server.py"])
    
    time.sleep(2)
    print(f"{Colors.GREEN}✓ Frontend iniciado{Colors.END}")

def open_browser():
    """Abre el navegador en la app"""
    print_step(4, 4, "Abriendo navegador...")
    time.sleep(2)
    
    try:
        webbrowser.open('http://localhost:3000')
        print(f"{Colors.GREEN}✓ Navegador abierto{Colors.END}")
    except Exception as e:
        print(f"{Colors.YELLOW}No se pudo abrir el navegador automáticamente{Colors.END}")
        print(f"   Abre manualmente: http://localhost:3000")

def main():
    try:
        # Cambiar al directorio del script
        os.chdir(Path(__file__).parent)
        
        print_header()
        
        # Verificar venv
        if not check_venv():
            sys.exit(1)
        
        # Iniciar servicios
        if not init_database():
            sys.exit(1)
        
        start_backend()
        start_frontend()
        open_browser()
        
        print(f"{Colors.CYAN}{'='*60}{Colors.END}")
        print(f"{Colors.GREEN}✓ CELUPRO iniciado correctamente{Colors.END}")
        print(f"{Colors.CYAN}{'='*60}{Colors.END}\n")
        
        print(f"{Colors.BOLD}Acceso:{Colors.END}")
        print(f"  Frontend: {Colors.YELLOW}http://localhost:3000{Colors.END}")
        print(f"  Backend:  {Colors.YELLOW}http://localhost:5000{Colors.END}\n")
        
        print(f"{Colors.BOLD}Para detener:{Colors.END}")
        if sys.platform == "win32":
            print(f"  Cierra las ventanas del Backend y Frontend\n")
        else:
            print(f"  Presiona Ctrl+C\n")
        
        # Mantener el script en ejecución
        print(f"{Colors.YELLOW}El servidor está corriendo...{Colors.END}")
        print(f"{Colors.YELLOW}Presiona Ctrl+C para detener{Colors.END}\n")
        
        while True:
            time.sleep(1)
    
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Deteniendo servicios...{Colors.END}")
        sys.exit(0)
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.END}")
        sys.exit(1)

if __name__ == "__main__":
    main()
