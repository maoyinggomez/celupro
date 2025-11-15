"""
Script para iniciar la aplicación CELUPRO completa
Ejecuta backend y frontend automáticamente
"""

import subprocess
import os
import sys
import time
from pathlib import Path

# Configurar encoding UTF-8 para Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Colores para terminal
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def get_local_ip():
    """Obtiene la IP local de la máquina"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

def setup_environment():
    """Configura el entorno virtual y dependencias"""
    print(f"\n{Colors.CYAN}=== CONFIGURANDO ENTORNO ==={Colors.END}\n")
    
    project_root = Path(__file__).parent
    os.chdir(project_root)
    
    # Crear venv si no existe
    venv_path = project_root / "venv"
    if not venv_path.exists():
        print(f"{Colors.YELLOW}Creando entorno virtual...{Colors.END}")
        subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
        print(f"{Colors.GREEN}✓ Entorno virtual creado{Colors.END}")
    
    # Activar venv y instalar dependencias
    if sys.platform == "win32":
        activate_cmd = str(venv_path / "Scripts" / "activate.bat")
        pip_cmd = str(venv_path / "Scripts" / "pip.exe")
    else:
        activate_cmd = str(venv_path / "bin" / "activate")
        pip_cmd = str(venv_path / "bin" / "pip")
    
    print(f"{Colors.YELLOW}Instalando dependencias del backend...{Colors.END}")
    backend_requirements = project_root / "backend" / "requirements.txt"
    subprocess.run([pip_cmd, "install", "-q", "-r", str(backend_requirements)], check=False)
    print(f"{Colors.GREEN}✓ Dependencias instaladas{Colors.END}")
    
    # Inicializar base de datos
    print(f"{Colors.YELLOW}Inicializando base de datos...{Colors.END}")
    os.chdir(project_root / "backend")
    subprocess.run([
        pip_cmd.replace("pip.exe", "python.exe").replace("\\Scripts\\pip", "\\Scripts\\python"),
        "-c",
        "from database.init_db import init_db; init_db()"
    ], check=False)
    os.chdir(project_root)
    print(f"{Colors.GREEN}✓ Base de datos lista{Colors.END}")

def start_backend():
    """Inicia el servidor backend"""
    backend_dir = Path(__file__).parent / "backend"
    project_root = Path(__file__).parent
    os.chdir(backend_dir)
    
    print(f"\n{Colors.BLUE}Iniciando backend (Puerto 5000)...{Colors.END}")
    
    if sys.platform == "win32":
        python_exe = str(project_root / "venv" / "Scripts" / "python.exe")
    else:
        python_exe = str(project_root / "venv" / "bin" / "python")
    
    return subprocess.Popen([python_exe, "app.py"])

def start_frontend():
    """Inicia el servidor frontend"""
    frontend_dir = Path(__file__).parent / "frontend"
    project_root = Path(__file__).parent
    os.chdir(frontend_dir)
    
    print(f"{Colors.BLUE}Iniciando frontend (Puerto 3000)...{Colors.END}")
    
    if sys.platform == "win32":
        python_exe = str(project_root / "venv" / "Scripts" / "python.exe")
    else:
        python_exe = str(project_root / "venv" / "bin" / "python")
    
    return subprocess.Popen([python_exe, "server.py"])

def main():
    """Función principal"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}")
    print("""
    ╔═══════════════════════════════════╗
    ║         CELUPRO 🔧📱             ║
    ║  Centro de Reparación de Celulares ║
    ╚═══════════════════════════════════╝
    """)
    print(Colors.END)
    
    try:
        # Configurar entorno
        setup_environment()
        
        # Iniciar servidores
        print(f"\n{Colors.CYAN}=== INICIANDO SERVIDORES ==={Colors.END}\n")
        
        backend_process = start_backend()
        time.sleep(2)  # Esperar a que el backend inicie
        frontend_process = start_frontend()
        
        # Obtener IP local
        local_ip = get_local_ip()
        
        # Mostrar información
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ APLICACIÓN INICIADA{Colors.END}\n")
        
        print(f"{Colors.BOLD}URLs de acceso:{Colors.END}")
        print(f"  {Colors.CYAN}Local:{Colors.END}        http://localhost:3000")
        print(f"  {Colors.CYAN}Red Local:{Colors.END}     http://{local_ip}:3000")
        print(f"  {Colors.CYAN}API:{Colors.END}           http://localhost:5000/api")
        
        print(f"\n{Colors.BOLD}Credenciales por defecto:{Colors.END}")
        print(f"  {Colors.CYAN}Usuario:{Colors.END}        admin")
        print(f"  {Colors.CYAN}Contraseña:{Colors.END}     admin123")
        
        print(f"\n{Colors.YELLOW}Presiona Ctrl+C para detener...{Colors.END}\n")
        
        # Mantener procesos activos
        while True:
            time.sleep(1)
            
            # Verificar si los procesos siguen corriendo
            if backend_process.poll() is not None:
                print(f"\n{Colors.RED}❌ Backend se detuvo inesperadamente{Colors.END}")
                break
            
            if frontend_process.poll() is not None:
                print(f"\n{Colors.RED}❌ Frontend se detuvo inesperadamente{Colors.END}")
                break
    
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}Deteniendo servidores...{Colors.END}\n")
        
        if 'backend_process' in locals():
            backend_process.terminate()
            backend_process.wait()
        
        if 'frontend_process' in locals():
            frontend_process.terminate()
            frontend_process.wait()
        
        print(f"{Colors.GREEN}✓ Aplicación detenida{Colors.END}\n")
    
    except Exception as e:
        print(f"\n{Colors.RED}Error: {str(e)}{Colors.END}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
