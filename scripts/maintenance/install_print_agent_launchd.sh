#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PYTHON_BIN="${WORKSPACE_ROOT}/.venv/bin/python"
AGENT_SCRIPT="${WORKSPACE_ROOT}/scripts/maintenance/print_agent.py"
PLIST_PATH="${HOME}/Library/LaunchAgents/com.celupro.printagent.plist"

API_URL="http://127.0.0.1:5001/api"
USUARIO="admin"
PASSWORD="admin123"
PRINTER_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url)
      API_URL="${2:-}"
      shift 2
      ;;
    --usuario)
      USUARIO="${2:-}"
      shift 2
      ;;
    --password)
      PASSWORD="${2:-}"
      shift 2
      ;;
    --printer)
      PRINTER_NAME="${2:-}"
      shift 2
      ;;
    --python-bin)
      PYTHON_BIN="${2:-}"
      shift 2
      ;;
    *)
      echo "Argumento no reconocido: $1"
      echo "Uso: $0 [--api-url URL] [--usuario USER] [--password PASS] [--printer NOMBRE] [--python-bin /ruta/python]"
      exit 1
      ;;
  esac
done

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "No se encontró Python ejecutable en: $PYTHON_BIN"
  echo "Crea/activa el entorno virtual primero en ${WORKSPACE_ROOT}/.venv"
  exit 1
fi

if [[ ! -f "$AGENT_SCRIPT" ]]; then
  echo "No se encontró el script del agente en: $AGENT_SCRIPT"
  exit 1
fi

mkdir -p "${HOME}/Library/LaunchAgents"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.celupro.printagent</string>

    <key>ProgramArguments</key>
    <array>
      <string>${PYTHON_BIN}</string>
      <string>${AGENT_SCRIPT}</string>
      <string>--base-url</string>
      <string>${API_URL}</string>
      <string>--usuario</string>
      <string>${USUARIO}</string>
      <string>--password</string>
      <string>${PASSWORD}</string>
      <string>--printer</string>
      <string>${PRINTER_NAME}</string>
      <string>--interval</string>
      <string>2</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>WorkingDirectory</key>
    <string>${WORKSPACE_ROOT}</string>

    <key>StandardOutPath</key>
    <string>/tmp/celupro_print_agent.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/celupro_print_agent.err</string>
  </dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/com.celupro.printagent" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/com.celupro.printagent"
launchctl kickstart -k "gui/$(id -u)/com.celupro.printagent"

echo "Servicio instalado y ejecutándose: com.celupro.printagent"
echo "Logs: /tmp/celupro_print_agent.log y /tmp/celupro_print_agent.err"
echo "Plist: $PLIST_PATH"