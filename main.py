#!/usr/bin/env python3
"""
Main script to start CELUPRO application in Replit environment
Launches both backend and frontend servers
"""

import subprocess
import sys
import time
from pathlib import Path

def start_servers():
    """Start both backend and frontend servers"""
    project_root = Path(__file__).parent
    
    # Start backend (port 8000)
    print("Starting backend API server on port 8000...")
    backend_process = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=str(project_root / "backend"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Give backend time to start
    time.sleep(2)
    
    # Start frontend (port 5000)
    print("Starting frontend server on port 5000...")
    frontend_process = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=str(project_root / "frontend"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    print("\n✓ CELUPRO Application Started")
    print("\nAccess the application at:")
    print("  - Web Interface: Port 5000")
    print("  - API Backend: Port 8000")
    print("\nDefault credentials:")
    print("  Username: admin")
    print("  Password: admin123")
    print("\nPress Ctrl+C to stop...\n")
    
    # Monitor processes
    try:
        while True:
            # Check if processes are still running
            if backend_process.poll() is not None:
                print("\n❌ Backend stopped unexpectedly")
                frontend_process.terminate()
                sys.exit(1)
            
            if frontend_process.poll() is not None:
                print("\n❌ Frontend stopped unexpectedly")
                backend_process.terminate()
                sys.exit(1)
            
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n\nStopping servers...")
        backend_process.terminate()
        frontend_process.terminate()
        
        backend_process.wait(timeout=5)
        frontend_process.wait(timeout=5)
        
        print("✓ Servers stopped\n")

if __name__ == "__main__":
    start_servers()
