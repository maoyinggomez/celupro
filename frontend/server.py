"""
Servidor para servir archivos estáticos del frontend con proxy a backend
"""
from flask import Flask, render_template, send_from_directory, request, jsonify
import requests
import os

app = Flask(__name__)

BACKEND_URL = 'http://127.0.0.1:8000'

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
    
    headers = {}
    if request.headers.get('Authorization'):
        headers['Authorization'] = request.headers.get('Authorization')
    if request.headers.get('Content-Type'):
        headers['Content-Type'] = request.headers.get('Content-Type')
    
    try:
        if request.method == 'GET':
            resp = requests.get(url, headers=headers, params=request.args)
        elif request.method == 'POST':
            resp = requests.post(url, headers=headers, json=request.get_json())
        elif request.method == 'PUT':
            resp = requests.put(url, headers=headers, json=request.get_json())
        elif request.method == 'DELETE':
            resp = requests.delete(url, headers=headers)
        
        return resp.content, resp.status_code, {'Content-Type': resp.headers.get('Content-Type', 'application/json')}
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Backend connection error: {str(e)}'}), 503

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
