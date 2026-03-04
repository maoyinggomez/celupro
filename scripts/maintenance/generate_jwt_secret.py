import argparse
from datetime import datetime
from pathlib import Path
import secrets
import sys


def parse_args():
    parser = argparse.ArgumentParser(
        description="Genera un JWT_SECRET_KEY seguro para CELUPRO"
    )
    parser.add_argument(
        "--bytes",
        type=int,
        default=48,
        help="Cantidad de bytes aleatorios antes de codificar (recomendado: 32-64)."
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Imprime solo el valor secreto (sin prefijo JWT_SECRET_KEY=)."
    )
    parser.add_argument(
        "--update-env",
        type=str,
        default="",
        help="Ruta de archivo .env para escribir/actualizar JWT_SECRET_KEY (ej: backend/.env)."
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Confirma automáticamente la escritura en --update-env (útil en CI/no interactivo)."
    )
    return parser.parse_args()


def confirm_env_update(target: Path, auto_yes: bool):
    if auto_yes:
        return True

    if not sys.stdin.isatty():
        print("Error: ejecución no interactiva. Usa --yes para confirmar --update-env.", file=sys.stderr)
        return False

    prompt = f"Vas a actualizar JWT_SECRET_KEY en {target}. ¿Continuar? [y/N]: "
    answer = input(prompt).strip().lower()
    return answer in ("y", "yes", "s", "si", "sí")


def update_env_file(env_path: str, secret_value: str, auto_yes: bool = False):
    target = Path(env_path).expanduser().resolve()
    target.parent.mkdir(parents=True, exist_ok=True)

    if not confirm_env_update(target, auto_yes):
        print("Operación cancelada.", file=sys.stderr)
        return False

    existing_lines = []
    if target.exists():
        content = target.read_text(encoding="utf-8")
        existing_lines = content.splitlines()

        backup_path = target.with_suffix(target.suffix + f".bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        backup_path.write_text(content, encoding="utf-8")
        print(f"Backup creado: {backup_path}", file=sys.stderr)

    updated_lines = []
    replaced = False
    for line in existing_lines:
        if line.startswith("JWT_SECRET_KEY=") and not replaced:
            updated_lines.append(f"JWT_SECRET_KEY={secret_value}")
            replaced = True
        else:
            updated_lines.append(line)

    if not replaced:
        if updated_lines and updated_lines[-1].strip() != "":
            updated_lines.append("")
        updated_lines.append(f"JWT_SECRET_KEY={secret_value}")

    output = "\n".join(updated_lines).rstrip("\n") + "\n"
    target.write_text(output, encoding="utf-8")
    print(f"JWT_SECRET_KEY actualizado en: {target}", file=sys.stderr)
    return True


def main():
    args = parse_args()

    if args.bytes < 16:
        print("Error: --bytes debe ser >= 16", file=sys.stderr)
        return 1

    secret_value = secrets.token_urlsafe(args.bytes)

    if len(secret_value) < 32:
        print("Error: clave generada demasiado corta. Incrementa --bytes.", file=sys.stderr)
        return 1

    if args.raw:
        print(secret_value)
    else:
        print(f"JWT_SECRET_KEY={secret_value}")

    if args.update_env.strip():
        updated = update_env_file(args.update_env.strip(), secret_value, auto_yes=args.yes)
        if not updated:
            return 1

    print("Longitud generada:", len(secret_value), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
