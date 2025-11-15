"""
Servidor para servir archivos estáticos del frontend con proxy a backend
"""
from flask import Flask, render_template, send_from_directory, request, jsonify
import requests
import os

app = Flask(__name__)

BACKEND_URL = 'http://127.0.0.1:5000'

@app.route('/')
def login():
    return render_template('login.html')

@app.route('/dashboard')
@app.route('/ingreso')
@app.route('/registros')
@app.route('/tecnico')
@app.route('/admin')
def dashboard():
    return render_template('dashboard.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy_api(path):
    """Proxy all API requests to backend server"""
    url = f'{BACKEND_URL}/api/{path}'
    
    # Pasar todos los headers excepto los de Host
    headers = {}
    for key, value in request.headers:
        if key.lower() not in ['host', 'content-length']:
            headers[key] = value
    
    # Asegurar Content-Type correcto
    if 'content-type' not in headers:
        headers['Content-Type'] = 'application/json'
    
    print(f"DEBUG PROXY: {request.method} {path}")
    print(f"  URL: {url}")
    print(f"  Headers: {dict(headers)}")
    
    try:
        if request.method == 'GET':
            resp = requests.get(url, headers=headers, params=request.args)
        elif request.method == 'POST':
            # Obtener el body como data bruta para preservar el content-type
            data = request.get_data()
            resp = requests.post(url, headers=headers, data=data)
        elif request.method == 'PUT':
            # Obtener el body como data bruta
            data = request.get_data()
            resp = requests.put(url, headers=headers, data=data)
        elif request.method == 'DELETE':
            resp = requests.delete(url, headers=headers)
        
        print(f"  Response: {resp.status_code}")
        return resp.content, resp.status_code, {'Content-Type': resp.headers.get('Content-Type', 'application/json')}
    except requests.exceptions.RequestException as e:
        print(f"  ERROR: {e}")
        return jsonify({'error': f'Backend connection error: {str(e)}'}), 503

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=3000, use_reloader=False)
