#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR/backend"

if [[ -f "../.venv/bin/activate" ]]; then
  source ../.venv/bin/activate
fi

export PIP_DISABLE_PIP_VERSION_CHECK=1

if ! python3 -c "import pytest" >/dev/null 2>&1; then
  echo "Instalando dependencias de pruebas..."
  python3 -m pip install -r requirements-dev.txt >/dev/null
fi

pytest -q tests/test_smoke_api.py
