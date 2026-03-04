#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CELUPRO_BASE_URL:-http://127.0.0.1:5001/api}"
CHECK_USER="${CELUPRO_CHECK_USER:-admin}"
CHECK_PASSWORD="${CELUPRO_CHECK_PASSWORD:-admin123}"
TIMEOUT="${CELUPRO_CHECK_TIMEOUT:-10}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --user)
      CHECK_USER="$2"
      shift 2
      ;;
    --password)
      CHECK_PASSWORD="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    *)
      echo "Argumento no reconocido: $1" >&2
      exit 1
      ;;
  esac
done

log() {
  echo "[post-deploy-check] $*"
}

fail() {
  echo "[post-deploy-check] ERROR: $*" >&2
  exit 1
}

json_get() {
  local key="$1"
  python3 - "$key" <<'PY'
import json
import sys

key = sys.argv[1]
try:
    payload = json.load(sys.stdin)
except Exception:
    print("")
    sys.exit(0)

value = payload
for part in key.split('.'):
    if isinstance(value, dict):
        value = value.get(part)
    else:
        value = None
        break

if value is None:
    print("")
elif isinstance(value, (dict, list)):
    print(json.dumps(value, ensure_ascii=False))
else:
    print(str(value))
PY
}

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local auth_token="${4:-}"

  local -a curl_args=(
    -sS
    -m "$TIMEOUT"
    -X "$method"
    -H "Content-Type: application/json"
  )

  if [[ -n "$auth_token" ]]; then
    curl_args+=( -H "Authorization: Bearer $auth_token" )
  fi

  if [[ -n "$body" ]]; then
    curl_args+=( -d "$body" )
  fi

  local response
  response="$(curl "${curl_args[@]}" "$url")" || return 1
  echo "$response"
}

log "Base URL: $BASE_URL"
log "Usuario de chequeo: $CHECK_USER"

LOGIN_PAYLOAD="$(printf '{"usuario":"%s","contraseña":"%s"}' "$CHECK_USER" "$CHECK_PASSWORD")"
LOGIN_RESPONSE="$(request_json POST "$BASE_URL/auth/login" "$LOGIN_PAYLOAD")" || fail "No se pudo conectar al endpoint de login"
TOKEN="$(echo "$LOGIN_RESPONSE" | json_get access_token)"

[[ -n "$TOKEN" ]] || fail "Login sin access_token. Revisa usuario/contraseña y backend"
log "OK login"

ME_RESPONSE="$(request_json GET "$BASE_URL/auth/me" "" "$TOKEN")" || fail "Falló /auth/me"
ME_ROLE="$(echo "$ME_RESPONSE" | json_get rol)"
[[ -n "$ME_ROLE" ]] || fail "Respuesta inválida en /auth/me"
log "OK auth/me (rol=$ME_ROLE)"

CONF_RESPONSE="$(request_json GET "$BASE_URL/configuracion/publica" "" "$TOKEN")" || fail "Falló /configuracion/publica"
NEGOCIO="$(echo "$CONF_RESPONSE" | json_get nombre_negocio)"
[[ -n "$NEGOCIO" ]] || fail "Respuesta inválida en /configuracion/publica"
log "OK configuracion/publica"

if [[ "$ME_ROLE" == "admin" ]]; then
  RESUMEN_RESPONSE="$(request_json GET "$BASE_URL/admin/operacion/resumen" "" "$TOKEN")" || fail "Falló /admin/operacion/resumen"
  RESUMEN_SUCCESS="$(echo "$RESUMEN_RESPONSE" | json_get success)"
  [[ "$RESUMEN_SUCCESS" == "True" || "$RESUMEN_SUCCESS" == "true" ]] || fail "Resumen operativo no exitoso"
  log "OK admin/operacion/resumen"

  AUDIT_RESPONSE="$(request_json GET "$BASE_URL/admin/auditoria?limit=1" "" "$TOKEN")" || fail "Falló /admin/auditoria"
  AUDIT_SUCCESS="$(echo "$AUDIT_RESPONSE" | json_get success)"
  [[ "$AUDIT_SUCCESS" == "True" || "$AUDIT_SUCCESS" == "true" ]] || fail "Auditoría no exitosa"
  log "OK admin/auditoria"
else
  log "Chequeos admin omitidos (usuario no admin)"
fi

log "CHECK COMPLETO: OK"
