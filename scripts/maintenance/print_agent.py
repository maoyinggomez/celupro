#!/usr/bin/env python3
import argparse
import base64
import os
import shutil
import subprocess
import tempfile
import time
from typing import Optional

import requests


class PrintAgent:
    def __init__(self, base_url: str, usuario: str, password: str, printer_name: str, interval: float):
        self.base_url = base_url.rstrip('/')
        self.usuario = usuario
        self.password = password
        self.printer_name = printer_name.strip()
        self.interval = interval
        self.token: Optional[str] = None
        self.worker_name = self.printer_name or f'AGENT_{os.getenv("COMPUTERNAME", "LOCAL")}'

    def _headers(self):
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }

    def login(self):
        response = requests.post(
            f'{self.base_url}/auth/login',
            json={
                'usuario': self.usuario,
                'contraseña': self.password
            },
            timeout=20
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get('access_token')
        if not token:
            raise RuntimeError('No se obtuvo access_token en login')
        self.token = token

    def claim_job(self):
        self.heartbeat()
        response = requests.post(
            f'{self.base_url}/print-jobs/claim',
            headers=self._headers(),
            json={'printer_name': self.worker_name, 'worker_type': 'agent'},
            timeout=20
        )
        if response.status_code == 401:
            self.login()
            response = requests.post(
                f'{self.base_url}/print-jobs/claim',
                headers=self._headers(),
                json={'printer_name': self.worker_name, 'worker_type': 'agent'},
                timeout=20
            )
        response.raise_for_status()
        payload = response.json()
        return payload.get('job')

    def heartbeat(self):
        try:
            requests.post(
                f'{self.base_url}/print-workers/heartbeat',
                headers=self._headers(),
                json={
                    'worker_name': self.worker_name,
                    'worker_type': 'agent',
                    'printer_name': self.printer_name or self.worker_name
                },
                timeout=10
            )
        except Exception:
            pass

    def get_ticket_bytes(self, ingreso_id: int) -> bytes:
        response = requests.get(
            f'{self.base_url}/ingresos/{ingreso_id}/ticket',
            headers=self._headers(),
            timeout=25
        )
        if response.status_code == 401:
            self.login()
            response = requests.get(
                f'{self.base_url}/ingresos/{ingreso_id}/ticket',
                headers=self._headers(),
                timeout=25
            )
        response.raise_for_status()
        payload = response.json()
        b64_data = payload.get('ticket_data')
        if not b64_data:
            raise RuntimeError('ticket_data vacío en respuesta')
        return base64.b64decode(b64_data)

    def complete_job(self, job_id: int):
        requests.post(
            f'{self.base_url}/print-jobs/{job_id}/complete',
            headers=self._headers(),
            json={},
            timeout=20
        )

    def fail_job(self, job_id: int, error: str):
        requests.post(
            f'{self.base_url}/print-jobs/{job_id}/fail',
            headers=self._headers(),
            json={'error': error[:500]},
            timeout=20
        )

    def print_raw_bytes(self, data: bytes):
        output_file = os.getenv('PRINT_OUTPUT_FILE', '').strip()
        if output_file:
            with open(output_file, 'ab') as f:
                f.write(data)
                f.write(b'\n')
            return

        printer_device = os.getenv('PRINTER_DEVICE_PATH', '').strip()
        if printer_device:
            with open(printer_device, 'wb') as f:
                f.write(data)
            return

        if os.name == 'nt':
            self._print_windows_raw(data)
            return

        self._print_unix_raw(data)

    def _print_windows_raw(self, data: bytes):
        try:
            import win32print  # type: ignore
        except Exception as exc:
            raise RuntimeError('En Windows instala pywin32 para impresión RAW: pip install pywin32') from exc

        printer = self.printer_name or win32print.GetDefaultPrinter()
        if not printer:
            raise RuntimeError('No se encontró impresora predeterminada')

        hprinter = win32print.OpenPrinter(printer)
        try:
            hjob = win32print.StartDocPrinter(hprinter, 1, ('CELUPRO Ticket', None, 'RAW'))
            try:
                win32print.StartPagePrinter(hprinter)
                win32print.WritePrinter(hprinter, data)
                win32print.EndPagePrinter(hprinter)
            finally:
                win32print.EndDocPrinter(hprinter)
        finally:
            win32print.ClosePrinter(hprinter)

    def _print_unix_raw(self, data: bytes):
        lp_cmd = shutil.which('lp')
        lpr_cmd = shutil.which('lpr')

        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(data)
            tmp.flush()
            tmp_path = tmp.name

        try:
            if lp_cmd:
                command = [lp_cmd]
                if self.printer_name:
                    command += ['-d', self.printer_name]
                command += ['-o', 'raw', tmp_path]
                subprocess.run(command, check=True)
                return

            if lpr_cmd:
                command = [lpr_cmd]
                if self.printer_name:
                    command += ['-P', self.printer_name]
                command += ['-l', tmp_path]
                subprocess.run(command, check=True)
                return

            raise RuntimeError('No se encontró comando lp/lpr. Define PRINTER_DEVICE_PATH o instala CUPS.')
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def run(self):
        print('Iniciando agente de impresión CELUPRO...')
        self.login()
        print('Login OK. Esperando trabajos...')

        while True:
            try:
                job = self.claim_job()
                if not job:
                    time.sleep(self.interval)
                    continue

                job_id = int(job['id'])
                ingreso_id = int(job['ingreso_id'])
                print(f'[JOB {job_id}] Procesando ingreso {ingreso_id}')

                ticket_bytes = self.get_ticket_bytes(ingreso_id)
                self.print_raw_bytes(ticket_bytes)
                self.complete_job(job_id)
                print(f'[JOB {job_id}] Impresión completada')
            except KeyboardInterrupt:
                print('Agente detenido por usuario')
                break
            except Exception as exc:
                print(f'Error en agente: {exc}')
                try:
                    if 'job_id' in locals():
                        self.fail_job(job_id, str(exc))
                except Exception:
                    pass
                time.sleep(max(self.interval, 2))


def parse_args():
    parser = argparse.ArgumentParser(description='Agente de impresión remota CELUPRO')
    parser.add_argument('--base-url', default=os.getenv('CELUPRO_API_URL', 'http://127.0.0.1:5001/api'))
    parser.add_argument('--usuario', default=os.getenv('CELUPRO_PRINT_USER', 'admin'))
    parser.add_argument('--password', default=os.getenv('CELUPRO_PRINT_PASSWORD', 'admin123'))
    parser.add_argument('--printer', default=os.getenv('CELUPRO_PRINTER_NAME', ''))
    parser.add_argument('--interval', type=float, default=float(os.getenv('CELUPRO_PRINT_POLL_SECONDS', '2')))
    return parser.parse_args()


def main():
    args = parse_args()
    agent = PrintAgent(
        base_url=args.base_url,
        usuario=args.usuario,
        password=args.password,
        printer_name=args.printer,
        interval=args.interval
    )
    agent.run()


if __name__ == '__main__':
    main()
