#!/usr/bin/env python
"""Lista usuarios en la BD"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))
from backend.models.user import User

print("\n=== USUARIOS EN BD ===\n")
users = User.get_all()
for u in users:
    print(f"  {u['usuario']} - {u['nombre']} ({u['rol']})")
print()
