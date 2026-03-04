import importlib
import os
import sqlite3
import shutil
import sys
import time
from pathlib import Path

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db_dir = tmp_path_factory.mktemp("celupro_test_db")
    db_path = db_dir / "celupro_test.sqlite"

    workspace_root = Path(__file__).resolve().parents[2]
    source_db = workspace_root / "database" / "celupro.db"
    if source_db.exists():
        shutil.copy2(source_db, db_path)

    os.environ["CELUPRO_DB_PATH"] = str(db_path)
    os.environ["CELUPRO_DISABLE_BACKGROUND_WORKERS"] = "1"
    os.environ["JWT_SECRET_KEY"] = "celupro_test_secure_jwt_secret_key_2026"

    backend_root = workspace_root / "backend"

    if str(workspace_root) not in sys.path:
        sys.path.insert(0, str(workspace_root))
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    app_module = importlib.import_module("app")
    importlib.reload(app_module)
    app_module.app.config.update(TESTING=True)

    with app_module.app.test_client() as test_client:
        yield test_client


def login(client, usuario, password):
    response = client.post(
        "/api/auth/login",
        json={"usuario": usuario, "contraseña": password},
    )
    assert response.status_code == 200, response.get_json()
    payload = response.get_json()
    assert payload and payload.get("access_token")
    return payload["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def get_base_ingreso_payload(client, token):
    tecnicos_res = client.get("/api/tecnicos", headers=auth_headers(token))
    assert tecnicos_res.status_code == 200
    tecnicos = tecnicos_res.get_json() or []
    assert tecnicos, "No hay técnicos para pruebas"

    marcas_res = client.get("/api/marcas", headers=auth_headers(token))
    assert marcas_res.status_code == 200
    marcas = marcas_res.get_json() or []
    assert marcas, "No hay marcas para pruebas"

    marca_id = int(marcas[0]["id"])
    modelos_res = client.get(f"/api/marcas/{marca_id}/modelos", headers=auth_headers(token))
    assert modelos_res.status_code == 200
    modelos = modelos_res.get_json() or []
    assert modelos, "No hay modelos para la marca de prueba"

    unique_suffix = int(time.time() * 1000)

    return {
        "tecnico_id": int(tecnicos[0]["id"]),
        "marca_id": marca_id,
        "modelo_id": int(modelos[0]["id"]),
        "cliente_nombre": "Prueba",
        "cliente_apellido": "Calidad",
        "cliente_cedula": str(900000000 + (unique_suffix % 99999999)),
        "cliente_telefono": "3001234567",
        "cliente_direccion": "Calle Test 123",
        "color": "Negro",
        "falla_general": "No carga",
        "valor_total": 50000,
        "estado_apagado": False,
        "tiene_clave": False,
        "garantia": False,
        "estuche": False,
        "bandeja_sim": False,
        "visor_partido": False,
    }


def test_auth_smoke_and_role_guard(client):
    no_auth = client.get("/api/tecnicos")
    assert no_auth.status_code in (401, 422)

    admin_token = login(client, "admin", "admin123")
    me = client.get("/api/auth/me", headers=auth_headers(admin_token))
    assert me.status_code == 200
    body = me.get_json() or {}
    assert body.get("rol") == "admin"


def test_create_ingreso_with_imei_no_visible(client):
    admin_token = login(client, "admin", "admin123")
    payload = get_base_ingreso_payload(client, admin_token)
    payload.update({
        "imei_no_visible": True,
        "imei": "",
    })

    create_res = client.post("/api/ingresos", json=payload, headers=auth_headers(admin_token))
    assert create_res.status_code == 201, create_res.get_json()
    created = create_res.get_json() or {}
    ingreso_id = created.get("id")
    assert ingreso_id

    detail_res = client.get(f"/api/ingresos/{ingreso_id}", headers=auth_headers(admin_token))
    assert detail_res.status_code == 200
    detail = detail_res.get_json() or {}
    assert bool(detail.get("imei_no_visible")) is True


def test_reject_invalid_imei_with_more_than_two_values(client):
    admin_token = login(client, "admin", "admin123")
    payload = get_base_ingreso_payload(client, admin_token)
    payload.update({
        "imei_no_visible": False,
        "imei": "123456789012345 / 223456789012345 / 323456789012345",
    })

    create_res = client.post("/api/ingresos", json=payload, headers=auth_headers(admin_token))
    assert create_res.status_code == 400
    error_body = create_res.get_json() or {}
    assert "máximo 2" in str(error_body.get("error", "")).lower()


def test_empleado_can_update_estado_ingreso(client):
    admin_token = login(client, "admin", "admin123")
    payload = get_base_ingreso_payload(client, admin_token)
    payload.update({
        "imei_no_visible": False,
        "imei": "123456789012345",
    })

    create_res = client.post("/api/ingresos", json=payload, headers=auth_headers(admin_token))
    assert create_res.status_code == 201, create_res.get_json()
    ingreso_id = (create_res.get_json() or {}).get("id")
    assert ingreso_id

    empleado_token = login(client, "empleado", "empleado123")
    update_res = client.put(
        f"/api/ingresos/{ingreso_id}",
        json={"estado_ingreso": "entregado", "estado_pago": "pagado"},
        headers=auth_headers(empleado_token),
    )
    assert update_res.status_code == 200, update_res.get_json()

    detail_res = client.get(f"/api/ingresos/{ingreso_id}", headers=auth_headers(admin_token))
    assert detail_res.status_code == 200
    detail = detail_res.get_json() or {}
    assert str(detail.get("estado_ingreso", "")).lower() == "entregado"


def test_empleado_cannot_edit_sensitive_ingreso_fields(client):
    admin_token = login(client, "admin", "admin123")
    payload = get_base_ingreso_payload(client, admin_token)
    payload.update({
        "imei_no_visible": False,
        "imei": "123456789012345",
    })

    create_res = client.post("/api/ingresos", json=payload, headers=auth_headers(admin_token))
    assert create_res.status_code == 201, create_res.get_json()
    ingreso_id = (create_res.get_json() or {}).get("id")
    assert ingreso_id

    empleado_token = login(client, "empleado", "empleado123")
    forbidden_res = client.put(
        f"/api/ingresos/{ingreso_id}",
        json={"cliente_telefono": "3000000000"},
        headers=auth_headers(empleado_token),
    )
    assert forbidden_res.status_code == 403
    body = forbidden_res.get_json() or {}
    assert "empleado" in str(body.get("error", "")).lower()


def test_login_lockout_after_repeated_failures(client):
    username = f"lock_user_{int(time.time() * 1000)}"
    payload = {"usuario": username, "contraseña": "incorrecta"}

    statuses = []
    for _ in range(6):
        response = client.post("/api/auth/login", json=payload)
        statuses.append(response.status_code)

    assert 429 in statuses, statuses
    assert statuses[-1] == 429


def test_admin_auditoria_filters_pagination_and_export(client):
    admin_token = login(client, "admin", "admin123")

    listing_res = client.get(
        "/api/admin/auditoria?limit=10&page=1&status=success",
        headers=auth_headers(admin_token),
    )
    assert listing_res.status_code == 200, listing_res.get_json()

    listing_payload = listing_res.get_json() or {}
    assert listing_payload.get("success") is True
    assert isinstance(listing_payload.get("data"), list)
    assert int(listing_payload.get("page") or 0) >= 1
    assert int(listing_payload.get("limit") or 0) == 10
    assert "total" in listing_payload
    assert "total_pages" in listing_payload
    assert "has_more" in listing_payload

    export_res = client.get(
        "/api/admin/auditoria/export?status=success",
        headers=auth_headers(admin_token),
    )
    assert export_res.status_code == 200
    content_type = str(export_res.headers.get("Content-Type") or "").lower()
    assert "text/csv" in content_type
    disposition = str(export_res.headers.get("Content-Disposition") or "")
    assert "attachment" in disposition.lower()


def test_audit_retention_cleanup_removes_old_rows(client):
    import app as app_module

    db_path = os.environ.get("CELUPRO_DB_PATH")
    assert db_path

    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            INSERT INTO audit_logs (
                actor_user_id, actor_rol, action, resource_type, resource_id,
                status, ip_address, user_agent, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-400 days'))
            """,
            (1, "admin", "retention_old_test", "system", "1", "success", "127.0.0.1", "pytest", "{}")
        )
        conn.execute(
            """
            INSERT INTO audit_logs (
                actor_user_id, actor_rol, action, resource_type, resource_id,
                status, ip_address, user_agent, details_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (1, "admin", "retention_new_test", "system", "2", "success", "127.0.0.1", "pytest", "{}")
        )
        conn.commit()
    finally:
        conn.close()

    deleted = app_module._run_audit_retention_cleanup(force=True)
    assert isinstance(deleted, int)
    assert deleted >= 1

    conn = sqlite3.connect(db_path)
    try:
        old_row = conn.execute("SELECT id FROM audit_logs WHERE action = 'retention_old_test' LIMIT 1").fetchone()
        new_row = conn.execute("SELECT id FROM audit_logs WHERE action = 'retention_new_test' LIMIT 1").fetchone()
    finally:
        conn.close()

    assert old_row is None
    assert new_row is not None


def test_admin_operacion_resumen_smoke(client):
    admin_token = login(client, "admin", "admin123")

    response = client.get(
        "/api/admin/operacion/resumen",
        headers=auth_headers(admin_token),
    )
    assert response.status_code == 200, response.get_json()

    payload = response.get_json() or {}
    assert payload.get("success") is True
    data = payload.get("data") or {}

    assert isinstance(data.get("audit_last_24h"), dict)
    assert isinstance(data.get("print_queue"), dict)
    assert isinstance(data.get("workers"), dict)
    assert isinstance(data.get("auth"), dict)
    assert isinstance(data.get("recent_critical_events"), list)
