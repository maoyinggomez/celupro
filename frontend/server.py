"""
Servidor para servir archivos estáticos del frontend
"""
from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3000)
