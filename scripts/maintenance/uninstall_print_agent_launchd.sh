#!/usr/bin/env bash
set -euo pipefail

PLIST_PATH="${HOME}/Library/LaunchAgents/com.celupro.printagent.plist"

launchctl bootout "gui/$(id -u)/com.celupro.printagent" >/dev/null 2>&1 || true
launchctl disable "gui/$(id -u)/com.celupro.printagent" >/dev/null 2>&1 || true

if [[ -f "$PLIST_PATH" ]]; then
  rm -f "$PLIST_PATH"
fi

echo "Servicio eliminado: com.celupro.printagent"
