// Configuración global
const API_BASE = '/api';
let currentUser = null;
let token = null;

// ===== MANEJO DE AUTENTICACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Verificar si ya hay sesión
    checkSession();
});

function handleLogin(e) {
    e.preventDefault();
    
    const usuario = document.getElementById('usuario').value;
    const contraseña = document.getElementById('contraseña').value;
    const errorAlert = document.getElementById('errorAlert');
    
    fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usuario, contraseña })
    })
    .then(response => response.json())
    .then(data => {
        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirigir según rol
            redirectByRole(data.user.rol);
        } else {
            errorAlert.textContent = data.error || 'Error al iniciar sesión';
            errorAlert.classList.remove('d-none');
        }
    })
    .catch(error => {
        errorAlert.textContent = 'Error de conexión: ' + error.message;
        errorAlert.classList.remove('d-none');
    });
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = '/';
}

function checkSession() {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!storedToken || !storedUser) {
        if (location.pathname !== '/') {
            location.href = '/';
        }
        return;
    }
    
    token = storedToken;
    currentUser = JSON.parse(storedUser);
    
    // Mostrar información del usuario
    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = `${currentUser.nombre} (${currentUser.rol})`;
    }
}

function redirectByRole(rol) {
    const routes = {
        'admin': '/dashboard',
        'empleado': '/ingreso',
        'tecnico': '/tecnico'
    };
    
    location.href = routes[rol] || '/dashboard';
}

// ===== FUNCIONES UTILITARIAS =====
async function apiCall(endpoint, options = {}) {
    // Asegurar que tenemos el token actualizado
    const currentToken = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });
    
    if (response.status === 401) {
        handleLogout();
        return;
    }
    
    return await response.json();
}

function showLoading(show = true) {
    const modal = bootstrap.Modal.getInstance(document.getElementById('loadingModal'));
    if (show) {
        new bootstrap.Modal(document.getElementById('loadingModal')).show();
    } else if (modal) {
        modal.hide();
    }
}

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('main').prepend(alertDiv);
    
    setTimeout(() => alertDiv.remove(), 5000);
}
